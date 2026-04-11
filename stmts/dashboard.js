// dashboard.js
// Main JS for Accounts Dashboard SPA

// Google API client config
const CLIENT_ID = '634584714309-glnju0qta5thupmbnb1s2h4em0tuf9mf.apps.googleusercontent.com';
const API_KEY = 'AIzaSyC3A3yUbIa5DmhPgrRqRanWr1DxB7gNWQY';
const DISCOVERY_DOCS = [
  'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
  'https://sheets.googleapis.com/$discovery/rest?version=v4'
];
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'profile',
  'email',
].join(' ');

let tokenClient;
let accessToken = '';
let sheetUrl = '';
// Time-series slicer state
let slicer = {
  granularity: 'year', // 'year'|'quarter'|'month'
  periods: [], // array of period keys (e.g., '2023', '2023-Q1', '2023-01')
  startIdx: 0,
  endIdx: 0
};
let allTransactions = [];
// Account/source filter (empty Set = all accounts selected)
let accountFilter = new Set();

// Persist last drilldown search term
function loadLastDrilldownSearch() {
  try { return localStorage.getItem('stmt_dashboard_last_search') || ''; } catch (e) { return ''; }
}
function saveLastDrilldownSearch(v) {
  try { if (v && v.length) localStorage.setItem('stmt_dashboard_last_search', v); else localStorage.removeItem('stmt_dashboard_last_search'); } catch (e) {}
}

// On load, initialize Google API client
window.onload = function() {
  gapi.load('client', initClient);
  document.getElementById('login-btn').onclick = handleAuthClick;
};

function initClient() {
  gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: DISCOVERY_DOCS,
  }).then(() => {
    // Set up Google Identity Services token client
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse) => {
        // If we get a tokenResponse it means auth succeeded (silent or interactive)
        if (tokenResponse && tokenResponse.access_token) {
          accessToken = tokenResponse.access_token;
          gapi.client.setToken({access_token: accessToken});
          gapi.client.load('oauth2', 'v2').then(() => {
            // mark signed-in in localStorage so we can try silent sign-in on reload
            try { localStorage.setItem('stmt_dashboard_signed_in', '1'); } catch (e) {}
            getUserInfo();
          });
        } else {
          // No token - leave UI for explicit sign-in
          document.getElementById('login-btn').disabled = false;
        }
      }
    });
    // Try silent sign-in if the user has signed in before
    const previouslySignedIn = (() => { try { return localStorage.getItem('stmt_dashboard_signed_in') === '1'; } catch (e) { return false; } })();
    if (previouslySignedIn) {
      // Request a token silently (no prompt). If it fails, the callback will not supply an access_token
      try {
        tokenClient.requestAccessToken({prompt: ''});
      } catch (e) {
        // Fall back to enabling the explicit sign-in button
        document.getElementById('login-btn').disabled = false;
      }
    } else {
      document.getElementById('login-btn').disabled = false;
    }
  }).catch((error) => {
    console.error('Google API client initialization failed:', error);
    document.getElementById('auth-section').innerHTML =
      `<div class="alert alert-danger">Google API initialization failed.<br>${error.error || error.details || error.message || error}</div>`;
    document.getElementById('login-btn').disabled = true;
  });
}

function handleAuthClick() {
  if (tokenClient) {
    tokenClient.requestAccessToken();
  } else {
    alert('Google API not initialized. Please wait and try again.');
  }
}

function getUserInfo() {
  gapi.client.load('oauth2', 'v2').then(() => {
    gapi.client.oauth2.userinfo.get().then((response) => {
      const userProfile = response.result;
      document.getElementById('auth-section').style.display = 'none';
      document.getElementById('dashboard').style.display = '';
      // Desktop inline user info (visible on sm+)
      const userInfoEl = document.getElementById('user-info');
      if (userInfoEl) {
        userInfoEl.innerHTML = `
          <img src="${userProfile.picture || ''}" alt="avatar" class="rounded-circle me-2" style="width:32px;height:32px;object-fit:cover;vertical-align:middle;">
          <span class="ms-1">${userProfile.name} (${userProfile.email})</span>
          <a id="sheet-link" href="#" target="_blank" class="btn btn-light ms-3" style="display:none">
            <span class="material-icons">table_view</span> Open Sheet
          </a>
          <button id="desktop-signout" class="btn btn-outline-danger btn-sm ms-2" title="Sign out"><span class="material-icons">logout</span></button>
        `;
      }
      // Mobile dropdown menu (visible on xs)
      const userMenuBody = document.getElementById('user-menu-body');
      if (userMenuBody) {
        userMenuBody.innerHTML = `
          <li class="px-3 py-2 text-center">
            <img src="${userProfile.picture || ''}" alt="avatar" class="rounded-circle mb-2" style="width:48px;height:48px;object-fit:cover;">
            <div><strong>${userProfile.name}</strong></div>
            <div><small class="text-muted">${userProfile.email}</small></div>
          </li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item" href="#" id="mobile-sheet-link" style="display:none"><span class="material-icons align-middle">table_view</span> Open Sheet</a></li>
          <li><a class="dropdown-item" href="#" id="mobile-export"><span class="material-icons align-middle">download</span> Export</a></li>
          <li><a class="dropdown-item" href="#" id="mobile-settings"><span class="material-icons align-middle">settings</span> Settings</a></li>
          <li><a class="dropdown-item text-danger" href="#" id="mobile-signout"><span class="material-icons align-middle">logout</span> Sign out</a></li>
        `;
      }
      // mark signed-in and continue
      try { localStorage.setItem('stmt_dashboard_signed_in', '1'); } catch (e) {}
      setupDriveAndSheet();
    }).catch((error) => {
      console.error('Failed to get user info:', error);
      document.getElementById('auth-section').innerHTML =
        `<div class="alert alert-danger">Failed to get user info.<br>${error.error || error.details || error.message || error}</div>`;
    });
  });
}

