<script>
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

// Function to authenticate with Facebook and fetch data
function fetchFacebookData() {
    FB.login(function(response) {
        if (response.authResponse) {
            const sinceDate = document.getElementById('since').value;
            const untilDate = document.getElementById('until').value;

            if (!sinceDate || !untilDate) {
                alert("Please select both 'From' and 'To' dates.");
                return;
            }

            // Construct the API query
            const query = `insights?fields=ad_name,ad_id,clicks,video_p25_watched_actions,actions&time_range={'since':'${sinceDate}','until':'${untilDate}'}&level=ad&breakdown=video`;

            // Fetch data from the Facebook API
            FB.api(
                `/me/adaccounts/${query}`,
                'GET',
                {},
                function(response) {
                    if (response && !response.error) {
                        // Handle the response and update the table with data
                        console.log(response);
                        // You can add code here to update the HTML table with the fetched data
                    } else {
                        console.error(response.error);
                    }
                }
            );
        } else {
            console.error('User cancelled login or did not fully authorize.');
        }
    }, {scope: 'ads_read'});
}
</script>