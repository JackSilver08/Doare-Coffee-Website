const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...jsonHeaders, ...extraHeaders }
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const githubPagesOrigin = /^https:\/\/[a-z0-9-]+\.github\.io$/i.test(origin);
  const cfPagesOrigin = /^https:\/\/[a-z0-9-]+\.doare-coffee\.pages\.dev$/i.test(origin);
  const headers = {
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Vary": "Origin"
  };
  if (allowed.includes(origin) || githubPagesOrigin || cfPagesOrigin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validImageUrl(value) {
  const url = cleanText(value, 400000);
  return url === "" ||
    url.startsWith("https://") ||
    url.startsWith("http://localhost") ||
    url.startsWith("assets/") ||
    /^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(url);
}

function cleanImageUrl(value) {
  const url = cleanText(value, 400000);
  if (!validImageUrl(url)) throw new Error("IMAGE_URL_INVALID");
  return url;
}

const PRODUCT_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};
const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

function slugValid(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function productImageUrl(env, request, key) {
  const base = cleanText(env.R2_PUBLIC_BASE_URL, 240).replace(/\/+$/, "");
  if (base) return `${base}/${key}`;
  return `${new URL(request.url).origin}/api/images/${key}`;
}

function makePostId() {
  return `BP${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
}

function makeOrderId() {
  const date = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `DR${date}${suffix}`;
}

function makeCustomerId() {
  return `CU${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function makeContactId() {
  return `CT${crypto.randomUUID().replaceAll("-", "").slice(0, 14).toUpperCase()}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map((byte) => Number.parseInt(byte, 16)));
}

async function sha256(value) {
  return bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function passwordHash(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations },
    key,
    256
  );
  return bytesToHex(bits);
}

async function getAdminSession(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice(7);
  if (!token) return null;
  const tokenHash = await sha256(token);
  return env.DB.prepare(
    `SELECT s.id AS session_id, u.id AS user_id, u.email, u.display_name
     FROM admin_sessions s
     JOIN admin_users u ON u.id = s.admin_user_id
     WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP AND u.active = 1`
  ).bind(tokenHash).first();
}

async function isAdmin(request, env) {
  const expected = cleanText(env.ADMIN_API_KEY, 300);
  if (expected && request.headers.get("Authorization") === `Bearer ${expected}`) return true;
  return Boolean(await getAdminSession(request, env));
}

function unauthorized(headers = {}) {
  return json({ message: "Không có quyền truy cập." }, 401, headers);
}

function mapProductsWithGallery(productRows, imageRows) {
  const galleries = new Map();
  for (const image of imageRows) {
    if (!galleries.has(image.product_id)) galleries.set(image.product_id, []);
    galleries.get(image.product_id).push(image);
  }
  return productRows.map((product) => ({
    ...product,
    notes: JSON.parse(product.notes || "[]"),
    gallery: galleries.get(product.id) || []
  }));
}

async function getProducts(env) {
  const [result, imageResult] = await env.DB.batch([
    env.DB.prepare(
      `SELECT id, name, subtitle, category, roast, notes, price, weight, accent, image, badge
       FROM products WHERE active = 1 AND deleted_at IS NULL ORDER BY sort_order ASC, created_at DESC`
    ),
    env.DB.prepare(
      `SELECT id, product_id, image_url, alt_text, sort_order
       FROM product_images WHERE active = 1 ORDER BY product_id, sort_order ASC, id ASC`
    )
  ]);
  return mapProductsWithGallery(result.results, imageResult.results);
}

async function getAdminProducts(env) {
  const [result, imageResult] = await env.DB.batch([
    env.DB.prepare(
      `SELECT id, name, subtitle, category, roast, notes, price, weight, accent, image, badge, active, sort_order
       FROM products WHERE deleted_at IS NULL ORDER BY sort_order ASC, created_at DESC`
    ),
    env.DB.prepare(
      `SELECT id, product_id, image_url, alt_text, sort_order, storage_key, mime_type, size_bytes
       FROM product_images WHERE active = 1 ORDER BY product_id, sort_order ASC, id ASC`
    )
  ]);
  return mapProductsWithGallery(result.results, imageResult.results);
}

async function findAdminProduct(env, id) {
  return (await getAdminProducts(env)).find((product) => product.id === id) || null;
}

async function getPublishedPosts(url, env) {
  const limit = Math.max(1, Math.min(500, Number.parseInt(url.searchParams.get("limit"), 10) || 6));
  if (url.searchParams.get("sitemap") === "1") {
    const result = await env.DB.prepare(
      `SELECT slug, published_at, created_at, updated_at
       FROM blog_posts
       WHERE status = 'published'
       ORDER BY COALESCE(published_at, created_at) DESC
       LIMIT ?`
    ).bind(limit).all();
    return result.results;
  }
  const result = await env.DB.prepare(
    `SELECT id, slug, title, excerpt, thumbnail_url,
            published_at, created_at, updated_at
     FROM blog_posts
     WHERE status = 'published'
     ORDER BY COALESCE(published_at, created_at) DESC
     LIMIT ?`
  ).bind(limit).all();
  return result.results;
}

async function getPublishedPost(slug, env) {
  return env.DB.prepare(
    `SELECT id, slug, title, excerpt, markdown, thumbnail_url, focus_keyword, seo_title, seo_description,
            published_at, created_at, updated_at
     FROM blog_posts WHERE slug = ? AND status = 'published'`
  ).bind(slug).first();
}

function mapPostsForList(rows) {
  return rows.map((post) => ({
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    thumbnail_url: post.thumbnail_url || "",
    status: post.status,
    published_at: post.published_at || null,
    created_at: post.created_at,
    updated_at: post.updated_at
  }));
}

async function getAdminPosts(env) {
  const result = await env.DB.prepare(
    `SELECT id, slug, title, excerpt, thumbnail_url, status, published_at, created_at, updated_at
     FROM blog_posts ORDER BY updated_at DESC`
  ).all();
  return mapPostsForList(result.results);
}

async function getAdminPost(id, env) {
  return env.DB.prepare(
    `SELECT id, slug, title, excerpt, markdown, thumbnail_url, status,
            focus_keyword, seo_title, seo_description, published_at, created_at, updated_at
     FROM blog_posts WHERE id = ?`
  ).bind(id).first();
}

function plainTextFromMarkdown(value) {
  return String(value || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function generatedExcerpt(excerpt, markdown) {
  const source = cleanText(excerpt, 360) || plainTextFromMarkdown(markdown);
  if (source.length <= 220) return source;
  return `${source.slice(0, 217).trimEnd()}...`;
}

function normalizePost(body) {
  const markdown = cleanText(body.markdown, 80000);
  const post = {
    title: cleanText(body.title, 180),
    slug: cleanText(body.slug, 120).toLowerCase(),
    excerpt: generatedExcerpt(body.excerpt, markdown),
    markdown,
    thumbnailUrl: cleanImageUrl(body.thumbnailUrl),
    focusKeyword: cleanText(body.focusKeyword, 120),
    seoTitle: cleanText(body.seoTitle, 180).replaceAll("%title%", cleanText(body.title, 180)),
    seoDescription: generatedExcerpt(body.seoDescription, markdown),
    status: body.status === "published" ? "published" : "draft"
  };
  if (!post.title || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)) {
    throw new Error("POST_INVALID");
  }
  return post;
}

async function createAdminPost(request, env) {
  const post = normalizePost(await request.json().catch(() => ({})));
  const id = makePostId();
  await env.DB.prepare(
    `INSERT INTO blog_posts
     (id, slug, title, excerpt, markdown, thumbnail_url, focus_keyword, seo_title, seo_description, status, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END)`
  ).bind(
    id, post.slug, post.title, post.excerpt, post.markdown, post.thumbnailUrl,
    post.focusKeyword, post.seoTitle, post.seoDescription, post.status, post.status
  ).run();
  return env.DB.prepare("SELECT * FROM blog_posts WHERE id = ?").bind(id).first();
}

async function updateAdminPost(request, id, env) {
  const post = normalizePost(await request.json().catch(() => ({})));
  const result = await env.DB.prepare(
    `UPDATE blog_posts SET
       slug = ?, title = ?, excerpt = ?, markdown = ?, thumbnail_url = ?,
       focus_keyword = ?, seo_title = ?, seo_description = ?, status = ?,
       published_at = CASE
         WHEN ? = 'published' AND published_at IS NULL THEN CURRENT_TIMESTAMP
         WHEN ? = 'draft' THEN NULL
         ELSE published_at
       END,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(
    post.slug, post.title, post.excerpt, post.markdown, post.thumbnailUrl,
    post.focusKeyword, post.seoTitle, post.seoDescription, post.status,
    post.status, post.status, id
  ).run();
  if (!result.meta.changes) return null;
  return env.DB.prepare("SELECT * FROM blog_posts WHERE id = ?").bind(id).first();
}

function normalizeProductBody(body) {
  const name = cleanText(body.name, 140);
  const subtitle = cleanText(body.subtitle, 220);
  const category = cleanText(body.category, 80) || "ground";
  const roast = cleanText(body.roast, 120);
  const weight = cleanText(body.weight, 60);
  const accent = cleanText(body.accent, 20) || "#c9e5f2";
  const badge = cleanText(body.badge, 80);
  const price = Math.max(0, Number.parseInt(body.price, 10) || 0);
  const active = body.active === false || body.active === 0 ? 0 : 1;
  const sortOrder = Math.max(0, Number.parseInt(body.sortOrder ?? body.sort_order, 10) || 0);
  const notes = Array.isArray(body.notes)
    ? body.notes.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, 12)
    : cleanText(body.notes, 400).split(",").map((item) => item.trim()).filter(Boolean).slice(0, 12);
  const images = Array.isArray(body.images)
    ? body.images.map((item, index) => ({
        imageUrl: cleanImageUrl(typeof item === "string" ? item : item.imageUrl),
        altText: cleanText(typeof item === "string" ? name : item.altText, 180) || name,
        storageKey: cleanText(typeof item === "object" && item ? item.storageKey : "", 240),
        mimeType: cleanText(typeof item === "object" && item ? item.mimeType : "", 60),
        sizeBytes: Math.max(0, Number.parseInt(typeof item === "object" && item ? item.sizeBytes : 0, 10) || 0),
        sortOrder: index
      })).filter((item) => item.imageUrl).slice(0, 12)
    : [];
  if (!name || !subtitle || !roast || !weight || !price) throw new Error("PRODUCT_INVALID");
  const primaryImage = cleanImageUrl(body.image) || images[0]?.imageUrl || "";
  if (!primaryImage) throw new Error("PRODUCT_IMAGE_REQUIRED");
  return { name, subtitle, category, roast, weight, accent, badge, price, active, sortOrder, notes, images, primaryImage };
}

function productImageInserts(env, id, images) {
  return images.map((image) => env.DB.prepare(
    `INSERT INTO product_images (product_id, image_url, alt_text, sort_order, storage_key, mime_type, size_bytes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, image.imageUrl, image.altText, image.sortOrder, image.storageKey, image.mimeType, image.sizeBytes));
}

async function deleteR2Object(env, key) {
  if (!key || !env.PRODUCT_IMAGES) return;
  try {
    await env.PRODUCT_IMAGES.delete(key);
  } catch (error) {
    console.error("R2 delete failed", key, error);
  }
}

async function createAdminProduct(request, env) {
  const body = await request.json().catch(() => ({}));
  const id = cleanText(body.id, 80).toLowerCase();
  if (!slugValid(id)) throw new Error("PRODUCT_SLUG_INVALID");
  const data = normalizeProductBody(body);
  const existing = await env.DB.prepare(
    "SELECT id, deleted_at FROM products WHERE id = ?"
  ).bind(id).first();
  if (existing && !existing.deleted_at) throw new Error("PRODUCT_DUPLICATE");
  const oldImages = existing
    ? await env.DB.prepare("SELECT storage_key FROM product_images WHERE product_id = ?").bind(id).all()
    : { results: [] };
  await env.DB.batch([
    existing
      ? env.DB.prepare(
          `UPDATE products SET
             name = ?, subtitle = ?, category = ?, roast = ?, notes = ?,
             price = ?, weight = ?, accent = ?, image = ?, badge = ?, active = ?, sort_order = ?,
             deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).bind(
          data.name, data.subtitle, data.category, data.roast, JSON.stringify(data.notes),
          data.price, data.weight, data.accent, data.primaryImage, data.badge, data.active, data.sortOrder, id
        )
      : env.DB.prepare(
          `INSERT INTO products (id, name, subtitle, category, roast, notes, price, weight, accent, image, badge, active, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id, data.name, data.subtitle, data.category, data.roast, JSON.stringify(data.notes),
          data.price, data.weight, data.accent, data.primaryImage, data.badge, data.active, data.sortOrder
        ),
    existing
      ? env.DB.prepare("DELETE FROM product_images WHERE product_id = ?").bind(id)
      : null,
    ...productImageInserts(env, id, data.images)
  ].filter(Boolean));
  const keepKeys = new Set(data.images.map((image) => image.storageKey).filter(Boolean));
  for (const old of oldImages.results) {
    if (old.storage_key && !keepKeys.has(old.storage_key)) await deleteR2Object(env, old.storage_key);
  }
  return findAdminProduct(env, id);
}

async function updateAdminProduct(request, id, env) {
  const data = normalizeProductBody(await request.json().catch(() => ({})));
  const existing = await env.DB.prepare("SELECT id FROM products WHERE id = ?").bind(id).first();
  if (!existing) return null;
  const oldImages = await env.DB.prepare(
    "SELECT storage_key FROM product_images WHERE product_id = ?"
  ).bind(id).all();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE products SET name = ?, subtitle = ?, category = ?, roast = ?, notes = ?,
       price = ?, weight = ?, accent = ?, image = ?, badge = ?, active = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(data.name, data.subtitle, data.category, data.roast, JSON.stringify(data.notes), data.price, data.weight, data.accent, data.primaryImage, data.badge, data.active, data.sortOrder, id),
    env.DB.prepare("DELETE FROM product_images WHERE product_id = ?").bind(id),
    ...productImageInserts(env, id, data.images)
  ]);
  const keepKeys = new Set(data.images.map((image) => image.storageKey).filter(Boolean));
  for (const old of oldImages.results) {
    if (old.storage_key && !keepKeys.has(old.storage_key)) await deleteR2Object(env, old.storage_key);
  }
  return findAdminProduct(env, id);
}

async function setAdminProductStatus(request, id, env) {
  const body = await request.json().catch(() => ({}));
  const active = body.active === false || body.active === 0 ? 0 : 1;
  const result = await env.DB.prepare(
    "UPDATE products SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL"
  ).bind(active, id).run();
  if (!result.meta.changes) return null;
  return findAdminProduct(env, id);
}

async function softDeleteAdminProduct(id, env) {
  const result = await env.DB.prepare(
    "UPDATE products SET active = 0, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL"
  ).bind(id).run();
  return result.meta.changes > 0;
}

async function uploadProductImage(request, env) {
  if (!env.PRODUCT_IMAGES) throw new Error("R2_NOT_CONFIGURED");
  const form = await request.formData().catch(() => null);
  const file = form && form.get("file");
  if (!file || typeof file === "string") throw new Error("IMAGE_FILE_REQUIRED");
  const ext = PRODUCT_IMAGE_TYPES[file.type];
  if (!ext) throw new Error("IMAGE_TYPE_INVALID");
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) throw new Error("IMAGE_TOO_LARGE");
  const requested = cleanText(form.get("productId"), 80).toLowerCase();
  const folder = slugValid(requested) ? requested : "misc";
  const key = `products/${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  await env.PRODUCT_IMAGES.put(key, file.stream(), {
    httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" }
  });
  return {
    imageUrl: productImageUrl(env, request, key),
    storageKey: key,
    mimeType: file.type,
    sizeBytes: file.size
  };
}

async function uploadBlogImage(request, env) {
  if (!env.PRODUCT_IMAGES) throw new Error("R2_NOT_CONFIGURED");
  const form = await request.formData().catch(() => null);
  const file = form && form.get("file");
  if (!file || typeof file === "string") throw new Error("IMAGE_FILE_REQUIRED");
  const ext = PRODUCT_IMAGE_TYPES[file.type];
  if (!ext) throw new Error("IMAGE_TYPE_INVALID");
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) throw new Error("IMAGE_TOO_LARGE");
  const requested = cleanText(form.get("postSlug"), 120).toLowerCase();
  const folder = slugValid(requested) ? requested : "misc";
  const key = `blog/${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  await env.PRODUCT_IMAGES.put(key, file.stream(), {
    httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" }
  });
  return {
    imageUrl: productImageUrl(env, request, key),
    storageKey: key,
    mimeType: file.type,
    sizeBytes: file.size
  };
}

async function deleteProductImage(id, env) {
  const row = await env.DB.prepare("SELECT id, storage_key FROM product_images WHERE id = ?").bind(id).first();
  if (!row) return false;
  await env.DB.prepare("DELETE FROM product_images WHERE id = ?").bind(id).run();
  await deleteR2Object(env, row.storage_key);
  return true;
}

async function serveProductImage(key, env) {
  if (!env.PRODUCT_IMAGES) return new Response("Not found", { status: 404 });
  const object = await env.PRODUCT_IMAGES.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}

async function createOrder(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return json({ message: "Đơn hàng không có sản phẩm." }, 400);
  }

  const customer = body.customer || {};
  const normalizedCustomer = {
    name: cleanText(customer.name, 100),
    phone: cleanText(customer.phone, 20),
    email: cleanText(customer.email, 160),
    address: cleanText(customer.address, 220),
    city: cleanText(customer.city, 80),
    district: cleanText(customer.district, 80)
  };
  if (!normalizedCustomer.name || !normalizedCustomer.phone || !normalizedCustomer.address) {
    return json({ message: "Vui lòng nhập đủ tên, điện thoại và địa chỉ." }, 400);
  }

  const quantities = new Map();
  for (const item of body.items.slice(0, 30)) {
    const id = cleanText(item.productId, 80);
    const quantity = Math.max(1, Math.min(20, Number.parseInt(item.quantity, 10) || 1));
    if (id) quantities.set(id, (quantities.get(id) || 0) + quantity);
  }

  const ids = [...quantities.keys()];
  if (!ids.length) return json({ message: "Sản phẩm không hợp lệ." }, 400);

  const placeholders = ids.map(() => "?").join(",");
  const productResult = await env.DB.prepare(
    `SELECT id, name, price FROM products WHERE active = 1 AND id IN (${placeholders})`
  ).bind(...ids).all();

  if (productResult.results.length !== ids.length) {
    return json({ message: "Một sản phẩm không còn được bán." }, 409);
  }

  const orderItems = productResult.results.map((product) => ({
    productId: product.id,
    name: product.name,
    unitPrice: product.price,
    quantity: quantities.get(product.id)
  }));
  const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const freeShippingThreshold = Number(env.FREE_SHIPPING_THRESHOLD || 500000);
  const shipping = subtotal >= freeShippingThreshold ? 0 : Number(env.SHIPPING_FEE || 30000);
  const total = subtotal + shipping;
  const paymentMethod = "cod";
  const status = "confirmed";
  const id = makeOrderId();

  const existingCustomer = await env.DB.prepare(
    "SELECT id FROM customers WHERE phone = ?"
  ).bind(normalizedCustomer.phone).first();
  const customerId = existingCustomer?.id || makeCustomerId();

  const statements = [
    env.DB.prepare(
      `INSERT INTO customers
       (id, name, phone, email, order_count, total_spent, first_order_at, last_order_at)
       VALUES (?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(phone) DO UPDATE SET
         name = excluded.name,
         email = CASE WHEN excluded.email != '' THEN excluded.email ELSE customers.email END,
         order_count = customers.order_count + 1,
         total_spent = customers.total_spent + excluded.total_spent,
         last_order_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(
      customerId,
      normalizedCustomer.name,
      normalizedCustomer.phone,
      normalizedCustomer.email,
      total
    ),
    env.DB.prepare(
      `INSERT INTO orders
       (id, customer_id, customer_name, phone, email, address, city, district, note, payment_method, payment_status, order_status, subtotal, shipping_fee, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, customerId, normalizedCustomer.name, normalizedCustomer.phone, normalizedCustomer.email,
      normalizedCustomer.address, normalizedCustomer.city, normalizedCustomer.district,
      cleanText(body.note, 500), paymentMethod, "unpaid", status,
      subtotal, shipping, total
    ),
    ...orderItems.map((item) =>
      env.DB.prepare(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(id, item.productId, item.name, item.unitPrice, item.quantity)
    )
  ];
  await env.DB.batch(statements);

  return json({ id, customerId, status, subtotal, shipping, total }, 201);
}

async function subscribe(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = cleanText(body.email, 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ message: "Email không hợp lệ." }, 400);
  }
  await env.DB.prepare(
    "INSERT INTO subscribers (email) VALUES (?) ON CONFLICT(email) DO NOTHING"
  ).bind(email).run();
  return json({ success: true }, 201);
}

async function createContactMessage(request, env) {
  const body = await request.json().catch(() => ({}));
  const contact = {
    name: cleanText(body.name, 100),
    phone: cleanText(body.phone, 20),
    email: cleanText(body.email, 160).toLowerCase(),
    message: cleanText(body.message, 3000)
  };
  if (
    !contact.name ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) ||
    contact.message.length < 10
  ) {
    return json({ message: "Vui lòng nhập đủ họ tên, email và nội dung lời nhắn." }, 400);
  }

  const id = makeContactId();
  await env.DB.prepare(
    `INSERT INTO contact_messages (id, name, phone, email, message)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(id, contact.name, contact.phone, contact.email, contact.message).run();

  let emailSent = false;
  const formspreeEndpoint = cleanText(env.FORMSPREE_ENDPOINT, 240);
  if (formspreeEndpoint) {
    try {
      const formspreeResponse = await fetch(formspreeEndpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          message: contact.message,
          submission_id: id,
          _subject: `[Dorae Coffee] Lời nhắn mới từ ${contact.name}`
        })
      });
      if (!formspreeResponse.ok) {
        const details = await formspreeResponse.text();
        throw new Error(`Formspree ${formspreeResponse.status}: ${details}`);
      }
      emailSent = true;
    } catch (error) {
      console.error("Formspree contact email failed", error);
    }
  } else if (env.EMAIL) {
    const destination = cleanText(env.CONTACT_EMAIL, 160) || "huyntttb01626@gmail.com";
    const fromEmail = cleanText(env.CONTACT_FROM_EMAIL, 160) || "contact@doraecoffee.io.vn";
    const safeMessage = escapeHtml(contact.message).replaceAll("\n", "<br />");
    try {
      await env.EMAIL.send({
        to: destination,
        from: { email: fromEmail, name: "Dorae Coffee Website" },
        replyTo: contact.email,
        subject: `[Dorae Coffee] Lời nhắn mới từ ${contact.name}`,
        text: [
          `Mã lời nhắn: ${id}`,
          `Họ tên: ${contact.name}`,
          `Email: ${contact.email}`,
          `Điện thoại: ${contact.phone || "Không cung cấp"}`,
          "",
          contact.message
        ].join("\n"),
        html: `
          <h2>Lời nhắn mới từ website Dorae Coffee</h2>
          <p><strong>Mã:</strong> ${id}</p>
          <p><strong>Họ tên:</strong> ${escapeHtml(contact.name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(contact.email)}</p>
          <p><strong>Điện thoại:</strong> ${escapeHtml(contact.phone || "Không cung cấp")}</p>
          <hr />
          <p>${safeMessage}</p>
        `
      });
      emailSent = true;
    } catch (error) {
      console.error("Contact email failed", error);
    }
  }

  if (emailSent) {
    await env.DB.prepare(
      "UPDATE contact_messages SET email_sent = 1 WHERE id = ?"
    ).bind(id).run();
  }

  return json({ success: true, id, emailSent, delivery: emailSent ? "accepted" : "stored" }, 201);
}

async function getAdminDashboard(env) {
  const [orders, customers, revenue] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS value FROM orders"),
    env.DB.prepare("SELECT COUNT(*) AS value FROM customers"),
    env.DB.prepare("SELECT COALESCE(SUM(total), 0) AS value FROM orders")
  ]);
  return {
    orders: orders.results[0]?.value || 0,
    customers: customers.results[0]?.value || 0,
    revenue: revenue.results[0]?.value || 0
  };
}

async function getAdminOrders(url, env) {
  const limit = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get("limit"), 10) || 30));
  const result = await env.DB.prepare(
    `SELECT id, customer_name, phone, email, city, district, payment_method,
            payment_status, order_status, subtotal, shipping_fee, total, created_at
     FROM orders ORDER BY created_at DESC LIMIT ?`
  ).bind(limit).all();
  return result.results;
}

