// LCP Sales Portal - Main Application Logic
// CRITICAL: buildDashboard must be synchronous

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const AppState = {
    selectedProperty: null,
    selectedProduct: null,
    currentProductCallback: null,
    orderLineItems: [],
    quoteLineItems: [],
    products: [],
    properties: [],
    orders: [],
    quotes: []
};

// ============================================================================
// INITIALIZATION - Must be synchronous
// ============================================================================

function buildDashboard() {
    // Set default dates
    document.getElementById('order-quote-date').value = getTodayISO();
    document.getElementById('order-expiration-date').value = getExpirationDate(30);
    document.getElementById('quote-date').value = getTodayISO();
    document.getElementById('quote-expiration-date').value = getExpirationDate(30);
    
    // Update version display
    document.getElementById('app-version').textContent = CONFIG.version;
    
    // Setup form handlers
    setupFormHandlers();
    
    // Load initial data (async but don't await)
    loadProperties();
    loadProducts();
    
    // Check for version updates
    checkVersion();
    
    console.log('LCP Sales Portal initialized');
}

function setupFormHandlers() {
    // Order form submission
    document.getElementById('order-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveOrder();
    });
    
    // Quote form submission
    document.getElementById('quote-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveQuote();
    });
}

// Run on page load
document.addEventListener('DOMContentLoaded', buildDashboard);

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadProperties() {
    try {
        const fields = CONFIG.fields.properties;
        const response = await queryRecords(
            CONFIG.tables.properties,
            [fields.recordId, fields.propertyName, fields.propertyStreet1, fields.propertyCity, fields.propertyState, fields.propertyPostalCode],
            null,
            [{ fieldId: fields.propertyName, order: 'ASC' }]
        );
        
        AppState.properties = response.data.map(record => ({
            id: record[fields.recordId].value,
            name: record[fields.propertyName]?.value || 'Unnamed Property',
            street: record[fields.propertyStreet1]?.value || '',
            city: record[fields.propertyCity]?.value || '',
            state: record[fields.propertyState]?.value || '',
            postal: record[fields.propertyPostalCode]?.value || ''
        }));
        
        renderPropertyList();
    } catch (error) {
        console.error('Failed to load properties:', error);
        document.getElementById('property-list').innerHTML = `
            <div class="empty-state">
                <p class="empty-state-text">No properties found. Add a new property to get started.</p>
            </div>
        `;
    }
}

async function loadProducts() {
    // For now, we'll use the Yardi Codes table for Order line items
    // and Products table for 3D Quote line items
    // Since we don't have direct access, we'll create placeholder data
    // This should be replaced with actual API calls when tokens are configured
    
    AppState.products = [
        { id: 1, name: '3D Virtual Tour - Basic', description: 'Standard 3D tour package', price: 299.00 },
        { id: 2, name: '3D Virtual Tour - Premium', description: 'Premium tour with HDR photography', price: 499.00 },
        { id: 3, name: '3D Virtual Tour - Enterprise', description: 'Full enterprise package with analytics', price: 999.00 },
        { id: 4, name: 'Floor Plan - 2D', description: 'Professional 2D floor plan', price: 149.00 },
        { id: 5, name: 'Floor Plan - 3D', description: '3D rendered floor plan', price: 249.00 },
        { id: 6, name: 'Drone Photography', description: 'Aerial photography package', price: 399.00 },
        { id: 7, name: 'Video Walkthrough', description: 'Professional video tour', price: 599.00 },
        { id: 8, name: 'Virtual Staging', description: 'AI-powered virtual staging per room', price: 79.00 }
    ];
    
    renderProductGrid();
}

