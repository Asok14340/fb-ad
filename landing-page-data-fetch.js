// Global variable to store the access token
let accessToken = null;
let allAdAccounts = []; // Store all ad accounts here to prevent flickering

// Load the Facebook SDK
window.fbAsyncInit = function() {
    FB.init({
        appId: '1232378337671586', // Replace with your Facebook App ID
        cookie: true,
        xfbml: true,
        version: 'v12.0'
    });
};

// Load the Facebook SDK asynchronously
(function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) { return; }
    js = d.createElement(s); js.id = id;
    js.src = "https://connect.facebook.net/en_US/sdk.js";
    fjs.parentNode.insertBefore(js, fjs);
}(document, 'script', 'facebook-jssdk'));

// Function to authenticate with Facebook and fetch ad accounts
function fetchFacebookData() {
    if (typeof FB === 'undefined' || !FB) {
        console.error('Facebook SDK not loaded. Please check your connection and try again.');
        return;
    }

    FB.login(function(response) {
        if (response.authResponse) {
            // Store access token in both variable and localStorage
            accessToken = response.authResponse.accessToken;
            localStorage.setItem('fbAccessToken', accessToken); 
            // Fetch ad accounts after successful login
            fetchAdAccounts();
        } else {
            console.error('User cancelled login or did not fully authorize.');
        }
    }, {scope: 'ads_management,ads_read'});
}

// Function to fetch ad accounts and handle pagination
function fetchAdAccounts(url = '/me/adaccounts?fields=id,name&limit=500') {
    FB.api(url, 'GET', {}, function(response) {
        if (response && !response.error) {
            allAdAccounts = [...allAdAccounts, ...response.data]; // Append new accounts to the global list
            populateAdAccountDropdown(allAdAccounts); // Populate the dropdown with the updated list

            if (response.paging && response.paging.next) {
                fetchAdAccounts(response.paging.next); // Fetch the next page
            }
        } else {
            console.error('Error fetching ad accounts:', response.error);
        }
    });
}

// Function to populate dropdown with ad accounts
function populateAdAccountDropdown(adAccounts) {
    const adAccountSelect = document.getElementById('ad-account-select');
    adAccountSelect.innerHTML = ''; // Clear previous options

    adAccounts.forEach(account => {
        const option = document.createElement('option');
        option.value = account.id;
        option.text = `${account.name} (ID: ${account.id})`;
        adAccountSelect.appendChild(option);
    });

    document.getElementById('ad-account-container').style.display = 'block';
}

// Function to fetch landing page URL insights data for the selected ad account
function fetchLandingPageUrlInsights(url = null) {
    const adAccountId = document.getElementById('ad-account-select').value;
    const sinceDate = document.getElementById('since').value;
    const untilDate = document.getElementById('until').value;

    if (!adAccountId) {
        alert('Please select an ad account.');
        return;
    }

    if (!sinceDate || !untilDate) {
        alert("Please select both 'From' and 'To' dates.");
        return;
    }

    // Check if access token is already stored in the variable, otherwise fetch from localStorage
    if (!accessToken) {
        accessToken = localStorage.getItem('fbAccessToken');
        if (!accessToken) {
            fetchFacebookData(); // If no token, prompt login
            return;
        }
    }

    // Construct the API query to fetch landing page URL data
    const query = url || 
        `/${adAccountId}/insights?fields=clicks,video_p25_watched_actions,actions,spend&time_range={'since':'${sinceDate}','until':'${untilDate}'}&level=campaign&breakdowns=link_url_asset&sort=spend_descending&limit=500&access_token=${accessToken}`;

    // Fetch data from the Facebook API
    FB.api(
        query,
        'GET',
        {},
        function (response) {
            if (response && !response.error) {
                console.log(response); // Debugging: View the response data in the console
                const groupedData = groupDataByLandingPageUrl(response.data); // Group data by landing page URL
                displayLandingPageUrlData(groupedData); // Call the function to display data
            } else {
                console.error('Error fetching landing page URL insights:', response.error);
            }
        }
    );
}


