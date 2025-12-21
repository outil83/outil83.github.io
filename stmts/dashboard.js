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
// selections per widget type (category selections)
const widgetSelections = {
  Investment: new Set(),
  Income: new Set(),
  Expenses: new Set()
};

// Persist/load widget selections to localStorage
function loadWidgetSelections() {
  try {
    const raw = localStorage.getItem('stmt_dashboard_widget_selections');
    if (!raw) return;
    const obj = JSON.parse(raw);
    ['Investment','Income','Expenses'].forEach(k => {
      widgetSelections[k] = new Set((obj[k] || []));
    });
  } catch (e) { /* ignore */ }
}
function saveWidgetSelections() {
  try {
    const obj = {};
    ['Investment','Income','Expenses'].forEach(k => { obj[k] = Array.from(widgetSelections[k] || []); });
    localStorage.setItem('stmt_dashboard_widget_selections', JSON.stringify(obj));
  } catch (e) {}
}

// Persist last drilldown search term
function loadLastDrilldownSearch() {
  try { return localStorage.getItem('stmt_dashboard_last_search') || ''; } catch (e) { return ''; }
}
function saveLastDrilldownSearch(v) {
  try { if (v && v.length) localStorage.setItem('stmt_dashboard_last_search', v); else localStorage.removeItem('stmt_dashboard_last_search'); } catch (e) {}
}

