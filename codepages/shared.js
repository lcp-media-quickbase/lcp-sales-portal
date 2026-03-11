// LCP Sales Portal - Configuration
// App ID: bvvpht7z6
// Realm: lcp360-5583.quickbase.com

const CONFIG = {
    // Version info
    version: '1.0.0',
    versionUrl: 'https://raw.githubusercontent.com/lcp-media-quickbase/lcp-sales-portal/main/version.json',
    
    // QuickBase realm detection
    getRealmHostname: function() {
        return window.location.hostname; // Auto-detect: lcp360-5583.quickbase.com
    },
    
    // Cross-app realm (for external tables like Products, Companies)
    crossAppRealm: 'lcpmedia.quickbase.com',
    
    // App ID
    appId: 'bvvpht7z6',
    
    // Table IDs
    tables: {
        orders: 'bvvpht73m',
        orderLineItems: 'bvvpht749',
        quotes3D: 'bvvpht76j',
        lineItems3D: 'bvvpht773',
        properties: 'bvvpht79i',
        // External tables (cross-app)
        products: 'bvdjrfrja',
        companies: 'bvdjrk2qq',
        yardiCodes: 'bvkv6qbt9',
        propertiesMaster: 'bvdjrndec'
    },
    
    // Field mappings - Orders table (bvvpht73m)
    fields: {
        orders: {
            recordId: 3,
            dateCreated: 1,
            dateModified: 2,
            quoteDate: 6,
            expirationDate: 7,
            salesRepEmail: 8,
            historyNotes: 9,
            orderStatus: 10,
            orderName: 11,
            orderPDF: 12,
            propertyWorksheet: 13,
            relatedCompany: 18,
            companyYcrmId: 19,
            companyYcrmName: 20,
            companyName: 21
        },
        
        // Order Line Items table (bvvpht749)
        orderLineItems: {
            recordId: 3,
            quantity: 6,
            total: 7,
            description: 8,
            notes: 9,
            relatedOrder: 10,
            orderQuoteDate: 11,
            orderExpirationDate: 12,
            relatedCode: 13,
            codeProductNames: 14,
            codeProductDescription: 15,
            codeRetailPrice: 16,
            codeUnitOfMeasure: 17,
            codeBillingFrequency: 18
        },
        
        // 3D Quotes table (bvvpht76j)
        quotes3D: {
            recordId: 3,
            dateCreated: 1,
            dateModified: 2,
            quoteDate: 6,
            expirationDate: 7,
            salesRepEmail: 8,
            historyNotes: 9,
            quoteStatus: 10,
            quoteName: 11,
            quotePDF: 12,
            relatedCompany: 17,
            companyName: 18,
            companyYcrmId: 19,
            companyYcrmName: 20
        },
        
        // 3D Line Items table (bvvpht773)
        lineItems3D: {
            recordId: 3,
            quantity: 6,
            total: 7,
            description: 8,
            notes: 9,
            relatedQuote: 10,
            quoteDate: 11,
            quoteExpirationDate: 12,
            relatedProduct: 13,
            productName: 14,
            productRetailPrice: 15
        },
        
        // Properties table (bvvpht79i)
        properties: {
            recordId: 3,
            relatedOrder: 6,
            orderQuoteDate: 7,
            orderExpirationDate: 8,
            relatedQuote3D: 9,
            quote3DQuoteDate: 10,
            quote3DExpirationDate: 11,
            relatedProperty: 12,
            propertyName: 13,
            propertyAddress: 14,
            propertyStreet1: 15,
            propertyStreet2: 16,
            propertyCity: 17,
            propertyState: 18,
            propertyPostalCode: 19,
            propertyCountry: 20
        }
    },
    
    // Quote status options (for 3D Quotes)
    quoteStatuses: [
        'Draft',
        'Pending Review',
        'Sent to Client',
        'Approved',
        'Rejected',
        'Expired'
    ],
    
    // Order status options
    orderStatuses: [
        'Draft',
        'Pending',
        'Processing',
        'Completed',
        'Cancelled'
    ]
};

// Freeze config to prevent accidental modification
Object.freeze(CONFIG);
Object.freeze(CONFIG.tables);
Object.freeze(CONFIG.fields);
// LCP Sales Portal - Shared Utilities
// CRITICAL RULES:
// - switchTab must use inline display:none/flex styles, never CSS classes
// - Nav items in renderDashboardNav are <a> tags closed with </a>, never </div>
// - buildDashboard must be synchronous (async causes blank screen)
// - Never use broad sed on this file - use targeted string replacements

