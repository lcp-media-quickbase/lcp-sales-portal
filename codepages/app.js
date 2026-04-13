// LCP Sales Portal - Application Logic v1.0.2

const AppState = {
    selectedProduct: null, selectedClient: null, selectedQuoteClient: null,
    currentProductCallback: null, currentPropertyCallback: null,
    orderProperties: [], // [{propertyId, property, lineItems: [{id, productId, productName, quantity, unitPrice, total}], billingContact, billingEmail, billingPhone}]
    quoteProperties: [], // [{propertyId, property, attachments: [{id, file, description, linkUrl, needsReupload}]}]
    products: [], products3D: [], properties: [], clients: [], orders: [], quotes: [], priceList: [], cancellations: [], tourbuilder: [], tickets: [], companyInfo: [],
    attachmentCounter: 0,
    editingOrderId: null,
    editingQuoteId: null,
    currentUser: null
};

// ============================================================================
// INITIALIZATION
// ============================================================================

function buildDashboard() {
    setTheme(getTheme());
    document.getElementById('app-version').textContent = CONFIG.version;
    setupFormHandlers();
    setupClientSelector();
    loadProperties();
    loadProducts();
    load3DProducts();
    loadClients();
    checkVersion();
    loadDashboard();
    console.log('LCP Sales Portal initialized');
}

async function prefillCurrentUserEmail() {
    try {
        var user = AppState.currentUser || await getCurrentUser();
        if (user && user.email) {
            document.getElementById('order-sales-email').value = user.email;
            document.getElementById('quote-sales-email').value = user.email;
        }
    } catch (e) {
        console.error('Failed to prefill user email:', e);
    }
}

function setupFormHandlers() {
    document.getElementById('order-form').addEventListener('submit', async e => { e.preventDefault(); await saveOrder(); });
    document.getElementById('quote-form').addEventListener('submit', async e => { e.preventDefault(); await saveQuote(); });
}

function setupClientSelector() {
    document.addEventListener('click', e => {
        const sel = document.getElementById('client-selector');
        const dd = document.getElementById('client-dropdown');
        if (sel && !sel.contains(e.target)) dd.classList.remove('open');
        
        const quoteSel = document.getElementById('quote-client-selector');
        const quoteDd = document.getElementById('quote-client-dropdown');
        if (quoteSel && !quoteSel.contains(e.target)) quoteDd.classList.remove('open');
    });
}

// ============================================================================
// CLIENT MANAGEMENT
// ============================================================================

function toggleClientDropdown() {
    const dd = document.getElementById('client-dropdown');
    dd.classList.toggle('open');
    if (dd.classList.contains('open')) document.getElementById('client-search-input').focus();
}

async function loadClients() {
    try {
        const f = CONFIG.fields.companies;
        const r = await queryRecords(CONFIG.tables.companies, [f.recordId, f.name, f.ycrmId], null, [{ fieldId: f.ycrmId, order: 'ASC' }]);
        AppState.clients = r.data.map(rec => ({ id: rec[f.recordId].value, name: rec[f.name]?.value || '', ycrmId: rec[f.ycrmId]?.value || '' }));
        renderClientList();
        renderQuoteClientList();
    } catch (e) { console.error('Load clients failed:', e); AppState.clients = []; renderClientList(); renderQuoteClientList(); }
}

var CLIENT_DISPLAY_LIMIT = 50;

