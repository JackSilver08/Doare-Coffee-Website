(function () {
  const money = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  });
  let orders = JSON.parse(localStorage.getItem("doare_demo_orders") || "[]");
  let customers = [];
  let liveDashboard = null;
  const products = window.DOARE_CATALOG || [];
  const titles = {
    dashboard: "Tổng quan",
    orders: "Đơn hàng",
    customers: "Khách hàng",
    products: "Sản phẩm",
    content: "Nội dung"
  };
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const formatMoney = (value) => money.format(value || 0).replace("₫", "đ");

  function statusLabel(status) {
    return status === "confirmed" ? "Đã xác nhận" : "Chờ thanh toán";
  }

  function row(order, detailed = false) {
    const total = order.pricingPreview?.total || 0;
    const customer = order.customer || {};
    return `<tr>
      <td><strong>${order.id}</strong></td>
      ${detailed ? `<td>${new Date(order.createdAt).toLocaleDateString("vi-VN")}</td>` : ""}
      <td>${customer.name || "—"}</td>
      ${detailed ? `<td>${customer.phone || "—"}</td>` : ""}
      <td>${order.paymentMethod === "cod" ? "COD" : "Chuyển khoản"}</td>
      <td>${formatMoney(total)}</td>
      <td><span class="status ${order.status}">${statusLabel(order.status)}</span></td>
    </tr>`;
  }

  function orderTotal(order) {
    return order.total ?? order.pricingPreview?.total ?? 0;
  }

  function render() {
    const revenue = liveDashboard?.revenue ?? orders.reduce((sum, order) => sum + orderTotal(order), 0);
    const waiting = liveDashboard?.waitingPayment ?? orders.filter((order) => order.status === "waiting_payment").length;
    $("#revenue-stat").textContent = formatMoney(revenue);
    $("#orders-stat").textContent = liveDashboard?.orders ?? orders.length;
    $("#payment-stat").textContent = waiting;
    $("#products-stat").textContent = products.length;
    $("#pending-count").textContent = waiting;
    $("#recent-orders").innerHTML = orders.slice(0, 5).map((order) => row(order)).join("");
    $("#all-orders").innerHTML = orders.map((order) => row(order, true)).join("");
    $("#all-customers").innerHTML = customers.map((customer) => `
      <tr>
        <td><strong>${customer.name}</strong></td>
        <td>${customer.phone}</td>
        <td>${customer.email || "—"}</td>
        <td>${customer.order_count}</td>
        <td>${formatMoney(customer.total_spent)}</td>
        <td>${new Date(customer.last_order_at).toLocaleDateString("vi-VN")}</td>
      </tr>`).join("");
    $("#dashboard-empty").hidden = orders.length > 0;
    $("#orders-empty").hidden = orders.length > 0;
    $("#customers-empty").hidden = customers.length > 0;
    $("#admin-products").innerHTML = products.map((product) => `
      <article class="admin-product">
        <div class="admin-product-visual" style="--accent:${product.accent}"><img class="admin-packshot" src="${product.image}" alt="" /></div>
        <div class="admin-product-info"><h3>${product.name}</h3><p>${product.subtitle}</p><div><strong>${formatMoney(product.price)}</strong><span>${product.weight}</span></div></div>
      </article>`).join("");
  }

  function normalizeLiveOrder(order) {
    return {
      ...order,
      customer: { name: order.customer_name, phone: order.phone },
      paymentMethod: order.payment_method,
      status: order.order_status,
      createdAt: order.created_at,
      pricingPreview: { total: order.total }
    };
  }

  async function adminRequest(path, token, options = {}) {
    const response = await fetch(`${window.DOARE_CONFIG.API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || "Không thể kết nối backend.");
    }
    return response.json();
  }

  async function loadBackend(token) {
    const button = $("#connect-api");
    button.disabled = true;
    button.textContent = "Đang kết nối...";
    try {
      const [dashboard, orderData, customerData] = await Promise.all([
        adminRequest("/api/admin/dashboard", token),
        adminRequest("/api/admin/orders?limit=100", token),
        adminRequest("/api/admin/customers?limit=100", token)
      ]);
      localStorage.setItem("doare_admin_session", token);
      liveDashboard = dashboard;
      orders = orderData.orders.map(normalizeLiveOrder);
      customers = customerData.customers;
      render();
      button.textContent = "Đăng xuất";
      button.classList.add("connected");
      button.title = "Đăng xuất khỏi trang quản trị";
      return true;
    } catch (error) {
      localStorage.removeItem("doare_admin_session");
      button.textContent = "Đăng nhập";
      button.classList.remove("connected");
      button.title = "";
      throw error;
    } finally {
      button.disabled = false;
    }
  }

  async function loginAdmin(email, password) {
    const response = await fetch(`${window.DOARE_CONFIG.API_BASE_URL}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || "Đăng nhập không thành công.");
    return body;
  }

  async function logoutAdmin(token) {
    await adminRequest("/api/admin/logout", token, { method: "POST" }).catch(() => {});
    localStorage.removeItem("doare_admin_session");
  }

  async function connectBackend() {
    if (!window.DOARE_CONFIG.API_BASE_URL) {
      alert("Hãy điền API_BASE_URL trong assets/js/config.js sau khi deploy Worker.");
      return;
    }
    const button = $("#connect-api");
    if (button.classList.contains("connected")) {
      const token = localStorage.getItem("doare_admin_session");
      if (token) await logoutAdmin(token);
      liveDashboard = null;
      orders = JSON.parse(localStorage.getItem("doare_demo_orders") || "[]");
      customers = [];
      render();
      button.textContent = "Đăng nhập";
      button.classList.remove("connected");
      button.title = "";
      return;
    }

    const email = prompt("Tài khoản admin:", "admindoare.com");
    if (!email) return;
    const password = prompt("Mật khẩu:");
    if (!password) return;
    try {
      button.disabled = true;
      button.textContent = "Đang đăng nhập...";
      const session = await loginAdmin(email, password);
      await loadBackend(session.token);
    } catch (error) {
      alert(error.message);
      button.disabled = false;
      button.textContent = "Đăng nhập";
    }
  }

  function switchView(view) {
    $$(".view").forEach((node) => node.classList.toggle("active", node.id === `${view}-view`));
    $$("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    $("#page-title").textContent = titles[view];
  }

  $$("[data-view]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
  $$("[data-go]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.go)));
  $("#export-orders").addEventListener("click", () => {
    if (!orders.length) return;
    const lines = [["Ma don", "Ngay", "Khach hang", "Dien thoai", "Thanh toan", "Tong tien", "Trang thai"]];
    orders.forEach((order) => lines.push([
      order.id, order.createdAt, order.customer?.name, order.customer?.phone,
      order.paymentMethod, order.pricingPreview?.total, order.status
    ]));
    const csv = lines.map((line) => line.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    link.download = `doare-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
  $("#connect-api").addEventListener("click", connectBackend);

  render();
  const savedAdminSession = localStorage.getItem("doare_admin_session");
  if (savedAdminSession && window.DOARE_CONFIG.API_BASE_URL) {
    loadBackend(savedAdminSession).catch(() => {
      alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    });
  }
})();
