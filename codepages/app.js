// LCP Sales Portal - Application Logic v1.0.2

const AppState = {
    selectedProduct: null, selectedClient: null,
    currentProductCallback: null, currentPropertyCallback: null,
    orderProperties: [], // [{propertyId, property, lineItems: [{id, productId, productName, quantity, unitPrice, total}], billingContact, billingEmail, billingPhone}]
    quoteProperties: [], // Same structure for 3D quotes
    products: [], products3D: [], properties: [], clients: [], orders: [], quotes: [], priceList: []
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
    console.log('LCP Sales Portal initialized');
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
        const r = await queryRecords(CONFIG.tables.companies, [f.recordId, f.name, f.ycrmId], null, [{ fieldId: f.ycrmId, order: 'ASC' }], true);
        AppState.clients = r.data.map(rec => ({ id: rec[f.recordId].value, name: rec[f.name]?.value || '', ycrmId: rec[f.ycrmId]?.value || '' }));
        renderClientList();
    } catch (e) { console.error('Load clients failed:', e); AppState.clients = []; renderClientList(); }
}

function renderClientList() {
    const c = document.getElementById('client-list');
    if (!AppState.clients.length) { c.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">No clients found</div>'; return; }
    c.innerHTML = AppState.clients.map(cl => `<div class="client-item ${AppState.selectedClient?.id===cl.id?'selected':''}" onclick="selectClient(${cl.id})"><div class="client-item-name">${cl.name || 'No name'}</div><div class="client-item-id">${cl.ycrmId || 'No ID'}</div></div>`).join('');
}

function filterClients() {
    const s = document.getElementById('client-search-input').value.toLowerCase();
    document.querySelectorAll('.client-item').forEach(i => { 
        const name = i.querySelector('.client-item-name').textContent.toLowerCase();
        const ycrmId = i.querySelector('.client-item-id').textContent.toLowerCase();
        i.style.display = (name.includes(s) || ycrmId.includes(s)) ? 'block' : 'none'; 
    });
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
    selectClient(nc.id);
    document.getElementById('new-client-name').value = '';
    closeModal('add-client-modal');
    showSuccess('Client added');
}

// ============================================================================
// PROPERTY MANAGEMENT
// ============================================================================

async function loadProperties() {
    try {
        const f = CONFIG.fields.propertiesMaster;
        const r = await queryRecords(CONFIG.tables.propertiesMaster, [f.recordId, f.propertyName, f.address, f.billingContact, f.billingEmail, f.billingPhone], "{12.XEX.''}", [{ fieldId: f.propertyName, order: 'ASC' }], true);
        AppState.properties = r.data.map(rec => ({ 
            id: rec[f.recordId].value, 
            name: rec[f.propertyName]?.value || 'Unnamed', 
            address: rec[f.address]?.value || '',
            billingContact: rec[f.billingContact]?.value || '',
            billingEmail: rec[f.billingEmail]?.value || '',
            billingPhone: rec[f.billingPhone]?.value || ''
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
        ? AppState.quoteProperties.map(op => op.propertyId)
        : AppState.orderProperties.map(op => op.propertyId);
    var available = AppState.properties.filter(p => !selectedIds.includes(p.id));
    if (!available.length) {
        c.innerHTML = '<tr><td style="text-align:center;padding:40px;color:var(--text-muted)">All properties already added</td></tr>';
        return;
    }
    c.innerHTML = available.map(p => `<tr class="property-row" onclick="addPropertyFromSelector(${p.id})" data-name="${(p.name||'').toLowerCase()}" data-address="${(p.address||'').toLowerCase()}" style="cursor:pointer;"><td><div class="property-name-large">${p.name}</div><div class="property-address-small">${p.address || 'No address'}</div></td></tr>`).join('');
}

function filterProperties() {
    var s = document.getElementById('property-search-input').value.toLowerCase();
    document.querySelectorAll('.property-row').forEach(function(row) { 
        var name = row.dataset.name;
        var address = row.dataset.address;
        row.style.display = (name.includes(s) || address.includes(s)) ? '' : 'none'; 
    });
}

function openPropertySelector() {
    AppState.currentPropertyCallback = 'order';
    renderPropertyList();
    document.getElementById('property-search-input').value = '';
    openModal('property-modal');
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
        billingPhone: property.billingPhone || ''
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
        total: 0
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
    if (li) {
        li.quantity = parseInt(qty) || 1;
        li.total = li.quantity * li.unitPrice;
        renderOrderProperties();
    }
}

function selectProductForPropertyLine(propertyId, lineItemId) {
    openProductSelector(function(product) {
        var orderProp = AppState.orderProperties.find(op => op.propertyId === propertyId);
        if (!orderProp) return;
        var li = orderProp.lineItems.find(l => l.id === lineItemId);
        if (li) {
            li.productId = product.id;
            li.productName = product.name;
            li.unitPrice = product.price;
            li.total = li.quantity * product.price;
            renderOrderProperties();
        }
    });
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
                <div class="form-group"><input type="text" class="form-input" value="${formatCurrency(li.total)}" readonly style="background:var(--bg-hover);cursor:not-allowed;font-weight:600;color:var(--lcp-blue)"></div>
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
                    <label class="billing-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Contact</label>
                    <input type="text" class="form-input billing-input" id="billing-contact-${op.propertyId}" value="${op.billingContact || ''}" placeholder="Contact name" onchange="updatePropertyBilling(${op.propertyId},'billingContact',this.value)">
                </div>
                <div class="billing-field">
                    <label class="billing-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>Email</label>
                    <input type="email" class="form-input billing-input" id="billing-email-${op.propertyId}" value="${op.billingEmail || ''}" placeholder="billing@company.com" onchange="updatePropertyBilling(${op.propertyId},'billingEmail',this.value)">
                </div>
                <div class="billing-field">
                    <label class="billing-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>Phone</label>
                    <input type="tel" class="form-input billing-input" id="billing-phone-${op.propertyId}" value="${op.billingPhone || ''}" placeholder="(555) 123-4567" oninput="formatPhoneNumber(this)" onchange="updatePropertyBilling(${op.propertyId},'billingPhone',this.value)">
                </div>
            </div>
            <div class="property-group-body">
                <div class="line-item-header"><span>Product</span><span>Quantity</span><span>Unit Price</span><span>Total</span><span></span></div>
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
        const r = await queryRecords(CONFIG.tables.products, [f.recordId, f.productName, f.retailPrice], "{12.EX.'3D Services'}", [{ fieldId: f.productName, order: 'ASC' }], true);
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

function filterProducts() {
    var search = document.getElementById('product-search-input').value.toLowerCase();
    var typeFilter = document.getElementById('product-type-filter');
    var type = typeFilter ? typeFilter.value : '';
    document.querySelectorAll('.product-row').forEach(row => { 
        var rowType = row.dataset.type;
        var rowName = row.dataset.name;
        var rowCode = row.dataset.code;
        var matchType = !type || rowType === type;
        var matchSearch = !search || rowName.includes(search) || rowCode.includes(search);
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

async function loadPriceList() {
    const c = document.getElementById('price-list-table');
    showLoading(c);
    
    try {
        if (!AppState.priceList.length) await loadProducts();
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

function filterPriceList() {
    const type = document.getElementById('price-filter-type').value;
    const search = document.getElementById('price-filter-search').value.toLowerCase();
    document.querySelectorAll('#price-list-body tr').forEach(row => {
        const rowType = row.dataset.type;
        const rowName = row.dataset.name;
        const matchType = !type || rowType === type;
        const matchSearch = !search || rowName.includes(search);
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
    renderQuotePropertyList();
    document.getElementById('property-search-input').value = '';
    AppState.currentPropertyCallback = 'quote';
    openModal('property-modal');
}

function renderQuotePropertyList() {
    var c = document.getElementById('property-table-body');
    if (!c) return;
    if (!AppState.properties.length) { 
        c.innerHTML = '<tr><td style="text-align:center;padding:40px;color:var(--text-muted)">No properties found</td></tr>'; 
        return; 
    }
    var selectedIds = AppState.quoteProperties.map(op => op.propertyId);
    var available = AppState.properties.filter(p => !selectedIds.includes(p.id));
    if (!available.length) {
        c.innerHTML = '<tr><td style="text-align:center;padding:40px;color:var(--text-muted)">All properties already added</td></tr>';
        return;
    }
    c.innerHTML = available.map(p => `<tr class="property-row" onclick="addPropertyFromSelector(${p.id})" data-name="${(p.name||'').toLowerCase()}" data-address="${(p.address||'').toLowerCase()}" style="cursor:pointer;"><td><div class="property-name-large">${p.name}</div><div class="property-address-small">${p.address || 'No address'}</div></td></tr>`).join('');
}

function addPropertyFromSelector(propertyId) {
    if (AppState.currentPropertyCallback === 'quote') {
        addPropertyToQuote(propertyId);
    } else {
        addPropertyToOrder(propertyId);
    }
    AppState.currentPropertyCallback = null;
}

function addPropertyToQuote(propertyId) {
    var property = AppState.properties.find(p => p.id === propertyId);
    if (!property) return;
    
    if (AppState.quoteProperties.find(op => op.propertyId === propertyId)) {
        closeModal('property-modal');
        return;
    }
    
    AppState.quoteProperties.push({
        propertyId: propertyId,
        property: property,
        lineItems: [],
        billingContact: property.billingContact || '',
        billingEmail: property.billingEmail || '',
        billingPhone: property.billingPhone || ''
    });
    
    renderQuoteProperties();
    closeModal('property-modal');
}

function removePropertyFromQuote(propertyId) {
    AppState.quoteProperties = AppState.quoteProperties.filter(op => op.propertyId !== propertyId);
    renderQuoteProperties();
}

function addLineItemToQuoteProperty(propertyId) {
    var quoteProp = AppState.quoteProperties.find(op => op.propertyId === propertyId);
    if (!quoteProp) return;
    
    lineItemCounter++;
    quoteProp.lineItems.push({
        id: lineItemCounter,
        productId: null,
        productName: '',
        quantity: 1,
        unitPrice: 0,
        total: 0
    });
    renderQuoteProperties();
}

function removeLineItemFromQuoteProperty(propertyId, lineItemId) {
    var quoteProp = AppState.quoteProperties.find(op => op.propertyId === propertyId);
    if (!quoteProp) return;
    quoteProp.lineItems = quoteProp.lineItems.filter(li => li.id !== lineItemId);
    renderQuoteProperties();
}

function updateQuoteLineItemQty(propertyId, lineItemId, qty) {
    var quoteProp = AppState.quoteProperties.find(op => op.propertyId === propertyId);
    if (!quoteProp) return;
    var li = quoteProp.lineItems.find(l => l.id === lineItemId);
    if (li) {
        li.quantity = parseInt(qty) || 1;
        li.total = li.quantity * li.unitPrice;
        renderQuoteProperties();
    }
}

function selectProductForQuotePropertyLine(propertyId, lineItemId) {
    open3DProductSelector(function(product) {
        var quoteProp = AppState.quoteProperties.find(op => op.propertyId === propertyId);
        if (!quoteProp) return;
        var li = quoteProp.lineItems.find(l => l.id === lineItemId);
        if (li) {
            li.productId = product.id;
            li.productName = product.name;
            li.unitPrice = product.price;
            li.total = li.quantity * product.price;
            renderQuoteProperties();
        }
    });
}

function open3DProductSelector(cb) {
    AppState.currentProductCallback = cb;
    AppState.selectedProduct = null;
    render3DProductGrid();
    var searchInput = document.getElementById('product-search-input');
    if (searchInput) searchInput.value = '';
    var typeFilter = document.getElementById('product-type-filter');
    if (typeFilter) typeFilter.style.display = 'none'; // Hide type filter for 3D products
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

function updateQuotePropertyBilling(propertyId, field, value) {
    var quoteProp = AppState.quoteProperties.find(op => op.propertyId === propertyId);
    if (quoteProp) {
        quoteProp[field] = value;
    }
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
    
    c.innerHTML = AppState.quoteProperties.map(op => {
        var p = op.property;
        
        var lineItemsHtml = '';
        if (op.lineItems.length) {
            lineItemsHtml = op.lineItems.map(li => `<div class="line-item">
                <div class="form-group"><button type="button" class="btn btn-secondary" style="width:100%;justify-content:flex-start" onclick="selectProductForQuotePropertyLine(${op.propertyId},${li.id})">${li.productName||'Select Product...'}</button></div>
                <div class="form-group"><input type="number" class="form-input" value="${li.quantity}" min="1" onchange="updateQuoteLineItemQty(${op.propertyId},${li.id},this.value)"></div>
                <div class="form-group"><input type="text" class="form-input" value="${formatCurrency(li.unitPrice)}" readonly style="background:var(--bg-hover);cursor:not-allowed"></div>
                <div class="form-group"><input type="text" class="form-input" value="${formatCurrency(li.total)}" readonly style="background:var(--bg-hover);cursor:not-allowed;font-weight:600;color:var(--lcp-blue)"></div>
                <button type="button" class="remove-btn" onclick="removeLineItemFromQuoteProperty(${op.propertyId},${li.id})"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
            </div>`).join('');
        } else {
            lineItemsHtml = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">No products yet</div>';
        }
        
        return `<div class="property-group">
            <div class="property-group-header">
                <div class="property-group-info">
                    <div class="property-group-name">${p.name}</div>
                    <div class="property-group-address">${p.address || 'No address'}</div>
                </div>
                <div class="property-group-actions">
                    <button type="button" class="btn btn-ghost btn-sm" onclick="removePropertyFromQuote(${op.propertyId})" title="Remove Property">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </div>
            <div class="property-group-billing">
                <div class="billing-field">
                    <label class="billing-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Contact</label>
                    <input type="text" class="form-input billing-input" value="${op.billingContact || ''}" placeholder="Contact name" onchange="updateQuotePropertyBilling(${op.propertyId},'billingContact',this.value)">
                </div>
                <div class="billing-field">
                    <label class="billing-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>Email</label>
                    <input type="email" class="form-input billing-input" value="${op.billingEmail || ''}" placeholder="billing@company.com" onchange="updateQuotePropertyBilling(${op.propertyId},'billingEmail',this.value)">
                </div>
                <div class="billing-field">
                    <label class="billing-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>Phone</label>
                    <input type="tel" class="form-input billing-input" value="${op.billingPhone || ''}" placeholder="(555) 123-4567" oninput="formatPhoneNumber(this)" onchange="updateQuotePropertyBilling(${op.propertyId},'billingPhone',this.value)">
                </div>
            </div>
            <div class="property-group-body">
                <div class="line-item-header"><span>Product</span><span>Quantity</span><span>Unit Price</span><span>Total</span><span></span></div>
                <div class="line-items-container">${lineItemsHtml}</div>
                <button type="button" class="btn btn-secondary add-line-item-btn" onclick="addLineItemToQuoteProperty(${op.propertyId})">
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                    Add Product
                </button>
            </div>
        </div>`;
    }).join('');
}

// ============================================================================
// SAVE OPERATIONS
// ============================================================================

async function saveOrder() {
    const email = document.getElementById('order-sales-email').value.trim();
    const notes = getRichTextContent('order-notes-editor');
    
    if (!email) { alert('Sales rep email required'); return; }
    if (!AppState.selectedClient) { alert('Please select a client'); return; }
    if (!AppState.orderProperties.length) { alert('Please add at least one property'); return; }
    
    // Check each property has at least one line item
    var hasLineItems = AppState.orderProperties.some(op => op.lineItems.length > 0);
    if (!hasLineItems) { alert('Please add at least one line item'); return; }
    
    try {
        const f = CONFIG.fields.orders;
        const data = { 
            [f.salesRepEmail]: { value: email }, 
            [f.quoteDate]: { value: getTodayISO() }, 
            [f.expirationDate]: { value: getExpirationDate(30) }, 
            [f.orderStatus]: { value: 'Draft' }, 
            [f.historyNotes]: { value: notes }, 
            [f.relatedCompany]: { value: AppState.selectedClient.id }
        };
        const r = await createRecord(CONFIG.tables.orders, data);
        if (r.data?.[0]) {
            const orderId = r.data[0][f.recordId].value;
            // Save line items for each property
            for (const op of AppState.orderProperties) {
                for (const li of op.lineItems) {
                    if (li.productId) {
                        const lf = CONFIG.fields.orderLineItems;
                        await createRecord(CONFIG.tables.orderLineItems, { 
                            [lf.relatedOrder]: { value: orderId }, 
                            [lf.description]: { value: li.productName }, 
                            [lf.quantity]: { value: li.quantity }, 
                            [lf.total]: { value: li.total }
                            // TODO: Add related property field when available
                        });
                    }
                }
            }
            showSuccess('Order saved!');
            resetOrderForm();
        }
    } catch (e) { console.error(e); alert('Failed to save order'); }
}

async function saveQuote() {
    const name = document.getElementById('quote-name').value.trim();
    const email = document.getElementById('quote-sales-email').value.trim();
    if (!name || !email) { alert('Quote name and sales rep email required'); return; }
    if (!AppState.quoteProperties.length) { alert('Please add at least one property'); return; }
    
    var hasLineItems = AppState.quoteProperties.some(qp => qp.lineItems.length > 0);
    if (!hasLineItems) { alert('Please add at least one product'); return; }
    
    try {
        const f = CONFIG.fields.quotes3D;
        const data = { 
            [f.quoteName]: { value: name }, 
            [f.salesRepEmail]: { value: email }, 
            [f.quoteDate]: { value: getTodayISO() }, 
            [f.expirationDate]: { value: getExpirationDate(30) }, 
            [f.quoteStatus]: { value: 'Draft' }, 
            [f.historyNotes]: { value: document.getElementById('quote-notes').value } 
        };
        const r = await createRecord(CONFIG.tables.quotes3D, data);
        if (r.data?.[0]) {
            const quoteId = r.data[0][f.recordId].value;
            const lf = CONFIG.fields.lineItems3D;
            // Save line items for each property
            for (const qp of AppState.quoteProperties) {
                for (const li of qp.lineItems) {
                    if (li.productId) {
                        await createRecord(CONFIG.tables.lineItems3D, { 
                            [lf.relatedQuote]: { value: quoteId }, 
                            [lf.description]: { value: li.productName }, 
                            [lf.quantity]: { value: li.quantity }, 
                            [lf.total]: { value: li.total }
                        });
                    }
                }
            }
            showSuccess('Quote saved!');
            resetQuoteForm();
        }
    } catch (e) { console.error(e); alert('Failed to save quote'); }
}

// ============================================================================
// HISTORY
// ============================================================================

async function loadOrderHistory() {
    const c = document.getElementById('order-history-table');
    showLoading(c);
    try {
        const f = CONFIG.fields.orders;
        const r = await queryRecords(CONFIG.tables.orders, [f.recordId, f.orderStatus, f.quoteDate, f.salesRepEmail, f.companyName], null, [{ fieldId: f.dateModified, order: 'DESC' }]);
        AppState.orders = r.data;
        if (!AppState.orders.length) { c.innerHTML = '<div class="empty-state"><p class="empty-state-title">No orders yet</p><button class="btn btn-primary" onclick="switchTab(\'tab-new-order\')">Create Order</button></div>'; return; }
        document.getElementById('stat-total-orders').textContent = AppState.orders.length;
        document.getElementById('stat-pending-orders').textContent = AppState.orders.filter(o => ['Pending','Processing'].includes(o[f.orderStatus]?.value)).length;
        document.getElementById('stat-completed-orders').textContent = AppState.orders.filter(o => o[f.orderStatus]?.value === 'Completed').length;
        c.innerHTML = `<table class="data-table"><thead><tr><th>Company</th><th>Status</th><th>Date</th><th>Sales Rep</th><th>Actions</th></tr></thead><tbody>${AppState.orders.map(o => `<tr><td>${o[f.companyName]?.value||'-'}</td><td><span class="badge badge-${getStatusClass(o[f.orderStatus]?.value)}">${o[f.orderStatus]?.value||'Draft'}</span></td><td>${formatDate(o[f.quoteDate]?.value)}</td><td>${o[f.salesRepEmail]?.value||'-'}</td><td class="actions"><button class="btn btn-ghost btn-sm" onclick="viewOrder(${o[f.recordId].value})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></td></tr>`).join('')}</tbody></table>`;
    } catch (e) { showError(c, 'Failed to load orders'); }
}

async function loadQuoteHistory() {
    const c = document.getElementById('quote-history-table');
    showLoading(c);
    try {
        const f = CONFIG.fields.quotes3D;
        const r = await queryRecords(CONFIG.tables.quotes3D, [f.recordId, f.quoteName, f.quoteStatus, f.quoteDate, f.salesRepEmail, f.companyName], null, [{ fieldId: f.dateModified, order: 'DESC' }]);
        AppState.quotes = r.data;
        if (!AppState.quotes.length) { c.innerHTML = '<div class="empty-state"><p class="empty-state-title">No quotes yet</p><button class="btn btn-primary" onclick="switchTab(\'tab-new-quote\')">Create Quote</button></div>'; return; }
        document.getElementById('stat-total-quotes').textContent = AppState.quotes.length;
        document.getElementById('stat-pending-quotes').textContent = AppState.quotes.filter(q => ['Pending Review','Sent to Client'].includes(q[f.quoteStatus]?.value)).length;
        document.getElementById('stat-approved-quotes').textContent = AppState.quotes.filter(q => q[f.quoteStatus]?.value === 'Approved').length;
        c.innerHTML = `<table class="data-table"><thead><tr><th>Quote Name</th><th>Company</th><th>Status</th><th>Date</th><th>Sales Rep</th><th>Actions</th></tr></thead><tbody>${AppState.quotes.map(q => `<tr><td>${q[f.quoteName]?.value||'-'}</td><td>${q[f.companyName]?.value||'-'}</td><td><span class="badge badge-${getStatusClass(q[f.quoteStatus]?.value)}">${q[f.quoteStatus]?.value||'Draft'}</span></td><td>${formatDate(q[f.quoteDate]?.value)}</td><td>${q[f.salesRepEmail]?.value||'-'}</td><td class="actions"><button class="btn btn-ghost btn-sm" onclick="viewQuote(${q[f.recordId].value})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></td></tr>`).join('')}</tbody></table>`;
    } catch (e) { showError(c, 'Failed to load quotes'); }
}

function getStatusClass(s) { if (!s) return 'draft'; const l = s.toLowerCase(); if (l.includes('pending')||l.includes('processing')||l.includes('review')||l.includes('sent')) return 'pending'; if (l.includes('completed')||l.includes('approved')) return 'approved'; if (l.includes('rejected')||l.includes('cancelled')||l.includes('expired')) return 'rejected'; return 'draft'; }

// ============================================================================
// FORM RESET & VIEW
// ============================================================================

function resetOrderForm() {
    document.getElementById('order-form').reset();
    setRichTextContent('order-notes-editor', '');
    AppState.orderProperties = [];
    AppState.selectedClient = null;
    lineItemCounter = 0;
    document.getElementById('selected-client-name').textContent = 'Select a client...';
    document.getElementById('order-company-id').value = '';
    renderOrderProperties();
    renderClientList();
}

function resetQuoteForm() {
    document.getElementById('quote-form').reset();
    AppState.quoteProperties = [];
    renderQuoteProperties();
}

function viewOrder(id) { window.open(`https://${CONFIG.getRealmHostname()}/db/${CONFIG.tables.orders}?a=dr&rid=${id}`, '_blank'); }
function viewQuote(id) { window.open(`https://${CONFIG.getRealmHostname()}/db/${CONFIG.tables.quotes3D}?a=dr&rid=${id}`, '_blank'); }
