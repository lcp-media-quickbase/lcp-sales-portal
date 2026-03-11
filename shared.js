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
