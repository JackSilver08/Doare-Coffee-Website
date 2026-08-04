# Analytics measurement plan

## Configuration

The production site currently uses direct GA4 with measurement ID
`G-W6TVPDJGFL`. Set exactly one ID in `assets/js/config.js`:

- `GTM_CONTAINER_ID`: preferred when Google Tag Manager manages GA4.
- `GA4_MEASUREMENT_ID`: direct Google tag fallback.

When both are set, only GTM loads. Until a valid ID is configured, no third-party
analytics script or consent banner is loaded, while application events remain
available in `window.dataLayer` for local validation.

## Consent and privacy

Analytics consent defaults to denied. The Google tag loads only after the visitor
accepts measurement. The application never includes customer name, phone, email,
postal address, contact-message text, or order notes in analytics events.

Consent is stored in `localStorage` under `doare_analytics_consent`.

## Events

| Event | Trigger | Main properties | Decision supported |
| --- | --- | --- | --- |
| `page_view` | Google tag page load | Standard GA4 page context | Traffic trend |
| `article_viewed` | Published article rendered | slug, title, published date | SEO content performance |
| `view_item_list` | Product catalog loaded | list and item data | Catalog discovery |
| `view_item` | Product detail rendered | item and value | Product interest |
| `add_to_cart` | Item added to cart | item, quantity, value | Purchase intent |
| `begin_checkout` | Checkout becomes visible | items and subtotal | Checkout funnel |
| `purchase` | Order API confirms creation | transaction ID, items, value, shipping | Revenue conversion |
| `generate_lead` | Contact API confirms submission | source and form location | Lead conversion |
| `social_link_clicked` | Floating social link clicked | platform and location | Social navigation |

`purchase` fires only after a successful API response and once per form submission.
GA4 should mark `purchase` and `generate_lead` as key events. Do not mark
`add_to_cart` or `begin_checkout` as conversions.

## Validation before relying on reports

1. Use GTM Preview or GA4 DebugView after setting the real ID.
2. Accept and decline consent in separate private-browser sessions.
3. Test home, catalog, product detail, article, contact, and one test order.
4. Confirm no duplicate `purchase` and that its value equals the confirmed order.
5. Repeat on mobile and a second browser.
6. Use lowercase UTM values, for example:
   `?utm_source=facebook&utm_medium=organic_social&utm_campaign=august_2026`.
