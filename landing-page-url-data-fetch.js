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

function ensureFacebookSDKInitialized() {
    return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
            if (window.FB) {
                clearInterval(interval);
                resolve(true);
            }
        }, 100); // Check every 100ms
        setTimeout(() => {
            clearInterval(interval);
            reject("Facebook SDK failed to initialize.");
        }, 5000); // Fail after 5 seconds
    });
}

async function fetchAdAccounts() {
    try {
        // Ensure the SDK is initialized
        await ensureFacebookSDKInitialized();

        const adAccounts = [];
        let nextUrl = '/me/adaccounts?fields=name,account_id';

        // Fetch the ad accounts with pagination support
        while (nextUrl) {
            const response = await new Promise((resolve, reject) => {
                FB.api(nextUrl, 'GET', {}, response => {
                    if (!response || response.error) {
                        reject(response.error);
                    } else {
                        resolve(response);
                    }
                });
            });

            // Append fetched ad accounts
            adAccounts.push(...response.data);

            // Handle pagination (if there's a next page)
            nextUrl = response.paging && response.paging.next ? response.paging.next : null;
        }

        return adAccounts;
    } catch (error) {
        console.error("Error fetching ad accounts:", error);
        return [];
    }
}

async function loadAdAccounts() {
    const adAccounts = await fetchAdAccounts();
    if (adAccounts.length > 0) {
        populateAdAccountDropdown(adAccounts);
    } else {
        console.error("No ad accounts found.");
    }
}

// Call this function after the user authenticates or after the SDK is loaded
window.onload = async function() {
    await ensureFacebookSDKInitialized();
    loadAdAccounts();
};

// Function to populate dropdown with ad accounts
function populateAdAccountDropdown(adAccounts) {
    const adAccountDropdown = document.getElementById('ad-account-dropdown');
    
    // Clear existing dropdown options
    adAccountDropdown.innerHTML = '';

    // Populate the dropdown with ad accounts
    adAccounts.forEach(adAccount => {
        const option = document.createElement('option');
        option.value = adAccount.account_id;
        option.textContent = `${adAccount.name} (${adAccount.account_id})`;
        adAccountDropdown.appendChild(option);
    });
}

// Function to fetch landing page URL insights data for the selected ad account
function fetchLandingPageUrlInsights(url = null) {
    const adAccountId = document.getElementById('ad-account-select').value;
    const sinceDate = document.getElementById('since').value;
    const untilDate = document.getElementById('until').value;
    const accessToken = localStorage.getItem('fbAccessToken'); // Retrieve token from localStorage

    if (!adAccountId) {
        alert('Please select an ad account.');
        return;
    }

    if (!sinceDate || !untilDate) {
        alert("Please select both 'From' and 'To' dates.");
        return;
    }

    if (!accessToken) {
        fetchFacebookData(); // If no token, prompt login
        return;
    }

    // Construct the API query to fetch landing page URL data with `link_url_asset` breakdown
    const query = url || 
        `/${adAccountId}/insights?fields=ad_name,ad_id,clicks,video_p25_watched_actions,actions,spend&time_range={'since':'${sinceDate}','until':'${untilDate}'}&level=ad&breakdowns=link_url_asset&limit=20&access_token=${accessToken}`;

    // Fetch data from the Facebook API
    FB.api(
        query,
        'GET',
        {},
        function (response) {
            if (response && !response.error) {
                console.log(response); // Debugging: View the response data in the console
                const groupedData = groupDataByLandingPageUrl(response.data); // Group data by landing page URL
                displayLandingPageUrlTable(groupedData); // Call the function to display data
            } else {
                console.error('Error fetching landing page URL insights:', response.error);
            }
        }
    );
}

// Function to group data by landing page URL
function groupDataByLandingPageUrl(data) {
    const grouped = {};

    data.forEach(item => {
        // Extract the website URL from the `link_url_asset` field
        const landingPageUrl = item.link_url_asset && item.link_url_asset.website_url ? item.link_url_asset.website_url : 'Unknown';

        if (!grouped[landingPageUrl]) {
            grouped[landingPageUrl] = {
                clicks: 0,
                video_views: 0,
                spend: 0,
                actions: {}
            };
        }

        grouped[landingPageUrl].clicks += parseInt(item.clicks || 0);
        
        // Check if video_p25_watched_actions exists and has at least one element
        if (item.video_p25_watched_actions && item.video_p25_watched_actions.length > 0) {
            grouped[landingPageUrl].video_views += parseInt(item.video_p25_watched_actions[0].value || 0);
        } else {
            grouped[landingPageUrl].video_views += 0; // If not present, add 0
        }
        
        grouped[landingPageUrl].spend += parseFloat(item.spend || 0);

        // Check if actions exist before iterating
        if (item.actions) {
            item.actions.forEach(action => {
                if (!grouped[landingPageUrl].actions[action.action_type]) {
                    grouped[landingPageUrl].actions[action.action_type] = 0;
                }
                grouped[landingPageUrl].actions[action.action_type] += parseInt(action.value || 0);
            });
        }
    });

    console.log('Grouped Data:', grouped); // Debugging: Check grouped data
    return Object.entries(grouped).map(([url, metrics]) => ({ url, ...metrics }));
}

// Function to display landing page URL data in the table
function displayLandingPageUrlData(data) {
    const tableHead = document.getElementById('landing-page-url-table-head');
    const tableBody = document.getElementById('landing-page-url-table-body');
    tableHead.innerHTML = ''; // Clear existing headers
    tableBody.innerHTML = ''; // Clear existing data

    if (data.length === 0) {
        console.warn('No data to display');
        alert('No data found for the selected parameters.');
        return;
    }

    // Create table headers
    const headers = ['Landing Page URL', 'Clicks', 'Video Views (25% Watched)', 'Spend', 'Actions'];
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.className = 'px-4 py-2 text-left font-medium table-header';
        th.textContent = header;
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // Create table rows for each landing page URL
    data.forEach(item => {
        const row = document.createElement('tr');
        row.classList.add('hover:bg-blue-50');

        // Helper function to create a table cell
        const createCell = (text) => {
            const cell = document.createElement('td');
            cell.textContent = text;
            cell.classList.add('px-4', 'py-2', 'alt-column');
            return cell;
        };

        row.appendChild(createCell(item.url));
        row.appendChild(createCell(item.clicks));
        row.appendChild(createCell(item.video_views));
        row.appendChild(createCell(item.spend.toFixed(2)));

        const actionsCell = document.createElement('td');
        actionsCell.textContent = JSON.stringify(item.actions, null, 2); // Properly format JSON for readability
        actionsCell.classList.add('px-4', 'py-2', 'alt-column');
        row.appendChild(actionsCell);

        tableBody.appendChild(row);
    });

    document.getElementById('landing-page-url-table-container').style.display = 'block';
    console.log('Table updated with new data.'); // Debugging: Confirm table update
}