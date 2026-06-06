(function () {
  const money = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  });
  const orders = JSON.parse(localStorage.getItem("doare_demo_orders") || "[]");
  const products = window.DOARE_CATALOG || [];
  const titles = {
    dashboard: "Tổng quan",
    orders: "Đơn hàng",
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

  function render() {
    const revenue = orders.reduce((sum, order) => sum + (order.pricingPreview?.total || 0), 0);
    const waiting = orders.filter((order) => order.status === "waiting_payment").length;
    $("#revenue-stat").textContent = formatMoney(revenue);
    $("#orders-stat").textContent = orders.length;
    $("#payment-stat").textContent = waiting;
    $("#products-stat").textContent = products.length;
    $("#pending-count").textContent = waiting;
    $("#recent-orders").innerHTML = orders.slice(0, 5).map((order) => row(order)).join("");
    $("#all-orders").innerHTML = orders.map((order) => row(order, true)).join("");
    $("#dashboard-empty").hidden = orders.length > 0;
    $("#orders-empty").hidden = orders.length > 0;
    $("#admin-products").innerHTML = products.map((product) => `
      <article class="admin-product">
        <div class="admin-product-visual" style="--accent:${product.accent}"><img class="admin-packshot" src="${product.image}" alt="" /></div>
        <div class="admin-product-info"><h3>${product.name}</h3><p>${product.subtitle}</p><div><strong>${formatMoney(product.price)}</strong><span>${product.weight}</span></div></div>
      </article>`).join("");
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

  render();
})();
