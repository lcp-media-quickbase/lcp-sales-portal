// LCP Sales Portal - Configuration & Shared Utilities
// App ID: bvvpht7z6 | Realm: lcp360-5583.quickbase.com

const CONFIG = {
    version: '1.5.0',
    versionUrl: 'https://raw.githubusercontent.com/lcp-media-quickbase/lcp-sales-portal/main/codepages/version.json',
    
    getRealmHostname: function() { return window.location.hostname; },
    crossAppRealm: 'lcpmedia.quickbase.com',
    appId: 'bvvpht7z6',
    
    tables: {
        orders: 'bvvpht73m',
        orderLineItems: 'bvvpht749',
        quotes3D: 'bvvpht76j',
        lineItems3D: 'bvvpht773',
        properties: 'bvvpht79i',
        products: 'bvdjrfrja',
        companies: 'bvdjrk2qq',
        yardiCodes: 'bvkv6qbt9',
        propertiesMaster: 'bvdjrndec'
    },
    
    fields: {
        orders: {
            recordId: 3, dateCreated: 1, dateModified: 2, quoteDate: 6, expirationDate: 7,
            salesRepEmail: 8, historyNotes: 9, orderStatus: 10, orderName: 11, orderPDF: 12,
            propertyWorksheet: 13, relatedCompany: 18, companyYcrmId: 19, companyYcrmName: 20, companyName: 21,
            billingContactName: 22, billingContactEmail: 23, billingContactPhone: 24, ycrmOpportunityId: 39
        },
        orderLineItems: {
            recordId: 3, quantity: 6, total: 7, description: 8, notes: 9, relatedOrder: 10,
            orderQuoteDate: 11, orderExpirationDate: 12, relatedCode: 13, codeProductNames: 14,
            codeProductDescription: 15, codeRetailPrice: 16, codeUnitOfMeasure: 17, codeBillingFrequency: 18,
            concession: 21, concessionPercent: 22, relatedProperty: 23
        },
        quotes3D: {
            recordId: 3, dateCreated: 1, dateModified: 2, quoteDate: 6, expirationDate: 7,
            salesRepEmail: 8, historyNotes: 9, quoteStatus: 10, quoteName: 11, quotePDF: 12,
            relatedCompany: 17, companyName: 18, companyYcrmId: 19, companyYcrmName: 20
        },
        lineItems3D: {
            recordId: 3, quantity: 6, total: 7, description: 8, notes: 9, relatedQuote: 10,
            quoteDate: 11, quoteExpirationDate: 12, relatedProduct: 13, productName: 14, productRetailPrice: 15,
            stills: 16, panos: 17
        },
        properties: {
            recordId: 3, relatedOrder: 6, orderQuoteDate: 7, orderExpirationDate: 8, relatedQuote3D: 9,
            quote3DQuoteDate: 10, quote3DExpirationDate: 11, relatedProperty: 12, propertyName: 13,
            propertyAddress: 14, propertyStreet1: 15, propertyStreet2: 16, propertyCity: 17,
            propertyState: 18, propertyPostalCode: 19, propertyCountry: 20
        },
        propertiesMaster: {
            recordId: 3, propertyName: 12, address: 13, street1: 14, street2: 15,
            city: 16, state: 17, postalCode: 18, country: 19, streetAddress: 20,
            billingContact: 21, billingEmail: 22, billingPhone: 23
        },
        companies: { recordId: 3, name: 8, ycrmId: 9, ycrmName: 13 },
        yardiCodes: {
            recordId: 3, code: 6, productDescription: 7, unitOfMeasure: 8,
            retailPrice: 9, billingFrequency: 10, pipelineAssetType: 18
        },
        products3D: {
            recordId: 3, productType: 12, productName: 13, retailPrice: 16
        }
    },
    
    quoteStatuses: ['Draft', 'Pending Review', 'Sent to Client', 'Approved', 'Rejected', 'Expired'],
    orderStatuses: ['Draft', 'Pending', 'Processing', 'Completed', 'Cancelled']
};

Object.freeze(CONFIG);

// ============================================================================
// THEME MANAGEMENT
// ============================================================================

function getTheme() { return localStorage.getItem('lcp-theme') || 'dark'; }

function setTheme(theme) {
    localStorage.setItem('lcp-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    var toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.innerHTML = theme === 'light' 
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
            : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
    }
}

function toggleTheme() { setTheme(getTheme() === 'light' ? 'dark' : 'light'); }
function initTheme() { document.documentElement.setAttribute('data-theme', getTheme()); }
initTheme();

// ============================================================================
// API UTILITIES - Auth via QB session cookie
// ============================================================================

var TEMP_TOKEN_LIFETIME = 4 * 60 * 1000; // 4 min (tokens expire at 5)
var _tempTokens = {}; // { tableId: { token, expiresAt } }

// Tables in current app vs parent app
var CURRENT_APP_TABLES = ['bvvpht73m', 'bvvpht749', 'bvvpht76j', 'bvvpht773', 'bvvpht79i'];
var PARENT_APP_TABLES = ['bvdjrfrja', 'bvdjrk2qq', 'bvkv6qbt9', 'bvdjrndec'];