function renderClientList(searchTerm) {
    const c = document.getElementById('client-list');
    if (!c) return;
    if (!AppState.clients.length) { c.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">No clients found</div>'; return; }
    
    var term = (searchTerm || '').toLowerCase().trim();
    var filtered = AppState.clients.filter(cl => cl.ycrmId && (!term || (cl.name || '').toLowerCase().includes(term) || (cl.ycrmId || '').toLowerCase().includes(term)));

    if (!filtered.length) {
        c.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">No matching clients</div>';
        return;
    }

    var limited = filtered.slice(0, CLIENT_DISPLAY_LIMIT);
    var html = limited.map(cl => `<div class="client-item ${AppState.selectedClient?.id===cl.id?'selected':''}" onclick="selectClient(${cl.id})"><div class="client-item-name">${cl.name || 'No name'}</div><div class="client-item-id">${cl.ycrmId || 'No ID'}</div></div>`).join('');
    
    if (filtered.length > CLIENT_DISPLAY_LIMIT) {
        html += `<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:12px;">Showing ${CLIENT_DISPLAY_LIMIT} of ${filtered.length}. Type to search.</div>`;
    }
    c.innerHTML = html;
}

var clientFilterTimeout = null;
function filterClients() {
    clearTimeout(clientFilterTimeout);
    clientFilterTimeout = setTimeout(function() {
        var s = document.getElementById('client-search-input').value;
        renderClientList(s);
    }, 150);
}

function selectClient(id) {
    AppState.selectedClient = AppState.clients.find(c => c.id === id);
    document.getElementById('selected-client-name').textContent = AppState.selectedClient ? `${AppState.selectedClient.name || 'No name'}${AppState.selectedClient.ycrmId ? ' (' + AppState.selectedClient.ycrmId + ')' : ''}` : 'Select a client...';
    document.getElementById('order-company-id').value = id;
    document.getElementById('client-dropdown').classList.remove('open');
    renderClientList();
}

async function saveNewClient() {
    const name = document.getElementById('new-client-name').value.trim();
    if (!name) { alert('Company name required'); return; }
    const nc = { id: Date.now(), name, ycrmId: '' };
    AppState.clients.unshift(nc);
    renderClientList();
    renderQuoteClientList();
    selectClient(nc.id);
    document.getElementById('new-client-name').value = '';
    closeModal('add-client-modal');
    showSuccess('Client added');
}

// Quote Client Selector
function toggleQuoteClientDropdown() {
    const dd = document.getElementById('quote-client-dropdown');
    dd.classList.toggle('open');
    if (dd.classList.contains('open')) document.getElementById('quote-client-search-input').focus();
}

function renderQuoteClientList(searchTerm) {
    const c = document.getElementById('quote-client-list');
    if (!c) return;
    if (!AppState.clients.length) { c.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">No clients found</div>'; return; }
    
    var term = (searchTerm || '').toLowerCase().trim();
    var filtered = AppState.clients.filter(cl => cl.ycrmId && (!term || (cl.name || '').toLowerCase().includes(term) || (cl.ycrmId || '').toLowerCase().includes(term)));

    if (!filtered.length) {
        c.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">No matching clients</div>';
        return;
    }

    var limited = filtered.slice(0, CLIENT_DISPLAY_LIMIT);
    var html = limited.map(cl => `<div class="client-item ${AppState.selectedQuoteClient?.id===cl.id?'selected':''}" onclick="selectQuoteClient(${cl.id})"><div class="client-item-name">${cl.name || 'No name'}</div><div class="client-item-id">${cl.ycrmId || 'No ID'}</div></div>`).join('');
    
    if (filtered.length > CLIENT_DISPLAY_LIMIT) {
        html += `<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:12px;">Showing ${CLIENT_DISPLAY_LIMIT} of ${filtered.length}. Type to search.</div>`;
    }
    c.innerHTML = html;
}

var quoteClientFilterTimeout = null;
function filterQuoteClients() {
    clearTimeout(quoteClientFilterTimeout);
    quoteClientFilterTimeout = setTimeout(function() {
        var s = document.getElementById('quote-client-search-input').value;
        renderQuoteClientList(s);
    }, 150);
}

function selectQuoteClient(id) {
    AppState.selectedQuoteClient = AppState.clients.find(c => c.id === id);
    document.getElementById('quote-selected-client-name').textContent = AppState.selectedQuoteClient ? `${AppState.selectedQuoteClient.name || 'No name'}${AppState.selectedQuoteClient.ycrmId ? ' (' + AppState.selectedQuoteClient.ycrmId + ')' : ''}` : 'Select a client...';
    document.getElementById('quote-company-id').value = id;
    document.getElementById('quote-client-dropdown').classList.remove('open');
    renderQuoteClientList();
}

// ============================================================================
// PROPERTY MANAGEMENT
// ============================================================================

async function loadProperties() {
    try {
        const f = CONFIG.fields.propertiesMaster;
        const r = await queryRecords(CONFIG.tables.propertiesMaster, [f.recordId, f.propertyName, f.address, f.billingContact, f.billingEmail, f.billingPhone, f.unitCount], "{12.XEX.''}", [{ fieldId: f.propertyName, order: 'ASC' }]);
        AppState.properties = r.data.map(rec => ({
            id: rec[f.recordId].value,
            name: rec[f.propertyName]?.value || 'Unnamed',
            address: rec[f.address]?.value || '',
            billingContact: rec[f.billingContact]?.value || '',
            billingEmail: rec[f.billingEmail]?.value || '',
            billingPhone: rec[f.billingPhone]?.value || '',
            unitCount: rec[f.unitCount]?.value || 0
        }));
        renderPropertyList();
    } catch (e) { 
        console.error('Load properties failed:', e); 
        var tbody = document.getElementById('property-table-body');
        if (tbody) tbody.innerHTML = '<tr><td style="text-align:center;padding:40px;color:var(--text-muted)">Failed to load properties</td></tr>'; 
    }
}

function renderPropertyList() {
    var c = document.getElementById('property-table-body');
    if (!c) return;
    if (!AppState.properties.length) { 
        c.innerHTML = '<tr><td style="text-align:center;padding:40px;color:var(--text-muted)">No properties found</td></tr>'; 
        return; 
    }
    // Filter out already selected properties based on context
    var selectedIds = AppState.currentPropertyCallback === 'quote'
        ? AppState.quoteProperties.map(qp => qp.propertyId)
        : AppState.orderProperties.map(op => op.propertyId);
    var available = AppState.properties.filter(p => !selectedIds.includes(p.id));
    if (!available.length) {
        c.innerHTML = '<tr><td style="text-align:center;padding:40px;color:var(--text-muted)">All properties already added</td></tr>';
        return;
    }
    // Limit initial render to 100 items for performance - search filters the rest
    var displayLimit = 100;
    var limited = available.slice(0, displayLimit);
    var html = limited.map(p => `<tr class="property-row" onclick="addPropertyFromSelector(${p.id})" data-name="${(p.name||'').toLowerCase()}" data-address="${(p.address||'').toLowerCase()}" style="cursor:pointer;"><td><div class="property-name-large">${p.name}</div><div class="property-address-small">${p.address || 'No address'}</div></td></tr>`).join('');
    if (available.length > displayLimit) {
        html += `<tr><td style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px;">Showing ${displayLimit} of ${available.length} properties. Use search to find more.</td></tr>`;
    }
    c.innerHTML = html;
}

function filterProperties() {
    var s = document.getElementById('property-search-input').value.toLowerCase().trim();
    var c = document.getElementById('property-table-body');
    if (!c) return;
    
    // Get available properties based on context
    var selectedIds = AppState.currentPropertyCallback === 'quote'
        ? AppState.quoteProperties.map(qp => qp.propertyId)
        : AppState.orderProperties.map(op => op.propertyId);
    var available = AppState.properties.filter(p => !selectedIds.includes(p.id));
    
    // Filter by search term
    var filtered = s ? available.filter(p => 
        (p.name || '').toLowerCase().includes(s) || 
        (p.address || '').toLowerCase().includes(s)
    ) : available;
    
    if (!filtered.length) {
        c.innerHTML = '<tr><td style="text-align:center;padding:40px;color:var(--text-muted)">No matching properties</td></tr>';
        return;
    }
    
    // Show up to 100 matches
    var displayLimit = 100;
    var limited = filtered.slice(0, displayLimit);
    var html = limited.map(p => `<tr class="property-row" onclick="addPropertyFromSelector(${p.id})" data-name="${(p.name||'').toLowerCase()}" data-address="${(p.address||'').toLowerCase()}" style="cursor:pointer;"><td><div class="property-name-large">${p.name}</div><div class="property-address-small">${p.address || 'No address'}</div></td></tr>`).join('');
    if (filtered.length > displayLimit) {
        html += `<tr><td style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px;">Showing ${displayLimit} of ${filtered.length} matches. Refine search to see more.</td></tr>`;
    }
    c.innerHTML = html;
}

var propertyFilterTimeout = null;
function debouncedFilterProperties() {
    clearTimeout(propertyFilterTimeout);
    propertyFilterTimeout = setTimeout(filterProperties, 150);
}

function openPropertySelector() {
    AppState.currentPropertyCallback = 'order';
    renderPropertyList();
    document.getElementById('property-search-input').value = '';
    hideCreatePropertyForm();
    openModal('property-modal');
}

function showCreatePropertyForm() {
    document.getElementById('property-list-view').style.display = 'none';
    document.getElementById('property-create-view').style.display = 'block';
    document.getElementById('new-property-name').value = '';
    document.getElementById('new-property-street').value = '';
    document.getElementById('new-property-city').value = '';
    document.getElementById('new-property-state').value = '';
    document.getElementById('new-property-zip').value = '';
    document.getElementById('new-property-name').focus();
}

function hideCreatePropertyForm() {
    document.getElementById('property-list-view').style.display = 'block';
    document.getElementById('property-create-view').style.display = 'none';
}

const STATE_NAMES = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
    'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
    'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
    'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
    'DC': 'District of Columbia', 'PR': 'Puerto Rico', 'VI': 'Virgin Islands', 'GU': 'Guam'
};

async function createNewProperty() {
    const name = document.getElementById('new-property-name').value.trim();
    const street = document.getElementById('new-property-street').value.trim();
    const city = document.getElementById('new-property-city').value.trim();
    let state = document.getElementById('new-property-state').value.trim().toUpperCase();
    const zip = document.getElementById('new-property-zip').value.trim();
    
    if (!name) {
        alert('Property name is required');
        return;
    }
    
    // Convert state abbreviation to full name
    if (state && state.length === 2 && STATE_NAMES[state]) {
        state = STATE_NAMES[state];
    }
    
    // Build address string for local display
    let address = street;
    if (city || state || zip) {
        const cityStateZip = [city, state, zip].filter(Boolean).join(city && (state || zip) ? ', ' : ' ');
        address = address ? `${address}, ${cityStateZip}` : cityStateZip;
    }
    
    try {
        const pmf = CONFIG.fields.propertiesMaster;
        // Note: FID 13 (address) is a composite Address field - write to sub-fields only
        const propertyData = {
            [pmf.propertyName]: { value: name }
        };
        if (street) propertyData[pmf.street1] = { value: street };
        if (city) propertyData[pmf.city] = { value: city };
        if (state) propertyData[pmf.state] = { value: state };
        if (zip) propertyData[pmf.postalCode] = { value: zip };
        // Don't write to FID 13 (composite address) - QB auto-builds it from sub-fields
        
        console.log('Creating property with data:', JSON.stringify(propertyData));
        const result = await createRecord(CONFIG.tables.propertiesMaster, propertyData);
        const newPropertyId = result.metadata?.createdRecordIds?.[0];
        
        if (!newPropertyId) {
            if (result.metadata?.lineErrors) {
                console.error('Property creation error:', result.metadata.lineErrors);
                const firstError = Object.values(result.metadata.lineErrors)[0];
                throw new Error(Array.isArray(firstError) ? firstError[0] : 'Unknown error');
            }
            throw new Error('Failed to create property');
        }
        
        // Add to local state
        const newProperty = {
            id: newPropertyId,
            name: name,
            address: address,
            street1: street,
            city: city,
            state: state,
            postalCode: zip,
            billingContact: '',
            billingEmail: '',
            billingPhone: '',
            unitCount: 0
        };
        AppState.properties.push(newProperty);
        
        // Add to order/quote
        addPropertyFromSelector(newPropertyId);
        
        showSuccess(`Property "${name}" created!`);
        
    } catch (e) {
        console.error('Create property failed:', e);
        alert('Failed to create property: ' + e.message);
    }
}

function addPropertyToOrder(propertyId) {
    var property = AppState.properties.find(p => p.id === propertyId);
    if (!property) return;
    
    // Check if already added
    if (AppState.orderProperties.find(op => op.propertyId === propertyId)) {
        closeModal('property-modal');
        return;
    }
    
    AppState.orderProperties.push({
        propertyId: propertyId,
        property: property,
        lineItems: [],
        // Initialize billing from property, can be overridden
        billingContact: property.billingContact || '',
        billingEmail: property.billingEmail || '',
        billingPhone: property.billingPhone || '',
        unitCount: property.unitCount || 0
    });
    
    renderOrderProperties();
    closeModal('property-modal');
}

function updatePropertyBilling(propertyId, field, value) {
    var orderProp = AppState.orderProperties.find(op => op.propertyId === propertyId);
    if (orderProp) {
        orderProp[field] = value;
    }
}

function updateQuotePropertyUnitCount(propertyId, value) {
    var qp = AppState.quoteProperties.find(q => q.propertyId === propertyId);
    if (qp) qp.unitCount = value;
}

function removePropertyFromOrder(propertyId) {
    AppState.orderProperties = AppState.orderProperties.filter(op => op.propertyId !== propertyId);
    renderOrderProperties();
}

var lineItemCounter = 0;

function addLineItemToProperty(propertyId) {
    var orderProp = AppState.orderProperties.find(op => op.propertyId === propertyId);
    if (!orderProp) return;
    
    lineItemCounter++;
    orderProp.lineItems.push({
        id: lineItemCounter,
        productId: null,
        productName: '',
        quantity: 1,
        unitPrice: 0,
        total: 0,
        concession: false,
        concessionPercent: 0,
        concessionAmount: 0
    });
    renderOrderProperties();
}

function removeLineItemFromProperty(propertyId, lineItemId) {
    var orderProp = AppState.orderProperties.find(op => op.propertyId === propertyId);
    if (!orderProp) return;
    orderProp.lineItems = orderProp.lineItems.filter(li => li.id !== lineItemId);
    renderOrderProperties();
}

function updateLineItemQty(propertyId, lineItemId, qty) {
    var orderProp = AppState.orderProperties.find(op => op.propertyId === propertyId);
    if (!orderProp) return;
    var li = orderProp.lineItems.find(l => l.id === lineItemId);
    if (!li) return;
    li.quantity = parseInt(qty) || 1;
    recalcLineItemTotal(li);
    var totalEl = document.getElementById('li-total-' + propertyId + '-' + lineItemId);
    if (totalEl) totalEl.value = formatCurrency(li.total);
    if (li.concession) {
        var amtEl = document.getElementById('li-camt-' + propertyId + '-' + lineItemId);
        if (amtEl) amtEl.value = (li.concessionAmount || 0).toFixed(2);
    }
}

function toggleConcession(propertyId, lineItemId, checked) {
    var orderProp = AppState.orderProperties.find(op => op.propertyId === propertyId);
    if (!orderProp) return;
    var li = orderProp.lineItems.find(l => l.id === lineItemId);
    if (!li) return;
    li.concession = checked;
    if (!checked) { li.concessionPercent = 0; li.concessionAmount = 0; }
    recalcLineItemTotal(li);
    var pctEl  = document.getElementById('li-cpct-'  + propertyId + '-' + lineItemId);
    var amtEl  = document.getElementById('li-camt-'  + propertyId + '-' + lineItemId);
    var totalEl = document.getElementById('li-total-' + propertyId + '-' + lineItemId);
    if (pctEl) {
        pctEl.disabled = !checked;
        pctEl.style.opacity = checked ? '' : '0.5';
        pctEl.style.cursor  = checked ? '' : 'not-allowed';
        if (!checked) pctEl.value = '0';
    }
    if (amtEl) {
        amtEl.disabled = !checked;
        amtEl.style.opacity = checked ? '' : '0.5';
        amtEl.style.cursor  = checked ? '' : 'not-allowed';
        if (!checked) amtEl.value = '0.00';
    }
    if (totalEl) totalEl.value = formatCurrency(li.total);
}

function updateConcessionPercent(propertyId, lineItemId, pct) {
    var orderProp = AppState.orderProperties.find(op => op.propertyId === propertyId);
    if (!orderProp) return;
    var li = orderProp.lineItems.find(l => l.id === lineItemId);
    if (!li) return;
    var pctNum = parseFloat(pct);
    li.concessionPercent = Math.min(100, Math.max(0, isNaN(pctNum) ? 0 : pctNum));
    li.concessionAmount = li.quantity * li.unitPrice * li.concessionPercent / 100;
    recalcLineItemTotal(li);
    var amtEl  = document.getElementById('li-camt-'  + propertyId + '-' + lineItemId);
    var totalEl = document.getElementById('li-total-' + propertyId + '-' + lineItemId);
    if (amtEl)   amtEl.value   = (li.concessionAmount || 0).toFixed(2);
    if (totalEl) totalEl.value = formatCurrency(li.total);
}

function updateConcessionAmount(propertyId, lineItemId, amount) {
    var orderProp = AppState.orderProperties.find(op => op.propertyId === propertyId);
    if (!orderProp) return;
    var li = orderProp.lineItems.find(l => l.id === lineItemId);
    if (!li) return;
    var baseTotal = li.quantity * li.unitPrice;
    var amtNum = parseFloat(amount);
    if (isNaN(amtNum) || baseTotal === 0) {
        li.concessionAmount = 0;
        li.concessionPercent = 0;
    } else {
        li.concessionAmount = Math.min(baseTotal, Math.max(0, amtNum));
        li.concessionPercent = (li.concessionAmount / baseTotal) * 100;
    }
    recalcLineItemTotal(li);
    var pctEl  = document.getElementById('li-cpct-'  + propertyId + '-' + lineItemId);
    var totalEl = document.getElementById('li-total-' + propertyId + '-' + lineItemId);
    if (pctEl)   pctEl.value   = li.concessionPercent.toFixed(2);
    if (totalEl) totalEl.value = formatCurrency(li.total);
}

function recalcLineItemTotal(li) {
    var baseTotal = li.quantity * li.unitPrice;
    if (li.concession && li.concessionPercent > 0) {
        li.total = baseTotal * (1 - li.concessionPercent / 100);
    } else {
        li.total = baseTotal;
    }
}

function selectProductForPropertyLine(propertyId, lineItemId) {
    openProductSelector(function(product) {
        var orderProp = AppState.orderProperties.find(op => op.propertyId === propertyId);
        if (!orderProp) return;
        var li = orderProp.lineItems.find(l => l.id === lineItemId);
        if (li) {
            li.productId = product.id;
            li.productCode = product.code;
            li.productName = product.name;
            li.unitPrice = product.price;
            recalcLineItemTotal(li);
            
            // Auto-add 9430 (Virtual Tour Hosting) when 9461 or 9456 is selected
            if (String(product.code) === '9461' || String(product.code) === '9456') {
                autoAddHostingProduct(orderProp, '9430');
            }
            
            renderOrderProperties();
        }
    });
}

// Auto-add a product by code if not already present on this property
function autoAddHostingProduct(orderProp, productCode) {
    // Check if already exists on this property (compare as strings)
    if (orderProp.lineItems.find(li => String(li.productCode) === String(productCode))) {
        return; // Already added
    }
    
    // Find the product (compare as strings since QB may return number or string)
    const product = AppState.products.find(p => String(p.code) === String(productCode));
    if (!product) {
        console.warn('Auto-add product not found:', productCode);
        return;
    }
    
    lineItemCounter++;
    const newLineItem = {
        id: lineItemCounter,
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        quantity: 1,
        unitPrice: product.price,
        total: product.price,
        concession: false,
        concessionPercent: 0,
        concessionAmount: 0
    };
    
    orderProp.lineItems.push(newLineItem);
    showSuccess(`Auto-added: ${product.name}`);
}

function renderOrderProperties() {
    var c = document.getElementById('order-properties-container');
    if (!AppState.orderProperties.length) {
        c.innerHTML = `<div class="empty-state" style="padding: 40px 20px;">
            <svg class="empty-state-icon" style="width:48px;height:48px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <p class="empty-state-text">No properties added yet</p>
            <p class="empty-state-subtext">Click "Add Property" to get started</p>
        </div>`;
        return;
    }
    
    c.innerHTML = AppState.orderProperties.map((op, idx) => {
        var p = op.property;
        
        var lineItemsHtml = '';
        if (op.lineItems.length) {
            lineItemsHtml = op.lineItems.map(li => `<div class="line-item">
                <div class="form-group"><button type="button" class="btn btn-secondary" style="width:100%;justify-content:flex-start" onclick="selectProductForPropertyLine(${op.propertyId},${li.id})">${li.productName||'Select Product...'}</button></div>
                <div class="form-group"><input type="number" class="form-input" value="${li.quantity}" min="1" onchange="updateLineItemQty(${op.propertyId},${li.id},this.value)"></div>
                <div class="form-group"><input type="text" class="form-input" value="${formatCurrency(li.unitPrice)}" readonly style="background:var(--bg-hover);cursor:not-allowed"></div>
                <div class="form-group concession-check"><label class="concession-label"><input type="checkbox" ${li.concession?'checked':''} onchange="toggleConcession(${op.propertyId},${li.id},this.checked)"><span>Concession</span></label></div>
                <div class="form-group concession-pct"><input type="number" class="form-input" id="li-cpct-${op.propertyId}-${li.id}" value="${li.concessionPercent||0}" min="0" max="100" ${li.concession?'':'disabled'} onchange="updateConcessionPercent(${op.propertyId},${li.id},this.value)" style="${li.concession?'':'opacity:0.5;cursor:not-allowed'}"></div>
                <div class="form-group concession-amt"><input type="number" class="form-input" id="li-camt-${op.propertyId}-${li.id}" value="${(li.concessionAmount||0).toFixed(2)}" min="0" step="0.01" ${li.concession?'':'disabled'} onchange="updateConcessionAmount(${op.propertyId},${li.id},this.value)" style="${li.concession?'':'opacity:0.5;cursor:not-allowed'}"></div>
                <div class="form-group"><input type="text" class="form-input" id="li-total-${op.propertyId}-${li.id}" value="${formatCurrency(li.total)}" readonly style="background:var(--bg-hover);cursor:not-allowed;font-weight:600;color:var(--lcp-blue)"></div>
                <button type="button" class="remove-btn" onclick="removeLineItemFromProperty(${op.propertyId},${li.id})"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
            </div>`).join('');
        } else {
            lineItemsHtml = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">No line items yet</div>';
        }
        
        return `<div class="property-group">
            <div class="property-group-header">
                <div class="property-group-info">
                    <div class="property-group-name">${p.name}</div>
                    <div class="property-group-address">${p.address || 'No address'}</div>
                </div>
                <div class="property-group-actions">
                    <button type="button" class="btn btn-ghost btn-sm" onclick="removePropertyFromOrder(${op.propertyId})" title="Remove Property">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </div>
            <div class="property-group-billing">
                <div class="billing-field">
                    <label class="billing-label required"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Contact</label>
                    <input type="text" class="form-input billing-input" id="billing-contact-${op.propertyId}" value="${op.billingContact || ''}" placeholder="Contact name" onchange="updatePropertyBilling(${op.propertyId},'billingContact',this.value)">
                </div>
                <div class="billing-field">
                    <label class="billing-label required"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>Email</label>
                    <input type="email" class="form-input billing-input" id="billing-email-${op.propertyId}" value="${op.billingEmail || ''}" placeholder="billing@company.com" onchange="updatePropertyBilling(${op.propertyId},'billingEmail',this.value)">
                </div>
                <div class="billing-field">
                    <label class="billing-label required"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>Phone</label>
                    <input type="tel" class="form-input billing-input" id="billing-phone-${op.propertyId}" value="${op.billingPhone || ''}" placeholder="(555) 123-4567" oninput="formatPhoneNumber(this)" onchange="updatePropertyBilling(${op.propertyId},'billingPhone',this.value)">
                </div>
                <div class="billing-field">
                    <label class="billing-label required"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>Units</label>
                    <input type="number" class="form-input billing-input" id="unit-count-${op.propertyId}" value="${op.unitCount || ''}" placeholder="Unit count" min="0" onchange="updatePropertyBilling(${op.propertyId},'unitCount',parseInt(this.value)||0)">
                </div>
            </div>
            <div class="property-group-body">
                <div class="line-item-header"><span>Product</span><span>Qty</span><span>Unit Price</span><span>Concession</span><span>%</span><span>$</span><span>Total</span><span></span></div>
                <div class="line-items-container">${lineItemsHtml}</div>
                <button type="button" class="btn btn-secondary add-line-item-btn" onclick="addLineItemToProperty(${op.propertyId})">
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                    Add Line Item
                </button>
            </div>
        </div>`;
    }).join('');
}

// Keep these for backwards compat but they're not used in new flow
function selectProperty(id) { addPropertyToOrder(id); }
function updateSelectedPropertyDisplay() { renderOrderProperties(); }
function clearSelectedProperty() { }

async function saveNewProperty() {
    const name = document.getElementById('new-property-name').value.trim();
    if (!name) { alert('Property name required'); return; }
    const np = { id: Date.now(), name, street: document.getElementById('new-property-street').value.trim(), city: document.getElementById('new-property-city').value.trim(), state: document.getElementById('new-property-state').value.trim(), postal: document.getElementById('new-property-postal').value.trim() };
    AppState.properties.unshift(np);
    renderPropertyList();
    selectProperty(np.id);
    ['new-property-name','new-property-street','new-property-city','new-property-state','new-property-postal'].forEach(id => document.getElementById(id).value = '');
    closeModal('add-property-modal');
    showSuccess('Property added');
}

// ============================================================================
// PRODUCT / PRICE LIST MANAGEMENT
// ============================================================================

async function loadProducts() {
    try {
        const f = CONFIG.fields.yardiCodes;
        const r = await queryRecords(CONFIG.tables.yardiCodes, [f.recordId, f.code, f.productDescription, f.retailPrice, f.unitOfMeasure, f.billingFrequency, f.pipelineAssetType], null, [{ fieldId: f.productDescription, order: 'ASC' }]);
        AppState.products = r.data.map(rec => ({
            id: rec[f.recordId].value,
            code: rec[f.code]?.value || '',
            name: rec[f.productDescription]?.value || 'Unnamed Product',
            price: rec[f.retailPrice]?.value || 0,
            unit: rec[f.unitOfMeasure]?.value || 'Each',
            frequency: rec[f.billingFrequency]?.value || 'One-Time',
            assetType: rec[f.pipelineAssetType]?.value || ''
        }));
        AppState.priceList = AppState.products;
        renderProductGrid();
    } catch (e) {
        console.error('Load products failed:', e);
        // Fallback placeholder
        AppState.products = [
            { id: 1, code: '100', name: '3D Virtual Tour - Basic', price: 299, unit: 'Each', frequency: 'One-Time', assetType: '3D' },
            { id: 2, code: '101', name: '3D Virtual Tour - Premium', price: 499, unit: 'Each', frequency: 'One-Time', assetType: '3D' },
            { id: 3, code: '200', name: 'Drone Photography', price: 399, unit: 'Each', frequency: 'One-Time', assetType: 'Drone' },
            { id: 4, code: '300', name: 'Photography Package', price: 249, unit: 'Each', frequency: 'One-Time', assetType: 'Photography' }
        ];
        AppState.priceList = AppState.products;
        renderProductGrid();
    }
}

async function load3DProducts() {
    try {
        const f = CONFIG.fields.products3D;
        // Filter for FID 12 = '3D Services'
        const r = await queryRecords(CONFIG.tables.products, [f.recordId, f.productName, f.retailPrice], "{12.EX.'3D Services'}", [{ fieldId: f.productName, order: 'ASC' }]);
        AppState.products3D = r.data.map(rec => ({
            id: rec[f.recordId].value,
            name: rec[f.productName]?.value || 'Unnamed Product',
            price: rec[f.retailPrice]?.value || 0
        }));
        console.log('Loaded 3D products:', AppState.products3D.length);
    } catch (e) {
        console.error('Load 3D products failed:', e);
        AppState.products3D = [];
    }
}

function renderProductGrid() {
    var c = document.getElementById('product-table-body');
    if (!c) return;
    if (!AppState.products.length) { c.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">No products available</td></tr>'; return; }
    c.innerHTML = AppState.products.map(p => `<tr class="product-row" onclick="selectProductRow(${p.id})" data-type="${p.assetType||''}" data-name="${p.name.toLowerCase()}" data-code="${(p.code||'').toString().toLowerCase()}" style="cursor:pointer;"><td>${p.code}</td><td>${p.name}</td><td style="color:var(--lcp-blue);font-weight:500;">${formatCurrency(p.price)}</td><td>${p.unit}</td><td>${p.assetType?`<span class="badge-type ${p.assetType.toLowerCase().replace(/\s+/g,'-')}">${p.assetType}</span>`:'-'}</td></tr>`).join('');
}

var _productFilterTimeout = null;
function filterProducts() {
    clearTimeout(_productFilterTimeout);
    _productFilterTimeout = setTimeout(_applyProductFilter, 150);
}
function _applyProductFilter() {
    var search = document.getElementById('product-search-input').value.toLowerCase();
    var typeFilter = document.getElementById('product-type-filter');
    var type = typeFilter ? typeFilter.value : '';
    document.querySelectorAll('.product-row').forEach(row => {
        var matchType   = !type   || (row.dataset.type || '') === type;
        var matchSearch = !search || (row.dataset.name || '').includes(search) || (row.dataset.code || '').includes(search);
        row.style.display = (matchType && matchSearch) ? '' : 'none';
    });
}

function selectProductRow(productId, is3D) {
    var product;
    if (is3D) {
        product = AppState.products3D.find(p => p.id === productId);
    } else {
        product = AppState.products.find(p => p.id === productId);
    }
    if (!product) return;
    if (AppState.currentProductCallback) {
        AppState.currentProductCallback(product);
    }
    closeModal('product-modal');
    // Show type filter again
    var typeFilter = document.getElementById('product-type-filter');
    if (typeFilter) typeFilter.style.display = '';
    AppState.selectedProduct = null;
    AppState.currentProductCallback = null;
}

function selectProduct(id) { AppState.selectedProduct = AppState.products.find(p => p.id === id); renderProductGrid(); }

function openProductSelector(cb) {
    AppState.currentProductCallback = cb;
    AppState.selectedProduct = null;
    renderProductGrid();
    document.getElementById('product-search-input').value = '';
    var typeFilter = document.getElementById('product-type-filter');
    if (typeFilter) {
        typeFilter.value = '';
        typeFilter.style.display = '';
    }
    openModal('product-modal');
}

// confirmProductSelection no longer needed - row click selects directly

// ============================================================================
// PRICE LIST TAB
// ============================================================================

async function loadPriceList(force) {
    const c = document.getElementById('price-list-table');
    if (!force && AppState.priceList.length) { renderPriceListTable(); return; }
    showLoading(c);
    try {
        await loadProducts();
        renderPriceListTable();
    } catch (e) {
        showError(c, 'Failed to load price list');
        console.error(e);
    }
}

function renderPriceListTable() {
    const c = document.getElementById('price-list-table');
    if (!AppState.priceList.length) { c.innerHTML = '<div class="empty-state"><p class="empty-state-text">No products found</p></div>'; return; }
    
    c.innerHTML = `<div class="price-table-container"><table class="data-table price-table"><thead><tr><th>Code</th><th>Description</th><th>Price</th><th>Unit</th><th>Frequency</th><th>Type</th></tr></thead><tbody id="price-list-body">${AppState.priceList.map(p => `<tr data-type="${p.assetType||''}" data-name="${p.name.toLowerCase()}"><td>${p.code}</td><td>${p.name}</td><td class="price">${formatCurrency(p.price)}</td><td>${p.unit}</td><td>${p.frequency}</td><td>${p.assetType?`<span class="badge-type ${p.assetType.toLowerCase().replace(/\s+/g,'-')}">${p.assetType}</span>`:'-'}</td></tr>`).join('')}</tbody></table></div>`;
}

var _priceFilterTimeout = null;
function filterPriceList() {
    clearTimeout(_priceFilterTimeout);
    _priceFilterTimeout = setTimeout(_applyPriceFilter, 150);
}
function _applyPriceFilter() {
    const type   = document.getElementById('price-filter-type').value;
    const search = document.getElementById('price-filter-search').value.toLowerCase();
    document.querySelectorAll('#price-list-body tr').forEach(row => {
        const matchType   = !type   || row.dataset.type === type;
        const matchSearch = !search || (row.dataset.name || '').includes(search);
        row.style.display = (matchType && matchSearch) ? '' : 'none';
    });
}

// ============================================================================
// LINE ITEMS (legacy - keeping for compatibility)
// ============================================================================

function addOrderLineItem() {
    lineItemCounter++;
    AppState.orderLineItems.push({ id: lineItemCounter, productId: null, productName: '', quantity: 1, unitPrice: 0, total: 0 });
    renderOrderLineItems();
}

function renderOrderLineItems() {
    const c = document.getElementById('order-line-items');
    if (!AppState.orderLineItems.length) { c.innerHTML = '<div class="empty-state" style="padding:40px 20px"><p class="empty-state-text">No line items added yet</p></div>'; return; }
    c.innerHTML = AppState.orderLineItems.map(i => `<div class="line-item"><div class="form-group"><button type="button" class="btn btn-secondary" style="width:100%;justify-content:flex-start" onclick="selectProductForOrderLine(${i.id})">${i.productName||'Select Product...'}</button></div><div class="form-group"><input type="number" class="form-input" value="${i.quantity}" min="1" onchange="updateOrderLineQty(${i.id},this.value)"></div><div class="form-group"><input type="text" class="form-input" value="${formatCurrency(i.unitPrice)}" readonly style="background:var(--bg-hover);cursor:not-allowed"></div><div class="form-group"><input type="text" class="form-input" value="${formatCurrency(i.total)}" readonly style="background:var(--bg-hover);cursor:not-allowed;font-weight:600;color:var(--lcp-blue)"></div><button type="button" class="remove-btn" onclick="removeOrderLineItem(${i.id})"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></div>`).join('');
}

function selectProductForOrderLine(id) {
    openProductSelector(p => {
        const i = AppState.orderLineItems.find(x => x.id === id);
        if (i) { i.productId = p.id; i.productName = p.name; i.unitPrice = p.price; i.total = i.quantity * p.price; renderOrderLineItems(); }
    });
}

function updateOrderLineQty(id, qty) {
    const i = AppState.orderLineItems.find(x => x.id === id);
    if (i) { i.quantity = parseInt(qty) || 1; i.total = i.quantity * i.unitPrice; renderOrderLineItems(); }
}

function removeOrderLineItem(id) { AppState.orderLineItems = AppState.orderLineItems.filter(x => x.id !== id); renderOrderLineItems(); }

// ============================================================================
// 3D QUOTE PROPERTIES & LINE ITEMS
// ============================================================================

function openQuotePropertySelector() {
    renderPropertyList();
    document.getElementById('property-search-input').value = '';
    AppState.currentPropertyCallback = 'quote';
    hideCreatePropertyForm();
    openModal('property-modal');
}

function addPropertyFromSelector(propertyId) {
    if (AppState.currentPropertyCallback === 'quote') {
        addPropertyToQuote(propertyId);
    } else {
        addPropertyToOrder(propertyId);
    }
    AppState.currentPropertyCallback = null;
}

// ============================================================================
// 3D QUOTE PROPERTIES & ATTACHMENTS
// ============================================================================

function addPropertyToQuote(propertyId) {
    var property = AppState.properties.find(p => p.id === propertyId);
    if (!property) return;
    
    if (AppState.quoteProperties.find(qp => qp.propertyId === propertyId)) {
        closeModal('property-modal');
        return;
    }
    
    AppState.quoteProperties.push({
        propertyId: propertyId,
        property: property,
        attachments: [],
        unitCount: property.unitCount || 0
    });
    
    renderQuoteProperties();
    closeModal('property-modal');
}

function removePropertyFromQuote(propertyId) {
    AppState.quoteProperties = AppState.quoteProperties.filter(qp => qp.propertyId !== propertyId);
    renderQuoteProperties();
}

function handleFileDrop(propertyId, event) {
    event.preventDefault();
    event.stopPropagation();
    
    const dropZone = event.currentTarget;
    dropZone.classList.remove('drag-over');
    
    const files = event.dataTransfer?.files || event.target?.files;
    if (!files || !files.length) return;
    
    addFilesToProperty(propertyId, files);
}

function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('drag-over');
}

function addFilesToProperty(propertyId, files) {
    var quoteProp = AppState.quoteProperties.find(qp => qp.propertyId === propertyId);
    if (!quoteProp) return;
    
    for (let i = 0; i < files.length; i++) {
        AppState.attachmentCounter++;
        quoteProp.attachments.push({
            id: AppState.attachmentCounter,
            file: files[i],
            fileName: files[i].name,
            description: '',
            linkUrl: ''
        });
    }
    
    renderQuoteProperties();
}



function removeAttachmentFromProperty(propertyId, attachmentId) {
    var quoteProp = AppState.quoteProperties.find(qp => qp.propertyId === propertyId);
    if (!quoteProp) return;
    quoteProp.attachments = quoteProp.attachments.filter(a => a.id !== attachmentId);
    renderQuoteProperties();
}

function updateAttachment(propertyId, attachmentId, field, value) {
    var quoteProp = AppState.quoteProperties.find(qp => qp.propertyId === propertyId);
    if (!quoteProp) return;
    var att = quoteProp.attachments.find(a => a.id === attachmentId);
    if (att) {
        att[field] = value;
    }
}

function addLinkToProperty(propertyId) {
    var quoteProp = AppState.quoteProperties.find(qp => qp.propertyId === propertyId);
    if (!quoteProp) return;
    
    AppState.attachmentCounter++;
    quoteProp.attachments.push({
        id: AppState.attachmentCounter,
        file: null,
        fileName: '',
        description: '',
        linkUrl: ''
    });
    
    renderQuoteProperties();
}

function triggerFileInput(propertyId) {
    document.getElementById('file-input-' + propertyId).click();
}

function handleFileInputChange(propertyId, input) {
    if (input.files && input.files.length) {
        addFilesToProperty(propertyId, input.files);
    }
    input.value = ''; // Reset so same file can be selected again
}

function renderQuoteProperties() {
    var c = document.getElementById('quote-properties-container');
    if (!AppState.quoteProperties.length) {
        c.innerHTML = `<div class="empty-state" style="padding: 40px 20px;">
            <svg class="empty-state-icon" style="width:48px;height:48px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <p class="empty-state-text">No properties added yet</p>
            <p class="empty-state-subtext">Click "Add Property" to get started</p>
        </div>`;
        return;
    }
    
    c.innerHTML = AppState.quoteProperties.map(qp => {
        var p = qp.property;
        
        var attachmentsHtml = '';
        if (qp.attachments.length) {
            attachmentsHtml = `<div class="attachments-list">
                ${qp.attachments.map(att => `
                    <div class="attachment-item">
                        <div class="attachment-icon" style="${att.needsReupload ? 'opacity:0.5' : ''}">
                            ${att.file ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
                                       : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`}
                        </div>
                        <div class="attachment-name" style="${att.needsReupload ? 'color:var(--text-muted);font-style:italic' : ''}">${att.needsReupload ? `${att.fileName} (re-upload needed)` : (att.fileName || 'Link')}</div>
                        <input type="text" class="form-input attachment-desc-input" placeholder="Description (optional)" value="${att.description || ''}" onchange="updateAttachment(${qp.propertyId},${att.id},'description',this.value)">
                        ${(!att.file && !att.needsReupload) ? `<input type="url" class="form-input attachment-link-input" placeholder="Paste URL" value="${att.linkUrl || ''}" onchange="updateAttachment(${qp.propertyId},${att.id},'linkUrl',this.value)">` : ''}
                        <button type="button" class="remove-btn" onclick="removeAttachmentFromProperty(${qp.propertyId},${att.id})">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                `).join('')}
            </div>`;
        }
        
        return `<div class="property-group">
            <div class="property-group-header">
                <div class="property-group-info">
                    <div class="property-group-name">${p.name}</div>
                    <div class="property-group-address">${p.address || 'No address'}</div>
                    <div style="margin-top:6px;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted);">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
                        Units: <input type="number" class="form-input" value="${qp.unitCount || ''}" placeholder="—" min="0" style="width:80px;height:26px;padding:2px 8px;font-size:12px;display:inline-block;" onchange="updateQuotePropertyUnitCount(${qp.propertyId},parseInt(this.value)||0)">
                    </div>
                </div>
                <div class="property-group-actions">
                    <button type="button" class="btn btn-ghost btn-sm" onclick="removePropertyFromQuote(${qp.propertyId})" title="Remove Property">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </div>
            <div class="property-group-body">
                <input type="file" id="file-input-${qp.propertyId}" multiple style="display:none;" onchange="handleFileInputChange(${qp.propertyId},this)">
                <div class="drop-zone" 
                     ondrop="handleFileDrop(${qp.propertyId},event)" 
                     ondragover="handleDragOver(event)" 
                     ondragleave="handleDragLeave(event)"
                     onclick="triggerFileInput(${qp.propertyId})">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <span>Drop files here or click to browse</span>
                </div>
                <button type="button" class="btn add-link-btn" onclick="addLinkToProperty(${qp.propertyId})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    Add Link Instead
                </button>
                ${attachmentsHtml}
            </div>
        </div>`;
    }).join('');
}

// Keep 3D product selector for future use if needed
function open3DProductSelector(cb) {
    AppState.currentProductCallback = cb;
    AppState.selectedProduct = null;
    render3DProductGrid();
    var searchInput = document.getElementById('product-search-input');
    if (searchInput) searchInput.value = '';
    var typeFilter = document.getElementById('product-type-filter');
    if (typeFilter) typeFilter.style.display = 'none';
    openModal('product-modal');
}

function render3DProductGrid() {
    var c = document.getElementById('product-table-body');
    if (!c) return;
    if (!AppState.products3D.length) { 
        c.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">No 3D products available</td></tr>'; 
        return; 
    }
    c.innerHTML = AppState.products3D.map(p => `<tr class="product-row" onclick="selectProductRow(${p.id}, true)" data-name="${p.name.toLowerCase()}" style="cursor:pointer;"><td>—</td><td>${p.name}</td><td style="color:var(--lcp-blue);font-weight:500;">${formatCurrency(p.price)}</td><td>Each</td><td><span class="badge-type 3d">3D</span></td></tr>`).join('');
}

// ============================================================================
// SAVE PROGRESS MODAL
// ============================================================================

var _saveProgressActiveStep = -1;

var SAVE_PROGRESS_STEPS = [
    'Creating order',
    'Creating line items',
    'Generating contract PDF',
    'Generating contract DOCX',
    'Generating property worksheet'
];

function showSaveProgressModal() {
    _saveProgressActiveStep = -1;
    var c = document.getElementById('save-progress-steps');
    c.innerHTML = SAVE_PROGRESS_STEPS.map((s, i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;${i < SAVE_PROGRESS_STEPS.length - 1 ? 'border-bottom:1px solid var(--border-color)' : ''}">
            <div id="pstep-icon-${i}" style="width:20px;height:20px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--border-color)" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>
            </div>
            <span id="pstep-label-${i}" style="font-size:14px;color:var(--text-muted);">${s}</span>
        </div>
    `).join('');
    document.getElementById('save-progress-error').style.display = 'none';
    document.getElementById('save-progress-footer').style.display = 'none';
    openModal('save-progress-modal');
}

function setSaveProgressStep(i, status) {
    var icon = document.getElementById('pstep-icon-' + i);
    var label = document.getElementById('pstep-label-' + i);
    if (!icon) return;
    if (status === 'active') {
        _saveProgressActiveStep = i;
        icon.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;margin-bottom:0;"></div>';
        label.style.color = 'var(--text-primary)';
        label.style.fontWeight = '600';
    } else if (status === 'done') {
        icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
        label.style.color = 'var(--text-secondary)';
        label.style.fontWeight = 'normal';
    } else if (status === 'error') {
        icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        label.style.color = 'var(--error)';
        label.style.fontWeight = '600';
    } else if (status === 'skip') {
        icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
        label.style.color = 'var(--text-muted)';
        label.style.fontStyle = 'italic';
    }
}

// ============================================================================
// SAVE OPERATIONS
// ============================================================================

async function saveOrder() {
    const email = document.getElementById('order-sales-email').value.trim();
    const ycrmOpportunity = document.getElementById('order-ycrm-opportunity').value.trim();
    const contractFirst = document.getElementById('order-contract-first').value.trim();
    const contractLast = document.getElementById('order-contract-last').value.trim();
    const contractEmail = document.getElementById('order-contract-email').value.trim();
    const contractPhone = document.getElementById('order-contract-phone').value.trim();
    const notes = getRichTextContent('order-notes-editor');
    
    if (!email) { alert('Sales rep email required'); return; }
    if (!ycrmOpportunity) { alert('yCRM Opportunity ID required'); return; }
    if (!AppState.selectedClient) { alert('Please select a client'); return; }
    if (!contractFirst || !contractLast || !contractEmail || !contractPhone) {
        alert('Contract contact info (first name, last name, email, phone) is required');
        return;
    }
    if (!AppState.orderProperties.length) { alert('Please add at least one property'); return; }

    // Check each property has at least one line item with a product selected
    var hasLineItems = AppState.orderProperties.some(op => op.lineItems.some(li => li.productId));
    if (!hasLineItems) { alert('Please add at least one product to a line item'); return; }

    // Check each property has billing contact info and unit count
    for (const op of AppState.orderProperties) {
        if (!op.billingContact || !op.billingEmail || !op.billingPhone) {
            alert(`Billing contact (name, email, phone) required for: ${op.property.name}`);
            return;
        }
        if (!op.unitCount) {
            alert(`Unit count required for: ${op.property.name}`);
            return;
        }
    }
    
    // Show progress modal
    var saveBtn = document.querySelector('#order-form .btn-primary');
    saveBtn.disabled = true;
    showSaveProgressModal();

    try {
        const f = CONFIG.fields.orders;
        const pf = CONFIG.fields.properties;
        const lf = CONFIG.fields.orderLineItems;

        // Check if any line item has concession checked
        const hasConcessions = AppState.orderProperties.some(op =>
            op.lineItems.some(li => li.productId && li.concession)
        );
        const orderStatus = hasConcessions ? 'Concessions Approval Needed' : 'Contract Needed';

        // Step 0: Create order record
        setSaveProgressStep(0, 'active');
        const orderData = {
            [f.salesRepEmail]: { value: email },
            [f.quoteDate]: { value: getTodayISO() },
            [f.expirationDate]: { value: getExpirationDate(30) },
            [f.orderStatus]: { value: orderStatus },
            [f.historyNotes]: { value: notes },
            [f.relatedCompany]: { value: AppState.selectedClient.id }
        };
        if (ycrmOpportunity) orderData[f.ycrmOpportunityId] = { value: ycrmOpportunity };
        if (contractFirst) orderData[f.contractContactFirst] = { value: contractFirst };
        if (contractLast) orderData[f.contractContactLast] = { value: contractLast };
        if (contractEmail) orderData[f.contractEmail] = { value: contractEmail };
        if (contractPhone) orderData[f.contractPhone] = { value: contractPhone };
        orderData[f.propertyLevelBilling] = { value: document.getElementById('order-property-level-billing').checked };
        if (AppState.convertingQuoteId) orderData[f.relatedQuote3D] = { value: AppState.convertingQuoteId };

        let orderId;
        if (AppState.editingOrderId) {
            // Updating an existing draft — delete old children then update main record
            orderId = AppState.editingOrderId;
            await qbApiRequest(CONFIG.tables.properties, 'records', 'DELETE', { from: CONFIG.tables.properties, where: `{${pf.relatedOrder}.EX.${orderId}}` });
            await qbApiRequest(CONFIG.tables.orderLineItems, 'records', 'DELETE', { from: CONFIG.tables.orderLineItems, where: `{${lf.relatedOrder}.EX.${orderId}}` });
            orderData[f.recordId] = { value: orderId };
            await updateRecord(CONFIG.tables.orders, orderData);
            console.log('Updated draft order:', orderId);
        } else {
            const orderResult = await createRecord(CONFIG.tables.orders, orderData);
            orderId = orderResult.metadata?.createdRecordIds?.[0];
            if (!orderId) {
                console.error('Order create response:', orderResult);
                throw new Error('Failed to create order record');
            }
            console.log('Created order:', orderId);
        }
        setSaveProgressStep(0, 'done');

        // Step 1: Create property links and line items
        setSaveProgressStep(1, 'active');
        for (const op of AppState.orderProperties) {
            const propertyData = {
                [pf.relatedOrder]: { value: orderId },
                [pf.relatedProperty]: { value: op.propertyId },
                [pf.billingContact]: { value: op.billingContact || '' },
                [pf.billingEmail]: { value: op.billingEmail || '' },
                [pf.billingPhone]: { value: op.billingPhone || '' }
            };

            const propResult = await createRecord(CONFIG.tables.properties, propertyData);
            const propertyLinkId = propResult.metadata?.createdRecordIds?.[0];
            console.log('Created property link:', propertyLinkId, 'for property:', op.propertyId);

            // Persist unit count to propertiesMaster so FID 26 lookup reflects it
            if (op.unitCount) {
                const pmf = CONFIG.fields.propertiesMaster;
                await updateRecord(CONFIG.tables.propertiesMaster, {
                    [pmf.recordId]: { value: op.propertyId },
                    [pmf.unitCount]: { value: op.unitCount }
                });
            }

            for (const li of op.lineItems) {
                if (li.productId || li.productCode) {
                    const lineItemData = {
                        [lf.relatedOrder]: { value: orderId },
                        [lf.relatedProperty]: { value: propertyLinkId },
                        [lf.relatedCode]: { value: li.productCode },
                        [lf.description]: { value: li.productName },
                        [lf.quantity]: { value: li.quantity },
                        [lf.concession]: { value: li.concession || false },
                        [lf.concessionPercent]: { value: li.concessionPercent || 0 },
                        [lf.concessionAmount]: { value: li.concessionAmount || 0 }
                    };
                    if (li.unitPrice && li.unitPrice > 0) {
                        lineItemData[lf.quotePrice] = { value: li.unitPrice };
                    }
                    const liResult = await createRecord(CONFIG.tables.orderLineItems, lineItemData);
                    if (liResult.metadata?.lineErrors && Object.keys(liResult.metadata.lineErrors).length > 0) {
                        console.error('Line item creation error:', liResult.metadata.lineErrors);
                    } else {
                        console.log('Created line item for product:', li.productName, 'code:', li.productCode);
                    }
                }
            }
        }
        setSaveProgressStep(1, 'done');

        // Steps 2–4: Generate contracts (skipped if concessions present)
        const companyName = AppState.selectedClient?.name || '';
        const concessionCheck = await queryRecords(
            CONFIG.tables.orderLineItems, [lf.recordId],
            `{${lf.relatedOrder}.EX.${orderId}}AND{${lf.concessionFlag}.EX._true_}`
        );
        if (!concessionCheck.data || !concessionCheck.data.length) {
            await generateAndUploadContracts(orderId, ycrmOpportunity, companyName);
        } else {
            console.log('[Contracts] Skipped — concessions found in DB for order', orderId);
            [2, 3, 4].forEach(i => setSaveProgressStep(i, 'skip'));
        }

        // If this order was converted from a quote, update the quote status
        if (AppState.convertingQuoteId) {
            const qf = CONFIG.fields.quotes3D;
            await updateRecord(CONFIG.tables.quotes3D, {
                [qf.recordId]: { value: AppState.convertingQuoteId },
                [qf.quoteStatus]: { value: 'Converted to Order' }
            });
            console.log('Updated quote', AppState.convertingQuoteId, 'status to Converted to Order');
            AppState.convertingQuoteId = null;
        }

        closeModal('save-progress-modal');
        showSuccess('Order created successfully!');
        resetOrderForm();
        switchTab('tab-dashboard');
        loadDashboard(true);

    } catch (e) {
        console.error('Save order failed:', e);
        if (_saveProgressActiveStep >= 0) setSaveProgressStep(_saveProgressActiveStep, 'error');
        var errEl = document.getElementById('save-progress-error');
        if (errEl) { errEl.textContent = e.message; errEl.style.display = 'block'; }
        var footerEl = document.getElementById('save-progress-footer');
        if (footerEl) footerEl.style.display = 'block';
    } finally {
        saveBtn.disabled = false;
    }
}

// ============================================================================
// PROPERTY WORKSHEET GENERATION
// ============================================================================

async function loadSheetJS() {
    if (window.XLSX) return;
    await new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
        s.onload = resolve;
        s.onerror = function() { reject(new Error('Failed to load SheetJS')); };
        document.head.appendChild(s);
    });
}

