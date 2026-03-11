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