// Function to group data by landing page URL (website_url inside link_url_asset)
// Function to group data by landing page URL (website_url inside link_url_asset)
// and prepare the action types for their own columns
function groupDataByLandingPageUrl(data) {
    const grouped = {};
    const actionTypes = new Set(); // Track all unique action types

    data.forEach(item => {
        // Extract website_url from link_url_asset, or assign 'Unknown' if it doesn't exist
        const websiteUrl = item.link_url_asset?.website_url || 'Unknown';

        if (!grouped[websiteUrl]) {
            grouped[websiteUrl] = {
                clicks: 0,
                video_views: 0,
                spend: 0,
                actions: {}
            };
        }

        // Accumulate clicks, video views, spend
        grouped[websiteUrl].clicks += parseInt(item.clicks || 0);
        grouped[websiteUrl].video_views += parseInt(item.video_p25_watched_actions?.[0]?.value || 0);
        grouped[websiteUrl].spend += parseFloat(item.spend || 0);

        // Accumulate actions and track unique action types
        item.actions?.forEach(action => {
            const actionType = action.action_type;

            // Add action type to the set of unique action types
            actionTypes.add(actionType);

            if (!grouped[websiteUrl].actions[actionType]) {
                grouped[websiteUrl].actions[actionType] = 0;
            }
            grouped[websiteUrl].actions[actionType] += parseInt(action.value || 0);
        });
    });

    // Return grouped data as an array for easier display, along with the action types
    return {
        groupedData: Object.entries(grouped).map(([url, metrics]) => ({ url, ...metrics })),
        actionTypes: Array.from(actionTypes) // Convert Set to array
    };
}

// Function to display landing page URL data in the table
// Function to display landing page URL data in the table with dynamic action columns
function displayLandingPageUrlData(data) {
    const { groupedData, actionTypes } = data; // Destructure grouped data and action types
    const tableHead = document.getElementById('landing-page-url-table-head');
    const tableBody = document.getElementById('landing-page-url-table-body');

    tableHead.innerHTML = ''; // Clear existing headers
    tableBody.innerHTML = ''; // Clear existing data

    // Create table headers
    const headers = ['Landing Page URL', 'Clicks', 'Video Views (25% Watched)', 'Spend', ...actionTypes];
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.className = 'px-4 py-2 text-left font-medium table-header';
        th.textContent = header;
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // Create table rows for each landing page URL
    groupedData.forEach(item => {
        const row = document.createElement('tr');
        row.classList.add('hover:bg-blue-50');

        // Helper function to create a table cell
        const createCell = (text) => {
            const cell = document.createElement('td');
            cell.textContent = text;
            cell.classList.add('px-4', 'py-2', 'alt-column');
            return cell;
        };

        // Standard columns: Landing Page URL, Clicks, Video Views, Spend
        row.appendChild(createCell(item.url));
        row.appendChild(createCell(item.clicks));
        row.appendChild(createCell(item.video_views));
        row.appendChild(createCell(item.spend.toFixed(2)));

        // Action columns: dynamically populate columns for each action type
        actionTypes.forEach(actionType => {
            const actionValue = item.actions[actionType] || 0; // Default to 0 if the action type doesn't exist for this URL
            row.appendChild(createCell(actionValue));
        });

        tableBody.appendChild(row);
    });

    document.getElementById('landing-page-url-table-container').style.display = 'block';
}




// // Global variable to store the access token
// let accessToken = null;
// let allAdAccounts = []; // Store all ad accounts here to prevent flickering

// // Load the Facebook SDK
// window.fbAsyncInit = function() {
//     FB.init({
//         appId: '1232378337671586', // Replace with your Facebook App ID
//         cookie: true,
//         xfbml: true,
//         version: 'v12.0'
//     });
// };

// // Load the Facebook SDK asynchronously
// (function(d, s, id) {
//     var js, fjs = d.getElementsByTagName(s)[0];
//     if (d.getElementById(id)) { return; }
//     js = d.createElement(s); js.id = id;
//     js.src = "https://connect.facebook.net/en_US/sdk.js";
//     fjs.parentNode.insertBefore(js, fjs);
// }(document, 'script', 'facebook-jssdk'));

// // Function to authenticate with Facebook and fetch ad accounts
// function fetchFacebookData() {
//     if (typeof FB === 'undefined' || !FB) {
//         console.error('Facebook SDK not loaded. Please check your connection and try again.');
//         return;
//     }

