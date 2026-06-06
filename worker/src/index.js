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
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((item) => item.trim());
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || "http://localhost:8080";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin"
  };
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function makeOrderId() {
  const date = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `DR${date}${suffix}`;
}

function makeCustomerId() {
  return `CU${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
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

function unauthorized() {
  return json({ message: "Không có quyền truy cập." }, 401);
}

async function getProducts(env) {
  const result = await env.DB.prepare(
    `SELECT id, name, subtitle, category, roast, notes, price, weight, accent, image, badge
     FROM products WHERE active = 1 ORDER BY sort_order ASC, created_at DESC`
  ).all();

  return result.results.map((product) => ({
    ...product,
    notes: JSON.parse(product.notes || "[]")
  }));
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
  const paymentMethod = body.paymentMethod === "bank_transfer" ? "bank_transfer" : "cod";
  if (
    paymentMethod === "bank_transfer" &&
    (!env.BANK_ACCOUNT_NO || env.BANK_ACCOUNT_NO.includes("REPLACE_"))
  ) {
    return json({ message: "Thanh toán chuyển khoản chưa được cấu hình." }, 503);
  }
  const status = paymentMethod === "cod" ? "confirmed" : "waiting_payment";
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

  const payment =
    paymentMethod === "bank_transfer"
      ? {
          bankId: env.BANK_ID,
          accountNo: env.BANK_ACCOUNT_NO,
          accountName: env.BANK_ACCOUNT_NAME,
          amount: total,
          content: id,
          qrImageUrl: `https://img.vietqr.io/image/${encodeURIComponent(env.BANK_ID)}-${encodeURIComponent(env.BANK_ACCOUNT_NO)}-compact2.png?amount=${total}&addInfo=${encodeURIComponent(id)}&accountName=${encodeURIComponent(env.BANK_ACCOUNT_NAME)}`
        }
      : null;

  return json({ id, customerId, status, subtotal, shipping, total, payment }, 201);
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

async function getAdminDashboard(env) {
  const [orders, customers, revenue, waiting] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS value FROM orders"),
    env.DB.prepare("SELECT COUNT(*) AS value FROM customers"),
    env.DB.prepare("SELECT COALESCE(SUM(total), 0) AS value FROM orders"),
    env.DB.prepare("SELECT COUNT(*) AS value FROM orders WHERE payment_status = 'unpaid' AND payment_method = 'bank_transfer'")
  ]);
  return {
    orders: orders.results[0]?.value || 0,
    customers: customers.results[0]?.value || 0,
    revenue: revenue.results[0]?.value || 0,
    waitingPayment: waiting.results[0]?.value || 0
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

  const user = await env.DB.prepare(
    `SELECT id, email, password_hash, password_salt, password_iterations, display_name
     FROM admin_users WHERE email = ? AND active = 1`
  ).bind(email).first();
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
        if (!(await isAdmin(request, env))) return unauthorized();
        return json(await getAdminDashboard(env), 200, cors);
      }
      if (request.method === "GET" && url.pathname === "/api/admin/orders") {
        if (!(await isAdmin(request, env))) return unauthorized();
        return json({ orders: await getAdminOrders(url, env) }, 200, cors);
      }
      if (request.method === "GET" && url.pathname === "/api/admin/customers") {
        if (!(await isAdmin(request, env))) return unauthorized();
        return json({ customers: await getAdminCustomers(url, env) }, 200, cors);
      }
      return json({ message: "Không tìm thấy API." }, 404, cors);
    } catch (error) {
      console.error(error);
      return json({ message: "Máy chủ gặp lỗi. Vui lòng thử lại." }, 500, cors);
    }
  }
};
