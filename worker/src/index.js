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
  const status = paymentMethod === "cod" ? "confirmed" : "waiting_payment";
  const id = makeOrderId();

  const statements = [
    env.DB.prepare(
      `INSERT INTO orders
       (id, customer_name, phone, email, address, city, district, note, payment_method, payment_status, order_status, subtotal, shipping_fee, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, normalizedCustomer.name, normalizedCustomer.phone, normalizedCustomer.email,
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

  return json({ id, status, subtotal, shipping, total, payment }, 201);
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
      return json({ message: "Không tìm thấy API." }, 404, cors);
    } catch (error) {
      console.error(error);
      return json({ message: "Máy chủ gặp lỗi. Vui lòng thử lại." }, 500, cors);
    }
  }
};