//     FB.login(function(response) {
//         if (response.authResponse) {
//             // Store access token in both variable and localStorage
//             accessToken = response.authResponse.accessToken;
//             localStorage.setItem('fbAccessToken', accessToken); 
//             // Fetch ad accounts after successful login
//             fetchAdAccounts();
//         } else {
//             console.error('User cancelled login or did not fully authorize.');
//         }
//     }, {scope: 'ads_management,ads_read'});
// }

// // Function to fetch ad accounts and handle pagination
// function fetchAdAccounts(url = '/me/adaccounts?fields=id,name') {
//     FB.api(url, 'GET', {}, function(response) {
//         if (response && !response.error) {
//             allAdAccounts = [...allAdAccounts, ...response.data]; // Append new accounts to the global list
//             populateAdAccountDropdown(allAdAccounts); // Populate the dropdown with the updated list

//             if (response.paging && response.paging.next) {
//                 fetchAdAccounts(response.paging.next); // Fetch the next page
//             }
//         } else {
//             console.error('Error fetching ad accounts:', response.error);
//         }
//     });
// }

// // Function to populate dropdown with ad accounts
// function populateAdAccountDropdown(adAccounts) {
//     const adAccountSelect = document.getElementById('ad-account-select');
//     adAccountSelect.innerHTML = ''; // Clear previous options

//     adAccounts.forEach(account => {
//         const option = document.createElement('option');
//         option.value = account.id;
//         option.text = `${account.name} (ID: ${account.id})`;
//         adAccountSelect.appendChild(option);
//     });

//     document.getElementById('ad-account-container').style.display = 'block';
// }

// // Function to fetch total account spend (without breakdown)
// function fetchTotalAccountSpend(adAccountId, sinceDate, untilDate) {
//     const query = `/${adAccountId}/insights?fields=spend&time_range={'since':'${sinceDate}','until':'${untilDate}'}&level=account&access_token=${accessToken}`;
    
//     FB.api(query, 'GET', {}, function(response) {
//         if (response && !response.error) {
//             const totalSpend = response.data[0]?.spend || 0;
//             console.log('Total account spend:', totalSpend);
//             displayTotalSpend(totalSpend); // Display total spend in UI if needed
//         } else {
//             console.error('Error fetching total account spend:', response.error);
//         }
//     });
// }

// // Function to fetch campaign-level insights with breakdown by link_url_asset and handle pagination
// function fetchCampaignInsights(url = null) {
//     const adAccountId = document.getElementById('ad-account-select').value;
//     const sinceDate = document.getElementById('since').value;
//     const untilDate = document.getElementById('until').value;

//     // Construct the API query to fetch campaign insights with breakdown by link_url_asset
//     const query = url || `/${adAccountId}/insights?fields=campaign_name,campaign_id,clicks,video_p25_watched_actions,actions,spend&time_range={'since':'${sinceDate}','until':'${untilDate}'}&level=campaign&breakdowns=link_url_asset&limit=100&access_token=${accessToken}&action_attribution_windows=['1d_click','7d_click']`;

//     FB.api(query, 'GET', {}, function(response) {
//         if (response && !response.error) {
//             processCampaignInsights(response.data); // Process the data and display it

//             // If there's more data, paginate and fetch the next set
//             if (response.paging && response.paging.next) {
//                 fetchCampaignInsights(response.paging.next);
//             }
//         } else {
//             console.error('Error fetching campaign insights:', response.error);
//         }
//     });
// }

// // Function to group data by landing page URL (website_url inside link_url_asset)
// // and prepare the action types for their own columns
// function groupDataByLandingPageUrl(data) {
//     const grouped = {};
//     const actionTypes = new Set(); // Track all unique action types

//     data.forEach(item => {
//         // Extract website_url from link_url_asset, or assign 'Unknown' if it doesn't exist
//         const websiteUrl = item.link_url_asset?.website_url || 'Unknown';

//         if (!grouped[websiteUrl]) {
//             grouped[websiteUrl] = {
//                 clicks: 0,
//                 video_views: 0,
//                 spend: 0,
//                 actions: {}
//             };
//         }

//         // Accumulate clicks, video views, spend
//         grouped[websiteUrl].clicks += parseInt(item.clicks || 0);
//         grouped[websiteUrl].video_views += parseInt(item.video_p25_watched_actions?.[0]?.value || 0);
//         grouped[websiteUrl].spend += parseFloat(item.spend || 0);

//         // Accumulate actions and track unique action types
//         item.actions?.forEach(action => {
//             const actionType = action.action_type;