async function generatePropertyWorksheet(orderId, baseName) {
    await loadSheetJS();

    var pf = CONFIG.fields.properties;
    var lf = CONFIG.fields.orderLineItems;

    // Fetch properties and all order line items in parallel
    var results = await Promise.all([
        queryRecords(CONFIG.tables.properties,
            [pf.recordId, pf.propertyName, pf.propertyAddress, pf.billingEmail, pf.unitCount],
            '{' + pf.relatedOrder + '.EX.' + orderId + '}'),
        queryRecords(CONFIG.tables.orderLineItems,
            [lf.relatedProperty, lf.relatedCode, lf.quantity],
            '{' + lf.relatedOrder + '.EX.' + orderId + '}')
    ]);
    var properties = results[0].data || [];
    var lineItems = results[1].data || [];

    // Build map: propertyRecordId → { productCode → quantity }
    var propLineMap = {};
    for (var i = 0; i < lineItems.length; i++) {
        var li = lineItems[i];
        var propId = li[lf.relatedProperty]?.value;
        var code = String(li[lf.relatedCode]?.value || '');
        var qty = li[lf.quantity]?.value ?? 0;
        if (!propId || !code) continue;
        if (!propLineMap[propId]) propLineMap[propId] = {};
        propLineMap[propId][code] = qty;
    }

    // Column definitions: [header, productCode] — code null means no product mapping
    var PRODUCT_COLS = [
        ['TB Pro', '9430'],
        ['# Pro Areas', '9456'],
        ['TB Go', '9327'],
        ['# Units to Capture', '9419'],
        ['Zillow Promo TB Pro\n(6 Areas Free)', '9491'],
        ['Zillow Promo TB Essentials', '9492'],
        ['Zillow Promo TB Pro Additional Areas ($150/area)', '9493'],
        ['Professional Photography', '9416'],
        ['# of Images', '9416'],
        ['Set of 15 Drone Stills', '9408'],
        ['60 Second Drone Fly Over + 15 Stills', '9411'],
        ['Set of 5 Aerial 360s', '9410'],
        ['2D Floor Plans', '9413'],
        ['3D Floor Plans', '9414'],
        ['Virtually Staged 360s', '9431'],
        ['Virtually Staged Stills', '9431'],
        ['TB Go Camera Kit', '9324'],
        ['Per Area Matterport Conversion', '9461']
    ];

    var titleRow = ['LCP Property Worksheet'];
    var codeRow = ['', '', '', 'CODES'].concat(PRODUCT_COLS.map(function(c) { return parseInt(c[1]); }));
    var headerRow = ['Property', 'Address', 'Billing Contact Email', 'Unit Count']
        .concat(PRODUCT_COLS.map(function(c) { return c[0]; }));

    var dataRows = properties.map(function(p) {
        var pid = p[pf.recordId]?.value;
        var codes = propLineMap[pid] || {};
        var row = [
            p[pf.propertyName]?.value || '',
            p[pf.propertyAddress]?.value || '',
            p[pf.billingEmail]?.value || '',
            p[pf.unitCount]?.value || ''
        ];
        PRODUCT_COLS.forEach(function(c) {
            row.push(codes[c[1]] !== undefined ? codes[c[1]] : 0);
        });
        return row;
    });

    var aoa = [titleRow, codeRow, headerRow].concat(dataRows);
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Property Worksheet');
    var buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var fileName = baseName + ' - Property Worksheet.xlsx';
    var file = new File([blob], fileName, { type: blob.type });

    await uploadFileToField(CONFIG.tables.orders, orderId, CONFIG.fields.orders.propertyWorksheet, file);
    console.log('[Worksheet] Uploaded', fileName, 'to FID', CONFIG.fields.orders.propertyWorksheet);
}

// ============================================================================
// CONTRACT GENERATION
// ============================================================================

async function uploadFileToField(tableId, recordId, fieldId, file) {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return updateRecord(tableId, {
        3: { value: recordId },
        [fieldId]: { value: { fileName: file.name, data: base64 } }
    });
}

