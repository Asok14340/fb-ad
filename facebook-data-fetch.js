// Load the Facebook SDK
window.fbAsyncInit = function () {
    FB.init({
        appId: '837790581890637', // Replace with your Facebook App ID
        cookie: true,
        xfbml: true,
        version: 'v20.0'
    });

    // Check the login status when the SDK is initialized
    checkLoginState();
};

// Load the Facebook SDK asynchronously
(function (d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) { return; }
    js = d.createElement(s); js.id = id;
    js.src = "https://connect.facebook.net/en_US/sdk.js";
    fjs.parentNode.insertBefore(js, fjs);
}(document, 'script', 'facebook-jssdk'));

// Function to check login status
function checkLoginState() {
    FB.getLoginStatus(function (response) {
        if (response.status === 'connected') {
            // User is logged in and authenticated
            const accessToken = response.authResponse.accessToken;
            localStorage.setItem('fbAccessToken', accessToken); // Save access token to localStorage
            fetchAdAccounts(); // Automatically fetch ad accounts
        } else {
            // User is not logged in, prompt for login
            authenticateWithFacebook();
        }
    });
}

// Function to authenticate with Facebook and fetch ad accounts
function authenticateWithFacebook() {
    FB.login(function (response) {
        if (response.authResponse) {
            const accessToken = response.authResponse.accessToken;
            localStorage.setItem('fbAccessToken', accessToken); // Save access token to localStorage
            fetchAdAccounts();
        } else {
            console.error('User cancelled login or did not fully authorize.');
        }
    }, { scope: 'ads_management,ads_read' });
}

// Function to fetch all ad accounts and handle pagination
function fetchAdAccounts(url = '/me/adaccounts?fields=id,name', accumulatedAccounts = []) {
    const accessToken = localStorage.getItem('fbAccessToken'); // Retrieve token from localStorage
    if (!accessToken) {
        authenticateWithFacebook(); // If no token, prompt login
        return;
    }

    FB.api(url, 'GET', { access_token: accessToken }, function (response) {
        if (response && !response.error) {
            // Accumulate accounts
            accumulatedAccounts = accumulatedAccounts.concat(response.data);

            // Check for next page in pagination and recursively fetch
            if (response.paging && response.paging.next) {
                fetchAdAccounts(response.paging.next, accumulatedAccounts);
            } else {
                // Populate the dropdown after fetching all pages
                populateAdAccountDropdown(accumulatedAccounts);
            }
        } else {
            console.error('Error fetching ad accounts:', response.error);
        }
    });
}

// Function to populate dropdown with ad accounts
function populateAdAccountDropdown(adAccounts) {
    const adAccountSelect = document.getElementById('ad-account-select');
    adAccountSelect.innerHTML = ''; // Clear existing options

    adAccounts.forEach(account => {
        if (account.id && account.name !== undefined) { // Check for both ID and name
            const option = document.createElement('option');
            option.value = account.id;
            option.text = `${account.name} (ID: ${account.id})`; // Display both name and ID
            adAccountSelect.appendChild(option);
        } else {
            console.warn('Missing name or id for account:', account); // Debugging
        }
    });

    // Show the dropdown after populating it
    document.getElementById('ad-account-container').style.display = 'block';
}

// Function to fetch ad insights data for the selected ad account
function fetchAdInsights(url = null) {
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
        authenticateWithFacebook(); // If no token, prompt login
        return;
    }

    // Construct the API query
    const query = url || 
        `/${adAccountId}/insights?fields=ad_name,ad_id,clicks,video_p25_watched_actions,actions,spend&time_range={'since':'${sinceDate}','until':'${untilDate}'}&level=ad&breakdown=video&limit=20&access_token=${accessToken}`;

        // const query = url || 
        // `/${adAccountId}/insights?breakdowns=link_url_asset&fields=ad_name,ad_id,spend,clicks,impressions,date_start,date_stop&level=campaign&limit=20&sort=spend_ascending&time_range={'since':'${sinceDate}','until':'${untilDate}&access_token=${accessToken}`}



    // Fetch data from the Facebook API
    FB.api(
        query,
        'GET',
        {},
        function (response) {
            if (response && !response.error) {
                // Handle the response and update the table with data
                console.log(response); // Debugging: View the response data in the console
                displayAdInsightsData(response.data); // Call the function to display data
                setupPagination(response.paging); // Handle pagination
            } else {
                console.error('Error fetching ad insights:', response.error);
            }
        }
    );
}

// Function to display ad insights data in the table
function displayAdInsightsData(data) {
    const tableHead = document.getElementById('data-table-head');
    const tableBody = document.getElementById('data-table-body');
    tableHead.innerHTML = ''; // Clear existing headers
    tableBody.innerHTML = ''; // Clear existing data

    if (data.length === 0) {
        alert('No data found for the selected ad account and date range.');
        return;
    }

    // Collect all action types across all data for dynamic headers
    const allActionTypes = new Set();
    data.forEach(item => {
        if (item.actions) {
            item.actions.forEach(action => {
                allActionTypes.add(action.action_type);
            });
        }
    });

    // Convert the set to an array and sort alphabetically
    const actionTypesArray = Array.from(allActionTypes).sort();

    // Prepare table headers
    const headers = ['Ad ID', 'Ad Name', 'Clicks', 'Spend', 'Video Views (25% Watched)', ...actionTypesArray.map(action => action.replace(/_/g, ' '))];

    // Create table header row
    const headerRow = document.createElement('tr');
    headerRow.classList.add('table-header');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        th.classList.add('px-4', 'py-2', 'text-left', 'font-medium');
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // Loop through each data item and create a row in the table
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

        // Add standard fields
        row.appendChild(createCell(item.ad_id));
        row.appendChild(createCell(item.ad_name));
        row.appendChild(createCell(item.clicks || 0));
        row.appendChild(createCell(item.spend || 0)); // Include spend
        row.appendChild(createCell(item.video_p25_watched_actions ? item.video_p25_watched_actions[0].value : 0));

        // Extract actions data
        const actions = {};
        if (item.actions) {
            item.actions.forEach(action => {
                actions[action.action_type] = action.value;
            });
        }

        // Add action-related cells dynamically
        actionTypesArray.forEach(actionType => {
            row.appendChild(createCell(actions[actionType] || 0));
        });

        // Append the row to the table body
        tableBody.appendChild(row);
    });

    // Show the table container
    document.getElementById('data-table-container').style.display = 'block';
}

// Pagination handling functions

let nextPageUrl = null;
let prevPageUrl = null;

function setupPagination(paging) {
    if (paging) {
        nextPageUrl = paging.next || null;
        prevPageUrl = paging.previous || null;

        // Show or hide pagination controls based on availability of next/previous pages
        document.getElementById('pagination-controls').style.display = 'flex';
        document.getElementById('next-button').style.display = nextPageUrl ? 'inline-block' : 'none';
        document.getElementById('prev-button').style.display = prevPageUrl ? 'inline-block' : 'none';
    } else {
        // Hide pagination controls if no paging information is available
        document.getElementById('pagination-controls').style.display = 'none';
    }
}

function loadNextPage() {
    if (nextPageUrl) {
        fetchAdInsights(nextPageUrl);
    }
}

function loadPreviousPage() {
    if (prevPageUrl) {
        fetchAdInsights(prevPageUrl);
    }
}