async function getAdminCustomers(url, env) {
  const limit = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get("limit"), 10) || 30));
  const result = await env.DB.prepare(
    `SELECT id, name, phone, email, order_count, total_spent, first_order_at, last_order_at
     FROM customers ORDER BY last_order_at DESC LIMIT ?`
  ).bind(limit).all();
  return result.results;
}

async function loginAdmin(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = cleanText(body.email, 160).toLowerCase();
  const password = cleanText(body.password, 200);
  if (!email || !password) return json({ message: "Vui lòng nhập tài khoản và mật khẩu." }, 400);
  const legacyEmail = email === "admindorae.com" ? "admin@dorae.com" : "admindorae.com";

  const user = await env.DB.prepare(
    `SELECT id, email, password_hash, password_salt, password_iterations, display_name
     FROM admin_users WHERE (email = ? OR email = ?) AND active = 1`
  ).bind(email, legacyEmail).first();
  if (!user) return json({ message: "Tài khoản hoặc mật khẩu không đúng." }, 401);

  const candidate = await passwordHash(password, user.password_salt, user.password_iterations);
  if (candidate !== user.password_hash) {
    return json({ message: "Tài khoản hoặc mật khẩu không đúng." }, 401);
  }

  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = bytesToHex(tokenBytes);
  const tokenHash = await sha256(token);
  const sessionId = `AS${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;

  await env.DB.batch([
    env.DB.prepare("DELETE FROM admin_sessions WHERE expires_at <= CURRENT_TIMESTAMP"),
    env.DB.prepare(
      `INSERT INTO admin_sessions (id, admin_user_id, token_hash, expires_at)
       VALUES (?, ?, ?, datetime('now', '+30 days'))`
    ).bind(sessionId, user.id, tokenHash),
    env.DB.prepare(
      "UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(user.id)
  ]);

  return json({
    token,
    expiresIn: 2592000,
    user: { email: user.email, displayName: user.display_name }
  });
}

async function logoutAdmin(request, env) {
  const session = await getAdminSession(request, env);
  if (session) {
    await env.DB.prepare("DELETE FROM admin_sessions WHERE id = ?").bind(session.session_id).run();
  }
  return json({ success: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        return json({ ok: true, service: "doare-api" }, 200, cors);
      }
      if (request.method === "GET" && url.pathname === "/api/products") {
        return json({ products: await getProducts(env) }, 200, {
          ...cors,
          "Cache-Control": "public, max-age=60"
        });
      }
      if (request.method === "GET" && url.pathname === "/api/posts") {
        return json({ posts: await getPublishedPosts(url, env) }, 200, {
          ...cors,
          "Cache-Control": "public, max-age=60"
        });
      }
      const publicPostMatch = url.pathname.match(/^\/api\/posts\/([a-z0-9-]+)$/);
      if (request.method === "GET" && publicPostMatch) {
        const post = await getPublishedPost(publicPostMatch[1], env);
        return post ? json({ post }, 200, cors) : json({ message: "Không tìm thấy bài viết." }, 404, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/orders") {
        const response = await createOrder(request, env);
        Object.entries(cors).forEach(([key, value]) => response.headers.set(key, value));
        return response;
      }
      if (request.method === "POST" && url.pathname === "/api/subscribers") {
        const response = await subscribe(request, env);
        Object.entries(cors).forEach(([key, value]) => response.headers.set(key, value));
        return response;
      }
      if (request.method === "POST" && url.pathname === "/api/contact") {
        const response = await createContactMessage(request, env);
        Object.entries(cors).forEach(([key, value]) => response.headers.set(key, value));
        return response;
      }
      if (request.method === "POST" && url.pathname === "/api/admin/login") {
        const response = await loginAdmin(request, env);
        Object.entries(cors).forEach(([key, value]) => response.headers.set(key, value));
        return response;
      }
      if (request.method === "POST" && url.pathname === "/api/admin/logout") {
        const response = await logoutAdmin(request, env);
        Object.entries(cors).forEach(([key, value]) => response.headers.set(key, value));
        return response;
      }
      if (request.method === "GET" && url.pathname === "/api/admin/dashboard") {
        if (!(await isAdmin(request, env))) return unauthorized(cors);
        return json(await getAdminDashboard(env), 200, cors);
      }
      if (request.method === "GET" && url.pathname === "/api/admin/orders") {
        if (!(await isAdmin(request, env))) return unauthorized(cors);
        return json({ orders: await getAdminOrders(url, env) }, 200, cors);
      }
      if (request.method === "GET" && url.pathname === "/api/admin/customers") {
        if (!(await isAdmin(request, env))) return unauthorized(cors);
        return json({ customers: await getAdminCustomers(url, env) }, 200, cors);
      }
      if (request.method === "GET" && url.pathname === "/api/admin/posts") {
        if (!(await isAdmin(request, env))) return unauthorized(cors);
        return json({ posts: await getAdminPosts(env) }, 200, cors);
      }
      const adminPostIdMatch = url.pathname.match(/^\/api\/admin\/posts\/([A-Z0-9]+)$/);
      if (request.method === "GET" && adminPostIdMatch) {
        if (!(await isAdmin(request, env))) return unauthorized(cors);
        const post = await getAdminPost(adminPostIdMatch[1], env);
        return post ? json({ post }, 200, cors) : json({ message: "Không tìm thấy bài viết." }, 404, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/admin/posts") {
        if (!(await isAdmin(request, env))) return unauthorized(cors);
        return json({ post: await createAdminPost(request, env) }, 201, cors);
      }
      const adminPostMatch = adminPostIdMatch;
      if (request.method === "PUT" && adminPostMatch) {
        if (!(await isAdmin(request, env))) return unauthorized(cors);
        const post = await updateAdminPost(request, adminPostMatch[1], env);
        return post ? json({ post }, 200, cors) : json({ message: "Không tìm thấy bài viết." }, 404, cors);
      }
      if (request.method === "DELETE" && adminPostMatch) {
        if (!(await isAdmin(request, env))) return unauthorized(cors);
        const result = await env.DB.prepare("DELETE FROM blog_posts WHERE id = ?").bind(adminPostMatch[1]).run();
        return result.meta.changes
          ? json({ success: true }, 200, cors)
          : json({ message: "Không tìm thấy bài viết." }, 404, cors);
      }
      const imageServeMatch = url.pathname.match(/^\/api\/images\/(.+)$/);
      if (request.method === "GET" && imageServeMatch) {
        return serveProductImage(decodeURIComponent(imageServeMatch[1]), env);
      }
      if (request.method === "GET" && url.pathname === "/api/admin/products") {
        if (!(await isAdmin(request, env))) return unauthorized(cors);
        return json({ products: await getAdminProducts(env) }, 200, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/admin/products") {
        if (!(await isAdmin(request, env))) return unauthorized(cors);
        return json({ product: await createAdminProduct(request, env) }, 201, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/admin/product-images") {
        if (!(await isAdmin(request, env))) return unauthorized(cors);
        return json(await uploadProductImage(request, env), 201, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/admin/blog-images") {
        if (!(await isAdmin(request, env))) return unauthorized(cors);
        return json(await uploadBlogImage(request, env), 201, cors);
      }
      const adminImageMatch = url.pathname.match(/^\/api\/admin\/product-images\/(\d+)$/);
      if (request.method === "DELETE" && adminImageMatch) {
        if (!(await isAdmin(request, env))) return unauthorized(cors);
        const removed = await deleteProductImage(Number(adminImageMatch[1]), env);
        return removed
          ? json({ success: true }, 200, cors)
          : json({ message: "Không tìm thấy ảnh." }, 404, cors);
      }
      const adminProductStatusMatch = url.pathname.match(/^\/api\/admin\/products\/([a-z0-9-]+)\/status$/);
      if (request.method === "PATCH" && adminProductStatusMatch) {
        if (!(await isAdmin(request, env))) return unauthorized(cors);
        const product = await setAdminProductStatus(request, adminProductStatusMatch[1], env);
        return product
          ? json({ product }, 200, cors)
          : json({ message: "Không tìm thấy sản phẩm." }, 404, cors);
      }
      const adminProductMatch = url.pathname.match(/^\/api\/admin\/products\/([a-z0-9-]+)$/);
      if (request.method === "PUT" && adminProductMatch) {
        if (!(await isAdmin(request, env))) return unauthorized(cors);
        const product = await updateAdminProduct(request, adminProductMatch[1], env);
        return product
          ? json({ product }, 200, cors)
          : json({ message: "Không tìm thấy sản phẩm." }, 404, cors);
      }
      if (request.method === "DELETE" && adminProductMatch) {
        if (!(await isAdmin(request, env))) return unauthorized(cors);
        const removed = await softDeleteAdminProduct(adminProductMatch[1], env);
        return removed
          ? json({ success: true }, 200, cors)
          : json({ message: "Không tìm thấy sản phẩm." }, 404, cors);
      }
      return json({ message: "Không tìm thấy API." }, 404, cors);
    } catch (error) {
      console.error(error);
      if (error.message === "IMAGE_URL_INVALID") return json({ message: "Đường dẫn ảnh không hợp lệ." }, 400, cors);
      if (error.message === "POST_INVALID") return json({ message: "Tiêu đề hoặc slug bài viết không hợp lệ." }, 400, cors);
      if (error.message === "PRODUCT_INVALID") return json({ message: "Thông tin sản phẩm chưa đầy đủ." }, 400, cors);
      if (error.message === "PRODUCT_IMAGE_REQUIRED") return json({ message: "Sản phẩm cần ít nhất một ảnh." }, 400, cors);
      if (error.message === "PRODUCT_SLUG_INVALID") return json({ message: "ID/slug sản phẩm không hợp lệ (chỉ chữ thường, số và dấu gạch ngang)." }, 400, cors);
      if (error.message === "PRODUCT_DUPLICATE") return json({ message: "ID sản phẩm đã tồn tại." }, 409, cors);
      if (error.message === "R2_NOT_CONFIGURED") return json({ message: "Chưa cấu hình R2 bucket cho ảnh." }, 503, cors);
      if (error.message === "IMAGE_FILE_REQUIRED") return json({ message: "Vui lòng chọn file ảnh." }, 400, cors);
      if (error.message === "IMAGE_TYPE_INVALID") return json({ message: "Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP." }, 400, cors);
      if (error.message === "IMAGE_TOO_LARGE") return json({ message: "Ảnh vượt quá 5MB." }, 400, cors);
      if (String(error.message).includes("UNIQUE constraint failed: blog_posts.slug")) {
        return json({ message: "Slug bài viết đã tồn tại." }, 409, cors);
      }
      return json({ message: "Máy chủ gặp lỗi. Vui lòng thử lại." }, 500, cors);
    }
  }
};
