Accounts Dashboard SPA - HELP

Overview
--------
This small single-page application (SPA) provides a lightweight accounts dashboard that reads transaction data from a Google Sheet in the user's Google Drive and renders simple widgets with drilldown tables.

Files
-----
- `index.html` - The HTML shell and UI markup. Loads Bootstrap, Material Icons and the Google JS libraries, and includes `dashboard.js`.
- `dashboard.js` - Main application logic: Google API initialization and authentication, Drive/Sheets lookup and creation, data read, widget rendering, and drilldown UI.

Quick features summary
----------------------
- Sign in with Google (OAuth) using Google Identity Services.
- Automatically finds or creates a folder named `stmt-dashboard` in the authenticated user's Drive.
- Finds or creates a Google Sheet named `account-transactions` in that folder and initializes header columns if creating it.
- Reads transaction rows (A2:K) from the sheet and maps them into transactions used by the UI.
- Shows four widgets: Cashflow, Investment, Income, Expenses.
  - Cashflow shows totals for Income, Expense and Investment.
  - Investment/Income/Expenses widgets list category-wise totals (descending) and support scrolling.
- Clicking a widget opens a drilldown table with inline column filters and sortable headers.

How it works (high level)
-------------------------
1. On page load, the SPA initializes the Google APIs client and the Google Identity Services token client in `initClient()`.
2. The user clicks "Sign in with Google" which triggers `tokenClient.requestAccessToken()` and obtains an access token.
3. After auth, the app fetches the user's profile and then runs `setupDriveAndSheet()` which:
   - Uses the Drive API to search for or create a folder named `stmt-dashboard`.
   - Uses the Drive API to search for or create a spreadsheet named `account-transactions` inside that folder.
   - If a new sheet is created, it writes header columns into `A1:K1`.
   - Reads sheet values from range `A2:K` and converts each row into a transaction object.
4. The transactions are passed to `renderDashboardWidgets()` which computes aggregates and populates the four widgets.
5. Clicking any widget runs `showDrilldown()` to display a table with filters and sorting.

Authentication and API scopes
-----------------------------
The app requests the following OAuth scopes via Google Identity Services:
- `https://www.googleapis.com/auth/drive.file` - to create/read files the app creates or has access to.
- `https://www.googleapis.com/auth/spreadsheets` - to read/write the spreadsheet.
- `profile` and `email` - to show signed-in user's profile info.

These scopes require user consent at runtime.

Data format (expected sheet layout)
----------------------------------
The code initializes header row with the following column names (A1..K1):
- txn_source
- txn_date
- narration
- txn_amount
- credit_indicator
- txn_type
- category
- sub_category
- raw_data
- state

Rows are read from A2:K and mapped to transaction objects where:
- `txn_amount` is parsed with `parseFloat` and defaults to 0 for invalid values.
- Missing columns are treated as empty strings.

Important: The app assumes `txn_type` contains values like `Income`, `Expense`, or `Investment` to classify transactions.

UI details and interactions
--------------------------
- Sign-in button: `#login-btn` — starts OAuth flow.
- After sign-in, user info appears in top-right and an "Open Sheet" button links to the spreadsheet.
- Widgets:
  - `#cashflow-content` — shows total Income, Expense, Investment (formatted in INR with 2 decimals).
  - `#investment-content`, `#income-content`, `#expenses-content` — list top categories and amounts in descending order. Each widget shows up to 10 categories with a scrollable box if more exist.
- Drilldown (`#drilldown-section`):
  - Clicking a widget opens a table containing relevant columns for that view:
    - Cashflow: `txn_date`, `txn_type`, `txn_amount`, `narration`
    - Investment: `txn_date`, `category`, `txn_amount`, `narration`
    - Income: `txn_date`, `category`, `txn_amount`, `narration`
    - Expenses: `txn_date`, `category`, `sub_category`, `txn_amount`, `narration`
  - Each column header is clickable to sort by that column (amount sorts numerically, others sort lexicographically).
  - Above the table there are small text inputs per column to filter rows inline (case-insensitive substring match).

Limitations & known behaviors
----------------------------
- The app uses a hard-coded `CLIENT_ID` and `API_KEY` in `dashboard.js`. For production or wider distribution, replace with your own credentials from Google Cloud Console.
- `drive.file` scope restricts access to files created or opened by the app; users should consent to allow the app to create the `stmt-dashboard` folder and the spreadsheet.
- The sheet creation writes a header row with 10 columns but the code reads up to column K; if your sheet has a different layout the mapping may be incorrect.
- Date parsing/formatting is not performed; `txn_date` is displayed as-is from the sheet.
- No pagination is implemented for drilldown tables; large sheets may cause long render times in the browser.
- There is minimal error handling; network or API errors are shown using simple alerts or inserted error HTML.

Security & privacy notes
------------------------
- The included `API_KEY` and `CLIENT_ID` are embedded in `dashboard.js`. Treat these as credentials — do not publish or expose them in public sites without considering OAuth client restrictions and API key restrictions in Google Cloud Console.
- The app operates on the end-user's Google Drive and Sheets. The user explicitly consents to the requested scopes during sign-in.

Troubleshooting
---------------
- If the Sign-in button is disabled, check browser console for "Google API client initialization failed" messages — network access to `https://apis.google.com/js/api.js` and correct `API_KEY` are required.
- If the sheet is not found or created, inspect Drive API errors in the console; ensure the account used has Drive/Sheets access and consented to the scopes.
- If no transactions appear, open the created spreadsheet and verify rows exist under the header row (A2 and below) and that `txn_amount` contains numeric values.

Suggested improvements
----------------------
- Replace hard-coded credentials with environment-based config or a build-time replacement.
- Add better error handling and user-visible retry flows.
- Add date parsing and range filtering in the drilldown.
- Add export/CSV download for drilldown results.
- Add lazy rendering or virtualized table for large datasets.
- Add unit tests for data mapping and aggregation logic.

Contact / Contribution
----------------------
If you want to contribute improvements or report issues, open a PR or issue in the repository.

----
Generated from `index.html` and `dashboard.js` located under `scripts/dashboard`.