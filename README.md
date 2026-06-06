# Doare Coffee Website

Static-first storefront for a real coffee business. The customer-facing site is plain HTML, CSS and JavaScript; dynamic commerce features are provided by a Cloudflare Worker and D1.

## Current MVP

- Responsive light-blue and white coffee landing page using the supplied brand assets
- Artistic single-product showcase for one ground-coffee SKU
- Persistent shopping cart using `localStorage`
- Checkout form with COD and bank-transfer choices
- Mock API mode that creates demo orders without a backend
- Demo admin dashboard at `/admin.html`
- Cloudflare Worker API, D1 schema and seed products
- Remembered admin login backed by hashed credentials and 30-day sessions
- Server-side price recalculation before an order is stored

## Run locally

```powershell
npm run dev
```

Open:

- Storefront: `http://localhost:8080`
- Admin demo: `http://localhost:8080/admin.html`

Run the lightweight project checks:

```powershell
npm run validate
```

## Project structure

```text
.
├── index.html                 Storefront
├── admin.html                 Admin demo
├── assets/
│   ├── css/                   Store and admin styles
│   ├── images/                Optimized project assets
│   └── js/
│       ├── config.js          Public frontend configuration
│       ├── catalog.js         Static fallback catalog
│       ├── api.js             API adapter and demo fallback
│       ├── app.js             Storefront behavior
│       └── admin.js           Demo dashboard behavior
├── worker/
│   ├── src/index.js           Serverless API
│   ├── schema.sql             D1 database schema
│   ├── seed.sql               Initial products
│   └── wrangler.toml.example  Worker configuration template
└── docs/
    ├── ARCHITECTURE.md
    └── DEPLOYMENT.md
```

## Demo mode

`assets/js/config.js` ships with an empty `API_BASE_URL`. The site therefore uses `catalog.js` and stores demo orders in the current browser.

The production Worker is deployed at:

```js
API_BASE_URL: "https://doare-coffee-api.trannntunnn.workers.dev"
```

The frontend now uses the live product and order APIs. Bank transfer remains disabled until real bank details are configured.

## Production status

The storefront and order API foundation are usable, but the following are required before accepting real payments:

- Protect admin routes with Cloudflare Access or another identity provider
- Build authenticated admin CRUD endpoints
- Connect a bank reconciliation provider and verify signed payment webhooks
- Add bot protection/rate limits to checkout
- Configure transactional order notifications
- Add store policies, legal business details and Ministry of Industry and Trade notification
- Replace placeholder contact and bank details

See [deployment instructions](docs/DEPLOYMENT.md) and [architecture notes](docs/ARCHITECTURE.md).

## Brand assets

The logo, decorative emblem and product packshots were extracted from the supplied product PDF and optimized for web delivery. The visual system uses light blue and white as the primary palette, with coffee brown and warm gold retained for contrast and product warmth.
