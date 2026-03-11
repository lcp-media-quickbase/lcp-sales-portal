// LCP Sales Portal - Application Logic v1.0.2

const AppState = {
    selectedProperty: null, selectedProduct: null, selectedClient: null,
    currentProductCallback: null, orderLineItems: [], quoteLineItems: [],
    products: [], properties: [], clients: [], orders: [], quotes: [], priceList: []
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
        const r = await queryRecords(CONFIG.tables.companies, [f.recordId, f.companyName, f.ycrmId], null, [{ fieldId: f.companyName, order: 'ASC' }], true);
        AppState.clients = r.data.map(rec => ({ id: rec[f.recordId].value, name: rec[f.companyName]?.value || 'Unnamed', ycrmId: rec[f.ycrmId]?.value || '' }));
        renderClientList();
    } catch (e) { console.error('Load clients failed:', e); AppState.clients = []; renderClientList(); }
}

function renderClientList() {
    const c = document.getElementById('client-list');
    if (!AppState.clients.length) { c.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">No clients found</div>'; return; }
    c.innerHTML = AppState.clients.map(cl => `<div class="client-item ${AppState.selectedClient?.id===cl.id?'selected':''}" onclick="selectClient(${cl.id})"><div class="client-item-name">${cl.name}</div>${cl.ycrmId?`<div class="client-item-id">yCRM: ${cl.ycrmId}</div>`:''}</div>`).join('');
}

function filterClients() {
    const s = document.getElementById('client-search-input').value.toLowerCase();
    document.querySelectorAll('.client-item').forEach(i => { i.style.display = i.querySelector('.client-item-name').textContent.toLowerCase().includes(s) ? 'block' : 'none'; });
}

function selectClient(id) {
    AppState.selectedClient = AppState.clients.find(c => c.id === id);
    document.getElementById('selected-client-name').textContent = AppState.selectedClient?.name || 'Select a client...';
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
        const f = CONFIG.fields.properties;
        const r = await queryRecords(CONFIG.tables.properties, [f.recordId, f.propertyName, f.propertyStreet1, f.propertyCity, f.propertyState, f.propertyPostalCode], null, [{ fieldId: f.propertyName, order: 'ASC' }]);
        AppState.properties = r.data.map(rec => ({ id: rec[f.recordId].value, name: rec[f.propertyName]?.value || 'Unnamed', street: rec[f.propertyStreet1]?.value || '', city: rec[f.propertyCity]?.value || '', state: rec[f.propertyState]?.value || '', postal: rec[f.propertyPostalCode]?.value || '' }));
        renderPropertyList();
    } catch (e) { console.error('Load properties failed:', e); document.getElementById('property-list').innerHTML = '<div class="empty-state"><p class="empty-state-text">No properties found</p></div>'; }
}

function renderPropertyList() {
    const c = document.getElementById('property-list');
    if (!AppState.properties.length) { c.innerHTML = '<div class="empty-state"><p class="empty-state-text">No properties found</p></div>'; return; }
    c.innerHTML = AppState.properties.map(p => `<div class="property-item ${AppState.selectedProperty?.id===p.id?'selected':''}" onclick="selectProperty(${p.id})"><div class="property-info"><div class="property-name-display">${p.name}</div><div class="property-address">${[p.street,p.city,p.state,p.postal].filter(Boolean).join(', ')||'No address'}</div></div><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--lcp-blue);opacity:${AppState.selectedProperty?.id===p.id?'1':'0'}"><polyline points="20 6 9 17 4 12"/></svg></div>`).join('');
}

function filterProperties() {
    const s = document.getElementById('property-search-input').value.toLowerCase();
    document.querySelectorAll('.property-item').forEach(i => { const n = i.querySelector('.property-name-display').textContent.toLowerCase(); const a = i.querySelector('.property-address').textContent.toLowerCase(); i.style.display = (n.includes(s)||a.includes(s)) ? 'flex' : 'none'; });
}

function selectProperty(id) {
    AppState.selectedProperty = AppState.properties.find(p => p.id === id);
    renderPropertyList();
    updateSelectedPropertyDisplay();
    closeModal('property-modal');
}

