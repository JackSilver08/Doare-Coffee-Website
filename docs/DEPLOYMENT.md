# Deployment

## 1. Push source to GitHub

```powershell
git branch -M main
git add .
git commit -m "Build Doare Coffee storefront MVP"
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin main
```

The files use relative URLs and include `.nojekyll`, so the storefront can also be previewed with GitHub Pages from the repository root. For a real commercial store, use Cloudflare Pages as the production host and keep GitHub as the source repository.

## 2. Deploy the static site to Cloudflare Pages

1. In Cloudflare, create a Pages project and connect the GitHub repository.
2. Select the `main` branch.
3. Framework preset: `None`.
4. Build command: leave empty.
5. Build output directory: `/`.
6. Deploy, then attach the custom domain.

Each push to `main` will deploy the static site automatically.

For the current production domain:

1. Add `doraecoffee.io.vn` to Cloudflare as a zone.
2. At the domain registrar, replace the current nameservers with the two
   nameservers assigned by Cloudflare.
3. In Workers & Pages, open the `doare-coffee` Pages project.
4. Open Custom domains, select Set up a domain, and add `doraecoffee.io.vn`.
5. Add `www.doraecoffee.io.vn` as a second custom domain, then redirect it to
   `https://doraecoffee.io.vn` with a Cloudflare Redirect Rule.

Use `doraecoffee.io.vn` for the storefront. Do not attach the apex domain to the
`doare-coffee-api` Worker, because that Worker only serves the JSON API.

## 3. Create D1 and deploy the Worker

Install Worker dependencies:

```powershell
cd worker
npm install
```

Authenticate and create the database:

```powershell
npx wrangler login
npx wrangler d1 create doare-coffee
```

Copy `wrangler.toml.example` to `wrangler.toml`, insert the returned database ID, real domain and bank details.

Create tables and seed products:

```powershell
npx wrangler d1 execute doare-coffee --remote --file=schema.sql
npx wrangler d1 execute doare-coffee --remote --file=seed.sql
npx wrangler deploy
```

Test:

```text
https://YOUR-WORKER.workers.dev/api/health
https://YOUR-WORKER.workers.dev/api/products
```

## 4. Connect the frontend

Edit `assets/js/config.js`:

```js
API_BASE_URL: "https://YOUR-WORKER.workers.dev"
```

For the current deployment this is:

```text
https://doare-coffee-api.trannntunnn.workers.dev
```

The admin page uses a D1-backed login and stores a 30-day session token in the browser. The initial account is seeded by `worker/seed-admin.sql`; change the default password before handing the store to production staff. `ADMIN_API_KEY` remains an ignored emergency credential rather than the normal login method.

Commit and push. Confirm a real order appears in D1:

```powershell
npx wrangler d1 execute doare-coffee --remote --command "SELECT * FROM orders ORDER BY created_at DESC LIMIT 5"
```

## 5. Enable contact email delivery

Contact messages are always stored in the D1 `contact_messages` table. To also
send each message to `huyntttb01626@gmail.com`:

1. In Cloudflare, open **Compute > Email Service > Email Sending**.
2. Onboard `doraecoffee.io.vn` and finish the DNS verification shown there.
3. Add this binding to `worker/wrangler.toml`:

```toml
[[send_email]]
name = "EMAIL"
```

4. Deploy the Worker again:

```powershell
cd worker
npx wrangler deploy
```

The sender is `contact@doraecoffee.io.vn`, while replies are directed to the
email address entered by the visitor.

## 6. Required production configuration

- Replace all placeholder bank, email, phone and address data.
- Restrict `ALLOWED_ORIGINS` to the production and preview domains.
- Add Turnstile or equivalent bot checks before order creation.
- Set rate limits for order and subscriber endpoints.
- Protect admin with Cloudflare Access.
- Configure database backup/export.
- Add a signed payment webhook before claiming automatic confirmation.
- Test COD, transfer, cancellation, refunds and duplicate webhook events.

## GitHub Pages note

GitHub Pages is useful for a non-transactional preview. GitHub states that Pages is not intended as free hosting for an online business whose primary purpose is commercial transactions. Cloudflare Pages connected to GitHub gives the same push-to-deploy workflow without relying on Pages for production commerce.