// ============================================================================
// API UTILITIES
// ============================================================================

async function getTemporaryToken() {
    try {
        const response = await fetch(`https://${CONFIG.getRealmHostname()}/db/main?a=QBI_AuthenticateWithSession&fmt=json`, {
            method: 'POST',
            credentials: 'include'
        });
        const data = await response.json();
        return data.ticket;
    } catch (error) {
        console.error('Failed to get temporary token:', error);
        return null;
    }
}

async function qbApiRequest(tableId, endpoint, method = 'POST', body = null, useCrossAppRealm = false) {
    const token = await getTemporaryToken();
    if (!token) {
        throw new Error('Authentication failed');
    }
    
    const realm = useCrossAppRealm ? CONFIG.crossAppRealm : CONFIG.getRealmHostname();
    const url = `https://api.quickbase.com/v1/${endpoint}`;
    
    const headers = {
        'QB-Realm-Hostname': realm,
        'Authorization': `QB-TEMP-TOKEN ${token}`,
        'Content-Type': 'application/json'
    };
    
    const options = {
        method: method,
        headers: headers
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'API request failed');
    }
    
    return response.json();
}

async function queryRecords(tableId, select, where = null, sortBy = null, useCrossAppRealm = false) {
    const body = {
        from: tableId,
        select: select
    };
    
    if (where) {
        body.where = where;
    }
    
    if (sortBy) {
        body.sortBy = sortBy;
    }
    
    return qbApiRequest(tableId, 'records/query', 'POST', body, useCrossAppRealm);
}

async function createRecord(tableId, data) {
    const body = {
        to: tableId,
        data: [data]
    };
    
    return qbApiRequest(tableId, 'records', 'POST', body);
}

async function updateRecord(tableId, recordId, data) {
    const body = {
        to: tableId,
        data: [{
            ...data,
            [CONFIG.fields[getTableKey(tableId)].recordId]: { value: recordId }
        }]
    };
    
    return qbApiRequest(tableId, 'records', 'POST', body);
}

function getTableKey(tableId) {
    for (const [key, id] of Object.entries(CONFIG.tables)) {
        if (id === tableId) return key;
    }
    return null;
}

// ============================================================================
// UI UTILITIES
// ============================================================================

function showLoading(container) {
    container.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <p>Loading...</p>
        </div>
    `;
}

function showError(container, message) {
    container.innerHTML = `
        <div class="error-message">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <p>${message}</p>
        </div>
    `;
}

function showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatCurrency(value) {
    if (!value && value !== 0) return '$0.00';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(value);
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function getTodayISO() {
    return new Date().toISOString().split('T')[0];
}

function getExpirationDate(daysFromNow = 30) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
}

// ============================================================================
// NAVIGATION - CRITICAL: Use inline styles for display switching
// ============================================================================

function switchTab(tabId) {
    // Hide all tabs using inline styles (NEVER use CSS classes for this)
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Show selected tab using inline style
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
        selectedTab.style.display = 'flex';
    }
    
    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeNav = document.querySelector(`[data-tab="${tabId}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
    }
}

// ============================================================================
// VERSION CHECK
// ============================================================================

async function checkVersion() {
    try {
        const response = await fetch(CONFIG.versionUrl + '?t=' + Date.now());
        const data = await response.json();
        
        if (data.version !== CONFIG.version) {
            console.log(`New version available: ${data.version} (current: ${CONFIG.version})`);
            showVersionNotice(data.version);
        }
    } catch (error) {
        console.warn('Version check failed:', error);
    }
}

function showVersionNotice(newVersion) {
    const notice = document.createElement('div');
    notice.className = 'version-notice';
    notice.innerHTML = `
        <span>A new version (${newVersion}) is available.</span>
        <button onclick="location.reload(true)">Refresh</button>
        <button onclick="this.parentElement.remove()">Dismiss</button>
    `;
    document.body.insertBefore(notice, document.body.firstChild);
}

// ============================================================================
// MODAL UTILITIES
// ============================================================================

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    document.body.style.overflow = '';
}

// Close modal on outside click
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
        document.body.style.overflow = '';
    }
});

// Close modal on escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeAllModals();
    }
});