async function generateAndUploadContracts(orderId, opportunityId, companyName) {
    const CONTRACT_TEMPLATE_ID = 3;
    const f = CONFIG.fields.orders;
    const tableId = CONFIG.tables.orders;
    const realm = CONFIG.getRealmHostname();
    const realmShort = realm.replace('.quickbase.com', '');

    // Build sanitized filename
    let baseName;
    if (opportunityId && companyName) {
        baseName = `${opportunityId} - ${companyName}`;
    } else if (opportunityId) {
        baseName = opportunityId;
    } else if (companyName) {
        baseName = companyName;
    } else {
        baseName = 'Order_Contract_' + orderId;
    }
    const safeFileName = encodeURIComponent(baseName.replace(/[\/\\:*?"<>|]/g, ''));

    // Step 1: Set status → "Contract Needed"
    await updateRecord(tableId, {
        [f.recordId]: { value: orderId },
        [f.orderStatus]: { value: 'Contract Needed' }
    });
    console.log('[Contracts] Status → Contract Needed for order', orderId);

    // Step 2 (progress): Generate PDF → upload to FID 12
    setSaveProgressStep(2, 'active');
    const pdfGenUrl = `https://api.quickbase.com/v1/docTemplates/${CONTRACT_TEMPLATE_ID}/generate?tableId=${tableId}&realm=${realmShort}&filename=${safeFileName}&format=pdf&recordId=${orderId}`;
    const pdfResp = await fetch(pdfGenUrl, {
        method: 'GET',
        credentials: 'include',
        headers: { 'QB-Realm-Hostname': realm }
    });
    if (!pdfResp.ok) {
        const pdfErr = await pdfResp.text().catch(() => String(pdfResp.status));
        throw new Error(`PDF generation failed: ${pdfErr}`);
    }
    const pdfBlob = await pdfResp.blob();
    await uploadFileToField(tableId, orderId, f.orderPDF,
        new File([pdfBlob], `${baseName}.pdf`, { type: 'application/pdf' }));
    console.log('[Contracts] PDF uploaded to FID', f.orderPDF);
    setSaveProgressStep(2, 'done');

    // Step 3 (progress): Generate DOCX → upload to FID 38
    setSaveProgressStep(3, 'active');
    const docxGenUrl = `https://api.quickbase.com/v1/docTemplates/${CONTRACT_TEMPLATE_ID}/generate?tableId=${tableId}&realm=${realmShort}&filename=${safeFileName}&format=docx&recordId=${orderId}`;
    const docxResp = await fetch(docxGenUrl, {
        method: 'GET',
        credentials: 'include',
        headers: { 'QB-Realm-Hostname': realm }
    });
    if (!docxResp.ok) {
        const docxErr = await docxResp.text().catch(() => String(docxResp.status));
        throw new Error(`DOCX generation failed: ${docxErr}`);
    }
    const docxBlob = await docxResp.blob();
    await uploadFileToField(tableId, orderId, f.orderDOCX,
        new File([docxBlob], `${baseName}.docx`, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
    console.log('[Contracts] DOCX uploaded to FID', f.orderDOCX);
    setSaveProgressStep(3, 'done');

    // Set status → "Contract Created"
    await updateRecord(tableId, {
        [f.recordId]: { value: orderId },
        [f.orderStatus]: { value: 'Contract Created' }
    });
    console.log('[Contracts] Status → Contract Created for order', orderId);

    // Step 4 (progress): Generate property worksheet → upload to FID 13
    setSaveProgressStep(4, 'active');
    await generatePropertyWorksheet(orderId, baseName);
    setSaveProgressStep(4, 'done');
}

async function saveQuote() {
    const companyId = document.getElementById('quote-company-id').value;
    const name = document.getElementById('quote-name').value.trim();
    const email = document.getElementById('quote-sales-email').value.trim();
    const notes = getRichTextContent('quote-notes-editor');
    if (!companyId) { alert('Please select a client'); return; }
    if (!name || !email) { alert('Quote name and sales rep email required'); return; }
    if (!AppState.quoteProperties.length) { alert('Please add at least one property'); return; }
    
    var saveBtn = document.querySelector('#quote-form .btn-primary');
    var originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    
    try {
        const f = CONFIG.fields.quotes3D;
        const pf = CONFIG.fields.properties;
        const af = CONFIG.fields.quoteAttachments;
        
        // 1. Create or update the Quote record
        const data = {
            [f.quoteName]: { value: name },
            [f.salesRepEmail]: { value: email },
            [f.quoteDate]: { value: getTodayISO() },
            [f.expirationDate]: { value: getExpirationDate(30) },
            [f.historyNotes]: { value: notes },
            [f.relatedCompany]: { value: parseInt(companyId) },
            [f.quoteStatus]: { value: 'Pending Review' }
        };

        let quoteId;
        if (AppState.editingQuoteId) {
            quoteId = AppState.editingQuoteId;
            await qbApiRequest(CONFIG.tables.properties, 'records', 'DELETE', { from: CONFIG.tables.properties, where: `{${pf.relatedQuote3D}.EX.${quoteId}}` });
            await qbApiRequest(CONFIG.tables.quoteAttachments, 'records', 'DELETE', { from: CONFIG.tables.quoteAttachments, where: `{${af.relatedQuote}.EX.${quoteId}}` });
            data[f.recordId] = { value: quoteId };
            await updateRecord(CONFIG.tables.quotes3D, data);
            console.log('Updated draft quote:', quoteId);
        } else {
            const r = await createRecord(CONFIG.tables.quotes3D, data);
            quoteId = r.metadata?.createdRecordIds?.[0];
            if (!quoteId) {
                if (r.metadata?.lineErrors) console.error('QB lineErrors:', r.metadata.lineErrors);
                throw new Error('Failed to create quote record');
            }
            console.log('Created quote:', quoteId);
        }
        
        // 2. For each property, create a property link record and attachments
        for (const qp of AppState.quoteProperties) {
            // Create property link record
            const propertyData = {
                [pf.relatedQuote3D]: { value: quoteId },
                [pf.relatedProperty]: { value: qp.propertyId }
            };
            
            const propResult = await createRecord(CONFIG.tables.properties, propertyData);
            const propertyLinkId = propResult.metadata?.createdRecordIds?.[0];
            console.log('Created property link:', propertyLinkId, 'for property:', qp.propertyId);

            if (qp.unitCount) {
                const pmf = CONFIG.fields.propertiesMaster;
                await updateRecord(CONFIG.tables.propertiesMaster, {
                    [pmf.recordId]: { value: qp.propertyId },
                    [pmf.unitCount]: { value: qp.unitCount }
                });
            }

            // 3. Create attachments for this property
            for (const att of qp.attachments) {
                if (att.file || att.linkUrl) {
                    // Include property name in description for reference
                    const descWithProperty = att.description 
                        ? `[${qp.property.name}] ${att.description}`
                        : `[${qp.property.name}]`;
                    
                    const attData = {
                        [af.relatedQuote]: { value: quoteId },
                        [af.description]: { value: descWithProperty },
                        [af.linkToFile]: { value: att.linkUrl || '' }
                    };
                    
                    const attResult = await createRecord(CONFIG.tables.quoteAttachments, attData);
                    const attId = attResult.metadata?.createdRecordIds?.[0];
                    
                    // If there's a file to upload, upload it
                    if (attId && att.file) {
                        await uploadAttachmentFile(attId, att.file);
                    }
                    
                    console.log('Created attachment:', attId, att.fileName || att.linkUrl);
                }
            }
        }
        
        showSuccess('Quote saved!');
        resetQuoteForm();
        switchTab('tab-dashboard');
    } catch (e) { 
        console.error('Save quote failed:', e); 
        alert('Failed to save quote: ' + e.message); 
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

async function uploadAttachmentFile(recordId, file) {
    // QB file upload requires multipart form data to the record endpoint
    try {
        const af = CONFIG.fields.quoteAttachments;
        const formData = new FormData();
        formData.append('file', file);
        
        const realm = CONFIG.getRealmHostname();
        const token = await getTempToken(CONFIG.tables.quoteAttachments);
        
        const response = await fetch(`https://api.quickbase.com/v1/files/${CONFIG.tables.quoteAttachments}/${recordId}/${af.fileAttachment}`, {
            method: 'POST',
            headers: {
                'QB-Realm-Hostname': realm,
                'Authorization': `QB-TEMP-TOKEN ${token}`
            },
            body: formData,
            credentials: 'include'
        });
        
        if (!response.ok) {
            console.error('File upload failed:', await response.text());
        } else {
            console.log('File uploaded successfully');
        }
    } catch (e) {
        console.error('File upload error:', e);
    }
}

// ============================================================================
// DRAFT SAVE
// ============================================================================

async function saveDraftOrder() {
    const email = document.getElementById('order-sales-email').value.trim();
    if (!email) { alert('Sales rep email required'); return; }

    var btn = document.querySelector('#order-form .btn-secondary:last-of-type');
    var orig = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
        const f = CONFIG.fields.orders;
        const pf = CONFIG.fields.properties;
        const lf = CONFIG.fields.orderLineItems;

        const orderData = {
            [f.salesRepEmail]: { value: email },
            [f.orderStatus]: { value: 'Draft' },
            [f.historyNotes]: { value: getRichTextContent('order-notes-editor') }
        };
        const ycrmOpp = document.getElementById('order-ycrm-opportunity').value.trim();
        const contractFirst = document.getElementById('order-contract-first').value.trim();
        const contractLast = document.getElementById('order-contract-last').value.trim();
        const contractEmail = document.getElementById('order-contract-email').value.trim();
        const contractPhone = document.getElementById('order-contract-phone').value.trim();
        if (AppState.selectedClient) orderData[f.relatedCompany] = { value: AppState.selectedClient.id };
        if (ycrmOpp) orderData[f.ycrmOpportunityId] = { value: ycrmOpp };
        if (contractFirst) orderData[f.contractContactFirst] = { value: contractFirst };
        if (contractLast) orderData[f.contractContactLast] = { value: contractLast };
        if (contractEmail) orderData[f.contractEmail] = { value: contractEmail };
        if (contractPhone) orderData[f.contractPhone] = { value: contractPhone };
        orderData[f.propertyLevelBilling] = { value: document.getElementById('order-property-level-billing').checked };

        let orderId;
        if (AppState.editingOrderId) {
            orderId = AppState.editingOrderId;
            await qbApiRequest(CONFIG.tables.properties, 'records', 'DELETE', { from: CONFIG.tables.properties, where: `{${pf.relatedOrder}.EX.${orderId}}` });
            await qbApiRequest(CONFIG.tables.orderLineItems, 'records', 'DELETE', { from: CONFIG.tables.orderLineItems, where: `{${lf.relatedOrder}.EX.${orderId}}` });
            orderData[f.recordId] = { value: orderId };
            await updateRecord(CONFIG.tables.orders, orderData);
        } else {
            orderData[f.quoteDate] = { value: getTodayISO() };
            orderData[f.expirationDate] = { value: getExpirationDate(30) };
            const result = await createRecord(CONFIG.tables.orders, orderData);
            orderId = result.metadata?.createdRecordIds?.[0];
            if (!orderId) throw new Error('Failed to create draft order');
            AppState.editingOrderId = orderId;
        }

        // Save properties and line items
        for (const op of AppState.orderProperties) {
            const propData = {
                [pf.relatedOrder]: { value: orderId },
                [pf.relatedProperty]: { value: op.propertyId },
                [pf.billingContact]: { value: op.billingContact || '' },
                [pf.billingEmail]: { value: op.billingEmail || '' },
                [pf.billingPhone]: { value: op.billingPhone || '' }
            };
            const propResult = await createRecord(CONFIG.tables.properties, propData);
            const propertyLinkId = propResult.metadata?.createdRecordIds?.[0];

            if (op.unitCount) {
                const pmf = CONFIG.fields.propertiesMaster;
                await updateRecord(CONFIG.tables.propertiesMaster, {
                    [pmf.recordId]: { value: op.propertyId },
                    [pmf.unitCount]: { value: op.unitCount }
                });
            }

            for (const li of op.lineItems) {
                if (li.productId || li.productCode) {
                    const liData = {
                        [lf.relatedOrder]: { value: orderId },
                        [lf.relatedProperty]: { value: propertyLinkId },
                        [lf.relatedCode]: { value: li.productCode },
                        [lf.description]: { value: li.productName },
                        [lf.quantity]: { value: li.quantity },
                        [lf.concession]: { value: li.concession || false },
                        [lf.concessionPercent]: { value: li.concessionPercent || 0 },
                        [lf.concessionAmount]: { value: li.concessionAmount || 0 }
                    };
                    if (li.unitPrice && li.unitPrice > 0) liData[lf.quotePrice] = { value: li.unitPrice };
                    await createRecord(CONFIG.tables.orderLineItems, liData);
                }
            }
        }

        showSuccess('Draft saved! Continue editing or submit when ready.');
    } catch (e) {
        console.error('Save draft order failed:', e);
        alert('Failed to save draft: ' + e.message);
    } finally {
        btn.textContent = orig;
        btn.disabled = false;
    }
}

async function saveDraftQuote() {
    const name = document.getElementById('quote-name').value.trim();
    const email = document.getElementById('quote-sales-email').value.trim();
    if (!name || !email) { alert('Quote name and sales rep email required'); return; }

    var btn = document.querySelector('#quote-form .btn-secondary:last-of-type');
    var orig = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
        const f = CONFIG.fields.quotes3D;
        const pf = CONFIG.fields.properties;
        const af = CONFIG.fields.quoteAttachments;
        const companyId = document.getElementById('quote-company-id').value;

        const data = {
            [f.quoteName]: { value: name },
            [f.salesRepEmail]: { value: email },
            [f.historyNotes]: { value: getRichTextContent('quote-notes-editor') },
            [f.quoteStatus]: { value: 'Draft' }
        };
        if (companyId) data[f.relatedCompany] = { value: parseInt(companyId) };

        let quoteId;
        if (AppState.editingQuoteId) {
            quoteId = AppState.editingQuoteId;
            await qbApiRequest(CONFIG.tables.properties, 'records', 'DELETE', { from: CONFIG.tables.properties, where: `{${pf.relatedQuote3D}.EX.${quoteId}}` });
            await qbApiRequest(CONFIG.tables.quoteAttachments, 'records', 'DELETE', { from: CONFIG.tables.quoteAttachments, where: `{${af.relatedQuote}.EX.${quoteId}}` });
            data[f.recordId] = { value: quoteId };
            await updateRecord(CONFIG.tables.quotes3D, data);
        } else {
            data[f.quoteDate] = { value: getTodayISO() };
            data[f.expirationDate] = { value: getExpirationDate(30) };
            const r = await createRecord(CONFIG.tables.quotes3D, data);
            quoteId = r.metadata?.createdRecordIds?.[0];
            if (!quoteId) throw new Error('Failed to create draft quote');
            AppState.editingQuoteId = quoteId;
        }

        // Save properties and attachments
        for (const qp of AppState.quoteProperties) {
            const propData = {
                [pf.relatedQuote3D]: { value: quoteId },
                [pf.relatedProperty]: { value: qp.propertyId }
            };
            await createRecord(CONFIG.tables.properties, propData);
            if (qp.unitCount) {
                const pmf = CONFIG.fields.propertiesMaster;
                await updateRecord(CONFIG.tables.propertiesMaster, {
                    [pmf.recordId]: { value: qp.propertyId },
                    [pmf.unitCount]: { value: qp.unitCount }
                });
            }
            for (const att of qp.attachments) {
                if (att.file || att.linkUrl) {
                    const descWithProperty = att.description ? `[${qp.property.name}] ${att.description}` : `[${qp.property.name}]`;
                    const attData = {
                        [af.relatedQuote]: { value: quoteId },
                        [af.description]: { value: descWithProperty },
                        [af.linkToFile]: { value: att.linkUrl || '' }
                    };
                    const attResult = await createRecord(CONFIG.tables.quoteAttachments, attData);
                    const attId = attResult.metadata?.createdRecordIds?.[0];
                    if (attId && att.file) await uploadAttachmentFile(attId, att.file);
                }
            }
        }

        showSuccess('Draft saved! Continue editing or submit when ready.');
    } catch (e) {
        console.error('Save draft quote failed:', e);
        alert('Failed to save draft: ' + e.message);
    } finally {
        btn.textContent = orig;
        btn.disabled = false;
    }
}

// ============================================================================
// LOAD DRAFT FOR EDITING
// ============================================================================

async function loadOrderForEdit(id) {
    try {
        const f = CONFIG.fields.orders;
        const pf = CONFIG.fields.properties;
        const lf = CONFIG.fields.orderLineItems;

        const [orderResult, propsResult] = await Promise.all([
            queryRecords(CONFIG.tables.orders,
                [f.recordId, f.salesRepEmail, f.ycrmOpportunityId, f.historyNotes, f.relatedCompany,
                 f.contractContactFirst, f.contractContactLast, f.contractEmail, f.contractPhone, f.propertyLevelBilling],
                `{3.EX.${id}}`
            ),
            queryRecords(CONFIG.tables.properties,
                [pf.recordId, pf.relatedProperty, pf.propertyName, pf.billingContact, pf.billingEmail, pf.billingPhone, pf.unitCount],
                `{${pf.relatedOrder}.EX.${id}}`
            )
        ]);

        if (!orderResult.data?.length) { alert('Draft not found'); return; }
        const order = orderResult.data[0];

        // Fetch line items for each property in parallel
        const propLinks = propsResult.data || [];
        const lineItemResults = await Promise.all(propLinks.map(p =>
            queryRecords(CONFIG.tables.orderLineItems,
                [lf.recordId, lf.quantity, lf.relatedCode, lf.codeProductNames, lf.codeRetailPrice, lf.quotePrice, lf.concession, lf.concessionPercent, lf.concessionAmount, lf.relatedProperty],
                `{${lf.relatedProperty}.EX.${p[pf.recordId].value}}`
            )
        ));

        resetOrderForm();
        switchTab('tab-new-order');

        // Populate header fields
        document.getElementById('order-sales-email').value = order[f.salesRepEmail]?.value || '';
        document.getElementById('order-ycrm-opportunity').value = order[f.ycrmOpportunityId]?.value || '';
        document.getElementById('order-contract-first').value = order[f.contractContactFirst]?.value || '';
        document.getElementById('order-contract-last').value = order[f.contractContactLast]?.value || '';
        document.getElementById('order-contract-email').value = order[f.contractEmail]?.value || '';
        document.getElementById('order-contract-phone').value = order[f.contractPhone]?.value || '';
        document.getElementById('order-property-level-billing').checked = order[f.propertyLevelBilling]?.value === true;
        setRichTextContent('order-notes-editor', order[f.historyNotes]?.value || '');

        // Restore client
        const relatedCompany = order[f.relatedCompany]?.value;
        if (relatedCompany) {
            const client = AppState.clients.find(c => c.id === relatedCompany);
            if (client) selectClient(client.id);
        }

        // Restore properties and line items
        propLinks.forEach((prop, i) => {
            const propertyId = prop[pf.relatedProperty]?.value;
            const property = AppState.properties.find(p => p.id === propertyId);
            if (!property) return;

            const lineItems = (lineItemResults[i]?.data || []).map(li => {
                lineItemCounter++;
                const unitPrice = li[lf.quotePrice]?.value ?? li[lf.codeRetailPrice]?.value ?? 0;
                const qty = li[lf.quantity]?.value ?? 1;
                return {
                    id: lineItemCounter,
                    productId: li[lf.relatedCode]?.value,
                    productCode: li[lf.relatedCode]?.value,
                    productName: li[lf.codeProductNames]?.value || '',
                    quantity: qty,
                    unitPrice: unitPrice,
                    total: qty * unitPrice,
                    concession: li[lf.concession]?.value ?? false,
                    concessionPercent: li[lf.concessionPercent]?.value ?? 0,
                    concessionAmount: li[lf.concessionAmount]?.value ?? 0
                };
            });

            AppState.orderProperties.push({
                propertyId,
                property,
                lineItems,
                billingContact: prop[pf.billingContact]?.value || '',
                billingEmail: prop[pf.billingEmail]?.value || '',
                billingPhone: prop[pf.billingPhone]?.value || '',
                unitCount: prop[pf.unitCount]?.value || 0
            });
        });

        AppState.editingOrderId = id;
        renderOrderProperties();
        showSuccess('Order loaded for editing.');
    } catch (e) {
        console.error('Load order draft failed:', e);
        alert('Failed to load draft: ' + e.message);
    }
}

async function loadQuoteDraft(id) {
    try {
        const f = CONFIG.fields.quotes3D;
        const pf = CONFIG.fields.properties;
        const af = CONFIG.fields.quoteAttachments;

        const [quoteResult, propsResult, attachmentsResult] = await Promise.all([
            queryRecords(CONFIG.tables.quotes3D,
                [f.recordId, f.quoteName, f.salesRepEmail, f.historyNotes, f.relatedCompany],
                `{3.EX.${id}}`
            ),
            queryRecords(CONFIG.tables.properties,
                [pf.recordId, pf.relatedProperty, pf.propertyName, pf.unitCount],
                `{${pf.relatedQuote3D}.EX.${id}}`
            ),
            queryRecords(CONFIG.tables.quoteAttachments,
                [af.recordId, af.description, af.linkToFile, af.fileAttachment],
                `{${af.relatedQuote}.EX.${id}}`
            )
        ]);

        if (!quoteResult.data?.length) { alert('Draft not found'); return; }
        const quote = quoteResult.data[0];

        resetQuoteForm();
        switchTab('tab-new-quote');

        document.getElementById('quote-name').value = quote[f.quoteName]?.value || '';
        document.getElementById('quote-sales-email').value = quote[f.salesRepEmail]?.value || '';
        setRichTextContent('quote-notes-editor', quote[f.historyNotes]?.value || '');

        const relatedCompany = quote[f.relatedCompany]?.value;
        if (relatedCompany) {
            const client = AppState.clients.find(c => c.id === relatedCompany);
            if (client) selectQuoteClient(client.id);
        }

        const attachments = attachmentsResult.data || [];

        (propsResult.data || []).forEach(prop => {
            const propertyId = prop[pf.relatedProperty]?.value;
            const property = AppState.properties.find(p => p.id === propertyId);
            if (!property) return;

            const propName = prop[pf.propertyName]?.value || property.name;
            const propAtts = attachments
                .filter(att => (att[af.description]?.value || '').startsWith(`[${propName}]`))
                .map(att => {
                    AppState.attachmentCounter++;
                    const desc = (att[af.description]?.value || '').replace(`[${propName}]`, '').trim();
                    const linkUrl = att[af.linkToFile]?.value || '';
                    const fileInfo = att[af.fileAttachment]?.value;
                    return {
                        id: AppState.attachmentCounter,
                        file: null,
                        fileName: fileInfo?.filename || '',
                        description: desc,
                        linkUrl: linkUrl,
                        needsReupload: !linkUrl && !!fileInfo
                    };
                });

            AppState.quoteProperties.push({ propertyId, property, attachments: propAtts, unitCount: prop[pf.unitCount]?.value || 0 });
        });

        AppState.editingQuoteId = id;
        renderQuoteProperties();
        showSuccess('Draft loaded. Continue editing and submit when ready.');
    } catch (e) {
        console.error('Load quote draft failed:', e);
        alert('Failed to load draft: ' + e.message);
    }
}

// ============================================================================
// DASHBOARD
// ============================================================================

async function loadDashboard(force) {
    if (!AppState.currentUser) {
        AppState.currentUser = await getCurrentUser();
    }
    var user = AppState.currentUser;
    prefillCurrentUserEmail();

    if (!force && AppState._dashboardRendered) return;

    var dashContent = document.getElementById('dash-content');
    showLoading(dashContent);

    var role = user?.role;
    var reportsNav = document.getElementById('nav-reports');
    if (reportsNav) reportsNav.style.display = role === 'Administrator' ? '' : 'none';

    if (role === '3D Director') {
        await renderDirectorDashboard(user);
    } else if (role === 'Administrator') {
        await renderAdminDashboard(user);
    } else {
        await renderSalesDashboard(user);
    }
    AppState._dashboardRendered = true;
}

// Shared helpers for building dashboard panels
async function _fetchDashProductTypes(displayedOrders, f) {
    var map = {};
    if (!displayedOrders.length || !AppState.products || !AppState.products.length) return map;
    try {
        var lf = CONFIG.fields.orderLineItems;
        var ids = displayedOrders.map(function(o){ return o[f.recordId].value; });
        var orFilter = ids.map(function(id){ return `{${lf.relatedOrder}.EX.${id}}`; }).join('OR');
        var result = await queryRecords(CONFIG.tables.orderLineItems, [lf.relatedOrder, lf.relatedCode], orFilter);
        (result.data || []).forEach(function(li) {
            var oid = li[lf.relatedOrder]?.value;
            var code = li[lf.relatedCode]?.value;
            if (!oid || !code) return;
            var product = AppState.products.find(function(p){ return String(p.code) === String(code); });
            var assetType = product && product.assetType;
            if (!assetType) return;
            if (!map[oid]) map[oid] = [];
            if (!map[oid].includes(assetType)) map[oid].push(assetType);
        });
    } catch(e) { console.warn('Dashboard product types fetch failed:', e); }
    return map;
}
function _dashEmptyRow(msg) {
    return `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">${msg}</div>`;
}
function _dashOrderRow(o, f, editable, productTypes) {
    var status = o[f.orderStatus]?.value || 'Draft';
    var total = o[f.orderTotal]?.value;
    var propCount = o[f.propertyCount]?.value || 0;
    var id = o[f.recordId].value;
    return `<div class="dash-mini-row">
        <div class="dash-mini-left" style="cursor:pointer;" onclick="${editable ? `loadOrderForEdit(${id})` : `viewOrder(${id})`}">
            <div class="dash-mini-company">${escapeHtml(o[f.companyName]?.value || '—')}</div>
            <div class="dash-mini-meta">${formatDate(o[f.quoteDate]?.value) || '—'} &middot; ${propCount} ${propCount === 1 ? 'property' : 'properties'}</div>
            ${productTypes && productTypes.length ? `<div class="dash-mini-products">${productTypes.map(function(t){ return `<span class="badge-type ${escapeHtml(t.toLowerCase().replace(/\s+/g,'-'))}">${escapeHtml(t)}</span>`; }).join('')}</div>` : ''}
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
            ${total != null ? `<span style="font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap;">${formatCurrency(total)}</span>` : ''}
            <span class="badge badge-${getStatusClass(status)}">${escapeHtml(status)}</span>
            ${editable ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();loadOrderForEdit(${id})" title="Edit Order"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>` : ''}
        </div>
    </div>`;
}
function _dashQuoteRow(q, qf) {
    var status = q[qf.quoteStatus]?.value || 'Draft';
    var total = q[qf.quoteTotal]?.value;
    return `<div class="dash-mini-row" onclick="viewQuote(${q[qf.recordId].value})">
        <div class="dash-mini-left">
            <div class="dash-mini-company">${escapeHtml(q[qf.quoteName]?.value || q[qf.companyName]?.value || '—')}</div>
            <div class="dash-mini-meta">${escapeHtml(q[qf.companyName]?.value || '—')} &middot; ${formatDate(q[qf.quoteDate]?.value) || '—'}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
            ${total != null ? `<span style="font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap;">${formatCurrency(total)}</span>` : ''}
            <span class="badge badge-${getStatusClass(status)}">${escapeHtml(status)}</span>
        </div>
    </div>`;
}
function _kpiGrid(ids) {
    // ids: [{id, label, accent}]
    return `<div class="dash-kpi-grid" style="grid-template-columns:repeat(${ids.length},1fr);">${ids.map(function(k) {
        return `<div class="stat-card"><div class="stat-label">${k.label}</div><div class="stat-value${k.accent ? ' blue' : ''}" id="${k.id}">—</div></div>`;
    }).join('')}</div>`;
}

async function renderSalesDashboard(user) {
    var f = CONFIG.fields.orders;
    var qf = CONFIG.fields.quotes3D;
    var dashContent = document.getElementById('dash-content');
    var headerActions = document.getElementById('dash-header-actions');

    headerActions.innerHTML = `
        <button class="btn btn-secondary" onclick="switchTab('tab-new-quote')">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            New 3D Quote
        </button>
        <button class="btn btn-primary" onclick="switchTab('tab-new-order')">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            New Order
        </button>`;

    var contractStatuses = ['Contract Created','Awaiting Signature','Contract Signed','Concessions Approved','Contract Needed','Completed'];

    dashContent.innerHTML = `
        <div class="dash-kpi-row">
            <div><div class="dash-section-label">My Orders</div>${_kpiGrid([
                {id:'ds-o-total',label:'Total'},{id:'ds-o-pending',label:'In Progress',accent:true},{id:'ds-o-completed',label:'Completed'}
            ])}</div>
            <div><div class="dash-section-label">My 3D Quotes</div>${_kpiGrid([
                {id:'ds-q-total',label:'Total'},{id:'ds-q-pending',label:'Pending Review',accent:true},{id:'ds-q-approved',label:'Approved'}
            ])}</div>
        </div>
        <div class="dash-cols">
            <div class="dash-panel">
                <div class="dash-panel-header"><span class="dash-panel-title">My Pending Orders</span><a class="dash-view-all" onclick="switchTab('tab-order-history')">View all</a></div>
                <div id="ds-pending-orders"><div class="loading-spinner"><div class="spinner"></div><p>Loading...</p></div></div>
            </div>
            <div class="dash-panel">
                <div class="dash-panel-header"><span class="dash-panel-title">Submitted Orders</span><a class="dash-view-all" onclick="switchTab('tab-order-history')">View all</a></div>
                <div id="ds-contract-orders"><div class="loading-spinner"><div class="spinner"></div><p>Loading...</p></div></div>
            </div>
        </div>
        <div class="dash-panel">
            <div class="dash-panel-header"><span class="dash-panel-title">My Recent Quotes</span><a class="dash-view-all" onclick="switchTab('tab-quote-history')">View all</a></div>
            <div id="ds-recent-quotes"><div class="loading-spinner"><div class="spinner"></div><p>Loading...</p></div></div>
        </div>`;

    try {
        var emailFilter = user?.email ? `{${f.salesRepEmail}.EX.'${user.email}'}` : null;
        var quoteEmailFilter = user?.email ? `{${qf.salesRepEmail}.EX.'${user.email}'}` : null;
        var [ordersResult, quotesResult] = await Promise.all([
            queryRecords(CONFIG.tables.orders, [f.recordId, f.orderStatus, f.quoteDate, f.salesRepEmail, f.companyName, f.orderTotal, f.propertyCount],
                emailFilter, [{fieldId: f.dateModified, order: 'DESC'}]),
            queryRecords(CONFIG.tables.quotes3D, [qf.recordId, qf.quoteName, qf.quoteStatus, qf.quoteDate, qf.salesRepEmail, qf.companyName, qf.quoteTotal],
                quoteEmailFilter, [{fieldId: qf.dateModified, order: 'DESC'}])
        ]);
        var orders = ordersResult.data || [];
        var quotes = quotesResult.data || [];
        var pendingOrders = orders.filter(function(o){ return !contractStatuses.includes(o[f.orderStatus]?.value) && o[f.orderStatus]?.value !== 'Cancelled'; });
        var contractOrders = orders.filter(function(o){ return contractStatuses.includes(o[f.orderStatus]?.value); });

        document.getElementById('ds-o-total').textContent = orders.filter(function(o){ return o[f.orderStatus]?.value !== 'Cancelled'; }).length;
        document.getElementById('ds-o-pending').textContent = pendingOrders.length;
        document.getElementById('ds-o-completed').textContent = orders.filter(function(o){ return o[f.orderStatus]?.value === 'Completed'; }).length;
        document.getElementById('ds-q-total').textContent = quotes.length;
        document.getElementById('ds-q-pending').textContent = quotes.filter(function(q){ return ['Pending Review','Sent to Client'].includes(q[qf.quoteStatus]?.value); }).length;
        document.getElementById('ds-q-approved').textContent = quotes.filter(function(q){ return q[qf.quoteStatus]?.value === 'Approved'; }).length;

        var productTypesMap = await _fetchDashProductTypes([...pendingOrders.slice(0,5), ...contractOrders.slice(0,5)], f);
        document.getElementById('ds-pending-orders').innerHTML = pendingOrders.slice(0,5).map(function(o){ return _dashOrderRow(o,f,true,productTypesMap[o[f.recordId].value]); }).join('') || _dashEmptyRow('No pending orders');
        document.getElementById('ds-contract-orders').innerHTML = contractOrders.slice(0,5).map(function(o){ return _dashOrderRow(o,f,false,productTypesMap[o[f.recordId].value]); }).join('') || _dashEmptyRow('No contract orders yet');
        document.getElementById('ds-recent-quotes').innerHTML = quotes.slice(0,5).map(function(q){ return _dashQuoteRow(q,qf); }).join('') || _dashEmptyRow('No quotes yet');
    } catch(e) { console.error('renderSalesDashboard failed:', e); }
}

async function renderAdminDashboard(user) {
    var f = CONFIG.fields.orders;
    var qf = CONFIG.fields.quotes3D;
    var dashContent = document.getElementById('dash-content');
    var headerActions = document.getElementById('dash-header-actions');

    headerActions.innerHTML = `
        <button class="btn btn-secondary" onclick="switchTab('tab-new-quote')">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            New 3D Quote
        </button>
        <button class="btn btn-primary" onclick="switchTab('tab-new-order')">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            New Order
        </button>`;

    dashContent.innerHTML = `
        <div class="dash-panel dash-concessions-alert" id="da-concessions-section" style="display:none;">
            <div class="dash-panel-header">
                <div style="display:flex;align-items:center;gap:10px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--warning);flex-shrink:0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <span class="dash-panel-title">Concessions Pending Approval</span>
                    <span class="badge badge-pending" id="da-concessions-count">0</span>
                </div>
            </div>
            <div id="da-concessions-table"></div>
        </div>
        <div class="dash-kpi-row">
            <div><div class="dash-section-label">Orders</div>${_kpiGrid([
                {id:'da-o-total',label:'Total'},{id:'da-o-pending',label:'In Progress',accent:true},{id:'da-o-completed',label:'Completed'}
            ])}</div>
            <div><div class="dash-section-label">3D Quotes</div>${_kpiGrid([
                {id:'da-q-total',label:'Total'},{id:'da-q-pending',label:'Pending Review',accent:true},{id:'da-q-approved',label:'Approved'}
            ])}</div>
        </div>
        <div class="dash-cols">
            <div class="dash-panel">
                <div class="dash-panel-header"><span class="dash-panel-title">Pending Orders</span><a class="dash-view-all" onclick="switchTab('tab-order-history')">View all</a></div>
                <div id="da-pending-orders"><div class="loading-spinner"><div class="spinner"></div><p>Loading...</p></div></div>
            </div>
            <div class="dash-panel">
                <div class="dash-panel-header"><span class="dash-panel-title">Submitted Orders</span><a class="dash-view-all" onclick="switchTab('tab-order-history')">View all</a></div>
                <div id="da-contract-orders"><div class="loading-spinner"><div class="spinner"></div><p>Loading...</p></div></div>
            </div>
        </div>
        <div class="dash-panel">
            <div class="dash-panel-header"><span class="dash-panel-title">Recent 3D Quotes</span><a class="dash-view-all" onclick="switchTab('tab-quote-history')">View all</a></div>
            <div id="da-recent-quotes"><div class="loading-spinner"><div class="spinner"></div><p>Loading...</p></div></div>
        </div>`;

    try {
        var emailFilter = user?.email ? `{${f.salesRepEmail}.EX.'${user.email}'}` : null;
        var quoteEmailFilter = user?.email ? `{${qf.salesRepEmail}.EX.'${user.email}'}` : null;
        var [ordersResult, quotesResult, concessionsResult] = await Promise.all([
            queryRecords(CONFIG.tables.orders, [f.recordId, f.orderStatus, f.quoteDate, f.salesRepEmail, f.companyName, f.orderTotal, f.propertyCount],
                emailFilter, [{fieldId: f.dateModified, order: 'DESC'}]),
            queryRecords(CONFIG.tables.quotes3D, [qf.recordId, qf.quoteName, qf.quoteStatus, qf.quoteDate, qf.salesRepEmail, qf.companyName, qf.quoteTotal],
                quoteEmailFilter, [{fieldId: qf.dateModified, order: 'DESC'}]),
            queryRecords(CONFIG.tables.orders, [f.recordId, f.orderStatus, f.quoteDate, f.salesRepEmail, f.companyName],
                `{${f.orderStatus}.EX.'Concessions Approval Needed'}`, [{fieldId: f.dateModified, order: 'DESC'}])
        ]);
        var orders = ordersResult.data || [];
        var quotes = quotesResult.data || [];
        var concessions = concessionsResult.data || [];
        var contractStatuses = ['Contract Created','Awaiting Signature','Contract Signed','Concessions Approved','Contract Needed','Completed'];
        var pendingOrders = orders.filter(function(o){ return !contractStatuses.includes(o[f.orderStatus]?.value) && o[f.orderStatus]?.value !== 'Cancelled'; });
        var contractOrders = orders.filter(function(o){ return contractStatuses.includes(o[f.orderStatus]?.value); });

        document.getElementById('da-o-total').textContent = orders.filter(function(o){ return o[f.orderStatus]?.value !== 'Cancelled'; }).length;
        document.getElementById('da-o-pending').textContent = pendingOrders.length;
        document.getElementById('da-o-completed').textContent = orders.filter(function(o){ return o[f.orderStatus]?.value === 'Completed'; }).length;
        document.getElementById('da-q-total').textContent = quotes.length;
        document.getElementById('da-q-pending').textContent = quotes.filter(function(q){ return ['Pending Review','Sent to Client'].includes(q[qf.quoteStatus]?.value); }).length;
        document.getElementById('da-q-approved').textContent = quotes.filter(function(q){ return q[qf.quoteStatus]?.value === 'Approved'; }).length;

        var productTypesMap = await _fetchDashProductTypes([...pendingOrders.slice(0,5), ...contractOrders.slice(0,5)], f);
        document.getElementById('da-pending-orders').innerHTML = pendingOrders.slice(0,5).map(function(o){ return _dashOrderRow(o,f,true,productTypesMap[o[f.recordId].value]); }).join('') || _dashEmptyRow('No pending orders');
        document.getElementById('da-contract-orders').innerHTML = contractOrders.slice(0,5).map(function(o){ return _dashOrderRow(o,f,false,productTypesMap[o[f.recordId].value]); }).join('') || _dashEmptyRow('No contract orders yet');
        document.getElementById('da-recent-quotes').innerHTML = quotes.slice(0,5).map(function(q){ return _dashQuoteRow(q,qf); }).join('') || _dashEmptyRow('No quotes yet');

        if (concessions.length) {
            document.getElementById('da-concessions-section').style.display = 'block';
            document.getElementById('da-concessions-count').textContent = concessions.length;
            document.getElementById('da-concessions-table').innerHTML = concessions.map(function(o) {
                return `<div class="dash-mini-row" onclick="viewOrder(${o[f.recordId].value})">
                    <div class="dash-mini-left">
                        <div class="dash-mini-company">${escapeHtml(o[f.companyName]?.value || '—')}</div>
                        <div class="dash-mini-meta">${escapeHtml(o[f.salesRepEmail]?.value || '—')} &middot; ${formatDate(o[f.quoteDate]?.value)}</div>
                    </div>
                    <span class="badge badge-pending">Needs Approval</span>
                </div>`;
            }).join('');
        }
    } catch(e) { console.error('renderAdminDashboard failed:', e); }
}

async function renderDirectorDashboard(user) {
    var qf = CONFIG.fields.quotes3D;
    var dashContent = document.getElementById('dash-content');
    var headerActions = document.getElementById('dash-header-actions');

    headerActions.innerHTML = `
        <button class="btn btn-primary" onclick="switchTab('tab-new-quote')">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            New 3D Quote
        </button>`;

    dashContent.innerHTML = `
        <div style="margin-bottom:24px;">
            <div class="dash-section-label">3D Quotes</div>
            ${_kpiGrid([
                {id:'dd-q-total',label:'Total'},
                {id:'dd-q-pending',label:'Pending Review',accent:true},
                {id:'dd-q-approved',label:'Approved'},
                {id:'dd-q-converted',label:'Converted'}
            ])}
        </div>
        <div class="dash-panel" style="margin-bottom:24px;">
            <div class="dash-panel-header">
                <span class="dash-panel-title">Pending Review</span>
                <span class="badge badge-pending" id="dd-pending-count">0</span>
            </div>
            <div id="dd-pending-list"><div class="loading-spinner"><div class="spinner"></div><p>Loading...</p></div></div>
        </div>
        <div class="dash-panel">
            <div class="dash-panel-header">
                <span class="dash-panel-title">All Recent Quotes</span>
                <a class="dash-view-all" onclick="switchTab('tab-quote-history')">View all</a>
            </div>
            <div id="dd-all-quotes"><div class="loading-spinner"><div class="spinner"></div><p>Loading...</p></div></div>
        </div>`;

    try {
        var result = await queryRecords(
            CONFIG.tables.quotes3D,
            [qf.recordId, qf.quoteName, qf.quoteStatus, qf.quoteDate, qf.salesRepEmail, qf.companyName],
            null, [{fieldId: qf.dateModified, order: 'DESC'}]
        );
        var quotes = result.data || [];

        document.getElementById('dd-q-total').textContent = quotes.length;
        document.getElementById('dd-q-pending').textContent = quotes.filter(function(q){ return q[qf.quoteStatus]?.value === 'Pending Review'; }).length;
        document.getElementById('dd-q-approved').textContent = quotes.filter(function(q){ return q[qf.quoteStatus]?.value === 'Approved'; }).length;
        document.getElementById('dd-q-converted').textContent = quotes.filter(function(q){ return q[qf.quoteStatus]?.value === 'Converted to Order'; }).length;

        var pending = quotes.filter(function(q){ return q[qf.quoteStatus]?.value === 'Pending Review'; });
        document.getElementById('dd-pending-count').textContent = pending.length;
        document.getElementById('dd-pending-list').innerHTML = pending.length
            ? pending.map(function(q) {
                var safeName = (q[qf.quoteName]?.value || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
                var status = q[qf.quoteStatus]?.value || 'Pending Review';
                return `<div class="dash-mini-row">
                    <div class="dash-mini-left">
                        <div class="dash-mini-company">${escapeHtml(q[qf.quoteName]?.value || q[qf.companyName]?.value || '—')}</div>
                        <div class="dash-mini-meta">${escapeHtml(q[qf.companyName]?.value || '—')} &middot; ${formatDate(q[qf.quoteDate]?.value)} &middot; ${escapeHtml(q[qf.salesRepEmail]?.value || '—')}</div>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
                        <button class="btn btn-secondary btn-sm" onclick="openLineItemsModal(${q[qf.recordId].value},'${safeName}','${status}')">Add Line Items</button>
                        <button class="btn btn-ghost btn-sm" onclick="viewQuote(${q[qf.recordId].value})" title="View"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                    </div>
                </div>`;
            }).join('')
            : _dashEmptyRow('No quotes pending review');

        document.getElementById('dd-all-quotes').innerHTML = quotes.slice(0,8).map(function(q){ return _dashQuoteRow(q,qf); }).join('') || _dashEmptyRow('No quotes yet');
    } catch(e) { console.error('renderDirectorDashboard failed:', e); }
}

// ============================================================================
// LINE ITEMS MODAL (3D Director)
// ============================================================================

var _liQuoteId = null;
var _liRowCounter = 0;

async function openLineItemsModal(quoteId, quoteName, currentStatus) {
    _liQuoteId = quoteId;
    _liRowCounter = 0;
    document.getElementById('li-modal-title').textContent = quoteName || 'Quote';

    var statusSel = document.getElementById('li-modal-status');
    statusSel.innerHTML = CONFIG.quoteStatuses.filter(function(s){ return s !== 'Draft'; }).map(function(s) {
        return `<option value="${s}"${s === currentStatus ? ' selected' : ''}>${s}</option>`;
    }).join('');

    openModal('line-items-modal');

    var rows = document.getElementById('li-modal-rows');
    rows.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted);">Loading...</td></tr>`;

    try {
        var lf = CONFIG.fields.lineItems3D;
        var result = await queryRecords(
            CONFIG.tables.lineItems3D,
            [lf.recordId, lf.relatedProduct, lf.productName, lf.productRetailPrice, lf.quantity, lf.stills, lf.panos, lf.quotePrice, lf.notes],
            `{${lf.relatedQuote}.EX.${quoteId}}`
        );
        var existing = result.data || [];
        rows.innerHTML = '';
        if (existing.length) {
            existing.forEach(function(li) {
                addLineItemRow({
                    productId: li[lf.relatedProduct]?.value,
                    retailPrice: li[lf.productRetailPrice]?.value || 0,
                    quantity: li[lf.quantity]?.value || 1,
                    stills: li[lf.stills]?.value || '',
                    panos: li[lf.panos]?.value || '',
                    quotePrice: li[lf.quotePrice]?.value || '',
                    notes: li[lf.notes]?.value || ''
                });
            });
        } else {
            addLineItemRow();
        }
    } catch(e) {
        rows.innerHTML = `<tr><td colspan="7" style="color:var(--error);padding:16px;">Failed to load line items.</td></tr>`;
    }
}

function addLineItemRow(data) {
    var id = ++_liRowCounter;
    var opts = AppState.products3D.map(function(p) {
        return `<option value="${p.id}" data-price="${p.price}"${data?.productId == p.id ? ' selected' : ''}>${p.name}</option>`;
    }).join('');
    var retail = data?.retailPrice ? Number(data.retailPrice).toFixed(2) : '0.00';
    var tr = document.createElement('tr');
    tr.id = 'li-row-' + id;
    tr.innerHTML = `
        <td><select class="form-input li-product" style="font-size:13px;padding:6px 8px;" onchange="updateLiPrice(${id})">
            <option value="">Select...</option>${opts}
        </select></td>
        <td><input type="number" class="form-input li-qty" value="${data?.quantity || 1}" min="1" style="width:56px;font-size:13px;padding:6px 8px;"></td>
        <td><input type="number" class="form-input li-stills" value="${data?.stills || ''}" min="0" style="width:56px;font-size:13px;padding:6px 8px;"></td>
        <td><input type="number" class="form-input li-panos" value="${data?.panos || ''}" min="0" style="width:56px;font-size:13px;padding:6px 8px;"></td>
        <td><input type="number" class="form-input li-price" value="${data?.quotePrice || ''}" min="0" step="0.01" placeholder="${retail}" style="width:80px;font-size:13px;padding:6px 8px;"></td>
        <td><input type="text" class="form-input li-notes" value="${data?.notes || ''}" style="width:140px;font-size:13px;padding:6px 8px;"></td>
        <td><button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('li-row-${id}').remove()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button></td>`;
    document.getElementById('li-modal-rows').appendChild(tr);
}

function updateLiPrice(rowId) {
    var sel = document.querySelector('#li-row-' + rowId + ' .li-product');
    var opt = sel?.options[sel.selectedIndex];
    var price = opt?.dataset?.price || '';
    var inp = document.querySelector('#li-row-' + rowId + ' .li-price');
    if (inp) inp.placeholder = price ? Number(price).toFixed(2) : '0.00';
}

async function saveLineItems() {
    if (!_liQuoteId) return;
    var saveBtn = document.querySelector('#line-items-modal .btn-primary');
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    try {
        var lf = CONFIG.fields.lineItems3D;
        var f = CONFIG.fields.quotes3D;

        var lineItems = [];
        document.querySelectorAll('#li-modal-rows tr').forEach(function(row) {
            var productId = row.querySelector('.li-product')?.value;
            if (!productId) return;
            var product = AppState.products3D.find(function(p){ return p.id == productId; });
            var qpVal = parseFloat(row.querySelector('.li-price')?.value);
            lineItems.push({
                productId: parseInt(productId),
                productName: product?.name || '',
                retailPrice: product?.price || 0,
                quantity: parseInt(row.querySelector('.li-qty')?.value || 1) || 1,
                stills: parseInt(row.querySelector('.li-stills')?.value || 0) || 0,
                panos: parseInt(row.querySelector('.li-panos')?.value || 0) || 0,
                quotePrice: isNaN(qpVal) ? null : qpVal,
                notes: row.querySelector('.li-notes')?.value || ''
            });
        });

        // Delete existing then recreate
        await qbApiRequest(CONFIG.tables.lineItems3D, 'records', 'DELETE', {
            from: CONFIG.tables.lineItems3D,
            where: `{${lf.relatedQuote}.EX.${_liQuoteId}}`
        });

        for (var i = 0; i < lineItems.length; i++) {
            var li = lineItems[i];
            var data = {
                [lf.relatedQuote]: { value: _liQuoteId },
                [lf.relatedProduct]: { value: li.productId },
                [lf.productName]: { value: li.productName },
                [lf.productRetailPrice]: { value: li.retailPrice },
                [lf.quantity]: { value: li.quantity },
                [lf.stills]: { value: li.stills },
                [lf.panos]: { value: li.panos },
                [lf.notes]: { value: li.notes }
            };
            if (li.quotePrice !== null) data[lf.quotePrice] = { value: li.quotePrice };
            await createRecord(CONFIG.tables.lineItems3D, data);
        }

        // Update quote status
        var newStatus = document.getElementById('li-modal-status').value;
        await updateRecord(CONFIG.tables.quotes3D, {
            [f.recordId]: { value: _liQuoteId },
            [f.quoteStatus]: { value: newStatus }
        });

        showSuccess('Line items saved (' + lineItems.length + ' item' + (lineItems.length !== 1 ? 's' : '') + ')');
        closeModal('line-items-modal');
        loadDashboard();
    } catch(e) {
        console.error('saveLineItems failed:', e);
        alert('Failed to save: ' + e.message);
    } finally {
        saveBtn.textContent = 'Save Line Items';
        saveBtn.disabled = false;
    }
}

// ============================================================================
// REPORTS
// ============================================================================

async function loadReports(force) {
    var c = document.getElementById('reports-content');
    if (!c) return;
    if (!force && _reportsCache) { renderReports(_reportsCache.orders, _reportsCache.quotes); return; }
    showLoading(c);
    try {
        var f = CONFIG.fields.orders;
        var qf = CONFIG.fields.quotes3D;
        var [ordersResult, quotesResult] = await Promise.all([
            queryRecords(CONFIG.tables.orders,
                [f.recordId, f.orderStatus, f.quoteDate, f.salesRepEmail, f.companyName, f.orderTotal, f.propertyCount, f.commissionValue, f.nonCommissionValue],
                null, [{fieldId: f.quoteDate, order: 'DESC'}]),
            queryRecords(CONFIG.tables.quotes3D,
                [qf.recordId, qf.quoteStatus, qf.quoteDate, qf.salesRepEmail, qf.companyName, qf.quoteTotal],
                null, [{fieldId: qf.dateModified, order: 'DESC'}])
        ]);
        _reportsCache = { orders: ordersResult.data || [], quotes: quotesResult.data || [] };
        renderReports(_reportsCache.orders, _reportsCache.quotes);
    } catch(e) {
        showError(c, 'Failed to load reports: ' + e.message);
    }
}

var _reportsCache = null;
var _reportFilters = { period: 'current-month', customFrom: '', customTo: '', company: '', rep: '' };

function renderReports(orders, quotes) {
    var c = document.getElementById('reports-content');
    var ACTIVE   = 'background:none;border:none;border-bottom:2px solid var(--primary);color:var(--primary);font-weight:600;font-size:14px;padding:10px 20px;cursor:pointer;margin-bottom:-2px;';
    var INACTIVE = 'background:none;border:none;border-bottom:2px solid transparent;color:var(--text-secondary);font-weight:normal;font-size:14px;padding:10px 20px;cursor:pointer;margin-bottom:-2px;';
    c.innerHTML = `
        <div style="display:flex;border-bottom:2px solid var(--border-color);margin-bottom:24px;">
            <button id="rsubtab-btn-overview" style="${ACTIVE}" onclick="switchReportsTab('overview')">Overview</button>
            <button id="rsubtab-btn-sales" style="${INACTIVE}" onclick="switchReportsTab('sales')">Sales Report</button>
        </div>
        <div id="rsubtab-overview"></div>
        <div id="rsubtab-sales" style="display:none;"></div>`;
    _renderReportsOverview(orders, quotes);
    _reportFilters = { period: 'current-month', customFrom: '', customTo: '', company: '', rep: '' };
    _renderSalesReport(orders);
}

function switchReportsTab(tab) {
    var ACTIVE   = 'background:none;border:none;border-bottom:2px solid var(--primary);color:var(--primary);font-weight:600;font-size:14px;padding:10px 20px;cursor:pointer;margin-bottom:-2px;';
    var INACTIVE = 'background:none;border:none;border-bottom:2px solid transparent;color:var(--text-secondary);font-weight:normal;font-size:14px;padding:10px 20px;cursor:pointer;margin-bottom:-2px;';
    ['overview','sales'].forEach(function(t) {
        var btn  = document.getElementById('rsubtab-btn-' + t);
        var pane = document.getElementById('rsubtab-' + t);
        if (btn)  btn.style.cssText  = t === tab ? ACTIVE : INACTIVE;
        if (pane) pane.style.display = t === tab ? '' : 'none';
    });
}

function applyReportPeriodFilter() {
    if (!_reportsCache) return;
    _reportFilters.period    = document.getElementById('report-period-select')?.value || 'current-month';
    _reportFilters.customFrom = document.getElementById('report-date-from')?.value || '';
    _reportFilters.customTo   = document.getElementById('report-date-to')?.value || '';
    _reportFilters.company   = document.getElementById('report-company-filter')?.value || '';
    _reportFilters.rep       = document.getElementById('report-rep-filter')?.value || '';
    _renderSalesReport(_reportsCache.orders);
}

function _getReportDateRange(period) {
    var now = new Date(), y = now.getFullYear(), m = now.getMonth();
    if (period === 'current-month') return { from: new Date(y, m, 1),     to: new Date(y, m + 1, 0) };
    if (period === 'last-month')    return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) };
    if (period === 'last-3')        return { from: new Date(y, m - 3, 1), to: now };
    if (period === 'last-6')        return { from: new Date(y, m - 6, 1), to: now };
    if (period === 'ytd')           return { from: new Date(y, 0, 1),     to: now };
    if (period === 'custom') {
        var p1 = _reportFilters.customFrom ? _reportFilters.customFrom.split('-').map(Number) : null;
        var p2 = _reportFilters.customTo   ? _reportFilters.customTo.split('-').map(Number)   : null;
        var from = p1 ? new Date(p1[0], p1[1] - 1, p1[2]) : null;
        var to   = p2 ? new Date(p2[0], p2[1] - 1, p2[2]) : null;
        if (from && to) return { from: from, to: to };
        if (from)       return { from: from, to: new Date() };
        return null;
    }
    return null;
}

function _renderSalesReport(orders) {
    var c = document.getElementById('rsubtab-sales');
    if (!c) return;
    var f = CONFIG.fields.orders;
    var period = _reportFilters.period;

    // Build unique company/rep lists from all non-cancelled orders for dropdowns
    var allActive = orders.filter(function(o) { return o[f.orderStatus]?.value !== 'Cancelled'; });
    var companies = Array.from(new Set(allActive.map(function(o) { return o[f.companyName]?.value || ''; }).filter(Boolean))).sort();
    var reps      = Array.from(new Set(allActive.map(function(o) { return o[f.salesRepEmail]?.value || ''; }).filter(Boolean))).sort();

    // Apply all filters
    var range = _getReportDateRange(period);
    var filtered = allActive.filter(function(o) {
        if (range) {
            var d = o[f.quoteDate]?.value;
            if (!d) return false;
            var p = String(d).split('T')[0].split('-').map(Number);
            var date = new Date(p[0], p[1] - 1, p[2]);
            if (date < range.from || date > range.to) return false;
        }
        if (_reportFilters.company && o[f.companyName]?.value !== _reportFilters.company) return false;
        if (_reportFilters.rep && o[f.salesRepEmail]?.value !== _reportFilters.rep) return false;
        return true;
    });

    var totalProps   = filtered.reduce(function(s, o) { return s + (o[f.propertyCount]?.value || 0); }, 0);
    var totalNonComm = filtered.reduce(function(s, o) { return s + (o[f.nonCommissionValue]?.value || 0); }, 0);
    var totalComm    = filtered.reduce(function(s, o) { return s + (o[f.commissionValue]?.value || 0); }, 0);
    var totalVal     = filtered.reduce(function(s, o) { return s + (o[f.orderTotal]?.value || 0); }, 0);

    var periodOptions = [
        { value: 'current-month', label: 'Current Month' },
        { value: 'last-month',    label: 'Last Month' },
        { value: 'last-3',        label: 'Last 3 Months' },
        { value: 'last-6',        label: 'Last 6 Months' },
        { value: 'ytd',           label: 'Year to Date' },
        { value: 'all',           label: 'All Time' },
        { value: 'custom',        label: 'Custom Range' }
    ];

    var isCustom = period === 'custom';

    c.innerHTML =
        '<div style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px;margin-bottom:20px;padding:16px;background:var(--bg-secondary);border-radius:8px;">' +
            '<div style="display:flex;flex-direction:column;gap:4px;">' +
                '<label style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;">Period</label>' +
                '<select id="report-period-select" class="form-input" style="width:auto;" onchange="applyReportPeriodFilter()">' +
                    periodOptions.map(function(o) { return '<option value="' + o.value + '"' + (o.value === period ? ' selected' : '') + '>' + o.label + '</option>'; }).join('') +
                '</select>' +
            '</div>' +
            '<div id="report-custom-range" style="display:' + (isCustom ? 'flex' : 'none') + ';align-items:flex-end;gap:8px;">' +
                '<div style="display:flex;flex-direction:column;gap:4px;">' +
                    '<label style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;">From</label>' +
                    '<input type="date" id="report-date-from" class="form-input" style="width:auto;" value="' + (_reportFilters.customFrom || '') + '" onchange="applyReportPeriodFilter()">' +
                '</div>' +
                '<div style="display:flex;flex-direction:column;gap:4px;">' +
                    '<label style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;">To</label>' +
                    '<input type="date" id="report-date-to" class="form-input" style="width:auto;" value="' + (_reportFilters.customTo || '') + '" onchange="applyReportPeriodFilter()">' +
                '</div>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:4px;">' +
                '<label style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;">Company</label>' +
                '<select id="report-company-filter" class="form-input" style="width:auto;max-width:200px;" onchange="applyReportPeriodFilter()">' +
                    '<option value="">All Companies</option>' +
                    companies.map(function(co) { return '<option value="' + escapeHtml(co) + '"' + (co === _reportFilters.company ? ' selected' : '') + '>' + escapeHtml(co) + '</option>'; }).join('') +
                '</select>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:4px;">' +
                '<label style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;">Sales Rep</label>' +
                '<select id="report-rep-filter" class="form-input" style="width:auto;max-width:200px;" onchange="applyReportPeriodFilter()">' +
                    '<option value="">All Reps</option>' +
                    reps.map(function(rep) { return '<option value="' + escapeHtml(rep) + '"' + (rep === _reportFilters.rep ? ' selected' : '') + '>' + escapeHtml(rep) + '</option>'; }).join('') +
                '</select>' +
            '</div>' +
            '<div style="display:flex;align-items:flex-end;gap:12px;margin-left:auto;">' +
                '<span style="font-size:13px;color:var(--text-muted);padding-bottom:7px;">' + filtered.length + ' order' + (filtered.length !== 1 ? 's' : '') + '</span>' +
                '<button class="btn btn-secondary" style="white-space:nowrap;" onclick="downloadSalesReport()">&#x2B07; Download Excel</button>' +
            '</div>' +
        '</div>' +
        (filtered.length ?
            '<div style="overflow-x:auto;">' +
                '<table class="data-table">' +
                    '<thead><tr>' +
                        '<th>Order Date</th><th>Sales Rep</th><th>Company</th>' +
                        '<th style="text-align:right">Properties</th>' +
                        '<th style="text-align:right">Non-Commission</th>' +
                        '<th style="text-align:right">Commission</th>' +
                        '<th style="text-align:right">Total Value</th>' +
                    '</tr></thead>' +
                    '<tbody>' + filtered.map(function(o) {
                        return '<tr>' +
                            '<td>' + (formatDate(o[f.quoteDate]?.value) || '—') + '</td>' +
                            '<td>' + escapeHtml(o[f.salesRepEmail]?.value || '—') + '</td>' +
                            '<td>' + escapeHtml(o[f.companyName]?.value || '—') + '</td>' +
                            '<td style="text-align:right">' + (o[f.propertyCount]?.value || 0) + '</td>' +
                            '<td style="text-align:right">' + formatCurrency(o[f.nonCommissionValue]?.value || 0) + '</td>' +
                            '<td style="text-align:right">' + formatCurrency(o[f.commissionValue]?.value || 0) + '</td>' +
                            '<td style="text-align:right"><strong>' + formatCurrency(o[f.orderTotal]?.value || 0) + '</strong></td>' +
                        '</tr>';
                    }).join('') + '</tbody>' +
                    '<tfoot><tr style="font-weight:600;border-top:2px solid var(--border-color);">' +
                        '<td colspan="3" style="padding-top:10px;">Totals</td>' +
                        '<td style="text-align:right;padding-top:10px;">' + totalProps + '</td>' +
                        '<td style="text-align:right;padding-top:10px;">' + formatCurrency(totalNonComm) + '</td>' +
                        '<td style="text-align:right;padding-top:10px;">' + formatCurrency(totalComm) + '</td>' +
                        '<td style="text-align:right;padding-top:10px;">' + formatCurrency(totalVal) + '</td>' +
                    '</tr></tfoot>' +
                '</table>' +
            '</div>'
        : '<div style="padding:40px;text-align:center;color:var(--text-muted);font-size:14px;">No orders found for the selected filters.</div>');
}

function downloadSalesReport() {
    if (!_reportsCache) return;
    var f = CONFIG.fields.orders;
    var range = _getReportDateRange(_reportFilters.period);
    var filtered = _reportsCache.orders.filter(function(o) {
        if (o[f.orderStatus]?.value === 'Cancelled') return false;
        if (range) {
            var d = o[f.quoteDate]?.value;
            if (!d) return false;
            var p = String(d).split('T')[0].split('-').map(Number);
            var date = new Date(p[0], p[1] - 1, p[2]);
            if (date < range.from || date > range.to) return false;
        }
        if (_reportFilters.company && o[f.companyName]?.value !== _reportFilters.company) return false;
        if (_reportFilters.rep && o[f.salesRepEmail]?.value !== _reportFilters.rep) return false;
        return true;
    });
    var rows = [['Order Date', 'Sales Rep', 'Company', 'Property Count', 'Non-Commission', 'Commission', 'Total Value']];
    filtered.forEach(function(o) {
        rows.push([
            formatDate(o[f.quoteDate]?.value) || '',
            o[f.salesRepEmail]?.value || '',
            o[f.companyName]?.value || '',
            o[f.propertyCount]?.value || 0,
            o[f.nonCommissionValue]?.value || 0,
            o[f.commissionValue]?.value || 0,
            o[f.orderTotal]?.value || 0
        ]);
    });
    // Build SpreadsheetML XML so Excel opens it natively with proper number types
    var numCols = new Set([3, 4, 5, 6]); // Property Count, Non-Commission, Commission, Total Value columns
    var xml = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n' +
        '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n' +
        '<Worksheet ss:Name="Sales Report"><Table>\n';
    rows.forEach(function(row, rowIndex) {
        xml += '<Row>';
        row.forEach(function(cell, colIndex) {
            if (rowIndex > 0 && numCols.has(colIndex)) {
                xml += '<Cell><Data ss:Type="Number">' + (Number(cell) || 0) + '</Data></Cell>';
            } else {
                var escaped = String(cell).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                xml += '<Cell><Data ss:Type="String">' + escaped + '</Data></Cell>';
            }
        });
        xml += '</Row>\n';
    });
    xml += '</Table></Worksheet></Workbook>';
    var blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'sales-report-' + new Date().toISOString().substring(0, 10) + '.xls';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function _renderReportsOverview(orders, quotes) {
    var c = document.getElementById('rsubtab-overview');
    if (!c) return;
    var f = CONFIG.fields.orders;
    var qf = CONFIG.fields.quotes3D;

    var activeOrders = orders.filter(function(o) { return o[f.orderStatus]?.value !== 'Cancelled'; });
    var totalRevenue = activeOrders.reduce(function(s, o) { return s + (o[f.orderTotal]?.value || 0); }, 0);
    var completedOrders = activeOrders.filter(function(o) { return o[f.orderStatus]?.value === 'Completed'; });
    var completedRevenue = completedOrders.reduce(function(s, o) { return s + (o[f.orderTotal]?.value || 0); }, 0);
    var avgOrder = activeOrders.length ? totalRevenue / activeOrders.length : 0;

    var contractStatuses = ['Contract Created','Awaiting Signature','Contract Signed','Concessions Approved','Contract Needed','Completed'];
    var pipeline = activeOrders.filter(function(o) { return !contractStatuses.includes(o[f.orderStatus]?.value); });
    var pipelineValue = pipeline.reduce(function(s, o) { return s + (o[f.orderTotal]?.value || 0); }, 0);

    // --- by status ---
    var statusMap = {};
    activeOrders.forEach(function(o) {
        var s = o[f.orderStatus]?.value || 'Draft';
        if (!statusMap[s]) statusMap[s] = { count: 0, total: 0 };
        statusMap[s].count++;
        statusMap[s].total += o[f.orderTotal]?.value || 0;
    });
    var statusRows = Object.entries(statusMap).sort(function(a, b) { return b[1].total - a[1].total; });

    // --- by rep ---
    var repMap = {};
    activeOrders.forEach(function(o) {
        var rep = o[f.salesRepEmail]?.value || 'Unknown';
        if (!repMap[rep]) repMap[rep] = { count: 0, total: 0 };
        repMap[rep].count++;
        repMap[rep].total += o[f.orderTotal]?.value || 0;
    });
    var repRows = Object.entries(repMap).sort(function(a, b) { return b[1].total - a[1].total; }).slice(0, 10);

    // --- by company ---
    var coMap = {};
    activeOrders.forEach(function(o) {
        var co = o[f.companyName]?.value || 'Unknown';
        if (!coMap[co]) coMap[co] = { count: 0, total: 0 };
        coMap[co].count++;
        coMap[co].total += o[f.orderTotal]?.value || 0;
    });
    var coRows = Object.entries(coMap).sort(function(a, b) { return b[1].total - a[1].total; }).slice(0, 10);

    // --- monthly trend (last 12 months) ---
    var monthMap = {};
    activeOrders.forEach(function(o) {
        var d = o[f.quoteDate]?.value;
        if (!d) return;
        var key = String(d).substring(0, 7); // YYYY-MM
        if (!monthMap[key]) monthMap[key] = { count: 0, total: 0 };
        monthMap[key].count++;
        monthMap[key].total += o[f.orderTotal]?.value || 0;
    });
    var monthRows = Object.entries(monthMap).sort(function(a, b) { return b[0].localeCompare(a[0]); }).slice(0, 12);

    // --- quote conversion ---
    var totalQuotes = quotes.length;
    var convertedQuotes = quotes.filter(function(q) { return q[qf.quoteStatus]?.value === 'Converted'; }).length;
    var conversionRate = totalQuotes ? Math.round(convertedQuotes / totalQuotes * 100) : 0;
    var quoteRevenue = quotes.reduce(function(s, q) { return s + (q[qf.quoteTotal]?.value || 0); }, 0);

    function repTable(rows, valueKey) {
        if (!rows.length) return '<p style="color:var(--text-muted);font-size:13px;padding:12px 0;">No data</p>';
        return `<table class="data-table"><thead><tr><th>${valueKey === 'rep' ? 'Sales Rep' : 'Company'}</th><th style="text-align:right">Orders</th><th style="text-align:right">Revenue</th></tr></thead><tbody>${
            rows.map(function(r) {
                return `<tr><td>${escapeHtml(r[0])}</td><td style="text-align:right">${r[1].count}</td><td style="text-align:right">${formatCurrency(r[1].total)}</td></tr>`;
            }).join('')
        }</tbody></table>`;
    }

    c.innerHTML = `
        <div class="dash-kpi-row" style="margin-bottom:24px;">
            <div><div class="dash-section-label">All Orders</div>
                <div class="dash-kpi-grid" style="grid-template-columns:repeat(4,1fr);">
                    <div class="stat-card"><div class="stat-label">Total Revenue</div><div class="stat-value blue">${formatCurrency(totalRevenue)}</div></div>
                    <div class="stat-card"><div class="stat-label">Active Orders</div><div class="stat-value">${activeOrders.length}</div></div>
                    <div class="stat-card"><div class="stat-label">Avg Order Value</div><div class="stat-value">${formatCurrency(avgOrder)}</div></div>
                    <div class="stat-card"><div class="stat-label">Completed Revenue</div><div class="stat-value">${formatCurrency(completedRevenue)}</div></div>
                </div>
            </div>
            <div><div class="dash-section-label">Pipeline &amp; Quotes</div>
                <div class="dash-kpi-grid" style="grid-template-columns:repeat(4,1fr);">
                    <div class="stat-card"><div class="stat-label">Pipeline Value</div><div class="stat-value blue">${formatCurrency(pipelineValue)}</div></div>
                    <div class="stat-card"><div class="stat-label">In Pipeline</div><div class="stat-value">${pipeline.length}</div></div>
                    <div class="stat-card"><div class="stat-label">Quote Revenue</div><div class="stat-value">${formatCurrency(quoteRevenue)}</div></div>
                    <div class="stat-card"><div class="stat-label">Conversion Rate</div><div class="stat-value blue">${conversionRate}% <span style="font-size:12px;font-weight:normal;color:var(--text-muted);">(${convertedQuotes}/${totalQuotes})</span></div></div>
                </div>
            </div>
        </div>

        <div class="dash-cols" style="margin-bottom:24px;">
            <div class="dash-panel">
                <div class="dash-panel-header"><span class="dash-panel-title">Revenue by Status</span></div>
                <table class="data-table"><thead><tr><th>Status</th><th style="text-align:right">Orders</th><th style="text-align:right">Revenue</th></tr></thead><tbody>${
                    statusRows.map(function(r) {
                        return `<tr><td><span class="badge badge-${getStatusClass(r[0])}">${escapeHtml(r[0])}</span></td><td style="text-align:right">${r[1].count}</td><td style="text-align:right">${formatCurrency(r[1].total)}</td></tr>`;
                    }).join('')
                }</tbody></table>
            </div>
            <div class="dash-panel">
                <div class="dash-panel-header"><span class="dash-panel-title">Monthly Trend</span></div>
                <table class="data-table"><thead><tr><th>Month</th><th style="text-align:right">Orders</th><th style="text-align:right">Revenue</th></tr></thead><tbody>${
                    monthRows.map(function(r) {
                        var parts = r[0].split('-');
                        var label = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
                        return `<tr><td>${label}</td><td style="text-align:right">${r[1].count}</td><td style="text-align:right">${formatCurrency(r[1].total)}</td></tr>`;
                    }).join('')
                }</tbody></table>
            </div>
        </div>

        <div class="dash-cols">
            <div class="dash-panel">
                <div class="dash-panel-header"><span class="dash-panel-title">Top Sales Reps</span></div>
                ${repTable(repRows, 'rep')}
            </div>
            <div class="dash-panel">
                <div class="dash-panel-header"><span class="dash-panel-title">Top Companies</span></div>
                ${repTable(coRows, 'co')}
            </div>
        </div>`;
}

// ============================================================================
// HISTORY
// ============================================================================

function renderOrderHistoryTable() {
    const c = document.getElementById('order-history-table');
    const f = CONFIG.fields.orders;
    if (!AppState.orders.length) { c.innerHTML = '<div class="empty-state"><p class="empty-state-title">No orders yet</p><button class="btn btn-primary" onclick="switchTab(\'tab-new-order\')">Create Order</button></div>'; return; }
    document.getElementById('stat-total-orders').textContent = AppState.orders.length;
    document.getElementById('stat-pending-orders').textContent = AppState.orders.filter(o => ['Pending','Processing'].includes(o[f.orderStatus]?.value)).length;
    document.getElementById('stat-completed-orders').textContent = AppState.orders.filter(o => o[f.orderStatus]?.value === 'Completed').length;
    c.innerHTML = `<table class="data-table"><thead><tr><th>Company</th><th>Status</th><th>Date</th><th>Sales Rep</th><th style="text-align:right">Total</th><th>Actions</th></tr></thead><tbody>${AppState.orders.map(o => {
        const status = o[f.orderStatus]?.value || 'Draft';
        const oid = o[f.recordId].value;
        const total = o[f.orderTotal]?.value;
        return `<tr>
            <td>${o[f.companyName]?.value||'-'}</td>
            <td><span class="badge badge-${getStatusClass(status)}">${status}</span></td>
            <td>${formatDate(o[f.quoteDate]?.value)}</td>
            <td>${o[f.salesRepEmail]?.value||'-'}</td>
            <td style="text-align:right;font-weight:500;color:var(--lcp-blue)">${total != null && total > 0 ? formatCurrency(total) : '-'}</td>
            <td class="actions">
                ${!['Concessions Approved','Contract Needed','Completed','Cancelled'].includes(status) ? `<button class="btn btn-ghost btn-sm" onclick="loadOrderForEdit(${oid})" title="Edit Order"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>` : ''}
                <button class="btn btn-ghost btn-sm" onclick="viewOrder(${oid})" title="View Order"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
            </td>
        </tr>`;
    }).join('')}</tbody></table>`;
}

async function loadOrderHistory(force) {
    const c = document.getElementById('order-history-table');
    if (!force && AppState.orders.length) { renderOrderHistoryTable(); return; }
    showLoading(c);
    try {
        const f = CONFIG.fields.orders;
        const r = await queryRecords(CONFIG.tables.orders, [f.recordId, f.orderStatus, f.quoteDate, f.salesRepEmail, f.companyName, f.orderTotal, f.orderPDF, f.orderDOCX], null, [{ fieldId: f.dateModified, order: 'DESC' }]);
        AppState.orders = r.data;
        renderOrderHistoryTable();
    } catch (e) { showError(c, 'Failed to load orders'); }
}

function renderQuoteHistoryTable() {
    const c = document.getElementById('quote-history-table');
    const f = CONFIG.fields.quotes3D;
    if (!AppState.quotes.length) { c.innerHTML = '<div class="empty-state"><p class="empty-state-title">No quotes yet</p><button class="btn btn-primary" onclick="switchTab(\'tab-new-quote\')">Create Quote</button></div>'; return; }
    document.getElementById('stat-total-quotes').textContent = AppState.quotes.length;
    document.getElementById('stat-pending-quotes').textContent = AppState.quotes.filter(q => ['Pending Review','Sent to Client'].includes(q[f.quoteStatus]?.value)).length;
    document.getElementById('stat-approved-quotes').textContent = AppState.quotes.filter(q => q[f.quoteStatus]?.value === 'Approved').length;
    c.innerHTML = `<table class="data-table"><thead><tr><th>Quote Name</th><th>Company</th><th>Status</th><th>Date</th><th>Sales Rep</th><th>Actions</th></tr></thead><tbody>${AppState.quotes.map(q => {
        const status = q[f.quoteStatus]?.value || 'Draft';
        return `<tr>
            <td>${q[f.quoteName]?.value||'-'}</td>
            <td>${q[f.companyName]?.value||'-'}</td>
            <td><span class="badge badge-${getStatusClass(status)}">${status}</span></td>
            <td>${formatDate(q[f.quoteDate]?.value)}</td>
            <td>${q[f.salesRepEmail]?.value||'-'}</td>
            <td class="actions">
                ${status === 'Draft' ? `<button class="btn btn-ghost btn-sm" onclick="loadQuoteDraft(${q[f.recordId].value})" title="Edit Draft"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>` : ''}
                <button class="btn btn-ghost btn-sm" onclick="viewQuote(${q[f.recordId].value})" title="View Quote">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
            </td>
        </tr>`;
    }).join('')}</tbody></table>`;
}

async function loadQuoteHistory(force) {
    const c = document.getElementById('quote-history-table');
    if (!force && AppState.quotes.length) { renderQuoteHistoryTable(); return; }
    showLoading(c);
    try {
        const f = CONFIG.fields.quotes3D;
        const r = await queryRecords(CONFIG.tables.quotes3D, [f.recordId, f.quoteName, f.quoteStatus, f.quoteDate, f.salesRepEmail, f.companyName], null, [{ fieldId: f.dateModified, order: 'DESC' }]);
        AppState.quotes = r.data;
        renderQuoteHistoryTable();
    } catch (e) { showError(c, 'Failed to load quotes'); }
}

async function loadCancellations(force) {
    const c = document.getElementById('cancellations-table');
    if (!c) return;
    if (!force && AppState.cancellations.length) { renderCancellationsTable(AppState.cancellations); return; }
    showLoading(c);
    try {
        const f = CONFIG.fields.cancellations;
        const r = await queryRecords(CONFIG.tables.cancellations,
            [f.recordId, f.companyName, f.propertyName, f.propertyAddress, f.nextDate, f.cancellationDate, f.cancellationReason],
            null,
            [{ fieldId: f.cancellationDate, order: 'DESC' }]
        );
        const records = r.data || [];
        AppState.cancellations = records;

        if (!records.length) {
            c.innerHTML = '<div class="empty-state"><p class="empty-state-title">No cancellations found</p></div>';
            return;
        }

        // Populate company filter
        const companies = [...new Set(records.map(rec => rec[f.companyName]?.value).filter(Boolean))].sort();
        const companySelect = document.getElementById('cancellations-filter-company');
        if (companySelect) {
            const curr = companySelect.value;
            companySelect.innerHTML = '<option value="">All Companies</option>' + companies.map(co => `<option value="${co}"${co === curr ? ' selected' : ''}>${co}</option>`).join('');
        }

        // Populate state filter (extracted from address)
        const states = [...new Set(records.map(rec => extractStateFromAddress(rec[f.propertyAddress]?.value)).filter(Boolean))].sort();
        const stateSelect = document.getElementById('cancellations-filter-state');
        if (stateSelect) {
            const curr = stateSelect.value;
            stateSelect.innerHTML = '<option value="">All States</option>' + states.map(s => `<option value="${s}"${s === curr ? ' selected' : ''}>${s}</option>`).join('');
        }

        renderCancellationsTable(records);
    } catch (e) {
        showError(c, 'Failed to load cancellations');
        console.error(e);
    }
}

function extractStateFromAddress(addr) {
    if (!addr) return '';
    var m = addr.match(/,\s*([A-Z]{2})\s*\d{5}/);
    if (m) return m[1];
    var m2 = addr.match(/,\s*([A-Z]{2})\s*$/);
    if (m2) return m2[1];
    return '';
}

var _cancellationsSort = { col: 'cancellationDate', dir: 'desc' };

var _cancellationsCols = [
    { key: 'company',          label: 'Company' },
    { key: 'propertyName',     label: 'Property' },
    { key: 'address',          label: 'Address' },
    { key: 'nextDate',         label: 'Next Date' },
    { key: 'cancellationDate', label: 'Date of Cancellation' },
    { key: 'reason',           label: 'Reason' }
];

function sortCancellations(col) {
    if (_cancellationsSort.col === col) {
        _cancellationsSort.dir = _cancellationsSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        _cancellationsSort.col = col;
        _cancellationsSort.dir = 'asc';
    }
    renderCancellationsTable(AppState.cancellations);
}

function renderCancellationsTable(records) {
    const c = document.getElementById('cancellations-table');
    const f = CONFIG.fields.cancellations;
    const { col, dir } = _cancellationsSort;

    const sortArrow = dir === 'asc' ? ' ▲' : ' ▼';
    const headers = _cancellationsCols.map(h =>
        `<th style="cursor:pointer;user-select:none;" onclick="sortCancellations('${h.key}')">${h.label}${col === h.key ? `<span style="color:var(--lcp-blue)">${sortArrow}</span>` : ''}</th>`
    ).join('');

    // Build row data with sort keys
    const rows = records.map(rec => {
        const addr = rec[f.propertyAddress]?.value || '';
        const company = rec[f.companyName]?.value || '';
        const state = extractStateFromAddress(addr);
        return {
            company,
            propertyName: rec[f.propertyName]?.value || '',
            address: addr,
            nextDate: rec[f.nextDate]?.value || '',
            cancellationDate: rec[f.cancellationDate]?.value || '',
            reason: rec[f.cancellationReason]?.value || '',
            state,
            search: [company, rec[f.propertyName]?.value||'', addr, rec[f.cancellationReason]?.value||''].join(' ').toLowerCase()
        };
    });

    rows.sort((a, b) => {
        const av = a[col] || '';
        const bv = b[col] || '';
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return dir === 'asc' ? cmp : -cmp;
    });

    c.innerHTML = `<table class="data-table"><thead><tr>${headers}</tr></thead><tbody id="cancellations-tbody">${rows.map(row => `<tr data-company="${escapeHtml(row.company.toLowerCase())}" data-state="${escapeHtml(row.state)}" data-search="${escapeHtml(row.search)}">
            <td>${escapeHtml(row.company)||'-'}</td>
            <td>${escapeHtml(row.propertyName)||'-'}</td>
            <td>${escapeHtml(row.address)||'-'}</td>
            <td>${formatDate(row.nextDate)}</td>
            <td>${formatDate(row.cancellationDate)}</td>
            <td>${escapeHtml(row.reason)||'-'}</td>
        </tr>`).join('')}</tbody></table>`;

    // Re-apply active filters without resetting them
    _applyCancellationsFilter();
}

var _cancellationsFilterTimeout = null;
function filterCancellations() {
    clearTimeout(_cancellationsFilterTimeout);
    _cancellationsFilterTimeout = setTimeout(_applyCancellationsFilter, 150);
}
function _applyCancellationsFilter() {
    const search   = (document.getElementById('cancellations-search')?.value || '').toLowerCase();
    const company  = (document.getElementById('cancellations-filter-company')?.value || '').toLowerCase();
    const state    = document.getElementById('cancellations-filter-state')?.value || '';
    document.querySelectorAll('#cancellations-tbody tr').forEach(row => {
        const matchSearch  = !search  || (row.dataset.search  || '').includes(search);
        const matchCompany = !company || row.dataset.company === company;
        const matchState   = !state   || row.dataset.state   === state;
        row.style.display = (matchSearch && matchCompany && matchState) ? '' : 'none';
    });
}

// ============================================================================
// TOURBUILDER DATA
// ============================================================================

var _tourbuilderSort = { col: 'clientName', dir: 'asc' };

var _tourbuilderCols = [
    { key: 'tourId',       label: 'Tour ID' },
    { key: 'clientName',   label: 'Client Name' },
    { key: 'propertyName', label: 'Property Name' },
    { key: 'street',       label: 'Street' },
    { key: 'city',         label: 'City' },
    { key: 'state',        label: 'State' },
    { key: 'unitTours',    label: 'Unit Tours' },
    { key: '_action',      label: '' }
];

async function loadTourBuilderData(force) {
    const c = document.getElementById('tourbuilder-table');
    if (!c) return;
    if (!force && AppState.tourbuilder.length) { renderTourBuilderTable(AppState.tourbuilder); return; }
    showLoading(c);
    try {
        const f = CONFIG.fields.tourbuilder;
        const r = await queryRecords(CONFIG.tables.tourbuilder,
            [f.recordId, f.tourId, f.clientName, f.propertyName, f.street, f.city, f.state, f.unitTours, f.tourUrl],
            null,
            [{ fieldId: f.clientName, order: 'ASC' }]
        );
        const records = (r.data || []).filter(rec => rec[f.clientName]?.value);
        AppState.tourbuilder = records;

        if (!records.length) {
            c.innerHTML = '<div class="empty-state"><p class="empty-state-title">No TourBuilder records found</p></div>';
            return;
        }

        // Populate company (client name) filter
        const clients = [...new Set(records.map(rec => rec[f.clientName]?.value).filter(Boolean))].sort();
        const clientSelect = document.getElementById('tourbuilder-filter-company');
        if (clientSelect) {
            const curr = clientSelect.value;
            clientSelect.innerHTML = '<option value="">All Clients</option>' + clients.map(cl => `<option value="${cl}"${cl === curr ? ' selected' : ''}>${cl}</option>`).join('');
        }

        // Populate state filter
        const states = [...new Set(records.map(rec => rec[f.state]?.value).filter(Boolean))].sort();
        const stateSelect = document.getElementById('tourbuilder-filter-state');
        if (stateSelect) {
            const curr = stateSelect.value;
            stateSelect.innerHTML = '<option value="">All States</option>' + states.map(s => `<option value="${s}"${s === curr ? ' selected' : ''}>${s}</option>`).join('');
        }

        renderTourBuilderTable(records);
    } catch (e) {
        showError(c, 'Failed to load TourBuilder data');
        console.error(e);
    }
}

function renderTourBuilderTable(records) {
    const c = document.getElementById('tourbuilder-table');
    const f = CONFIG.fields.tourbuilder;
    const { col, dir } = _tourbuilderSort;

    const sortArrow = dir === 'asc' ? ' ▲' : ' ▼';
    const headers = _tourbuilderCols.map(h => {
        if (h.key === '_action') return '<th></th>';
        return `<th style="cursor:pointer;user-select:none;" onclick="sortTourBuilderData('${h.key}')">${h.label}${col === h.key ? `<span style="color:var(--lcp-blue)">${sortArrow}</span>` : ''}</th>`;
    }).join('');

    const rows = records.map(rec => ({
        tourId:       rec[f.tourId]?.value || '',
        clientName:   rec[f.clientName]?.value || '',
        propertyName: rec[f.propertyName]?.value || '',
        street:       rec[f.street]?.value || '',
        city:         rec[f.city]?.value || '',
        state:        rec[f.state]?.value || '',
        unitTours:    rec[f.unitTours]?.value ?? '',
        tourUrl:      rec[f.tourUrl]?.value || '',
        search:       [rec[f.tourId]?.value||'', rec[f.clientName]?.value||'', rec[f.propertyName]?.value||'', rec[f.street]?.value||'', rec[f.city]?.value||''].join(' ').toLowerCase()
    }));

    rows.sort((a, b) => {
        const av = String(a[col] || '');
        const bv = String(b[col] || '');
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return dir === 'asc' ? cmp : -cmp;
    });

    c.innerHTML = `<table class="data-table"><thead><tr>${headers}</tr></thead><tbody id="tourbuilder-tbody">${rows.map(row => `<tr data-client="${escapeHtml(row.clientName.toLowerCase())}" data-state="${escapeHtml(row.state)}" data-search="${escapeHtml(row.search)}">
        <td>${escapeHtml(row.tourId)||'-'}</td>
        <td>${escapeHtml(row.clientName)||'-'}</td>
        <td>${escapeHtml(row.propertyName)||'-'}</td>
        <td>${escapeHtml(row.street)||'-'}</td>
        <td>${escapeHtml(row.city)||'-'}</td>
        <td>${escapeHtml(row.state)||'-'}</td>
        <td>${row.unitTours !== '' ? escapeHtml(String(row.unitTours)) : '-'}</td>
        <td>${row.tourUrl ? `<a href="${escapeHtml(row.tourUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">View Tour</a>` : '-'}</td>
    </tr>`).join('')}</tbody></table>`;

    _applyTourBuilderFilter();
}

function sortTourBuilderData(col) {
    if (_tourbuilderSort.col === col) {
        _tourbuilderSort.dir = _tourbuilderSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        _tourbuilderSort.col = col;
        _tourbuilderSort.dir = 'asc';
    }
    renderTourBuilderTable(AppState.tourbuilder);
}

var _tourbuilderFilterTimeout = null;
function filterTourBuilderData() {
    clearTimeout(_tourbuilderFilterTimeout);
    _tourbuilderFilterTimeout = setTimeout(_applyTourBuilderFilter, 150);
}
function _applyTourBuilderFilter() {
    const search = (document.getElementById('tourbuilder-search')?.value || '').toLowerCase();
    const client = (document.getElementById('tourbuilder-filter-company')?.value || '').toLowerCase();
    const state  = document.getElementById('tourbuilder-filter-state')?.value || '';
    document.querySelectorAll('#tourbuilder-tbody tr').forEach(row => {
        const matchSearch = !search || (row.dataset.search || '').includes(search);
        const matchClient = !client || row.dataset.client === client;
        const matchState  = !state  || row.dataset.state  === state;
        row.style.display = (matchSearch && matchClient && matchState) ? '' : 'none';
    });
}

function getStatusClass(s) {
    if (!s) return 'draft';
    // Exact matches for workflow-specific statuses that need distinct colors
    if (s === 'Concessions Approval Needed') return 'concessions-needed'; // orange
    if (s === 'Contract Created')            return 'info';               // blue
    if (s === 'Contract Signed')             return 'signed';             // teal
    // Keyword fallbacks
    const l = s.toLowerCase();
    if (l.includes('pending')||l.includes('processing')||l.includes('review')||l.includes('sent')||l.includes('awaiting')||l.includes('needed')||l.includes('open')||l.includes('progress')||l.includes('hold')) return 'pending'; // amber
    if (l.includes('completed')||l.includes('approved')||l.includes('converted')) return 'approved'; // green
    if (l.includes('rejected')||l.includes('cancelled')||l.includes('expired')||l.includes('denied')) return 'rejected'; // red
    return 'draft'; // grey
}

// ============================================================================
// FORM RESET & VIEW
// ============================================================================

function resetOrderForm() {
    document.getElementById('order-form').reset();
    setRichTextContent('order-notes-editor', '');
    document.getElementById('order-contract-first').value = '';
    document.getElementById('order-contract-last').value = '';
    document.getElementById('order-contract-email').value = '';
    document.getElementById('order-contract-phone').value = '';
    AppState.orderProperties = [];
    AppState.selectedClient = null;
    AppState.convertingQuoteId = null;
    AppState.editingOrderId = null;
    lineItemCounter = 0;
    document.getElementById('selected-client-name').textContent = 'Select a client...';
    document.getElementById('order-company-id').value = '';
    renderOrderProperties();
    renderClientList();
    prefillCurrentUserEmail();
}

function resetQuoteForm() {
    document.getElementById('quote-form').reset();
    setRichTextContent('quote-notes-editor', '');
    AppState.quoteProperties = [];
    AppState.attachmentCounter = 0;
    AppState.selectedQuoteClient = null;
    AppState.editingQuoteId = null;
    document.getElementById('quote-selected-client-name').textContent = 'Select a client...';
    document.getElementById('quote-company-id').value = '';
    renderQuoteProperties();
    renderQuoteClientList();
    prefillCurrentUserEmail();
}

async function viewOrder(id) {
    openModal('order-detail-modal');
    closeContractPdf();
    const content = document.getElementById('order-detail-content');
    content.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        const f = CONFIG.fields.orders;
        const pf = CONFIG.fields.properties;
        const lf = CONFIG.fields.orderLineItems;
        const pmf = CONFIG.fields.propertiesMaster;
        
        // Fetch order details
        const orderResult = await queryRecords(CONFIG.tables.orders,
            [f.recordId, f.orderStatus, f.quoteDate, f.expirationDate, f.salesRepEmail, f.historyNotes,
             f.companyName, f.companyYcrmId, f.ycrmOpportunityId, f.billingContactName, f.billingContactEmail, f.billingContactPhone,
             f.contractContactFirst, f.contractContactLast, f.contractEmail, f.contractPhone, f.propertyLevelBilling,
             f.concessionsApproval, f.concessionsApprovedBy, f.concessionsApprovedDate, f.concessionNotes,
             f.orderPDF, f.orderDOCX],
            `{3.EX.${id}}`
        );
        
        if (!orderResult.data?.length) {
            content.innerHTML = '<div class="empty-state"><p>Order not found</p></div>';
            return;
        }
        
        const order = orderResult.data[0];
        
        // Fetch properties linked to this order
        const propsResult = await queryRecords(CONFIG.tables.properties,
            [pf.recordId, pf.relatedProperty, pf.propertyName, pf.propertyAddress, pf.billingContact, pf.billingEmail, pf.billingPhone],
            `{${pf.relatedOrder}.EX.${id}}`
        );
        
        // Fetch line items for this order
        const lineItemsResult = await queryRecords(CONFIG.tables.orderLineItems,
            [lf.recordId, lf.relatedProperty, lf.relatedCode, lf.description, lf.quantity, lf.total, lf.concession, lf.concessionPercent, lf.concessionAmount, lf.codeRetailPrice, lf.quotePrice],
            `{${lf.relatedOrder}.EX.${id}}`
        );
        
        // Build the detail view
        const status = order[f.orderStatus]?.value || 'Draft';
        const companyName = escapeHtml(order[f.companyName]?.value || '-');
        const ycrmId = escapeHtml(order[f.companyYcrmId]?.value || '-');
        const opportunityId = escapeHtml(order[f.ycrmOpportunityId]?.value || '-');
        const salesRep = escapeHtml(order[f.salesRepEmail]?.value || '-');
        const orderDate = formatDate(order[f.quoteDate]?.value);
        const expDate = formatDate(order[f.expirationDate]?.value);
        const notes = order[f.historyNotes]?.value || ''; // rich text — rendered as HTML intentionally
        const contractFirst = order[f.contractContactFirst]?.value || '';
        const contractLast = order[f.contractContactLast]?.value || '';
        const contractContact = escapeHtml([contractFirst, contractLast].filter(Boolean).join(' '));
        const contractEmail = escapeHtml(order[f.contractEmail]?.value || '');
        const contractPhone = escapeHtml(order[f.contractPhone]?.value || '');
        const concessionsApproval = order[f.concessionsApproval]?.value || '';
        const _approvedByRaw = order[f.concessionsApprovedBy]?.value || '';
        const concessionsApprovedBy = escapeHtml(typeof _approvedByRaw === 'object' ? (_approvedByRaw.email || _approvedByRaw.name || 'Unknown') : _approvedByRaw);
        const concessionsApprovedDate = order[f.concessionsApprovedDate]?.value || '';
        const concessionNotes = escapeHtml(order[f.concessionNotes]?.value || '');
        const propertyLevelBilling = order[f.propertyLevelBilling]?.value === true;
        const needsConcessionApproval = status === 'Concessions Approval Needed';
        const hasConcessionDecision = concessionsApproval === 'Approved' || concessionsApproval === 'Denied';
        const hasContractContact = contractContact || contractEmail || contractPhone;
        const hasPdf = order[f.orderPDF]?.value != null;
        const hasDocx = order[f.orderDOCX]?.value != null;
        const rawOrderName = (order[f.ycrmOpportunityId]?.value && order[f.companyName]?.value)
            ? `${order[f.ycrmOpportunityId].value} - ${order[f.companyName].value}`
            : (order[f.companyName]?.value || `Order_Contract_${id}`);
        const dlName = rawOrderName.replace(/[\/\\:*?"<>|']/g, '');

        let html = `
            <div class="order-detail">
                <div class="order-detail-header">
                    <div class="order-detail-header-left">
                        <div class="order-detail-title">
                            <h2>${companyName}</h2>
                            <span class="badge badge-${getStatusClass(status)}">${status}</span>
                        </div>
                        <div class="order-detail-meta">
                            <span><strong>yCRM ID:</strong> ${ycrmId}</span>
                            <span><strong>Opportunity ID:</strong> ${opportunityId}</span>
                        </div>
                    </div>
                    ${(needsConcessionApproval || hasPdf || hasDocx) ? `
                        <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
                            ${needsConcessionApproval ? `
                                <div class="concession-approval-actions">
                                    <button class="btn btn-success" onclick="approveConcession(${id})">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                        Approve
                                    </button>
                                    <button class="btn btn-danger" onclick="denyConcession(${id})">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                        Deny
                                    </button>
                                </div>
                            ` : ''}
                            ${(hasPdf || hasDocx) ? `
                                <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
                                    ${hasPdf ? `
                                        <button class="btn btn-ghost btn-sm" onclick="viewContractPdf(${id}, 0)" title="View Contract PDF">
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                            View PDF
                                        </button>
                                        <button class="btn btn-ghost btn-sm" onclick="downloadContractFile(${id}, ${f.orderPDF}, 0, '${dlName}.pdf')" title="Download Contract PDF">
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                            Download PDF
                                        </button>
                                    ` : ''}
                                    ${hasDocx ? `
                                        <button class="btn btn-ghost btn-sm" onclick="downloadContractFile(${id}, ${f.orderDOCX}, 0, '${dlName}.docx')" title="Download Contract Word">
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                            Download Word
                                        </button>
                                    ` : ''}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
                
                ${hasConcessionDecision ? `
                    <div class="concession-decision-banner ${concessionsApproval === 'Approved' ? 'approved' : 'denied'}">
                        <strong>Concessions ${escapeHtml(concessionsApproval)}</strong> by ${concessionsApprovedBy} on ${formatDateTime(concessionsApprovedDate)}
                        ${concessionNotes ? `<div style="margin-top:6px;font-weight:400;">${concessionNotes}</div>` : ''}
                    </div>
                ` : ''}

                <div class="order-detail-grid">
                    <div class="order-detail-card">
                        <h4>Order Info</h4>
                        <p><strong>Sales Rep:</strong> ${salesRep}</p>
                        <p><strong>Order Date:</strong> ${orderDate}</p>
                        <p><strong>Property Level Billing:</strong> ${propertyLevelBilling ? 'Yes' : 'No'}</p>
                    </div>
                    ${hasContractContact ? `
                        <div class="order-detail-card">
                            <h4>Contract Contact</h4>
                            ${contractContact ? `<p><strong>Name:</strong> ${contractContact}</p>` : ''}
                            ${contractEmail ? `<p><strong>Email:</strong> <a href="mailto:${contractEmail}" style="color:var(--lcp-blue);">${contractEmail}</a></p>` : ''}
                            ${contractPhone ? `<p><strong>Phone:</strong> ${contractPhone}</p>` : ''}
                        </div>
                    ` : ''}
                    ${notes ? `<div class="order-detail-card"><h4>Notes</h4><div class="order-notes-content">${notes}</div></div>` : ''}
                </div>
        `;
        
        // Properties and line items
        const properties = propsResult.data || [];
        const lineItems = lineItemsResult.data || [];
        
        if (properties.length) {
            html += '<div class="order-detail-section"><h4>Properties & Line Items</h4>';
            
            for (const prop of properties) {
                const propId = prop[pf.recordId]?.value;
                const propName = escapeHtml(prop[pf.propertyName]?.value || 'Unknown Property');
                const propAddress = escapeHtml(prop[pf.propertyAddress]?.value || '');
                const billingContact = escapeHtml(prop[pf.billingContact]?.value || '-');
                const billingEmail = escapeHtml(prop[pf.billingEmail]?.value || '-');
                const billingPhone = escapeHtml(prop[pf.billingPhone]?.value || '-');

                // Get line items for this property
                const propLineItems = lineItems.filter(li => li[lf.relatedProperty]?.value === propId);

                html += `
                    <div class="property-detail-card">
                        <div class="property-detail-header">
                            <div>
                                <strong>${propName}</strong>
                                ${propAddress ? `<br><span class="text-muted">${propAddress}</span>` : ''}
                            </div>
                            <div class="property-billing-info">
                                <span><strong>Billing:</strong> ${billingContact}</span>
                                <span>${billingEmail}</span>
                                <span>${billingPhone}</span>
                            </div>
                        </div>
                        ${propLineItems.length ? `
                            <table class="data-table" style="margin-top: 12px;">
                                <thead>
                                    <tr>
                                        <th style="width: 90px;">Code</th>
                                        <th>Product</th>
                                        <th style="width: 60px;">Qty</th>
                                        <th style="width: 100px;">Unit Price</th>
                                        <th style="width: 70px;">Con %</th>
                                        <th style="width: 100px;">Con $</th>
                                        <th style="width: 100px;">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${propLineItems.map(li => {
                                        const code = escapeHtml(li[lf.relatedCode]?.value || '-');
                                        const desc = escapeHtml(li[lf.description]?.value || '-');
                                        const qty = li[lf.quantity]?.value || 0;
                                        const quotePrice = li[lf.quotePrice]?.value;
                                        const retailPrice = li[lf.codeRetailPrice]?.value || 0;
                                        const unitPrice = quotePrice != null && quotePrice !== '' && quotePrice > 0 ? quotePrice : retailPrice;
                                        const concession = li[lf.concession]?.value;
                                        const concessionPct = li[lf.concessionPercent]?.value || 0;
                                        const concessionAmt = li[lf.concessionAmount]?.value || 0;
                                        const total = li[lf.total]?.value || 0;
                                        return `<tr>
                                            <td>${code}</td>
                                            <td>${desc}</td>
                                            <td>${qty}</td>
                                            <td>${formatCurrency(unitPrice)}</td>
                                            <td>${concession ? concessionPct + '%' : '-'}</td>
                                            <td>${concession ? formatCurrency(concessionAmt) : '-'}</td>
                                            <td>${formatCurrency(total)}</td>
                                        </tr>`;
                                    }).join('')}
                                </tbody>
                            </table>
                        ` : '<p class="text-muted" style="margin-top: 8px;">No line items</p>'}
                    </div>
                `;
            }
            html += '</div>';
        }
        
        // Calculate order total
        const orderTotal = lineItems.reduce((sum, li) => sum + (li[lf.total]?.value || 0), 0);
        html += `
            <div class="order-detail-footer">
                <div class="order-total">
                    <strong>Order Total:</strong> ${formatCurrency(orderTotal)}
                </div>
            </div>
        </div>`;
        
        content.innerHTML = html;
        
    } catch (e) {
        console.error('Failed to load order details:', e);
        content.innerHTML = '<div class="empty-state"><p>Failed to load order details</p></div>';
    }
}

function loadPdfJs() {
    if (window._pdfjsLoaded) return Promise.resolve(window.pdfjsLib);
    const injectScript = (src) => new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error('Failed to load ' + src.split('/').pop()));
        document.head.appendChild(s);
    });
    // Load both scripts as regular <script> tags (not as Web Workers).
    // QuickBase CSP has worker-src: none, which blocks any Worker creation.
    // PDF.js detects window.pdfjsWorker.WorkerMessageHandler and automatically
    // falls back to a fake in-thread worker when no workerSrc is set.
    return injectScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js')
        .then(() => injectScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'))
        .then(() => { window._pdfjsLoaded = true; return window.pdfjsLib; });
}

async function viewContractPdf(orderId, versionNumber) {
    const panel = document.getElementById('order-pdf-panel');
    const container = document.getElementById('order-pdf-canvas-container');
    const mc = document.querySelector('#order-detail-modal .modal-content');
    panel.style.display = 'flex';
    mc.style.maxWidth = '1500px';
    mc.style.height = '88vh';
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ccc;font-size:14px;">Loading PDF...</div>';
    try {
        const realm = CONFIG.getRealmHostname();
        const token = await getTempToken(CONFIG.tables.orders);
        const url = `https://api.quickbase.com/v1/files/${CONFIG.tables.orders}/${orderId}/${CONFIG.fields.orders.orderPDF}/${versionNumber ?? 0}`;
        const resp = await fetch(url, { headers: { 'QB-Realm-Hostname': realm, 'Authorization': `QB-TEMP-TOKEN ${token}` } });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        // QB files API returns the file as base64-encoded text (not raw binary)
        const b64 = await resp.text();
        const binary = atob(b64.trim());
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const arrayBuffer = bytes.buffer;
        const pdfjsLib = await loadPdfJs();
        // Do NOT set workerSrc — PDF.js finds window.pdfjsWorker and uses fake in-thread worker
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        container.innerHTML = '';
        const panelWidth = container.clientWidth - 24;
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const unscaled = page.getViewport({ scale: 1 });
            const scale = Math.max(1, panelWidth / unscaled.width);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.cssText = 'display:block;width:100%;margin-bottom:8px;box-shadow:0 2px 8px rgba(0,0,0,0.4);';
            container.appendChild(canvas);
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        }
    } catch (e) {
        container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#f88;font-size:14px;">Failed to load PDF: ${e.message}</div>`;
    }
}

function closeContractPdf() {
    const panel = document.getElementById('order-pdf-panel');
    const container = document.getElementById('order-pdf-canvas-container');
    const mc = document.querySelector('#order-detail-modal .modal-content');
    if (!panel) return;
    panel.style.display = 'none';
    if (container) container.innerHTML = '';
    mc.style.maxWidth = '900px';
    mc.style.height = '';
}

async function viewOrderAndPdf(id, pdfVer) {
    await viewOrder(id);
    viewContractPdf(id, pdfVer);
}

async function downloadContractFile(orderId, fieldId, versionNumber, fileName) {
    try {
        const realm = CONFIG.getRealmHostname();
        const token = await getTempToken(CONFIG.tables.orders);
        const url = `https://api.quickbase.com/v1/files/${CONFIG.tables.orders}/${orderId}/${fieldId}/${versionNumber}`;
        const resp = await fetch(url, { headers: { 'QB-Realm-Hostname': realm, 'Authorization': `QB-TEMP-TOKEN ${token}` } });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        // QB files API returns base64-encoded content; decode to binary blob
        const b64 = await resp.text();
        const binary = atob(b64.trim());
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes]);
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (e) {
        alert('Failed to download file: ' + e.message);
    }
}

async function approveConcession(orderId) {
    if (!confirm('Approve concessions for this order?')) return;
    await updateConcessionStatus(orderId, 'Approved');
}

function denyConcession(orderId) {
    document.getElementById('concession-deny-notes').value = '';
    document.getElementById('concession-deny-modal').dataset.orderId = orderId;
    openModal('concession-deny-modal');
}

async function confirmDenyConcession() {
    const orderId = parseInt(document.getElementById('concession-deny-modal').dataset.orderId);
    const notes = document.getElementById('concession-deny-notes').value.trim();
    closeModal('concession-deny-modal');
    await updateConcessionStatus(orderId, 'Denied', notes);
}

async function updateConcessionStatus(orderId, decision, notes) {
    try {
        const f = CONFIG.fields.orders;
        const user = await getCurrentUser();
        const userEmail = user?.email || 'Unknown';
        const now = new Date().toISOString();

        const newStatus = decision === 'Approved' ? 'Concessions Approved' : 'Concessions Denied';

        const updateData = {
            [f.recordId]: { value: orderId },
            [f.orderStatus]: { value: newStatus },
            [f.concessionsApproval]: { value: decision },
            [f.concessionsApprovedBy]: { value: userEmail },
            [f.concessionsApprovedDate]: { value: now }
        };
        if (notes) updateData[f.concessionNotes] = { value: notes };
        
        await updateRecord(CONFIG.tables.orders, updateData);

        // Workflow 2: generate contracts when concessions are approved
        if (decision === 'Approved') {
            const orderRes = await queryRecords(CONFIG.tables.orders,
                [f.recordId, f.ycrmOpportunityId, f.companyName],
                `{3.EX.${orderId}}`
            );
            const orderRow = orderRes.data?.[0];
            const opportunityId = orderRow?.[f.ycrmOpportunityId]?.value || '';
            const companyName = orderRow?.[f.companyName]?.value || '';
            await generateAndUploadContracts(orderId, opportunityId, companyName);
        }

        showSuccess(`Concessions ${decision.toLowerCase()}!`);

        // Refresh the order detail view
        await viewOrder(orderId);

        // Also refresh the order history list
        loadOrderHistory();
        
    } catch (e) {
        console.error('Failed to update concession status:', e);
        alert('Failed to update concession status: ' + e.message);
    }
}

async function viewQuote(id) {
    openModal('quote-detail-modal');
    const content = document.getElementById('quote-detail-content');
    content.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading...</p></div>';
    
    try {
        const f = CONFIG.fields.quotes3D;
        const pf = CONFIG.fields.properties;
        const af = CONFIG.fields.quoteAttachments;
        const lf = CONFIG.fields.lineItems3D;

        // Fetch quote details, properties, attachments, and line items in parallel
        const [quoteResult, propsResult, attachmentsResult, lineItemsResult] = await Promise.all([
            queryRecords(CONFIG.tables.quotes3D,
                [f.recordId, f.quoteName, f.quoteStatus, f.quoteDate, f.expirationDate, f.salesRepEmail,
                 f.historyNotes, f.companyName, f.companyYcrmId, f.quoteTotal],
                `{3.EX.${id}}`
            ),
            queryRecords(CONFIG.tables.properties,
                [pf.recordId, pf.relatedProperty, pf.propertyName, pf.propertyAddress],
                `{${pf.relatedQuote3D}.EX.${id}}`
            ),
            queryRecords(CONFIG.tables.quoteAttachments,
                [af.recordId, af.fileType, af.description, af.linkToFile, af.fileAttachment],
                `{${af.relatedQuote}.EX.${id}}`
            ),
            queryRecords(CONFIG.tables.lineItems3D,
                [lf.recordId, lf.productName, lf.description, lf.quantity, lf.stills, lf.panos, lf.quotePrice, lf.productRetailPrice, lf.total, lf.notes],
                `{${lf.relatedQuote}.EX.${id}}`
            )
        ]);

        if (!quoteResult.data?.length) {
            content.innerHTML = '<div class="empty-state"><p>Quote not found</p></div>';
            return;
        }

        const quote = quoteResult.data[0];
        
        // Build the detail view
        const status = quote[f.quoteStatus]?.value || 'Draft';
        const quoteName = escapeHtml(quote[f.quoteName]?.value || 'Untitled Quote');
        const companyName = escapeHtml(quote[f.companyName]?.value || '-');
        const ycrmId = escapeHtml(quote[f.companyYcrmId]?.value || '-');
        const salesRep = escapeHtml(quote[f.salesRepEmail]?.value || '-');
        const quoteDate = formatDate(quote[f.quoteDate]?.value);
        const expDate = formatDate(quote[f.expirationDate]?.value);
        const notes = quote[f.historyNotes]?.value || ''; // rich text — rendered as HTML intentionally
        
        const isConverted = status === 'Converted to Order';
        const canConvert = !isConverted && status !== 'Rejected' && status !== 'Expired';
        
        let html = `
            <div class="order-detail">
                <div class="order-detail-header">
                    <div class="order-detail-header-left">
                        <div class="order-detail-title">
                            <h2>${quoteName}</h2>
                            <span class="badge badge-${getStatusClass(status)}">${status}</span>
                        </div>
                        <div class="order-detail-meta">
                            <span><strong>Company:</strong> ${companyName}</span>
                            <span><strong>yCRM ID:</strong> ${ycrmId}</span>
                        </div>
                    </div>
                    ${canConvert ? `
                        <div class="concession-approval-actions">
                            <button class="btn btn-primary" onclick="closeModal('quote-detail-modal'); convertQuoteToOrder(${id});">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                Convert to Order
                            </button>
                        </div>
                    ` : ''}
                </div>
                
                ${isConverted ? `
                    <div class="concession-decision-banner approved">
                        <strong>This quote has been converted to an order</strong>
                    </div>
                ` : ''}
                
                <div class="order-detail-grid">
                    <div class="order-detail-card">
                        <h4>Quote Info</h4>
                        <p><strong>Sales Rep:</strong> ${salesRep}</p>
                        <p><strong>Quote Date:</strong> ${quoteDate}</p>
                        <p><strong>Expires:</strong> ${expDate}</p>
                    </div>
                    ${notes ? `<div class="order-detail-card" style="grid-column: span 2;"><h4>Notes</h4><div class="order-notes-content">${notes}</div></div>` : ''}
                </div>
        `;
        
        // Properties section
        const properties = propsResult.data || [];
        const attachments = attachmentsResult.data || [];
        const lineItems = lineItemsResult.data || [];
        
        if (properties.length) {
            html += '<div class="order-detail-section"><h4>Properties</h4>';
            
            for (const prop of properties) {
                const propNameRaw = prop[pf.propertyName]?.value || 'Unknown Property';
                const propName = escapeHtml(propNameRaw);
                const propAddress = escapeHtml(prop[pf.propertyAddress]?.value || '');

                // Find attachments for this property (stored in description as [PropertyName])
                const propAttachments = attachments.filter(att => {
                    const desc = att[af.description]?.value || '';
                    return desc.startsWith(`[${propNameRaw}]`);
                });

                html += `
                    <div class="property-detail-card">
                        <div class="property-detail-header">
                            <div>
                                <strong>${propName}</strong>
                                ${propAddress ? `<br><span class="text-muted">${propAddress}</span>` : ''}
                            </div>
                        </div>
                `;

                if (propAttachments.length) {
                    html += `<div class="property-attachments"><strong>Attachments:</strong><ul style="margin: 8px 0 0 20px;">`;
                    for (const att of propAttachments) {
                        const description = escapeHtml((att[af.description]?.value || '').replace(`[${propNameRaw}]`, '').trim());
                        const linkUrl = att[af.linkToFile]?.value || '';
                        const fileInfo = att[af.fileAttachment]?.value;

                        let linkHtml = '';
                        if (linkUrl) {
                            linkHtml = `<a href="${escapeHtml(linkUrl)}" target="_blank" style="color: var(--lcp-blue);">View Link</a>`;
                        } else if (fileInfo && fileInfo.url) {
                            linkHtml = `<a href="${escapeHtml(fileInfo.url)}" target="_blank" style="color: var(--lcp-blue);">${escapeHtml(fileInfo.filename || 'Download')}</a>`;
                        }

                        html += `<li>${description ? description + ' ' : ''}${linkHtml}</li>`;
                    }
                    html += `</ul></div>`;
                }

                html += `</div>`;
            }
            html += '</div>';
        }

        // Line items section (added by 3D manager after review)
        if (lineItems.length) {
            const quoteTotal = quote[f.quoteTotal]?.value;
            html += '<div class="order-detail-section"><h4>Line Items</h4>';
            html += `<table class="data-table"><thead><tr>
                <th>Description</th><th>Qty</th><th>Stills</th><th>Panos</th><th>Unit Price</th><th>Total</th><th>Notes</th>
            </tr></thead><tbody>`;
            for (const li of lineItems) {
                html += `<tr>
                    <td>${escapeHtml([li[lf.productName]?.value, li[lf.description]?.value].filter(Boolean).join(' — ') || '-')}</td>
                    <td>${li[lf.quantity]?.value || '-'}</td>
                    <td>${li[lf.stills]?.value || '-'}</td>
                    <td>${li[lf.panos]?.value || '-'}</td>
                    <td>${(() => { const p = li[lf.quotePrice]?.value ?? li[lf.productRetailPrice]?.value; return p != null ? '$' + Number(p).toFixed(2) : '-'; })()}</td>
                    <td>${li[lf.total]?.value != null ? '$' + Number(li[lf.total].value).toFixed(2) : '-'}</td>
                    <td>${escapeHtml(li[lf.notes]?.value || '')}</td>
                </tr>`;
            }
            html += '</tbody></table>';
            if (quoteTotal != null) {
                html += `<div style="text-align:right; margin-top:8px; font-weight:600;">Total: $${Number(quoteTotal).toFixed(2)}</div>`;
            }
            html += '</div>';
        }

        html += '</div>';

        content.innerHTML = html;

    } catch (e) {
        console.error('Failed to load quote details:', e);
        content.innerHTML = '<div class="empty-state"><p>Failed to load quote details</p></div>';
    }
}

// ============================================================================
// CONVERT 3D QUOTE TO ORDER
// ============================================================================

async function convertQuoteToOrder(quoteId) {
    try {
        const qf = CONFIG.fields.quotes3D;
        const pf = CONFIG.fields.properties;
        
        // 1. Fetch the quote
        const quoteResult = await queryRecords(CONFIG.tables.quotes3D, 
            [qf.recordId, qf.quoteName, qf.quoteStatus, qf.salesRepEmail, qf.relatedCompany, 
             qf.companyName, qf.historyNotes],
            `{3.EX.${quoteId}}`
        );
        
        if (!quoteResult.data?.length) {
            throw new Error('Quote not found');
        }
        
        const quote = quoteResult.data[0];
        const quoteStatus = quote[qf.quoteStatus]?.value;
        
        // Check if already converted
        if (quoteStatus === 'Converted to Order') {
            alert('This quote has already been converted to an order.');
            return;
        }
        
        const quoteName = quote[qf.quoteName]?.value || '';
        const salesRepEmail = quote[qf.salesRepEmail]?.value || '';
        const relatedCompany = quote[qf.relatedCompany]?.value;
        const historyNotes = quote[qf.historyNotes]?.value || '';
        
        if (!relatedCompany) {
            throw new Error('Quote has no associated company');
        }
        
        // 2. Fetch properties linked to this quote
        const propsResult = await queryRecords(CONFIG.tables.properties,
            [pf.recordId, pf.relatedProperty, pf.propertyName, pf.propertyAddress],
            `{${pf.relatedQuote3D}.EX.${quoteId}}`
        );
        
        const quoteProperties = propsResult.data || [];
        
        // 3. Close quote modal
        closeModal('quote-detail-modal');
        
        // 4. Reset order form and switch to New Order tab
        resetOrderForm();
        switchTab('tab-new-order');
        
        // 5. Set the client/company
        const client = AppState.clients.find(c => c.id === relatedCompany);
        if (client) {
            selectClient(client.id);
        }
        
        // 6. Set sales rep email
        document.getElementById('order-sales-email').value = salesRepEmail;
        
        // 7. Set notes with conversion reference
        const conversionNote = `Converted from 3D Quote: ${quoteName} (ID: ${quoteId})`;
        setRichTextContent('order-notes-editor', historyNotes + (historyNotes ? '\n\n' : '') + conversionNote);
        
        // 8. Add properties from the quote
        for (const prop of quoteProperties) {
            const propertyId = prop[pf.relatedProperty]?.value;
            const property = AppState.properties.find(p => p.id === propertyId);
            
            if (!property) continue;
            
            // Check if already added
            if (AppState.orderProperties.find(op => op.propertyId === propertyId)) continue;
            
            AppState.orderProperties.push({
                propertyId: propertyId,
                property: property,
                lineItems: [],
                billingContact: property.billingContact || '',
                billingEmail: property.billingEmail || '',
                billingPhone: property.billingPhone || ''
            });
        }
        
        // 9. Render the form
        renderOrderProperties();
        
        // 10. Store quote ID for later (to update status after save)
        AppState.convertingQuoteId = quoteId;
        
        showSuccess(`Quote "${quoteName}" loaded with ${quoteProperties.length} properties. Add products to complete the order.`);
        
    } catch (e) {
        console.error('Convert quote to order failed:', e);
        alert('Failed to load quote: ' + e.message);
    }
}

// ============================================================================
// TICKETS
// ============================================================================

var _ticketsSort = { col: 'dateCreated', dir: 'desc' };

// Fallback options — overridden by values found in actual QB records
var _TICKET_TYPE_DEFAULTS = ['Photo', 'Video', '3D Tour', 'Editing', 'Revision', 'Floor Plan', 'Other'];
var _TICKET_STATUS_DEFAULTS = ['Open', 'In Progress', 'Pending Review', 'On Hold', 'Completed', 'Rejected', 'Closed'];

async function loadTickets(force) {
    const c = document.getElementById('tickets-table');
    if (!c) return;
    if (!force && AppState.tickets.length) {
        renderTicketsStats(AppState.tickets);
        renderTicketsTable(AppState.tickets);
        return;
    }
    showLoading(c);
    try {
        const f = CONFIG.fields.tickets;
        const r = await queryRecords(
            CONFIG.tables.tickets,
            [f.recordId, f.dateCreated, f.dateModified, f.requestType, f.requestStatus,
             f.requestedBy, f.assignee, f.projectName, f.propertyName,
             f.clientRequest, f.completed, f.closed, f.closedBy, f.dateClosed],
            null,
            [{ fieldId: f.dateCreated, order: 'DESC' }]
        );
        const records = r.data || [];
        AppState.tickets = records;

        // Populate type filter from actual data
        const types = [...new Set(records.map(rec => rec[f.requestType]?.value).filter(Boolean))].sort();
        const typeSelect = document.getElementById('tickets-filter-type');
        if (typeSelect) {
            const curr = typeSelect.value;
            typeSelect.innerHTML = '<option value="">All Types</option>' +
                types.map(t => `<option value="${escapeHtml(t)}"${t === curr ? ' selected' : ''}>${escapeHtml(t)}</option>`).join('');
        }

        // Populate status filter from actual data
        const statuses = [...new Set(records.map(rec => rec[f.requestStatus]?.value).filter(Boolean))].sort();
        const statusSelect = document.getElementById('tickets-filter-status');
        if (statusSelect) {
            const curr = statusSelect.value;
            statusSelect.innerHTML = '<option value="">All Statuses</option>' +
                statuses.map(s => `<option value="${escapeHtml(s)}"${s === curr ? ' selected' : ''}>${escapeHtml(s)}</option>`).join('');
        }

        renderTicketsStats(records);
        renderTicketsTable(records);
    } catch (e) {
        showError(c, 'Failed to load tickets: ' + escapeHtml(e.message));
        console.error(e);
    }
}

function _ticketUserLabel(val) {
    // QB User fields return { id, email, name, userName } or a plain string
    if (!val) return '-';
    if (typeof val === 'object') return val.name || val.email || val.userName || '-';
    return String(val);
}

function renderTicketsStats(records) {
    const f = CONFIG.fields.tickets;
    const el = document.getElementById('tickets-stats');
    if (!el) return;
    const total = records.length;
    const open = records.filter(r => !r[f.closed]?.value && !r[f.completed]?.value).length;
    const completed = records.filter(r => r[f.completed]?.value).length;
    const closed = records.filter(r => r[f.closed]?.value).length;
    el.innerHTML = `
        <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value">${total}</div></div>
        <div class="stat-card"><div class="stat-label">Open</div><div class="stat-value">${open}</div></div>
        <div class="stat-card"><div class="stat-label">Completed</div><div class="stat-value blue">${completed}</div></div>
        <div class="stat-card"><div class="stat-label">Closed</div><div class="stat-value">${closed}</div></div>
    `;
}

function renderTicketsTable(records) {
    const c = document.getElementById('tickets-table');
    if (!c) return;
    const f = CONFIG.fields.tickets;
    const { col, dir } = _ticketsSort;

    if (!records.length) {
        c.innerHTML = '<div class="empty-state"><p class="empty-state-title">No tickets found</p></div>';
        return;
    }

    const cols = [
        { key: 'recordId',     label: '#' },
        { key: 'requestType',  label: 'Type' },
        { key: 'requestStatus', label: 'Status' },
        { key: 'projectName',  label: 'Project' },
        { key: 'propertyName', label: 'Property' },
        { key: 'requestedBy',  label: 'Requested By' },
        { key: 'dateCreated',  label: 'Date' },
        { key: '_action',      label: '' }
    ];

    const sortArrow = dir === 'asc' ? ' ▲' : ' ▼';
    const headers = cols.map(h => {
        if (h.key === '_action') return '<th></th>';
        return `<th style="cursor:pointer;user-select:none;" onclick="sortTickets('${h.key}')">${h.label}${col === h.key ? `<span style="color:var(--lcp-blue)">${sortArrow}</span>` : ''}</th>`;
    }).join('');

    const rows = records.map(rec => {
        const status = rec[f.requestStatus]?.value || '';
        const type   = rec[f.requestType]?.value || '';
        const proj   = rec[f.projectName]?.value || '';
        const prop   = rec[f.propertyName]?.value || '';
        const reqBy  = _ticketUserLabel(rec[f.requestedBy]?.value);
        const recId  = rec[f.recordId]?.value || '';
        const created = rec[f.dateCreated]?.value || '';
        return {
            recordId: recId, requestType: type, requestStatus: status,
            projectName: proj, propertyName: prop, requestedBy: reqBy,
            dateCreated: created,
            search: [recId, type, status, proj, prop, reqBy].join(' ').toLowerCase()
        };
    });

    rows.sort((a, b) => {
        const av = String(a[col] || '');
        const bv = String(b[col] || '');
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return dir === 'asc' ? cmp : -cmp;
    });

    c.innerHTML = `<table class="data-table"><thead><tr>${headers}</tr></thead><tbody id="tickets-tbody">` +
        rows.map(row => `<tr
            data-type="${escapeHtml((row.requestType || '').toLowerCase())}"
            data-status="${escapeHtml((row.requestStatus || '').toLowerCase())}"
            data-search="${escapeHtml(row.search)}"
            style="cursor:pointer;"
            onclick="openTicketDetail(${row.recordId})">
            <td>${escapeHtml(String(row.recordId))}</td>
            <td>${escapeHtml(row.requestType) || '-'}</td>
            <td><span class="badge badge-${getStatusClass(row.requestStatus)}">${escapeHtml(row.requestStatus) || 'No Status'}</span></td>
            <td>${escapeHtml(row.projectName) || '-'}</td>
            <td>${escapeHtml(row.propertyName) || '-'}</td>
            <td>${escapeHtml(row.requestedBy)}</td>
            <td>${formatDate(row.dateCreated)}</td>
            <td onclick="event.stopPropagation()">
                <button class="btn btn-secondary btn-sm" onclick="openEditTicket(${row.recordId})">Edit</button>
            </td>
        </tr>`).join('') + '</tbody></table>';

    _applyTicketsFilter();
}

function sortTickets(col) {
    if (_ticketsSort.col === col) {
        _ticketsSort.dir = _ticketsSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        _ticketsSort.col = col;
        _ticketsSort.dir = 'asc';
    }
    renderTicketsTable(AppState.tickets);
}

var _ticketsFilterTimeout = null;
function filterTickets() {
    clearTimeout(_ticketsFilterTimeout);
    _ticketsFilterTimeout = setTimeout(_applyTicketsFilter, 150);
}
function _applyTicketsFilter() {
    const search = (document.getElementById('tickets-search')?.value || '').toLowerCase();
    const type   = (document.getElementById('tickets-filter-type')?.value || '').toLowerCase();
    const status = (document.getElementById('tickets-filter-status')?.value || '').toLowerCase();
    document.querySelectorAll('#tickets-tbody tr').forEach(row => {
        const matchSearch = !search || (row.dataset.search || '').includes(search);
        const matchType   = !type   || row.dataset.type   === type;
        const matchStatus = !status || row.dataset.status === status;
        row.style.display = (matchSearch && matchType && matchStatus) ? '' : 'none';
    });
}

function _populateTicketTypeSelect(selected) {
    const f = CONFIG.fields.tickets;
    const existing = [...new Set(AppState.tickets.map(r => r[f.requestType]?.value).filter(Boolean))].sort();
    const types = existing.length ? existing : _TICKET_TYPE_DEFAULTS;
    document.getElementById('ticket-request-type').innerHTML =
        '<option value="">Select a type...</option>' +
        types.map(t => `<option value="${escapeHtml(t)}"${t === selected ? ' selected' : ''}>${escapeHtml(t)}</option>`).join('');
}

function _populateTicketStatusSelect(selected) {
    const f = CONFIG.fields.tickets;
    const existing = [...new Set(AppState.tickets.map(r => r[f.requestStatus]?.value).filter(Boolean))].sort();
    const statuses = existing.length ? existing : _TICKET_STATUS_DEFAULTS;
    document.getElementById('ticket-request-status').innerHTML =
        '<option value="">Select status...</option>' +
        statuses.map(s => `<option value="${escapeHtml(s)}"${s === selected ? ' selected' : ''}>${escapeHtml(s)}</option>`).join('');
}

function openNewTicketModal() {
    document.getElementById('ticket-modal-title').textContent = 'New Ticket';
    document.getElementById('ticket-edit-id').value = '';
    document.getElementById('ticket-description').value = '';
    document.getElementById('ticket-comments').value = '';
    document.getElementById('ticket-client-request').checked = false;
    document.getElementById('ticket-submit-btn').textContent = 'Create Ticket';
    document.getElementById('ticket-submit-btn').disabled = false;
    _populateTicketTypeSelect('');
    _populateTicketStatusSelect('Open');
    openModal('ticket-modal');
}

function openEditTicket(id) {
    const f = CONFIG.fields.tickets;
    const rec = AppState.tickets.find(r => r[f.recordId]?.value == id);
    if (!rec) { alert('Ticket not found in current session — try refreshing.'); return; }

    document.getElementById('ticket-modal-title').textContent = 'Edit Ticket #' + id;
    document.getElementById('ticket-edit-id').value = id;
    document.getElementById('ticket-description').value = rec[f.description]?.value || '';
    document.getElementById('ticket-comments').value = rec[f.comments]?.value || '';
    document.getElementById('ticket-client-request').checked = !!rec[f.clientRequest]?.value;
    document.getElementById('ticket-submit-btn').textContent = 'Save Changes';
    document.getElementById('ticket-submit-btn').disabled = false;
    _populateTicketTypeSelect(rec[f.requestType]?.value);
    _populateTicketStatusSelect(rec[f.requestStatus]?.value);
    openModal('ticket-modal');
}

async function submitTicket() {
    const editId      = document.getElementById('ticket-edit-id').value;
    const requestType = document.getElementById('ticket-request-type').value;
    const requestStatus = document.getElementById('ticket-request-status').value;
    const description = document.getElementById('ticket-description').value.trim();
    const comments    = document.getElementById('ticket-comments').value.trim();
    const clientRequest = document.getElementById('ticket-client-request').checked;

    if (!requestType) { alert('Please select a request type.'); return; }

    const f = CONFIG.fields.tickets;
    const data = {
        [f.requestType]:   { value: requestType },
        [f.description]:   { value: description },
        [f.comments]:      { value: comments },
        [f.clientRequest]: { value: clientRequest }
    };
    if (requestStatus) data[f.requestStatus] = { value: requestStatus };

    const btn = document.getElementById('ticket-submit-btn');
    btn.disabled = true;
    btn.textContent = editId ? 'Saving...' : 'Creating...';

    try {
        if (editId) {
            data[f.recordId] = { value: parseInt(editId) };
            await updateRecord(CONFIG.tables.tickets, data);
            showSuccess('Ticket #' + editId + ' updated.');
        } else {
            await createRecord(CONFIG.tables.tickets, data);
            showSuccess('Ticket created successfully.');
        }
        closeModal('ticket-modal');
        loadTickets(true);
    } catch (e) {
        console.error('submitTicket failed:', e);
        alert('Failed to save ticket: ' + e.message);
        btn.disabled = false;
        btn.textContent = editId ? 'Save Changes' : 'Create Ticket';
    }
}

async function openTicketDetail(id) {
    document.getElementById('ticket-detail-title').textContent = 'Ticket #' + id;
    openModal('ticket-detail-modal');
    const content = document.getElementById('ticket-detail-content');
    content.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading...</p></div>';

    try {
        const f = CONFIG.fields.tickets;
        const r = await queryRecords(
            CONFIG.tables.tickets,
            [f.recordId, f.dateCreated, f.dateModified, f.requestType, f.requestStatus,
             f.requestedBy, f.assignee, f.projectName, f.propertyName, f.description,
             f.comments, f.clientRequest, f.completed, f.closed, f.closedBy, f.dateClosed],
            `{3.EX.${id}}`
        );
        if (!r.data?.length) {
            content.innerHTML = '<div class="empty-state"><p>Ticket not found.</p></div>';
            return;
        }
        const rec = r.data[0];
        const status      = rec[f.requestStatus]?.value || '';
        const type        = rec[f.requestType]?.value || '';
        const proj        = rec[f.projectName]?.value || '';
        const prop        = rec[f.propertyName]?.value || '';
        const reqBy       = _ticketUserLabel(rec[f.requestedBy]?.value);
        const assignee    = _ticketUserLabel(rec[f.assignee]?.value);
        const closedBy    = _ticketUserLabel(rec[f.closedBy]?.value);
        const description = rec[f.description]?.value || '';
        const comments    = rec[f.comments]?.value || '';
        const isClosed    = !!rec[f.closed]?.value;
        const isCompleted = !!rec[f.completed]?.value;
        const isClient    = !!rec[f.clientRequest]?.value;

        const metaItem = (label, value) =>
            `<div style="padding:10px 0;border-bottom:1px solid var(--border-color);">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-secondary);margin-bottom:4px;">${label}</div>
                <div style="font-size:14px;color:var(--text-primary);">${value}</div>
            </div>`;

        content.innerHTML = `
            <div style="padding:20px;">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;gap:12px;">
                    <div>
                        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                            <h2 style="margin:0;font-size:20px;">Ticket #${id}</h2>
                            ${status ? `<span class="badge badge-${getStatusClass(status)}">${escapeHtml(status)}</span>` : ''}
                            ${isCompleted ? '<span class="badge badge-approved">Completed</span>' : ''}
                            ${isClosed ? '<span class="badge badge-rejected">Closed</span>' : ''}
                            ${isClient ? '<span class="badge badge-info">Client Request</span>' : ''}
                        </div>
                        ${type ? `<div style="margin-top:6px;font-size:13px;color:var(--text-secondary);">${escapeHtml(type)}</div>` : ''}
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="openEditTicket(${id});closeModal('ticket-detail-modal');">Edit</button>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin-bottom:20px;">
                    ${metaItem('Requested By', escapeHtml(reqBy))}
                    ${metaItem('Assignee', escapeHtml(assignee))}
                    ${metaItem('Project', escapeHtml(proj) || '-')}
                    ${metaItem('Property', escapeHtml(prop) || '-')}
                    ${metaItem('Date Created', formatDate(rec[f.dateCreated]?.value))}
                    ${metaItem('Last Modified', formatDate(rec[f.dateModified]?.value))}
                    ${isClosed ? metaItem('Closed By', escapeHtml(closedBy)) : ''}
                    ${rec[f.dateClosed]?.value ? metaItem('Date Closed', formatDate(rec[f.dateClosed]?.value)) : ''}
                </div>

                ${description ? `<div style="margin-bottom:16px;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-secondary);margin-bottom:8px;">Description</div>
                    <div style="background:var(--surface-2,var(--bg-card));border:1px solid var(--border-color);border-radius:8px;padding:12px 14px;font-size:14px;line-height:1.65;">${description}</div>
                </div>` : ''}

                ${comments ? `<div>
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-secondary);margin-bottom:8px;">Comments</div>
                    <div style="background:var(--surface-2,var(--bg-card));border:1px solid var(--border-color);border-radius:8px;padding:12px 14px;font-size:14px;line-height:1.65;white-space:pre-wrap;">${escapeHtml(comments)}</div>
                </div>` : ''}
            </div>
        `;
    } catch (e) {
        content.innerHTML = `<div class="error-message"><p>Failed to load ticket: ${escapeHtml(e.message)}</p></div>`;
        console.error(e);
    }
}

