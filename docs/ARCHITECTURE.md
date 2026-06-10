# Architecture

## Production topology

```text
Customer browser
  |
  | HTTPS
  v
Cloudflare Pages
  |  HTML / CSS / JavaScript
  |
  | fetch()
  v
Cloudflare Worker API
  |-- validates requests
  |-- recalculates product prices
  |-- creates order IDs
  |-- creates COD orders
  |
  +--> Cloudflare D1
  |      products, orders, order_items, subscribers
  |
  +--> Email / Zalo provider
         order and status notifications
```

## Why static-first

The browser receives cacheable files, so the storefront is fast and inexpensive to host. JavaScript calls the Worker only for changing data. A backend outage therefore does not prevent customers from seeing the brand and catalog fallback, while checkout correctly reports an API failure.

## Trust boundaries

The browser is untrusted. It may suggest product IDs, quantities and customer details, but it cannot decide:

- final product price
- discount validity
- shipping fee
- stock changes
- order status
- payment status
- admin permissions

The Worker reads current products from D1 and calculates totals before writing an order. Payment may become `paid` only after a verified provider webhook or an authenticated admin action.

## Data model

- `products`: sellable catalog and current prices
- `orders`: customer, payment, fulfillment and totals
- `order_items`: immutable product name and price snapshot
- `subscribers`: newsletter opt-ins

Future tables should include `admins`, `audit_logs`, `inventory_events`, `promotions`, `payment_events` and `content_blocks`.

## Admin design

`admin.html` is currently a visual/demo shell. Production should:

1. Place `/admin*` behind Cloudflare Access.
2. Validate the Access JWT again inside the Worker.
3. Expose separate `/api/admin/*` endpoints.
4. Require explicit roles for price, payment and fulfillment changes.
5. Record every sensitive action in `audit_logs`.

Never store an admin password or secret API key in frontend JavaScript.

## Google Sheets

Google Sheets can remain useful as a report destination. It should not be the primary order database. A scheduled Worker or Apps Script can export aggregated orders to Sheets without giving the storefront write access to the sheet.

## Scaling path

D1 and Workers are adequate for an early store. If order volume or fulfillment complexity grows, the API adapter allows migration to another backend without rebuilding the storefront. Move inventory and payment processing first; static assets can remain on Pages.