// Create folder and sheet if not present
async function setupDriveAndSheet() {
  // 1. Check/create 'stmt-dashboard' folder
  let folderId = await getOrCreateFolder('stmt-dashboard');
  // 2. Check/create 'account-transactions' Google Sheet in folder
  let sheetId = await getOrCreateSheet(folderId, 'account-transactions');
  sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`;
  let sheetLink = document.getElementById('sheet-link');
  if (sheetLink) {
    sheetLink.href = sheetUrl;
    sheetLink.style.display = '';
  }
  // Also set mobile menu sheet link if present
  const mobileSheet = document.getElementById('mobile-sheet-link');
  if (mobileSheet) {
    mobileSheet.href = sheetUrl;
    mobileSheet.style.display = '';
  }

  // Wire up sign out actions (desktop and mobile)
  function signOut() {
    // Revoke token if possible
    if (accessToken) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, { method: 'POST', headers: { 'Content-type': 'application/x-www-form-urlencoded' } })
        .catch(() => {});
    }
    try { localStorage.removeItem('stmt_dashboard_signed_in'); } catch (e) {}
    // Reload to show sign-in button
    window.location.reload();
  }
  const desktopSignout = document.getElementById('desktop-signout');
  if (desktopSignout) desktopSignout.onclick = signOut;
  const mobileSignout = document.getElementById('mobile-signout');
  if (mobileSignout) mobileSignout.onclick = signOut;
  // Export/Settings placeholders (mobile)
  const mobileExport = document.getElementById('mobile-export');
  if (mobileExport) mobileExport.onclick = function(e) { e.preventDefault(); alert('Export feature coming soon!'); };
  const mobileSettings = document.getElementById('mobile-settings');
  if (mobileSettings) mobileSettings.onclick = function(e) { e.preventDefault(); alert('Settings feature coming soon!'); };
  // 3. Load data and render dashboard
  let transactions = await readSheetData(sheetId);
  allTransactions = transactions; // keep master copy
  initSlicerAndRender(transactions);
}

function initSlicerAndRender(transactions) {
  // default granularity is yearly
  const gran = document.getElementById('slicer-granularity');
  if (gran) gran.value = 'year';
  slicer.granularity = 'year';
  computePeriodsFromTransactions(transactions);
  // default to full range
  slicer.startIdx = 0;
  slicer.endIdx = Math.max(0, slicer.periods.length - 1);
  renderSlicer();
  // Render widgets with full data by default
  const initialFiltered = filterTransactionsBySlicer(transactions);
  window._slicerFiltered = initialFiltered;
  renderDashboardWidgets(initialFiltered);
  // Wire apply button
  const applyBtn = document.getElementById('slicer-apply');
  if (applyBtn) {
    applyBtn.onclick = () => {
      const filtered = filterTransactionsBySlicer(allTransactions);
      window._slicerFiltered = filtered;
      renderDashboardWidgets(filtered);
      if (window.lastDrillType) {
        showDrilldown(window.lastDrillType, window._currentFilteredTransactions, window.lastDrillCat, window.lastDrillSubCat);
      }
    };
  }
  // Wire granularity change
  const granEl = document.getElementById('slicer-granularity');
  if (granEl) {
    granEl.onchange = () => {
      slicer.granularity = granEl.value;
      computePeriodsFromTransactions(allTransactions);
      slicer.startIdx = 0;
      slicer.endIdx = Math.max(0, slicer.periods.length - 1);
      renderSlicer();
    };
  }
}

function computePeriodsFromTransactions(transactions) {
  // builds unique sorted periods according to granularity
  const set = new Set();
  transactions.forEach(txn => {
    const d = parseTxnDate(txn.txn_date);
    if (!d) return;
    if (slicer.granularity === 'year') set.add(String(d.getFullYear()));
    else if (slicer.granularity === 'quarter') {
      const q = Math.floor(d.getMonth() / 3) + 1;
      set.add(`${d.getFullYear()}-Q${q}`);
    } else if (slicer.granularity === 'month') {
      const m = String(d.getMonth() + 1).padStart(2, '0');
      set.add(`${d.getFullYear()}-${m}`);
    }
  });
  const arr = Array.from(set);
  // sort by chronological order
  arr.sort((a, b) => {
    const keyToNum = (k) => {
      if (slicer.granularity === 'year') return Number(k);
      if (slicer.granularity === 'quarter') {
        const [y, q] = k.split('-Q'); return Number(y) * 10 + Number(q);
      }
      // month
      const [y, m] = k.split('-'); return Number(y) * 100 + Number(m);
    };
    return keyToNum(a) - keyToNum(b);
  });
  slicer.periods = arr;
}

function renderSlicer() {
  const label = document.getElementById('slicer-range-label');
  const sliderEl = document.getElementById('slicer-slider');
  if (!label || !sliderEl) return;
  const n = slicer.periods.length;
  if (n === 0) {
    label.textContent = 'Range: (no date data)';
    // destroy any existing slider and clear container
    try { if (sliderEl.noUiSlider) sliderEl.noUiSlider.destroy(); } catch (e) {}
    sliderEl.innerHTML = '';
    return;
  }
  // On small screens tooltips may be hidden; show the textual label there
  const isSmall = window.matchMedia && window.matchMedia('(max-width:576px)').matches;
  label.style.display = isSmall ? '' : 'none';
  // ensure nouislider script is loaded
  const ensureNoUi = () => new Promise((resolve, reject) => {
    if (window.noUiSlider) return resolve();
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/noUiSlider/15.7.0/nouislider.min.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load noUiSlider'));
    document.head.appendChild(s);
  });
  ensureNoUi().then(() => {
    // destroy existing slider if any
    if (sliderEl.noUiSlider) sliderEl.noUiSlider.destroy();
    if (n === 0) {
      sliderEl.innerHTML = '';
      return;
    }
    const startVal = slicer.startIdx;
    const endVal = slicer.endIdx;
    window.noUiSlider.create(sliderEl, {
      start: [startVal, endVal],
      connect: true,
      step: 1,
      range: { min: 0, max: Math.max(0, n - 1) },
      // show human-readable period labels in tooltips
      tooltips: [
        { to: v => (slicer.periods[Math.round(v)] || String(Math.round(v))) },
        { to: v => (slicer.periods[Math.round(v)] || String(Math.round(v))) }
      ]
    });
    sliderEl.noUiSlider.on('update', function(values) {
      const sIdx = Math.round(Number(values[0]));
      const eIdx = Math.round(Number(values[1]));
      slicer.startIdx = sIdx; slicer.endIdx = eIdx;
      // update textual label on small screens
      if (isSmall) label.textContent = `${slicer.periods[slicer.startIdx]} — ${slicer.periods[slicer.endIdx]}`;
    });
  }).catch((err) => { console.warn('noUiSlider unavailable', err); });
}

function parseTxnDate(s) {
  if (!s) return null;
  // Try ISO first
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  // Try common formats dd/mm/yyyy or dd-mm-yyyy
  const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const day = Number(m[1]); const mon = Number(m[2]) - 1; const year = Number(m[3]);
    return new Date(year, mon, day);
  }
  return null;
}

function filterTransactionsBySlicer(transactions) {
  if (!slicer.periods || slicer.periods.length === 0) return transactions;
  const startKey = slicer.periods[slicer.startIdx];
  const endKey = slicer.periods[slicer.endIdx];
  return transactions.filter(txn => {
    const d = parseTxnDate(txn.txn_date);
    if (!d) return false;
    let key;
    if (slicer.granularity === 'year') key = String(d.getFullYear());
    else if (slicer.granularity === 'quarter') key = `${d.getFullYear()}-Q${Math.floor(d.getMonth()/3)+1}`;
    else {
      const m = String(d.getMonth()+1).padStart(2,'0'); key = `${d.getFullYear()}-${m}`;
    }
    // compare lexicographically using the periods array order
    const idx = slicer.periods.indexOf(key);
    return idx >= slicer.startIdx && idx <= slicer.endIdx;
  });
}

// Find or create folder in Google Drive
async function getOrCreateFolder(folderName) {
  // Search for folder
  const response = await gapi.client.drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive'
  });
  if (response.result.files && response.result.files.length > 0) {
    return response.result.files[0].id;
  }
  // Create folder
  const createRes = await gapi.client.drive.files.create({
    resource: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    },
    fields: 'id'
  });
  return createRes.result.id;
}

// Find or create Google Sheet in folder
async function getOrCreateSheet(folderId, sheetName) {
  // Search for sheet
  const response = await gapi.client.drive.files.list({
    q: `name='${sheetName}' and mimeType='application/vnd.google-apps.spreadsheet' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive'
  });
  if (response.result.files && response.result.files.length > 0) {
    return response.result.files[0].id;
  }
  // Create sheet
  const createRes = await gapi.client.drive.files.create({
    resource: {
      name: sheetName,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folderId]
    },
    fields: 'id'
  });
  const sheetId = createRes.result.id;
  // Set up columns
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'A1:K1',
    valueInputOption: 'RAW',
    resource: {
      values: [[
        'txn_source', 'txn_date', 'narration', 'txn_amount', 'credit_indicator',
        'txn_type', 'category', 'sub_category', 'raw_data', 'state'
      ]]
    }
  });
  return sheetId;
}