// ============================================================================
// COMPANY INFO
// ============================================================================

var _companyInfoSort = { col: 'name', dir: 'asc' };

async function loadCompanyInfo(force) {
    const c = document.getElementById('company-info-table');
    if (!c) return;
    if (!force && AppState.companyInfo.length) { renderCompanyInfoTable(AppState.companyInfo); return; }
    showLoading(c);
    try {
        const f = CONFIG.fields.companiesInfo;
        const r = await queryRecords(
            CONFIG.tables.companiesInfo,
            [f.recordId, f.name, f.ycrmId, f.tourBuilderId, f.propertyCount, f.totalOpportunityValue, f.totalOpportunityValueYTD],
            '{12.XEX.\'\'}',
            [{ fieldId: f.name, order: 'ASC' }]
        );
        AppState.companyInfo = r.data || [];
        renderCompanyInfoTable(AppState.companyInfo);
    } catch (e) {
        const c2 = document.getElementById('company-info-table');
        if (c2) showError(c2, 'Failed to load company data: ' + e.message);
    }
}

function sortCompanyInfo(col) {
    if (_companyInfoSort.col === col) {
        _companyInfoSort.dir = _companyInfoSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        _companyInfoSort.col = col;
        _companyInfoSort.dir = col === 'name' ? 'asc' : 'desc';
    }
    filterCompanyInfo();
}