async function getTempToken(tableId) {
    // Check cache
    var cached = _tempTokens[tableId];
    if (cached && Date.now() < cached.expiresAt) {
        return cached.token;
    }
    
    var realm = CONFIG.getRealmHostname();
    var resp = await fetch(
        'https://api.quickbase.com/v1/auth/temporary/' + tableId,
        {
            method: 'GET',
            headers: {
                'QB-Realm-Hostname': realm,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        }
    );
    
    if (!resp.ok) {
        var errData = await resp.json().catch(function() { return {}; });
        console.error('getTempToken failed for', tableId, ':', resp.status, errData);
        throw new Error(errData.message || 'Failed to get temp token for ' + tableId);
    }
    
    var data = await resp.json();
    _tempTokens[tableId] = {
        token: data.temporaryAuthorization,
        expiresAt: Date.now() + TEMP_TOKEN_LIFETIME
    };
    console.log('[Auth] Temp token acquired for', tableId);
    return data.temporaryAuthorization;
}

async function qbApiRequest(tableId, endpoint, method, body) {
    method = method || 'POST';
    
    var token = await getTempToken(tableId);
    var realm = CONFIG.getRealmHostname();
    
    var opts = { 
        method: method, 
        headers: { 
            'QB-Realm-Hostname': realm, 
            'Authorization': 'QB-TEMP-TOKEN ' + token, 
            'Content-Type': 'application/json' 
        },
        credentials: 'include'
    };
    if (body) opts.body = JSON.stringify(body);
    
    console.log('QB API Request:', method, endpoint, 'table:', tableId);
    var r = await fetch('https://api.quickbase.com/v1/' + endpoint, opts);
    var responseData = await r.json().catch(function() { return {}; });
    
    if (!r.ok) {
        console.error('QB API Error:', r.status, responseData);
        throw new Error(responseData.message || responseData.description || 'API failed: ' + r.status);
    }
    return responseData;
}

async function queryRecords(tableId, select, where, sortBy) {
    const body = { from: tableId, select };
    if (where) body.where = where;
    if (sortBy) body.sortBy = sortBy;
    return qbApiRequest(tableId, 'records/query', 'POST', body);
}

async function createRecord(tableId, data) {
    try {
        console.log('Creating record in table:', tableId, 'data:', JSON.stringify(data));
        var result = await qbApiRequest(tableId, 'records', 'POST', { to: tableId, data: [data] });
        console.log('Create result:', result);
        return result;
    } catch (e) {
        console.error('createRecord failed for table', tableId, ':', e);
        throw e;
    }
}

// ============================================================================
// UI UTILITIES
// ============================================================================

function showLoading(c) { c.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading...</p></div>'; }
function showError(c, m) { c.innerHTML = `<div class="error-message"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><p>${m}</p></div>`; }

function showSuccess(msg) {
    const t = document.createElement('div');
    t.className = 'toast toast-success';
    t.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span>${msg}</span>`;
    document.body.appendChild(t);
    setTimeout(() => { t.classList.add('toast-fade-out'); setTimeout(() => t.remove(), 300); }, 3000);
}

function formatCurrency(v) { return (v || v === 0) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v) : '$0.00'; }
function formatDate(d) { return d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''; }
function getTodayISO() { return new Date().toISOString().split('T')[0]; }
function getExpirationDate(days = 30) { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().split('T')[0]; }

function formatPhoneNumber(input) {
    var value = input.value.replace(/\D/g, '');
    if (value.length > 10) value = value.substring(0, 10);
    if (value.length > 6) {
        input.value = '(' + value.substring(0,3) + ') ' + value.substring(3,6) + '-' + value.substring(6);
    } else if (value.length > 3) {
        input.value = '(' + value.substring(0,3) + ') ' + value.substring(3);
    } else if (value.length > 0) {
        input.value = '(' + value;
    }
}

// ============================================================================
// NAVIGATION
// ============================================================================

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => { t.style.display = 'none'; });
    const sel = document.getElementById(tabId);
    if (sel) sel.style.display = 'flex';
    document.querySelectorAll('.nav-item').forEach(i => { i.classList.remove('active'); });
    const nav = document.querySelector(`[data-tab="${tabId}"]`);
    if (nav) nav.classList.add('active');
    if (tabId === 'tab-order-history') loadOrderHistory();
    else if (tabId === 'tab-quote-history') loadQuoteHistory();
    else if (tabId === 'tab-price-list') loadPriceList();
}

// ============================================================================
// VERSION & MODALS
// ============================================================================

async function checkVersion() {
    try {
        const r = await fetch(CONFIG.versionUrl + '?t=' + Date.now());
        const d = await r.json();
        if (d.version !== CONFIG.version) {
            const n = document.createElement('div');
            n.className = 'version-notice';
            n.innerHTML = `<span>New version (${d.version}) available.</span><button onclick="location.reload(true)">Refresh</button><button onclick="this.parentElement.remove()">Dismiss</button>`;
            document.body.insertBefore(n, document.body.firstChild);
        }
    } catch (e) { console.warn('Version check failed'); }
}

function openModal(id) { const m = document.getElementById(id); if (m) { m.style.display = 'flex'; document.body.style.overflow = 'hidden'; } }
function closeModal(id) { const m = document.getElementById(id); if (m) { m.style.display = 'none'; document.body.style.overflow = ''; } }
function closeAllModals() { document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; }); document.body.style.overflow = ''; }
document.addEventListener('click', e => { if (e.target.classList.contains('modal')) { e.target.style.display = 'none'; document.body.style.overflow = ''; } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllModals(); });

// ============================================================================
// RICH TEXT EDITOR
// ============================================================================

function execRichTextCommand(cmd, val = null) {
    document.execCommand(cmd, false, val);
    document.getElementById('order-notes-editor')?.focus();
}

function insertLink() {
    const url = prompt('Enter URL:', 'https://');
    if (url) document.execCommand('createLink', false, url);
}

function getRichTextContent(id) { const e = document.getElementById(id); return e ? e.innerHTML : ''; }
function setRichTextContent(id, c) { const e = document.getElementById(id); if (e) e.innerHTML = c || ''; }