// Read all transaction data from sheet
async function readSheetData(sheetId) {
  const response = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'A2:K',
  });
  const rows = response.result.values || [];
  return rows.map(row => ({
    txn_source: row[0] || '',
    txn_date: row[1] || '',
    narration: row[2] || '',
    txn_amount: parseFloat(removeThousandsSeparators(row[3])) || 0,
    credit_indicator: row[4] || '',
    txn_type: row[5] || '',
    category: row[6] || '',
    sub_category: row[7] || '',
    raw_data: row[8] || '',
    state: row[9] || ''
  }));
}

function removeThousandsSeparators(numStr) {
  return numStr.replace(/,/g, '');
}

// Escape a string for use in an HTML attribute value
function escapeAttr(s) {
  return (s || '').toString()
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Escape a string for use as HTML element text content
function escapeText(s) {
  return (s || '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Render dashboard widgets (Section 2 + Section 3)
function renderDashboardWidgets(transactions) {
  window._slicerFiltered = transactions;
  // Apply account filter on top of slicer filter
  let filtered = transactions;
  if (accountFilter.size > 0) {
    filtered = transactions.filter(t => accountFilter.has(t.txn_source));
  }
  window._currentFilteredTransactions = filtered;

  renderCashflowBar(transactions, filtered);
  renderTreeWidget('expense-tree-content',    'Expense',    filtered, 'Expenses');
  renderTreeWidget('investment-tree-content', 'Investment', filtered, 'Investment');
  renderTreeWidget('income-tree-content',     'Income',     filtered, 'Income');
  renderTreeWidget('transfer-tree-content',   'Transfer',   filtered, 'Transfer');
}

// Section 2: Horizontal cashflow summary bar + Account/Source multi-select filter
function renderCashflowBar(slicerFiltered, accountFiltered) {
  const container = document.getElementById('cashflow-bar-content');
  if (!container) return;

  const cashflow = accountFiltered.reduce((acc, t) => {
    if (t.txn_type === 'Income')      acc.income     += t.txn_amount;
    if (t.txn_type === 'Expense')     acc.expense    += t.txn_amount;
    if (t.txn_type === 'Investment')  acc.investment += t.txn_amount;
    if (t.txn_type === 'Transfer')    acc.transfer   += t.txn_amount;
    return acc;
  }, { income: 0, expense: 0, investment: 0, transfer: 0 });

  const fmt = amt => `₹${amt.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;

  // All unique accounts from the slicer-filtered data (before account filter)
  const accounts = [...new Set(slicerFiltered.map(t => t.txn_source).filter(Boolean))].sort();
  const allSelected = accountFilter.size === 0;

  const acctItems = accounts.map(a =>
    `<label class="dropdown-item py-1 d-flex align-items-center gap-2 small">
      <input type="checkbox" class="acct-chk" value="${escapeAttr(a)}" ${allSelected || accountFilter.has(a) ? 'checked' : ''}>
      <span>${escapeAttr(a)}</span>
    </label>`
  ).join('');

  container.innerHTML = `
    <div class="d-flex flex-wrap align-items-center gap-3 w-100">
      <div class="d-flex align-items-center gap-2">
        <span class="material-icons text-success" style="font-size:20px;">trending_up</span>
        <span class="text-muted small">Income</span>
        <span class="fw-bold text-success">${fmt(cashflow.income)}</span>
      </div>
      <div class="vr d-none d-sm-block"></div>
      <div class="d-flex align-items-center gap-2">
        <span class="material-icons text-danger" style="font-size:20px;">trending_down</span>
        <span class="text-muted small">Expense</span>
        <span class="fw-bold text-danger">${fmt(cashflow.expense)}</span>
      </div>
      <div class="vr d-none d-sm-block"></div>
      <div class="d-flex align-items-center gap-2">
        <span class="material-icons text-primary" style="font-size:20px;">savings</span>
        <span class="text-muted small">Investment</span>
        <span class="fw-bold text-primary">${fmt(cashflow.investment)}</span>
      </div>
      <div class="vr d-none d-sm-block"></div>
      <div class="d-flex align-items-center gap-2">
        <span class="material-icons text-secondary" style="font-size:20px;">swap_horiz</span>
        <span class="text-muted small">Transfer</span>
        <span class="fw-bold text-secondary">${fmt(cashflow.transfer)}</span>
      </div>
      <div class="ms-auto">
        <div class="dropdown" id="account-filter-dropdown">
          <button class="btn btn-outline-secondary btn-sm dropdown-toggle" type="button"
            data-bs-toggle="dropdown" aria-expanded="false" data-bs-auto-close="outside">
            <span class="material-icons align-middle" style="font-size:16px;">account_balance</span>
            Account/Source${accountFilter.size > 0 ? ` <span class="badge bg-primary ms-1">${accountFilter.size}</span>` : ''}
          </button>
          <div class="dropdown-menu p-2" style="min-width:230px;max-height:300px;overflow-y:auto;">
            <label class="dropdown-item py-1 d-flex align-items-center gap-2 small fw-bold">
              <input type="checkbox" id="acct-all" ${allSelected ? 'checked' : ''}>
              All Accounts
            </label>
            <hr class="dropdown-divider my-1">
            ${acctItems}
            <hr class="dropdown-divider my-1">
            <button class="btn btn-primary btn-sm w-100" id="acct-apply-btn">Apply</button>
          </div>
        </div>
      </div>
    </div>`;

  // Wire up account filter checkbox logic
  const allChk = document.getElementById('acct-all');
  const acctChks = container.querySelectorAll('.acct-chk');

  if (allChk) {
    allChk.addEventListener('change', function() {
      acctChks.forEach(c => { c.checked = this.checked; });
    });
  }
  acctChks.forEach(c => {
    c.addEventListener('change', function() {
      if (allChk) {
        allChk.checked = Array.from(acctChks).every(ck => ck.checked);
      }
    });
  });

  const applyBtn = document.getElementById('acct-apply-btn');
  if (applyBtn) {
    applyBtn.addEventListener('click', function() {
      const allCk = allChk && allChk.checked;
      const allIndividual = Array.from(acctChks).every(c => c.checked);
      accountFilter.clear();
      if (!allCk && !allIndividual) {
        acctChks.forEach(c => { if (c.checked) accountFilter.add(c.value); });
      }
      // Close Bootstrap dropdown
      const ddEl = document.getElementById('account-filter-dropdown');
      if (ddEl) {
        const dd = bootstrap.Dropdown.getInstance(ddEl.querySelector('[data-bs-toggle="dropdown"]'));
        if (dd) dd.hide();
      }
      renderDashboardWidgets(window._slicerFiltered || slicerFiltered);
      if (window.lastDrillType) {
        showDrilldown(window.lastDrillType, window._currentFilteredTransactions, window.lastDrillCat, window.lastDrillSubCat);
      }
    });
  }
}

// Section 3: Tree-table widget for a given transaction type
function renderTreeWidget(containerId, txnType, transactions, displayType) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const txns = transactions.filter(t => t.txn_type === txnType);

  // Build category → sub-category tree with totals
  const catMap = new Map();
  txns.forEach(t => {
    const cat = t.category || '(uncategorized)';
    if (!catMap.has(cat)) catMap.set(cat, { total: 0, subCats: new Map() });
    catMap.get(cat).total += t.txn_amount;
    const sc = t.sub_category || '';
    if (sc) {
      const scMap = catMap.get(cat).subCats;
      scMap.set(sc, (scMap.get(sc) || 0) + t.txn_amount);
    }
  });

  // Sort categories descending by total
  const cats = [...catMap.entries()].sort((a, b) => b[1].total - a[1].total);
  const fmt = amt => `₹${amt.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;

  if (cats.length === 0) {
    container.innerHTML = '<div class="text-muted small p-2">No transactions.</div>';
    return;
  }

  let html = '<div class="tree-list" style="max-height:300px;overflow-y:auto;">';
  cats.forEach(([cat, data], ci) => {
    const subCats = [...data.subCats.entries()].sort((a, b) => b[1] - a[1]);
    const hasSubCats = subCats.length > 0;
    const uid = `${containerId}-${ci}`;
    html += `
      <div class="tree-cat-row d-flex justify-content-between align-items-center px-2 py-1 border-bottom"
           style="cursor:pointer;" data-uid="${uid}" data-cat="${encodeURIComponent(cat)}">
        <div class="d-flex align-items-center gap-1 text-truncate">
          <span class="material-icons tree-caret" style="font-size:16px;color:#aaa;flex-shrink:0;">${hasSubCats ? 'chevron_right' : 'remove'}</span>
          <span class="fw-semibold small text-truncate">${escapeText(cat)}</span>
        </div>
        <span class="small ms-2 flex-shrink-0">${fmt(data.total)}</span>
      </div>`;
    if (hasSubCats) {
      html += `<div id="subs-${uid}" style="display:none;">`;
      subCats.forEach(([sc, amt]) => {
        html += `
          <div class="tree-sub-row d-flex justify-content-between align-items-center px-2 py-1 border-bottom"
               style="cursor:pointer;background:#f8f9fa;"
               data-cat="${encodeURIComponent(cat)}" data-sub="${encodeURIComponent(sc)}">
            <div class="d-flex align-items-center gap-1 text-truncate" style="padding-left:18px;">
              <span class="material-icons" style="font-size:13px;color:#ccc;flex-shrink:0;">subdirectory_arrow_right</span>
              <span class="small text-muted text-truncate">${escapeText(sc)}</span>
            </div>
            <span class="small ms-2 flex-shrink-0 text-muted">${fmt(amt)}</span>
          </div>`;
      });
      html += `</div>`;
    }
  });
  html += '</div>';
  container.innerHTML = html;

  // Wire category row click: toggle sub-cats + show drilldown
  const autoRefreshSwitchId = { Expenses: 'auto-refresh-expense', Investment: 'auto-refresh-investment', Income: 'auto-refresh-income', Transfer: 'auto-refresh-transfer' };
  const autoRefreshSwitch = document.getElementById(autoRefreshSwitchId[displayType]);

  container.querySelectorAll('.tree-cat-row').forEach(row => {
    row.addEventListener('click', function() {
      const cat = decodeURIComponent(this.dataset.cat);
      const uid = this.dataset.uid;
      const subsEl = document.getElementById('subs-' + uid);
      const caret = this.querySelector('.tree-caret');
      if (subsEl) {
        const isOpen = subsEl.style.display !== 'none';
        subsEl.style.display = isOpen ? 'none' : '';
        if (caret && caret.textContent.trim() !== 'remove') {
          caret.style.transform = isOpen ? '' : 'rotate(90deg)';
        }
      }
      if (autoRefreshSwitch && autoRefreshSwitch.checked) {
        showDrilldown(displayType, window._currentFilteredTransactions, cat, null);
      }
    });
  });

  // Wire sub-category row click: show drilldown filtered to sub-cat
  container.querySelectorAll('.tree-sub-row').forEach(row => {
    row.addEventListener('click', function(e) {
      e.stopPropagation();
      const cat = decodeURIComponent(this.dataset.cat);
      const sc  = decodeURIComponent(this.dataset.sub);
      if (autoRefreshSwitch && autoRefreshSwitch.checked) {
        showDrilldown(displayType, window._currentFilteredTransactions, cat, sc);
      }
    });
  });
}

// Section 4: Drilldown table/cards
function showDrilldown(type, transactions, filterCat, filterSubCat) {
  window.lastDrillType   = type;
  window.lastDrillCat    = filterCat    || null;
  window.lastDrillSubCat = filterSubCat || null;

  if (!transactions) transactions = [];

  // Map display type → txn_type field value
  const txnTypeMap = { Expenses: 'Expense', Investment: 'Investment', Income: 'Income', Transfer: 'Transfer' };
  const txnType = txnTypeMap[type];

  let filteredTxns = transactions.slice();
  if (txnType)     filteredTxns = filteredTxns.filter(t => t.txn_type === txnType);
  if (filterCat)   filteredTxns = filteredTxns.filter(t => t.category === filterCat);
  if (filterSubCat) filteredTxns = filteredTxns.filter(t => t.sub_category === filterSubCat);

  // Default sort: date descending
  filteredTxns.sort((a, b) => {
    const da = parseTxnDate(a.txn_date), db = parseTxnDate(b.txn_date);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return db - da;
  });

  // Build title
  let title = type + ' Transactions';
  if (filterCat)    title += ' \u2014 ' + filterCat;
  if (filterSubCat) title += ' / ' + filterSubCat;

  const columns = ['txn_source', 'category', 'sub_category', 'txn_date', 'txn_amount', 'narration'];
  const labelMap = {
    txn_source:   'Account/Source',
    category:     'Category',
    sub_category: 'Sub-category',
    txn_date:     'Date',
    txn_amount:   'Amount',
    narration:    'Narration'
  };

  const isSmall = window.matchMedia && window.matchMedia('(max-width:576px)').matches;

  let contentHtml = `
    <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
      <h6 class="mb-0 fw-bold">${escapeText(title)}</h6>
      <div class="d-flex align-items-center gap-2">
        <span class="small text-muted" id="drilldown-records">Records: ${filteredTxns.length} out of ${transactions.length}</span>
        <div class="position-relative">
          <button id="drilldown-search-btn" class="btn btn-sm btn-light" title="Search"><span class="material-icons">search</span></button>
          <div id="drilldown-search-pop" class="card p-2" style="position:absolute;right:0;top:36px;z-index:1000;display:none;min-width:220px;">
            <div class="input-group input-group-sm">
              <input id="drilldown-pop-search" class="form-control" placeholder="Search...">
              <button id="drilldown-pop-btn" class="btn btn-primary btn-sm">Search</button>
            </div>
            <div class="d-flex align-items-center gap-2 mt-2">
              <div id="drilldown-spinner" style="display:none"><div class="spinner-border spinner-border-sm text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>
              <div class="small text-muted" id="drilldown-progress" style="display:none">Filtering...</div>
              <button id="drilldown-cancel" class="btn btn-sm btn-outline-secondary ms-auto" style="display:none">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  // Mobile: order-by selector
  if (isSmall) {
    const sortFields = [
      { value: 'txn_source',   label: 'Account/Source' },
      { value: 'category',     label: 'Category' },
      { value: 'sub_category', label: 'Sub-category' },
      { value: 'txn_date',     label: 'Date' },
      { value: 'txn_amount',   label: 'Amount' }
    ];
    contentHtml += `
      <div class="d-flex align-items-center gap-2 mb-2">
        <label class="small text-muted mb-0 flex-shrink-0">Order by:</label>
        <select class="form-select form-select-sm" id="drilldown-sort-select" style="width:auto;">
          ${sortFields.map(f => `<option value="${f.value}">${f.label}</option>`).join('')}
        </select>
      </div>`;
  }

  contentHtml += `<div style="max-height:400px;overflow-y:auto;">`;
  if (!isSmall) {
    contentHtml += `<table class="table table-bordered table-sm table-hover"><thead><tr>` +
      columns.map(col =>
        `<th style="cursor:pointer;white-space:nowrap;" onclick="window.sortDrilldown && window.sortDrilldown('${col}')">` +
        `${labelMap[col]} <span class="material-icons" style="font-size:13px;vertical-align:middle;color:#bbb;">unfold_more</span></th>`
      ).join('') +
      `</tr></thead><tbody id="drilldown-body">` +
      renderRowsTable(filteredTxns) +
      `</tbody></table>`;
  } else {
    contentHtml += `<div id="drilldown-body">` + renderCardsList(filteredTxns) + `</div>`;
  }
  contentHtml += `</div>`;

  const section = document.getElementById('drilldown-section');
  section.innerHTML = contentHtml;
  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  function compareDrilldownValues(a, b, col) {
    if (col === 'txn_amount') return b.txn_amount - a.txn_amount;
    if (col === 'txn_date') {
      const aParsed = parseTxnDate(a.txn_date);
      const bParsed = parseTxnDate(b.txn_date);
      const aTime = aParsed instanceof Date ? aParsed.getTime() : NaN;
      const bTime = bParsed instanceof Date ? bParsed.getTime() : NaN;
      if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) return bTime - aTime;
    }
    return String(a[col] || '').localeCompare(String(b[col] || ''));
  }

  // Desktop: column sort
  window.sortDrilldown = function(col) {
    const sorted = [...filteredTxns].sort((a, b) => compareDrilldownValues(a, b, col));
    const body = document.getElementById('drilldown-body');
    if (!body) return;
    body.innerHTML = isSmall ? renderCardsList(sorted) : renderRowsTable(sorted);
    if (window._applyDrilldownSearch) {
      const pv = document.getElementById('drilldown-pop-search');
      window._applyDrilldownSearch((pv && pv.value) || '');
    }
  };

  // Mobile: order-by select
  if (isSmall) {
    const sortSel = document.getElementById('drilldown-sort-select');
    if (sortSel) {
      sortSel.addEventListener('change', function() {
        const col = this.value;
        const sorted = [...filteredTxns].sort((a, b) => compareDrilldownValues(a, b, col));
        const body = document.getElementById('drilldown-body');
        if (body) body.innerHTML = renderCardsList(sorted);
        if (window._applyDrilldownSearch) {
          const pv = document.getElementById('drilldown-pop-search');
          window._applyDrilldownSearch((pv && pv.value) || '');
        }
      });
    }
  }

  // Search popover
  (function() {
    const pop    = document.getElementById('drilldown-search-pop');
    const btn    = document.getElementById('drilldown-search-btn');
    const input  = document.getElementById('drilldown-pop-search');
    const popBtn = document.getElementById('drilldown-pop-btn');
    const recEl  = document.getElementById('drilldown-records');
    let _filterCancelRequested = false;
    let _lastVisibilitySnapshot = null;

    function updateRecords() {
      const visible = Array.from(document.querySelectorAll('#drilldown-section .drill-row'))
        .filter(r => r.style.display !== 'none').length;
      if (recEl) recEl.textContent = `Records: ${visible} out of ${transactions.length}`;
    }

    function applyFilter(q) {
      const rows = Array.from(document.querySelectorAll('#drilldown-section .drill-row'));
      if (!q) { rows.forEach(r => r.style.display = ''); updateRecords(); return; }
      const qq = q.toLowerCase();
      const chunkSize = 200;
      let idx = 0, visibleCount = 0;
      const spinner   = document.getElementById('drilldown-spinner');
      const progress  = document.getElementById('drilldown-progress');
      const cancelBtn = document.getElementById('drilldown-cancel');
      _filterCancelRequested = false;
      _lastVisibilitySnapshot = rows.map(r => r.style.display || '');
      if (spinner)   spinner.style.display = '';
      if (progress)  progress.style.display = '';
      if (cancelBtn) {
        cancelBtn.style.display = '';
        cancelBtn.onclick = function(e) { e.stopPropagation(); _filterCancelRequested = true; };
      }
      function processChunk() {
        const end = Math.min(idx + chunkSize, rows.length);
        for (let i = idx; i < end; i++) {
          if (_filterCancelRequested) break;
          const r = rows[i];
          const found = (r.getAttribute('data-search') || '').indexOf(qq) !== -1;
          r.style.display = found ? '' : 'none';
          if (found) visibleCount++;
        }
        if (recEl) recEl.textContent = `Records: ${visibleCount} out of ${transactions.length}`;
        idx = end;
        if (_filterCancelRequested) {
          rows.forEach((r, i) => { r.style.display = _lastVisibilitySnapshot[i] || ''; });
          if (spinner)   spinner.style.display = 'none';
          if (progress)  progress.style.display = 'none';
          if (cancelBtn) cancelBtn.style.display = 'none';
          return;
        }
        if (idx < rows.length) {
          setTimeout(processChunk, 16);
        } else {
          if (spinner)   spinner.style.display = 'none';
          if (progress)  progress.style.display = 'none';
          if (cancelBtn) cancelBtn.style.display = 'none';
        }
      }
      visibleCount = 0; idx = 0; processChunk();
    }

    window._applyDrilldownSearch = applyFilter;
    updateRecords();

    if (btn && pop) {
      btn.onclick = function(e) {
        e.stopPropagation();
        const wasHidden = pop.style.display === 'none' || !pop.style.display;
        pop.style.display = wasHidden ? '' : 'none';
        if (wasHidden) {
          const last = loadLastDrilldownSearch();
          if (input) { input.value = last || ''; setTimeout(() => input.focus(), 50); }
        }
      };
      popBtn.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        const q = (input && input.value) || '';
        saveLastDrilldownSearch(q);
        applyFilter(q);
        pop.style.display = 'none';
      };
      if (input) {
        input.addEventListener('keydown', function(ev) { if (ev.key === 'Enter') { ev.preventDefault(); popBtn.click(); } });
      }
      if (document._drilldownOutsideClickHandler) {
        document.removeEventListener('click', document._drilldownOutsideClickHandler);
      }
      document._drilldownOutsideClickHandler = function(ev) {
        if (ev.target === btn || btn.contains(ev.target) || pop.contains(ev.target)) return;
        pop.style.display = 'none';
      };
      document.addEventListener('click', document._drilldownOutsideClickHandler);
    }
  })();

  function renderRowsTable(rows) {
    return rows.map(txn => {
      const searchStr = columns.map(c => String(txn[c] || '')).join('|||').toLowerCase();
      return `<tr class="drill-row" data-search="${escapeAttr(searchStr)}">` +
        columns.map(c => {
          let val = txn[c];
          if (c === 'txn_amount') val = `₹${Number(val).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
          return `<td>${escapeText(String(val || ''))}</td>`;
        }).join('') + `</tr>`;
    }).join('');
  }

  function renderCardsList(rows) {
    return rows.map(txn => {
      const searchStr = columns.map(c => String(txn[c] || '')).join('|||').toLowerCase();
      return `<div class="drill-row card mb-2" data-search="${escapeAttr(searchStr)}"><div class="card-body p-2">` +
        columns.map(c => {
          let val = txn[c];
          if (c === 'txn_amount') val = `₹${Number(val).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
          return `<div class="d-flex justify-content-between"><div class="text-muted small">${labelMap[c]}</div><div>${escapeText(String(val || ''))}</div></div>`;
        }).join('<hr class="my-1">') + `</div></div>`;
    }).join('');
  }
}