function filterCompanyInfo() {
    const search = (document.getElementById('company-info-search')?.value || '').toLowerCase();
    const f = CONFIG.fields.companiesInfo;
    var records = AppState.companyInfo.filter(function(r) {
        if (!search) return true;
        var name = (r[f.name]?.value || '').toLowerCase();
        var ycrmId = String(r[f.ycrmId]?.value || '').toLowerCase();
        return name.includes(search) || ycrmId.includes(search);
    });
    renderCompanyInfoTable(records);
}

function renderCompanyInfoTable(records) {
    const c = document.getElementById('company-info-table');
    if (!c) return;
    const f = CONFIG.fields.companiesInfo;

    if (!records.length) {
        c.innerHTML = '<div class="empty-state"><p class="empty-state-title">No companies found</p></div>';
        return;
    }

    var col = _companyInfoSort.col;
    var dir = _companyInfoSort.dir;
    var sorted = records.slice().sort(function(a, b) {
        var av, bv;
        if (col === 'name')        { av = (a[f.name]?.value || '').toLowerCase();             bv = (b[f.name]?.value || '').toLowerCase(); }
        else if (col === 'ycrmId') { av = a[f.ycrmId]?.value || '';                           bv = b[f.ycrmId]?.value || ''; }
        else if (col === 'props')  { av = a[f.propertyCount]?.value || 0;                     bv = b[f.propertyCount]?.value || 0; }
        else if (col === 'opp')    { av = a[f.totalOpportunityValue]?.value || 0;             bv = b[f.totalOpportunityValue]?.value || 0; }
        else if (col === 'oppYTD') { av = a[f.totalOpportunityValueYTD]?.value || 0;          bv = b[f.totalOpportunityValueYTD]?.value || 0; }
        else                       { av = (a[f.name]?.value || '').toLowerCase();             bv = (b[f.name]?.value || '').toLowerCase(); }
        if (av < bv) return dir === 'asc' ? -1 : 1;
        if (av > bv) return dir === 'asc' ?  1 : -1;
        return 0;
    });

    function th(label, colKey) {
        var arrow = col === colKey ? (dir === 'asc' ? ' &#x25B2;' : ' &#x25BC;') : '';
        return '<th style="cursor:pointer;user-select:none;" onclick="sortCompanyInfo(\'' + colKey + '\')">' + label + arrow + '</th>';
    }

    c.innerHTML =
        '<div style="overflow-x:auto;">' +
        '<table class="data-table">' +
            '<thead><tr>' +
                th('Name', 'name') +
                th('yCRM ID', 'ycrmId') +
                '<th>TourBuilder ID</th>' +
                th('# Properties', 'props') +
                th('Total Opportunity', 'opp') +
                th('Opportunity YTD', 'oppYTD') +
            '</tr></thead>' +
            '<tbody>' + sorted.map(function(r) {
                var propCount = r[f.propertyCount]?.value || 0;
                var oppVal    = r[f.totalOpportunityValue]?.value;
                var oppYTD    = r[f.totalOpportunityValueYTD]?.value;
                var tourId    = r[f.tourBuilderId]?.value || '—';
                var ycrmId    = r[f.ycrmId]?.value || '—';
                return '<tr>' +
                    '<td><strong>' + escapeHtml(r[f.name]?.value || '—') + '</strong></td>' +
                    '<td>' + escapeHtml(String(ycrmId)) + '</td>' +
                    '<td>' + escapeHtml(String(tourId)) + '</td>' +
                    '<td style="text-align:right">' + propCount.toLocaleString() + '</td>' +
                    '<td style="text-align:right">' + (oppVal != null ? formatCurrency(oppVal) : '—') + '</td>' +
                    '<td style="text-align:right">' + (oppYTD != null ? formatCurrency(oppYTD) : '—') + '</td>' +
                '</tr>';
            }).join('') + '</tbody>' +
        '</table></div>';
}