function updateSelectedPropertyDisplay() {
    const c = document.getElementById('selected-property-display');
    if (!AppState.selectedProperty) { c.innerHTML = '<div class="empty-state"><svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><p class="empty-state-text">No property selected</p></div>'; return; }
    const p = AppState.selectedProperty;
    c.innerHTML = `<div class="property-item selected" style="cursor:default"><div class="property-info"><div class="property-name-display">${p.name}</div><div class="property-address">${[p.street,p.city,p.state,p.postal].filter(Boolean).join(', ')||'No address'}</div></div><button class="btn btn-ghost btn-sm" onclick="clearSelectedProperty()" title="Remove"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>`;
}

function clearSelectedProperty() { AppState.selectedProperty = null; updateSelectedPropertyDisplay(); renderPropertyList(); }

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

function renderProductGrid() {
    const c = document.getElementById('product-grid');
    if (!AppState.products.length) { c.innerHTML = '<div class="empty-state"><p class="empty-state-text">No products available</p></div>'; return; }
    c.innerHTML = AppState.products.map(p => `<div class="product-card ${AppState.selectedProduct?.id===p.id?'selected':''}" onclick="selectProduct(${p.id})"><div class="product-name">${p.name}</div><div class="product-description">Code: ${p.code} · ${p.unit} · ${p.frequency}</div><div class="product-price">${formatCurrency(p.price)}</div>${p.assetType?`<div class="product-meta"><span class="badge-type ${p.assetType.toLowerCase().replace(/\s+/g,'-')}">${p.assetType}</span></div>`:''}</div>`).join('');
}

function filterProducts() {
    const s = document.getElementById('product-search-input').value.toLowerCase();
    document.querySelectorAll('.product-card').forEach(c => { const n = c.querySelector('.product-name').textContent.toLowerCase(); const d = c.querySelector('.product-description').textContent.toLowerCase(); c.style.display = (n.includes(s)||d.includes(s)) ? 'block' : 'none'; });
}

function selectProduct(id) { AppState.selectedProduct = AppState.products.find(p => p.id === id); renderProductGrid(); }

function openProductSelector(cb) {
    AppState.currentProductCallback = cb;
    AppState.selectedProduct = null;
    renderProductGrid();
    document.getElementById('product-search-input').value = '';
    openModal('product-modal');
}

function confirmProductSelection() {
    if (!AppState.selectedProduct) { alert('Please select a product'); return; }
    if (AppState.currentProductCallback) AppState.currentProductCallback(AppState.selectedProduct);
    closeModal('product-modal');
    AppState.selectedProduct = null;
    AppState.currentProductCallback = null;
}

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
// LINE ITEMS
// ============================================================================

let orderLineCounter = 0, quoteLineCounter = 0;