//             // Add action type to the set of unique action types
//             actionTypes.add(actionType);

//             if (!grouped[websiteUrl].actions[actionType]) {
//                 grouped[websiteUrl].actions[actionType] = 0;
//             }
//             grouped[websiteUrl].actions[actionType] += parseInt(action.value || 0);
//         });
//     });

//     // Return grouped data as an array for easier display, along with the action types
//     return {
//         groupedData: Object.entries(grouped).map(([url, metrics]) => ({ url, ...metrics })),
//         actionTypes: Array.from(actionTypes) // Convert Set to array
//     };
// }

// // Function to display landing page URL data in the table with dynamic action columns and a summary row
// function displayLandingPageUrlData(data) {
//     const { groupedData, actionTypes } = data; // Destructure grouped data and action types
//     const tableHead = document.getElementById('landing-page-url-table-head');
//     const tableBody = document.getElementById('landing-page-url-table-body');

//     tableHead.innerHTML = ''; // Clear existing headers
//     tableBody.innerHTML = ''; // Clear existing data

//     // Initialize totals for the summary row
//     const totals = {
//         clicks: 0,
//         video_views: 0,
//         spend: 0,
//         actions: {}
//     };

//     // Create table headers
//     const headers = ['Landing Page URL', 'Clicks', 'Video Views (25% Watched)', 'Spend', ...actionTypes];
//     const headerRow = document.createElement('tr');
//     headers.forEach(header => {
//         const th = document.createElement('th');
//         th.className = 'px-4 py-2 text-left font-medium table-header';
//         th.textContent = header;
//         headerRow.appendChild(th);
//     });
//     tableHead.appendChild(headerRow);

//     // Create table rows for each landing page URL
//     groupedData.forEach(item => {
//         const row = document.createElement('tr');
//         row.classList.add('hover:bg-blue-50');

//         // Helper function to create a table cell
//         const createCell = (text) => {
//             const cell = document.createElement('td');
//             cell.textContent = text;
//             cell.classList.add('px-4', 'py-2', 'alt-column');
//             return cell;
//         };

//         // Standard columns: Landing Page URL, Clicks, Video Views, Spend
//         row.appendChild(createCell(item.url));
//         row.appendChild(createCell(item.clicks));
//         row.appendChild(createCell(item.video_views));
//         row.appendChild(createCell(item.spend.toFixed(2)));

//         // Accumulate totals for summary row
//         totals.clicks += item.clicks;
//         totals.video_views += item.video_views;
//         totals.spend += item.spend;

//         // Action columns: dynamically populate columns for each action type
//         actionTypes.forEach(actionType => {
//             const actionValue = item.actions[actionType] || 0; // Default to 0 if the action type doesn't exist for this URL
//             row.appendChild(createCell(actionValue));

//             // Accumulate totals for each action type
//             if (!totals.actions[actionType]) {
//                 totals.actions[actionType] = 0;
//             }
//             totals.actions[actionType] += actionValue;
//         });

//         tableBody.appendChild(row);
//     });

//     // Add a summary/total row at the bottom
//     const totalRow = document.createElement('tr');
//     totalRow.classList.add('font-bold', 'bg-gray-200', 'hover:bg-gray-300');

//     totalRow.appendChild(createCell('Total')); // First column is 'Total'
//     totalRow.appendChild(createCell(totals.clicks)); // Total Clicks
//     totalRow.appendChild(createCell(totals.video_views)); // Total Video Views
//     totalRow.appendChild(createCell(totals.spend.toFixed(2))); // Total Spend

//     // Add total for each action type
//     actionTypes.forEach(actionType => {
//         const totalActionValue = totals.actions[actionType] || 0;
//         totalRow.appendChild(createCell(totalActionValue));
//     });

//     tableBody.appendChild(totalRow);

//     // Show the table
//     document.getElementById('landing-page-url-table-container').style.display = 'block';
// }

// // Function to start fetching data when the user submits the form
// function fetchInsights() {
//     const adAccountId = document.getElementById('ad-account-select').value;
//     const sinceDate = document.getElementById('since').value;
//     const untilDate = document.getElementById('until').value;

//     // Fetch total spend without breakdowns
//     fetchTotalAccountSpend(adAccountId, sinceDate, untilDate);

//     // Fetch campaign insights with link_url_asset breakdown
//     fetchCampaignInsights();
// }