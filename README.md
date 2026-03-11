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

1. Enable GitHub Pages for this repo (Settings → Pages → Source: main branch)
2. In QuickBase, create a new Code Page in the app
3. Embed: `https://lcp-media-quickbase.github.io/lcp-sales-portal/`

## Development

Files:
- `index.html` - Main page structure and styles
- `config.js` - Table/field IDs and configuration
- `shared.js` - API utilities and shared functions
- `app.js` - Application logic
- `version.json` - Version tracking for auto-update notices

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