function updateSelectionBadges() {
  ['Cashflow','Investment','Income','Expenses'].forEach(k => {
    const el = document.getElementById(`badge-${k}`);
    if (!el) return;
    if (k === 'Cashflow') { el.style.display = 'none'; return; }
    const cnt = (widgetSelections[k] || new Set()).size;
    if (cnt > 0) { el.style.display = ''; el.textContent = cnt; } else { el.style.display = 'none'; }
  });
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
  renderDashboardWidgets(filterTransactionsBySlicer(transactions));
  // Wire apply button
  const applyBtn = document.getElementById('slicer-apply');
  if (applyBtn) {
    applyBtn.onclick = () => {
      const filtered = filterTransactionsBySlicer(allTransactions);
      renderDashboardWidgets(filtered);
      // If a drilldown is currently visible, re-run it for the same type if possible
      const current = document.getElementById('drilldown-tbody');
      if (current && window.lastDrillType) showDrilldown(window.lastDrillType, filtered);
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

// Render dashboard widgets
function renderDashboardWidgets(transactions) {
  const isSmall = window.matchMedia && window.matchMedia('(max-width:576px)').matches;
  // Cashflow widget
  const cashflow = transactions.reduce((acc, txn) => {
    if (txn.txn_type === 'Income') acc.income += txn.txn_amount;
    if (txn.txn_type === 'Expense') acc.expense += txn.txn_amount;
    if (txn.txn_type === 'Investment') acc.investment += txn.txn_amount;
    return acc;
  }, { income: 0, expense: 0, investment: 0 });
  document.getElementById('cashflow-content').innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <span class="fw-bold">Income</span>
      <span class="fw-bold">₹${cashflow.income.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
    </div>
    <div class="d-flex justify-content-between align-items-center mb-2">
      <span class="fw-bold">Expense</span>
      <span class="fw-bold">₹${cashflow.expense.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
    </div>
    <div class="d-flex justify-content-between align-items-center">
      <span class="fw-bold">Investment</span>
      <span class="fw-bold">₹${cashflow.investment.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
    </div>
  `;

  // Always render the standard cashflow widget (no compact mobile card)
  document.getElementById('cashflow-widget').classList.remove('compact');

  // Investment widget (category-wise, descending)
  const investByCat = {};
  transactions.filter(txn => txn.txn_type === 'Investment').forEach(txn => {
    investByCat[txn.category] = (investByCat[txn.category] || 0) + txn.txn_amount;
  });
  const investSorted = Object.entries(investByCat).sort((a, b) => b[1] - a[1]);
  // Render top 5 items with selection checkboxes; keep the rest hidden until 'Load more...' is clicked
  document.getElementById('investment-content').innerHTML = `<div style="max-height:260px;overflow-y:auto;">
    ${investSorted.slice(0,5).map(([cat, amt]) =>
      `<div class='d-flex justify-content-between align-items-center mb-2'><label class="mb-0"><input type="checkbox" class="widget-cat-chk" data-widget="Investment" data-cat="${cat}" checked> <span class="ms-2">${cat}</span></label><span>₹${amt.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>`
    ).join('')}
    ${investSorted.slice(5).map(([cat, amt]) =>
      `<div class='d-flex justify-content-between align-items-center mb-2 more-item invest-more d-none'><label class="mb-0"><input type="checkbox" class="widget-cat-chk" data-widget="Investment" data-cat="${cat}" checked> <span class="ms-2">${cat}</span></label><span>₹${amt.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>`
    ).join('')}
  </div>` + (investSorted.length > 5 ? '<div class="text-end small text-muted"><a href="#" id="invest-loadmore">Load more...</a></div>' : '');
  // Wire up toggle handler for investment 'Load more'
  if (investSorted.length > 5) {
    setTimeout(() => {
      const btn = document.getElementById('invest-loadmore');
      if (btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          e.preventDefault();
          const hidden = Array.from(document.querySelectorAll('#investment-content .invest-more'));
          let anyHidden = hidden.some(h => h.classList.contains('d-none'));
          hidden.forEach(h => {
            if (anyHidden) h.classList.remove('d-none'); else h.classList.add('d-none');
          });
          btn.textContent = anyHidden ? 'Show less' : 'Load more...';
        });
      }
    }, 0);
  }
  // wire up category checkbox handlers for investment
  setTimeout(() => {
    // initialize from persisted selections if available
    loadWidgetSelections();
    document.querySelectorAll('#investment-content .widget-cat-chk').forEach(chk => {
      const cat = chk.dataset.cat;
      // if persisted selection exists, use it; otherwise default to checked
      const set = widgetSelections.Investment;
      if (set.size === 0) set.add(cat);
      chk.checked = set.has(cat);
      chk.addEventListener('change', function(e) {
        e.stopPropagation();
        const c = this.dataset.cat;
        if (this.checked) widgetSelections.Investment.add(c); else widgetSelections.Investment.delete(c);
        saveWidgetSelections(); updateSelectionBadges();
        // if investment drilldown is visible, refresh it
        try { if (window.lastDrillType === 'Investment') showDrilldown('Investment', transactions); } catch (e) {}
      });
      // prevent checkbox click from opening drilldown
      chk.addEventListener('click', e => e.stopPropagation());
    });
  }, 0);
  // Always use the standard list layout for investment (no compact mobile card)
  document.getElementById('investment-widget').classList.remove('compact');

  // Income widget (category-wise, descending)
  const incomeByCat = {};
  transactions.filter(txn => txn.txn_type === 'Income').forEach(txn => {
    incomeByCat[txn.category] = (incomeByCat[txn.category] || 0) + txn.txn_amount;
  });
  const incomeSorted = Object.entries(incomeByCat).sort((a, b) => b[1] - a[1]);
  document.getElementById('income-content').innerHTML = `<div style="max-height:260px;overflow-y:auto;">
    ${incomeSorted.slice(0,5).map(([cat, amt]) =>
      `<div class='d-flex justify-content-between align-items-center mb-2'><label class="mb-0"><input type="checkbox" class="widget-cat-chk" data-widget="Income" data-cat="${cat}" checked> <span class="ms-2">${cat}</span></label><span>₹${amt.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>`
    ).join('')}
    ${incomeSorted.slice(5).map(([cat, amt]) =>
      `<div class='d-flex justify-content-between align-items-center mb-2 more-item income-more d-none'><label class="mb-0"><input type="checkbox" class="widget-cat-chk" data-widget="Income" data-cat="${cat}" checked> <span class="ms-2">${cat}</span></label><span>₹${amt.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>`
    ).join('')}
  </div>` + (incomeSorted.length > 5 ? '<div class="text-end small text-muted"><a href="#" id="income-loadmore">Load more...</a></div>' : '');
  // Wire up toggle handler for income 'Load more'
  if (incomeSorted.length > 5) {
    setTimeout(() => {
      const btn = document.getElementById('income-loadmore');
      if (btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          e.preventDefault();
          const hidden = Array.from(document.querySelectorAll('#income-content .income-more'));
          let anyHidden = hidden.some(h => h.classList.contains('d-none'));
          hidden.forEach(h => {
            if (anyHidden) h.classList.remove('d-none'); else h.classList.add('d-none');
          });
          btn.textContent = anyHidden ? 'Show less' : 'Load more...';
        });
      }
    }, 0);
  }
  // wire category checkbox handlers for income
  setTimeout(() => {
    document.querySelectorAll('#income-content .widget-cat-chk').forEach(chk => {
      const cat = chk.dataset.cat;
      const set = widgetSelections.Income;
      if (set.size === 0) set.add(cat);
      chk.checked = set.has(cat);
      chk.addEventListener('change', function(e) {
        e.stopPropagation();
        const c = this.dataset.cat;
        if (this.checked) widgetSelections.Income.add(c); else widgetSelections.Income.delete(c);
        saveWidgetSelections(); updateSelectionBadges();
        try { if (window.lastDrillType === 'Income') showDrilldown('Income', transactions); } catch (e) {}
      });
      chk.addEventListener('click', e => e.stopPropagation());
    });
  }, 0);
  // Always use the standard list layout for income (no compact mobile card)
  document.getElementById('income-widget').classList.remove('compact');

  // Expenses widget (category-wise only, descending)
  const expenseByCatTotal = {};
  transactions.filter(txn => txn.txn_type === 'Expense').forEach(txn => {
    expenseByCatTotal[txn.category] = (expenseByCatTotal[txn.category] || 0) + txn.txn_amount;
  });
  const expenseSorted = Object.entries(expenseByCatTotal).sort((a, b) => b[1] - a[1]);
  document.getElementById('expenses-content').innerHTML = `<div style="max-height:260px;overflow-y:auto;">
    ${expenseSorted.slice(0,5).map(([cat, amt]) =>
      `<div class='d-flex justify-content-between align-items-center mb-2'><label class="mb-0"><input type="checkbox" class="widget-cat-chk" data-widget="Expenses" data-cat="${cat}" checked> <span class="ms-2">${cat}</span></label><span>₹${amt.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>`
    ).join('')}
    ${expenseSorted.slice(5).map(([cat, amt]) =>
      `<div class='d-flex justify-content-between align-items-center mb-2 more-item expense-more d-none'><label class="mb-0"><input type="checkbox" class="widget-cat-chk" data-widget="Expenses" data-cat="${cat}" checked> <span class="ms-2">${cat}</span></label><span>₹${amt.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>`
    ).join('')}
  </div>` + (expenseSorted.length > 5 ? '<div class="text-end small text-muted"><a href="#" id="expense-loadmore">Load more...</a></div>' : '');
  // Wire up toggle handler for expenses 'Load more'
  if (expenseSorted.length > 5) {
    setTimeout(() => {
      const btn = document.getElementById('expense-loadmore');
      if (btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          e.preventDefault();
          const hidden = Array.from(document.querySelectorAll('#expenses-content .expense-more'));
          let anyHidden = hidden.some(h => h.classList.contains('d-none'));
          hidden.forEach(h => {
            if (anyHidden) h.classList.remove('d-none'); else h.classList.add('d-none');
          });
          btn.textContent = anyHidden ? 'Show less' : 'Load more...';
        });
      }
    }, 0);
  }
  // wire category checkbox handlers for expenses
  setTimeout(() => {
    document.querySelectorAll('#expenses-content .widget-cat-chk').forEach(chk => {
      const cat = chk.dataset.cat;
      const set = widgetSelections.Expenses;
      if (set.size === 0) set.add(cat);
      chk.checked = set.has(cat);
      chk.addEventListener('change', function(e) {
        e.stopPropagation();
        const c = this.dataset.cat;
        if (this.checked) widgetSelections.Expenses.add(c); else widgetSelections.Expenses.delete(c);
        saveWidgetSelections(); updateSelectionBadges();
        try { if (window.lastDrillType === 'Expenses') showDrilldown('Expenses', transactions); } catch (e) {}
      });
      chk.addEventListener('click', e => e.stopPropagation());
    });
  }, 0);
  // Always use the standard list layout for expenses (no compact mobile card)
  document.getElementById('expenses-widget').classList.remove('compact');

  // Add drilldown event listeners
  document.getElementById('cashflow-content').onclick = () => showDrilldown('Cashflow', transactions);
  document.getElementById('investment-content').onclick = () => showDrilldown('Investment', transactions);
  document.getElementById('income-content').onclick = () => showDrilldown('Income', transactions);
  document.getElementById('expenses-content').onclick = () => showDrilldown('Expenses', transactions);
  // update badges after rendering
  updateSelectionBadges();
}

// Simple sparkline generator using block chars
// SVG sparkline generator (returns inline SVG string)
function svgSparkline(values, width=80, height=24) {
  if (!values || values.length === 0) return '';
  const nums = values.map(v => Number(v) || 0);
  const max = Math.max(...nums.map(n => Math.abs(n)));
  const min = Math.min(...nums);
  const len = nums.length;
  const step = len > 1 ? (width / (len - 1)) : width;
  const points = nums.map((v, i) => {
    const x = Math.round(i * step);
    const y = max === 0 ? height : Math.round(height - ((v - min) / (max - min || 1)) * (height - 4)) + 2;
    return `${x},${y}`;
  }).join(' ');
  const stroke = '#1976d2';
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><polyline points="${points}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

// Favorites utility: store favorite widget types in localStorage
function loadFavorites() {
  try { return JSON.parse(localStorage.getItem('stmt_dashboard_favs') || '[]'); } catch (e) { return []; }
}
function saveFavorites(favs) { try { localStorage.setItem('stmt_dashboard_favs', JSON.stringify(favs)); } catch (e) {} }
function wireFavButton(btn, type) {
  const favs = loadFavorites();
  const isFav = favs.includes(type);
  btn.textContent = isFav ? '♥' : '♡';
  btn.classList.toggle('btn-warning', isFav);
  btn.onclick = function(e) {
    e.stopPropagation();
    const cur = loadFavorites();
    const idx = cur.indexOf(type);
    if (idx === -1) cur.push(type); else cur.splice(idx,1);
    saveFavorites(cur);
    btn.textContent = cur.includes(type) ? '♥' : '♡';
    btn.classList.toggle('btn-warning', cur.includes(type));
  };
}

// Drilldown handler with table, filter, sort, group
function showDrilldown(type, transactions) {
  let filteredTxns = transactions;
  let columns = [];
  if (type === 'Cashflow') {
    columns = ['txn_date', 'txn_type', 'txn_amount', 'narration'];
  } else if (type === 'Investment') {
    filteredTxns = transactions.filter(txn => txn.txn_type === 'Investment');
    columns = ['txn_date', 'category', 'txn_amount', 'narration'];
  } else if (type === 'Income') {
    filteredTxns = transactions.filter(txn => txn.txn_type === 'Income');
    columns = ['txn_date', 'category', 'txn_amount', 'narration'];
  } else if (type === 'Expenses') {
    filteredTxns = transactions.filter(txn => txn.txn_type === 'Expense');
    columns = ['txn_date', 'category', 'sub_category', 'txn_amount', 'narration'];
  }
  // Remember last drill type for re-render after slicer apply
  window.lastDrillType = type;
  const isSmall = window.matchMedia && window.matchMedia('(max-width:576px)').matches;
  // Apply widget category selections: if a widget has checkboxes, filter drilldown by selected categories
  if (['Investment','Income','Expenses'].includes(type)) {
    const sel = Array.from(widgetSelections[type] || []);
    if (sel.length > 0) {
      filteredTxns = filteredTxns.filter(txn => sel.includes(txn.category));
    } else {
      // If nothing selected, show no rows
      filteredTxns = [];
    }
  }

  // Container: records count and search popover (popover opens a small search box)
  const searchBtnId = 'drilldown-search-btn';
  const popId = 'drilldown-search-pop';
  const popInputId = 'drilldown-pop-search';
  const popBtnId = 'drilldown-pop-btn';
      let contentHtml = `<div class='d-flex justify-content-between align-items-center mb-2'>
    <div class='small text-muted' id='drilldown-records'>Records: ${filteredTxns.length} out of ${transactions.length}</div>
    <div class='position-relative'>
      <button id='${searchBtnId}' class='btn btn-sm btn-light' title='Search'><span class='material-icons'>search</span></button>
      <div id='${popId}' class='card p-2' style='position:absolute;right:0;top:36px;z-index:1000;display:none;min-width:220px;'>
        <div class='input-group input-group-sm'>
          <input id='${popInputId}' class='form-control' placeholder='Search...'>
          <button id='${popBtnId}' class='btn btn-primary btn-sm'>Search</button>
        </div>
        <div class='d-flex align-items-center gap-2 mt-2'>
          <div id='drilldown-spinner' style='display:none'><div class='spinner-border spinner-border-sm text-primary' role='status'><span class='visually-hidden'>Loading...</span></div></div>
          <div class='small text-muted' id='drilldown-progress' style='display:none'>Filtering...</div>
          <button id='drilldown-cancel' class='btn btn-sm btn-outline-secondary ms-auto' style='display:none'>Cancel</button>
        </div>
      </div>
    </div>
  </div><div style='max-height:400px;overflow-y:auto;'>`;
  const labelMap = {
    txn_date: 'Date', txn_type: 'Type', txn_amount: 'Amount', narration: 'Narration', category: 'Category', sub_category: 'Sub Category'
  };
  if (!isSmall) {
    contentHtml += `<table class='table table-bordered table-sm'><thead><tr>` +
      columns.map(col => `<th style='cursor:pointer' onclick='window.sortDrilldown && window.sortDrilldown("${col}")'>${labelMap[col] || col.replace('_',' ').toUpperCase()}</th>`).join('') +
      `</tr></thead><tbody id='drilldown-body'>` +
      renderRowsTable(filteredTxns, columns) +
      `</tbody></table>`;
  } else {
    contentHtml += `<div id='drilldown-body' class='d-flex flex-column'>` + renderCardsList(filteredTxns, columns) + `</div>`;
  }
  contentHtml += `</div>`;
  document.getElementById('drilldown-section').innerHTML = contentHtml;
  // Note: inline text filters were removed. Filtering for drilldown is provided by the search popover.
  (function() {
    const pop = document.getElementById(popId);
    const btn = document.getElementById(searchBtnId);
    const input = document.getElementById(popInputId);
    const popBtn = document.getElementById(popBtnId);
    const recEl = document.getElementById('drilldown-records');
    let lastSearch = '';
    function updateRecords() {
      const total = transactions.length;
      const visible = Array.from(document.querySelectorAll('#drilldown-section .drill-row')).filter(r => r.style.display !== 'none').length;
      if (recEl) recEl.textContent = `Records: ${visible} out of ${total}`;
    }
    let _filterCancelRequested = false;
    let _lastVisibilitySnapshot = null;
    function applyFilter(q) {
      lastSearch = q || '';
      const rows = Array.from(document.querySelectorAll('#drilldown-section .drill-row'));
      if (!q) {
        rows.forEach(r => r.style.display = '');
        updateRecords();
        return;
      }
      const qq = q.toLowerCase();
      // Process in chunks to avoid blocking UI for very large lists
      const chunkSize = 200; // number of rows per tick
      let idx = 0;
      let visibleCount = 0;
  const spinner = document.getElementById('drilldown-spinner');
  const progress = document.getElementById('drilldown-progress');
  const cancelBtn = document.getElementById('drilldown-cancel');
  _filterCancelRequested = false;
  // capture previous visibility so cancel can restore
  _lastVisibilitySnapshot = rows.map(r => r.style.display || '');
  if (spinner) spinner.style.display = '';
  if (progress) progress.style.display = '';
  if (cancelBtn) { cancelBtn.style.display = ''; cancelBtn.onclick = function(e) { e.stopPropagation(); _filterCancelRequested = true; } }
      function processChunk() {
        const end = Math.min(idx + chunkSize, rows.length);
        for (let i = idx; i < end; i++) {
          if (_filterCancelRequested) break;
          const r = rows[i];
          const s = String(r.getAttribute('data-search') || '');
          const found = s.indexOf(qq) !== -1;
          r.style.display = found ? '' : 'none';
          if (found) visibleCount++;
        }
        // incremental update so user sees progress
        if (recEl) recEl.textContent = `Records: ${visibleCount} out of ${transactions.length}`;
        idx = end;
        if (_filterCancelRequested) {
          // restore previous visibility
          rows.forEach((r, i) => { r.style.display = _lastVisibilitySnapshot[i] || ''; });
          if (spinner) spinner.style.display = 'none';
          if (progress) progress.style.display = 'none';
          if (cancelBtn) cancelBtn.style.display = 'none';
          return;
        }
        if (idx < rows.length) {
          // yield to main thread
          setTimeout(processChunk, 16);
        } else {
          // finished
          if (spinner) spinner.style.display = 'none';
          if (progress) progress.style.display = 'none';
          if (cancelBtn) cancelBtn.style.display = 'none';
        }
      }
      // kick off
      visibleCount = 0; idx = 0; processChunk();
    }
      if (btn && pop) {
      btn.onclick = function(e) {
        e.stopPropagation();
        const wasHidden = (pop.style.display === 'none' || !pop.style.display);
        pop.style.display = wasHidden ? '' : 'none';
        // pre-fill last search term if opening
        if (wasHidden) {
          const last = loadLastDrilldownSearch();
          if (input) { input.value = last || ''; setTimeout(()=>input.focus(), 50); }
        }
      };
      popBtn.onclick = function(e) { e.preventDefault(); e.stopPropagation(); const q = input.value || ''; saveLastDrilldownSearch(q); applyFilter(q); pop.style.display = 'none'; };
      // Enter key triggers search
      if (input) input.addEventListener('keydown', function(ev) { if (ev.key === 'Enter') { ev.preventDefault(); popBtn.click(); } });
      // close popover when clicking outside
      document.addEventListener('click', function(ev) {
        if (!pop) return;
        if (ev.target === btn || btn.contains(ev.target) || pop.contains(ev.target)) return;
        pop.style.display = 'none';
      });
    }
    // expose a helper so sorting can re-apply last search after re-render
    window._applyDrilldownSearch = applyFilter;
    // initial records update
    updateRecords();
  })();

  // Sorting logic: re-render into the same container depending on viewport
  window.sortDrilldown = function(col) {
    let sorted = [...filteredTxns].sort((a, b) => {
      if (col === 'txn_amount') return b[col] - a[col];
      return String(b[col]||'').localeCompare(String(a[col]||''));
    });
    const body = document.getElementById('drilldown-body');
    if (!body) return;
    if (!isSmall) {
      body.innerHTML = renderRowsTable(sorted, columns);
    } else {
      body.innerHTML = renderCardsList(sorted, columns);
    }
    // re-apply last search if any
    try {
      if (window._applyDrilldownSearch) {
        const popVal = document.getElementById('drilldown-pop-search')?.value;
        const useVal = (popVal && popVal.length) ? popVal : loadLastDrilldownSearch();
        window._applyDrilldownSearch(useVal || '');
      }
    } catch (e) {}
  };

  function escapeAttr(s) { return (s||'').toString().replace(/"/g, '&quot;'); }
  function renderRowsTable(rows, cols) {
    return rows.map(txn => {
      const searchStr = cols.map(c => String(txn[c] || '')).join('|||').toLowerCase();
      return `<tr class='drill-row' data-search="${escapeAttr(searchStr)}" ${cols.map(c => `data-${c}="${escapeAttr(txn[c])}"`).join(' ')}>` + cols.map(c => {
        let val = txn[c];
        if (c === 'txn_amount') val = `₹${Number(val).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        return `<td>${val || ''}</td>`;
      }).join('') + `</tr>`;
    }).join('');
  }

  function renderCardsList(rows, cols) {
    return rows.map(txn => {
      const searchStr = cols.map(c => String(txn[c] || '')).join('|||').toLowerCase();
      return `<div class='drill-row card mb-2' data-search="${escapeAttr(searchStr)}" ${cols.map(c => `data-${c}="${escapeAttr(txn[c])}"`).join(' ')}><div class='card-body p-2'>` +
        cols.map(c => {
          let val = txn[c];
          if (c === 'txn_amount') val = `₹${Number(val).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
          const label = c.replace('_',' ').toUpperCase();
          return `<div class='d-flex justify-content-between'><div class='text-muted small'>${label}</div><div>${val || ''}</div></div>`;
        }).join('<hr class="my-1">') + `</div></div>`;
    }).join('');
  }
}