async function loadOrderHistory() {
    const container = document.getElementById('order-history-table');
    showLoading(container);
    
    try {
        const fields = CONFIG.fields.orders;
        const response = await queryRecords(
            CONFIG.tables.orders,
            [fields.recordId, fields.orderName, fields.orderStatus, fields.quoteDate, fields.salesRepEmail, fields.companyName],
            null,
            [{ fieldId: fields.dateModified, order: 'DESC' }]
        );
        
        AppState.orders = response.data;
        
        if (AppState.orders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <p class="empty-state-title">No orders yet</p>
                    <p class="empty-state-text">Create your first order to get started</p>
                    <button class="btn btn-primary" onclick="switchTab('tab-new-order')">Create Order</button>
                </div>
            `;
            return;
        }
        
        // Update stats
        document.getElementById('stat-total-orders').textContent = AppState.orders.length;
        document.getElementById('stat-pending-orders').textContent = AppState.orders.filter(o => 
            o[fields.orderStatus]?.value === 'Pending' || o[fields.orderStatus]?.value === 'Processing'
        ).length;
        document.getElementById('stat-completed-orders').textContent = AppState.orders.filter(o => 
            o[fields.orderStatus]?.value === 'Completed'
        ).length;
        
        // Render table
        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Order Name</th>
                        <th>Company</th>
                        <th>Status</th>
                        <th>Quote Date</th>
                        <th>Sales Rep</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${AppState.orders.map(order => `
                        <tr>
                            <td>${order[fields.orderName]?.value || '—'}</td>
                            <td>${order[fields.companyName]?.value || '—'}</td>
                            <td><span class="badge badge-${getStatusClass(order[fields.orderStatus]?.value)}">${order[fields.orderStatus]?.value || 'Draft'}</span></td>
                            <td>${formatDate(order[fields.quoteDate]?.value)}</td>
                            <td>${order[fields.salesRepEmail]?.value || '—'}</td>
                            <td class="actions">
                                <button class="btn btn-ghost btn-sm" onclick="viewOrder(${order[fields.recordId].value})" title="View">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                        <circle cx="12" cy="12" r="3"/>
                                    </svg>
                                </button>
                                <button class="btn btn-ghost btn-sm" onclick="duplicateOrder(${order[fields.recordId].value})" title="Duplicate">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                    </svg>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        showError(container, 'Failed to load order history. Please try again.');
        console.error('Error loading orders:', error);
    }
}

async function loadQuoteHistory() {
    const container = document.getElementById('quote-history-table');
    showLoading(container);
    
    try {
        const fields = CONFIG.fields.quotes3D;
        const response = await queryRecords(
            CONFIG.tables.quotes3D,
            [fields.recordId, fields.quoteName, fields.quoteStatus, fields.quoteDate, fields.salesRepEmail, fields.companyName],
            null,
            [{ fieldId: fields.dateModified, order: 'DESC' }]
        );
        
        AppState.quotes = response.data;
        
        if (AppState.quotes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    </svg>
                    <p class="empty-state-title">No 3D quotes yet</p>
                    <p class="empty-state-text">Create your first 3D quote to get started</p>
                    <button class="btn btn-primary" onclick="switchTab('tab-new-quote')">Create 3D Quote</button>
                </div>
            `;
            return;
        }
        
        // Update stats
        document.getElementById('stat-total-quotes').textContent = AppState.quotes.length;
        document.getElementById('stat-pending-quotes').textContent = AppState.quotes.filter(q => 
            q[fields.quoteStatus]?.value === 'Pending Review' || q[fields.quoteStatus]?.value === 'Sent to Client'
        ).length;
        document.getElementById('stat-approved-quotes').textContent = AppState.quotes.filter(q => 
            q[fields.quoteStatus]?.value === 'Approved'
        ).length;
        
        // Render table
        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Quote Name</th>
                        <th>Company</th>
                        <th>Status</th>
                        <th>Quote Date</th>
                        <th>Sales Rep</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${AppState.quotes.map(quote => `
                        <tr>
                            <td>${quote[fields.quoteName]?.value || '—'}</td>
                            <td>${quote[fields.companyName]?.value || '—'}</td>
                            <td><span class="badge badge-${getStatusClass(quote[fields.quoteStatus]?.value)}">${quote[fields.quoteStatus]?.value || 'Draft'}</span></td>
                            <td>${formatDate(quote[fields.quoteDate]?.value)}</td>
                            <td>${quote[fields.salesRepEmail]?.value || '—'}</td>
                            <td class="actions">
                                <button class="btn btn-ghost btn-sm" onclick="viewQuote(${quote[fields.recordId].value})" title="View">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                        <circle cx="12" cy="12" r="3"/>
                                    </svg>
                                </button>
                                <button class="btn btn-ghost btn-sm" onclick="duplicateQuote(${quote[fields.recordId].value})" title="Duplicate">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                    </svg>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        showError(container, 'Failed to load quote history. Please try again.');
        console.error('Error loading quotes:', error);
    }
}

function getStatusClass(status) {
    if (!status) return 'draft';
    const s = status.toLowerCase();
    if (s.includes('pending') || s.includes('processing') || s.includes('review') || s.includes('sent')) return 'pending';
    if (s.includes('completed') || s.includes('approved')) return 'approved';
    if (s.includes('rejected') || s.includes('cancelled') || s.includes('expired')) return 'rejected';
    return 'draft';
}

// ============================================================================
// PROPERTY MANAGEMENT
// ============================================================================

function renderPropertyList() {
    const container = document.getElementById('property-list');
    
    if (AppState.properties.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p class="empty-state-text">No properties found. Add a new property to get started.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = AppState.properties.map(prop => `
        <div class="property-item ${AppState.selectedProperty?.id === prop.id ? 'selected' : ''}" 
             onclick="selectProperty(${prop.id})" data-property-id="${prop.id}">
            <div class="property-info">
                <div class="property-name-display">${prop.name}</div>
                <div class="property-address">${[prop.street, prop.city, prop.state, prop.postal].filter(Boolean).join(', ') || 'No address'}</div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--lcp-blue); opacity: ${AppState.selectedProperty?.id === prop.id ? '1' : '0'};">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
        </div>
    `).join('');
}

function filterProperties() {
    const search = document.getElementById('property-search-input').value.toLowerCase();
    const items = document.querySelectorAll('.property-item');
    
    items.forEach(item => {
        const name = item.querySelector('.property-name-display').textContent.toLowerCase();
        const address = item.querySelector('.property-address').textContent.toLowerCase();
        const matches = name.includes(search) || address.includes(search);
        item.style.display = matches ? 'flex' : 'none';
    });
}

function selectProperty(propertyId) {
    AppState.selectedProperty = AppState.properties.find(p => p.id === propertyId);
    renderPropertyList();
    updateSelectedPropertyDisplay();
    closeModal('property-modal');
}

function updateSelectedPropertyDisplay() {
    const container = document.getElementById('selected-property-display');
    
    if (!AppState.selectedProperty) {
        container.innerHTML = `
            <div class="empty-state">
                <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                <p class="empty-state-text">No property selected</p>
            </div>
        `;
        return;
    }
    
    const prop = AppState.selectedProperty;
    container.innerHTML = `
        <div class="property-item selected" style="cursor: default;">
            <div class="property-info">
                <div class="property-name-display">${prop.name}</div>
                <div class="property-address">${[prop.street, prop.city, prop.state, prop.postal].filter(Boolean).join(', ') || 'No address'}</div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="clearSelectedProperty()" title="Remove">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
    `;
}

function clearSelectedProperty() {
    AppState.selectedProperty = null;
    updateSelectedPropertyDisplay();
    renderPropertyList();
}

async function saveNewProperty() {
    const name = document.getElementById('new-property-name').value.trim();
    if (!name) {
        alert('Property name is required');
        return;
    }
    
    // For now, add to local state (in production, this would save to QB)
    const newProperty = {
        id: Date.now(), // Temporary ID
        name: name,
        street: document.getElementById('new-property-street').value.trim(),
        city: document.getElementById('new-property-city').value.trim(),
        state: document.getElementById('new-property-state').value.trim(),
        postal: document.getElementById('new-property-postal').value.trim()
    };
    
    AppState.properties.unshift(newProperty);
    renderPropertyList();
    
    // Select the new property
    selectProperty(newProperty.id);
    
    // Clear and close modal
    document.getElementById('new-property-name').value = '';
    document.getElementById('new-property-street').value = '';
    document.getElementById('new-property-city').value = '';
    document.getElementById('new-property-state').value = '';
    document.getElementById('new-property-postal').value = '';
    closeModal('add-property-modal');
    
    showSuccess('Property added successfully');
}

// ============================================================================
// PRODUCT MANAGEMENT
// ============================================================================

function renderProductGrid() {
    const container = document.getElementById('product-grid');
    
    if (AppState.products.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p class="empty-state-text">No products available</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = AppState.products.map(product => `
        <div class="product-card ${AppState.selectedProduct?.id === product.id ? 'selected' : ''}" 
             onclick="selectProduct(${product.id})" data-product-id="${product.id}">
            <div class="product-name">${product.name}</div>
            <div class="product-description">${product.description}</div>
            <div class="product-price">${formatCurrency(product.price)}</div>
        </div>
    `).join('');
}

function filterProducts() {
    const search = document.getElementById('product-search-input').value.toLowerCase();
    const cards = document.querySelectorAll('.product-card');
    
    cards.forEach(card => {
        const name = card.querySelector('.product-name').textContent.toLowerCase();
        const desc = card.querySelector('.product-description').textContent.toLowerCase();
        const matches = name.includes(search) || desc.includes(search);
        card.style.display = matches ? 'block' : 'none';
    });
}

function selectProduct(productId) {
    AppState.selectedProduct = AppState.products.find(p => p.id === productId);
    renderProductGrid();
}

function openProductSelector(callback) {
    AppState.currentProductCallback = callback;
    AppState.selectedProduct = null;
    renderProductGrid();
    document.getElementById('product-search-input').value = '';
    openModal('product-modal');
}

function confirmProductSelection() {
    if (!AppState.selectedProduct) {
        alert('Please select a product');
        return;
    }
    
    if (AppState.currentProductCallback) {
        AppState.currentProductCallback(AppState.selectedProduct);
    }
    
    closeModal('product-modal');
    AppState.selectedProduct = null;
    AppState.currentProductCallback = null;
}

// ============================================================================
// ORDER LINE ITEMS
// ============================================================================

let orderLineItemCounter = 0;

function addOrderLineItem() {
    orderLineItemCounter++;
    const id = orderLineItemCounter;
    
    const lineItem = {
        id: id,
        productId: null,
        productName: '',
        quantity: 1,
        unitPrice: 0,
        total: 0
    };
    
    AppState.orderLineItems.push(lineItem);
    renderOrderLineItems();
}

function renderOrderLineItems() {
    const container = document.getElementById('order-line-items');
    
    if (AppState.orderLineItems.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 40px 20px;">
                <p class="empty-state-text">No line items added yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = AppState.orderLineItems.map(item => `
        <div class="line-item" data-line-item-id="${item.id}">
            <div class="form-group">
                <label class="form-label" style="display: none;">Product</label>
                <button type="button" class="btn btn-secondary" style="width: 100%; justify-content: flex-start;" 
                        onclick="selectProductForOrderLine(${item.id})">
                    ${item.productName || 'Select Product...'}
                </button>
            </div>
            <div class="form-group">
                <label class="form-label" style="display: none;">Qty</label>
                <input type="number" class="form-input" value="${item.quantity}" min="1" 
                       onchange="updateOrderLineQuantity(${item.id}, this.value)">
            </div>
            <div class="form-group">
                <label class="form-label" style="display: none;">Unit Price</label>
                <input type="text" class="form-input" value="${formatCurrency(item.unitPrice)}" readonly 
                       style="background: var(--dark-border); cursor: not-allowed;">
            </div>
            <div class="form-group">
                <label class="form-label" style="display: none;">Total</label>
                <input type="text" class="form-input" value="${formatCurrency(item.total)}" readonly 
                       style="background: var(--dark-border); cursor: not-allowed; font-weight: 600; color: var(--lcp-blue);">
            </div>
            <button type="button" class="remove-btn" onclick="removeOrderLineItem(${item.id})" title="Remove">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
            </button>
        </div>
    `).join('');
}

function selectProductForOrderLine(lineItemId) {
    openProductSelector(function(product) {
        const item = AppState.orderLineItems.find(li => li.id === lineItemId);
        if (item) {
            item.productId = product.id;
            item.productName = product.name;
            item.unitPrice = product.price;
            item.total = item.quantity * product.price;
            renderOrderLineItems();
        }
    });
}

function updateOrderLineQuantity(lineItemId, quantity) {
    const item = AppState.orderLineItems.find(li => li.id === lineItemId);
    if (item) {
        item.quantity = parseInt(quantity) || 1;
        item.total = item.quantity * item.unitPrice;
        renderOrderLineItems();
    }
}

function removeOrderLineItem(lineItemId) {
    AppState.orderLineItems = AppState.orderLineItems.filter(li => li.id !== lineItemId);
    renderOrderLineItems();
}

// ============================================================================
// QUOTE LINE ITEMS (3D)
// ============================================================================

let quoteLineItemCounter = 0;

function addQuoteLineItem() {
    quoteLineItemCounter++;
    const id = quoteLineItemCounter;
    
    const lineItem = {
        id: id,
        productId: null,
        productName: '',
        quantity: 1,
        unitPrice: 0,
        total: 0
    };
    
    AppState.quoteLineItems.push(lineItem);
    renderQuoteLineItems();
}

function renderQuoteLineItems() {
    const container = document.getElementById('quote-line-items');
    
    if (AppState.quoteLineItems.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 40px 20px;">
                <p class="empty-state-text">No products added yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = AppState.quoteLineItems.map(item => `
        <div class="line-item" data-line-item-id="${item.id}">
            <div class="form-group">
                <label class="form-label" style="display: none;">Product</label>
                <button type="button" class="btn btn-secondary" style="width: 100%; justify-content: flex-start;" 
                        onclick="selectProductForQuoteLine(${item.id})">
                    ${item.productName || 'Select Product...'}
                </button>
            </div>
            <div class="form-group">
                <label class="form-label" style="display: none;">Qty</label>
                <input type="number" class="form-input" value="${item.quantity}" min="1" 
                       onchange="updateQuoteLineQuantity(${item.id}, this.value)">
            </div>
            <div class="form-group">
                <label class="form-label" style="display: none;">Unit Price</label>
                <input type="text" class="form-input" value="${formatCurrency(item.unitPrice)}" readonly 
                       style="background: var(--dark-border); cursor: not-allowed;">
            </div>
            <div class="form-group">
                <label class="form-label" style="display: none;">Total</label>
                <input type="text" class="form-input" value="${formatCurrency(item.total)}" readonly 
                       style="background: var(--dark-border); cursor: not-allowed; font-weight: 600; color: var(--lcp-blue);">
            </div>
            <button type="button" class="remove-btn" onclick="removeQuoteLineItem(${item.id})" title="Remove">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
            </button>
        </div>
    `).join('');
}

function selectProductForQuoteLine(lineItemId) {
    openProductSelector(function(product) {
        const item = AppState.quoteLineItems.find(li => li.id === lineItemId);
        if (item) {
            item.productId = product.id;
            item.productName = product.name;
            item.unitPrice = product.price;
            item.total = item.quantity * product.price;
            renderQuoteLineItems();
        }
    });
}

function updateQuoteLineQuantity(lineItemId, quantity) {
    const item = AppState.quoteLineItems.find(li => li.id === lineItemId);
    if (item) {
        item.quantity = parseInt(quantity) || 1;
        item.total = item.quantity * item.unitPrice;
        renderQuoteLineItems();
    }
}

function removeQuoteLineItem(lineItemId) {
    AppState.quoteLineItems = AppState.quoteLineItems.filter(li => li.id !== lineItemId);
    renderQuoteLineItems();
}

// ============================================================================
// SAVE OPERATIONS
// ============================================================================

async function saveOrder() {
    const orderName = document.getElementById('order-name').value.trim();
    const salesEmail = document.getElementById('order-sales-email').value.trim();
    
    if (!orderName || !salesEmail) {
        alert('Order name and sales rep email are required');
        return;
    }
    
    try {
        const fields = CONFIG.fields.orders;
        const orderData = {
            [fields.orderName]: { value: orderName },
            [fields.salesRepEmail]: { value: salesEmail },
            [fields.quoteDate]: { value: document.getElementById('order-quote-date').value },
            [fields.expirationDate]: { value: document.getElementById('order-expiration-date').value },
            [fields.orderStatus]: { value: document.getElementById('order-status').value },
            [fields.historyNotes]: { value: document.getElementById('order-notes').value }
        };
        
        const response = await createRecord(CONFIG.tables.orders, orderData);
        
        if (response.data && response.data[0]) {
            const orderId = response.data[0][fields.recordId].value;
            
            // Save line items
            for (const lineItem of AppState.orderLineItems) {
                if (lineItem.productId) {
                    const lineFields = CONFIG.fields.orderLineItems;
                    await createRecord(CONFIG.tables.orderLineItems, {
                        [lineFields.relatedOrder]: { value: orderId },
                        [lineFields.description]: { value: lineItem.productName },
                        [lineFields.quantity]: { value: lineItem.quantity },
                        [lineFields.total]: { value: lineItem.total }
                    });
                }
            }
            
            showSuccess('Order saved successfully!');
            resetOrderForm();
            loadOrderHistory();
        }
    } catch (error) {
        console.error('Failed to save order:', error);
        alert('Failed to save order. Please try again.');
    }
}

async function saveQuote() {
    const quoteName = document.getElementById('quote-name').value.trim();
    const salesEmail = document.getElementById('quote-sales-email').value.trim();
    
    if (!quoteName || !salesEmail) {
        alert('Quote name and sales rep email are required');
        return;
    }
    
    try {
        const fields = CONFIG.fields.quotes3D;
        const quoteData = {
            [fields.quoteName]: { value: quoteName },
            [fields.salesRepEmail]: { value: salesEmail },
            [fields.quoteDate]: { value: document.getElementById('quote-date').value },
            [fields.expirationDate]: { value: document.getElementById('quote-expiration-date').value },
            [fields.quoteStatus]: { value: document.getElementById('quote-status').value },
            [fields.historyNotes]: { value: document.getElementById('quote-notes').value }
        };
        
        const response = await createRecord(CONFIG.tables.quotes3D, quoteData);
        
        if (response.data && response.data[0]) {
            const quoteId = response.data[0][fields.recordId].value;
            
            // Save line items
            for (const lineItem of AppState.quoteLineItems) {
                if (lineItem.productId) {
                    const lineFields = CONFIG.fields.lineItems3D;
                    await createRecord(CONFIG.tables.lineItems3D, {
                        [lineFields.relatedQuote]: { value: quoteId },
                        [lineFields.description]: { value: lineItem.productName },
                        [lineFields.quantity]: { value: lineItem.quantity },
                        [lineFields.total]: { value: lineItem.total }
                    });
                }
            }
            
            showSuccess('Quote saved successfully!');
            resetQuoteForm();
            loadQuoteHistory();
        }
    } catch (error) {
        console.error('Failed to save quote:', error);
        alert('Failed to save quote. Please try again.');
    }
}

// ============================================================================
// FORM RESET
// ============================================================================

function resetOrderForm() {
    document.getElementById('order-form').reset();
    document.getElementById('order-quote-date').value = getTodayISO();
    document.getElementById('order-expiration-date').value = getExpirationDate(30);
    AppState.orderLineItems = [];
    AppState.selectedProperty = null;
    orderLineItemCounter = 0;
    renderOrderLineItems();
    updateSelectedPropertyDisplay();
}

function resetQuoteForm() {
    document.getElementById('quote-form').reset();
    document.getElementById('quote-date').value = getTodayISO();
    document.getElementById('quote-expiration-date').value = getExpirationDate(30);
    AppState.quoteLineItems = [];
    quoteLineItemCounter = 0;
    renderQuoteLineItems();
}

// ============================================================================
// VIEW & DUPLICATE
// ============================================================================

async function viewOrder(orderId) {
    // For now, open in QuickBase
    const url = `https://${CONFIG.getRealmHostname()}/db/${CONFIG.tables.orders}?a=dr&rid=${orderId}`;
    window.open(url, '_blank');
}

async function duplicateOrder(orderId) {
    // TODO: Implement order duplication
    showSuccess('Duplicate functionality coming soon');
}

async function viewQuote(quoteId) {
    // For now, open in QuickBase
    const url = `https://${CONFIG.getRealmHostname()}/db/${CONFIG.tables.quotes3D}?a=dr&rid=${quoteId}`;
    window.open(url, '_blank');
}

async function duplicateQuote(quoteId) {
    // TODO: Implement quote duplication
    showSuccess('Duplicate functionality coming soon');
}
