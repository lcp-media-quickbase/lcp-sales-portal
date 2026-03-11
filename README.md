# LCP Media Sales Portal

Custom QuickBase Code Page for the LCP Media sales team to create and manage orders and 3D quotes.

## Features

- **New Order** - Create orders with line items and property selection
- **Order History** - View, search, and duplicate previous orders
- **New 3D Quote** - Build 3D product quotes with line items
- **Quote History** - View, search, and duplicate previous quotes
- **Property Management** - Select existing or add new properties
- **Product Catalog** - Browse and select products for line items

## QuickBase App

- **App ID:** `bvvpht7z6`
- **Realm:** `lcp360-5583.quickbase.com`

## Tables

| Table | ID | Purpose |
|-------|----|---------| 
| Orders | `bvvpht73m` | Main orders |
| Order Line Items | `bvvpht749` | Order products |
| 3D Quotes | `bvvpht76j` | 3D quote requests |
| 3D Line Items | `bvvpht773` | 3D quote products |
| Properties | `bvvpht79i` | Property records |

## Installation

1. In QuickBase, go to your app → **Settings** → **Code Pages**
2. Create a new code page (type: **Exact Forms**)
3. Paste the contents of `QB_CODE_PAGE.html` into the code page editor
4. Save and access via the code page URL

## File Structure

```
lcp-sales-portal/
├── QB_CODE_PAGE.html      ← Paste this into QuickBase
├── README.md
└── codepages/
    ├── version.json       ← Version for CDN cache busting
    ├── shared.css         ← All styles
    ├── shared.js          ← Config + API utilities
    ├── app.js             ← Application logic
    └── dashboard.html     ← Main UI structure
```

## How It Works

The bootstrap loader in QB fetches versioned assets from jsDelivr CDN:
1. Reads `version.json` to get current version tag
2. Loads CSS, JS, HTML from `cdn.jsdelivr.net/gh/lcp-media-quickbase/lcp-sales-portal@{version}/codepages/`
3. Injects styles and scripts into the page
4. Runs `buildDashboard()` to initialize

## Versioning

To release a new version:
1. Update `codepages/version.json` with new version number
2. Create a git tag matching that version: `git tag 1.0.1 && git push --tags`
3. jsDelivr will cache the new version

### Critical Rules

1. `switchTab` must use inline `display:none/flex` styles, never CSS classes
2. Nav items in sidebar are `<a>` tags closed with `</a>`, never `</div>`
3. `buildDashboard` must be synchronous (async causes blank screen)
4. Never use broad `sed` on shared.js — use targeted string replacements
5. When layout breaks, diff HTML-generating functions first, not CSS

## Brand

- **Primary Color:** `#68B6E5` (LCP Blue)
- **Typography:** Inter (web), Aileron (print)
- **Style:** Dark theme, modern, exec-ready