function addOrderLineItem() {
    orderLineCounter++;
    AppState.orderLineItems.push({ id: orderLineCounter, productId: null, productName: '', quantity: 1, unitPrice: 0, total: 0 });
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

function addQuoteLineItem() {
    quoteLineCounter++;
    AppState.quoteLineItems.push({ id: quoteLineCounter, productId: null, productName: '', quantity: 1, unitPrice: 0, total: 0 });
    renderQuoteLineItems();
}

function renderQuoteLineItems() {
    const c = document.getElementById('quote-line-items');
    if (!AppState.quoteLineItems.length) { c.innerHTML = '<div class="empty-state" style="padding:40px 20px"><p class="empty-state-text">No products added yet</p></div>'; return; }
    c.innerHTML = AppState.quoteLineItems.map(i => `<div class="line-item"><div class="form-group"><button type="button" class="btn btn-secondary" style="width:100%;justify-content:flex-start" onclick="selectProductForQuoteLine(${i.id})">${i.productName||'Select Product...'}</button></div><div class="form-group"><input type="number" class="form-input" value="${i.quantity}" min="1" onchange="updateQuoteLineQty(${i.id},this.value)"></div><div class="form-group"><input type="text" class="form-input" value="${formatCurrency(i.unitPrice)}" readonly style="background:var(--bg-hover);cursor:not-allowed"></div><div class="form-group"><input type="text" class="form-input" value="${formatCurrency(i.total)}" readonly style="background:var(--bg-hover);cursor:not-allowed;font-weight:600;color:var(--lcp-blue)"></div><button type="button" class="remove-btn" onclick="removeQuoteLineItem(${i.id})"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></div>`).join('');
}

function selectProductForQuoteLine(id) {
    openProductSelector(p => {
        const i = AppState.quoteLineItems.find(x => x.id === id);
        if (i) { i.productId = p.id; i.productName = p.name; i.unitPrice = p.price; i.total = i.quantity * p.price; renderQuoteLineItems(); }
    });
}

function updateQuoteLineQty(id, qty) {
    const i = AppState.quoteLineItems.find(x => x.id === id);
    if (i) { i.quantity = parseInt(qty) || 1; i.total = i.quantity * i.unitPrice; renderQuoteLineItems(); }
}

function removeQuoteLineItem(id) { AppState.quoteLineItems = AppState.quoteLineItems.filter(x => x.id !== id); renderQuoteLineItems(); }

// ============================================================================
// SAVE OPERATIONS
// ============================================================================

async function saveOrder() {
    const email = document.getElementById('order-sales-email').value.trim();
    const notes = getRichTextContent('order-notes-editor');
    if (!email) { alert('Sales rep email required'); return; }
    if (!AppState.selectedClient) { alert('Please select a client'); return; }
    
    try {
        const f = CONFIG.fields.orders;
        const data = { [f.salesRepEmail]: { value: email }, [f.quoteDate]: { value: getTodayISO() }, [f.expirationDate]: { value: getExpirationDate(30) }, [f.orderStatus]: { value: 'Draft' }, [f.historyNotes]: { value: notes }, [f.relatedCompany]: { value: AppState.selectedClient.id } };
        const r = await createRecord(CONFIG.tables.orders, data);
        if (r.data?.[0]) {
            const orderId = r.data[0][f.recordId].value;
            for (const li of AppState.orderLineItems) {
                if (li.productId) {
                    const lf = CONFIG.fields.orderLineItems;
                    await createRecord(CONFIG.tables.orderLineItems, { [lf.relatedOrder]: { value: orderId }, [lf.description]: { value: li.productName }, [lf.quantity]: { value: li.quantity }, [lf.total]: { value: li.total } });
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
    
    try {
        const f = CONFIG.fields.quotes3D;
        const data = { [f.quoteName]: { value: name }, [f.salesRepEmail]: { value: email }, [f.quoteDate]: { value: getTodayISO() }, [f.expirationDate]: { value: getExpirationDate(30) }, [f.quoteStatus]: { value: document.getElementById('quote-status').value }, [f.historyNotes]: { value: document.getElementById('quote-notes').value } };
        const r = await createRecord(CONFIG.tables.quotes3D, data);
        if (r.data?.[0]) {
            const quoteId = r.data[0][f.recordId].value;
            for (const li of AppState.quoteLineItems) {
                if (li.productId) {
                    const lf = CONFIG.fields.lineItems3D;
                    await createRecord(CONFIG.tables.lineItems3D, { [lf.relatedQuote]: { value: quoteId }, [lf.description]: { value: li.productName }, [lf.quantity]: { value: li.quantity }, [lf.total]: { value: li.total } });
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
    AppState.orderLineItems = []; AppState.selectedProperty = null; AppState.selectedClient = null; orderLineCounter = 0;
    document.getElementById('selected-client-name').textContent = 'Select a client...';
    document.getElementById('order-company-id').value = '';
    renderOrderLineItems(); updateSelectedPropertyDisplay(); renderClientList();
}

function resetQuoteForm() {
    document.getElementById('quote-form').reset();
    AppState.quoteLineItems = []; quoteLineCounter = 0;
    renderQuoteLineItems();
}

function viewOrder(id) { window.open(`https://${CONFIG.getRealmHostname()}/db/${CONFIG.tables.orders}?a=dr&rid=${id}`, '_blank'); }
function viewQuote(id) { window.open(`https://${CONFIG.getRealmHostname()}/db/${CONFIG.tables.quotes3D}?a=dr&rid=${id}`, '_blank'); }
