(function () {
  const CART_KEY = "doare_cart";
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const money = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  });

  function formatMoney(value) {
    return money.format(value).replace("₫", "đ");
  }

  function getCart() {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  }

  function setCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCounts();
    renderSummary();
    window.dispatchEvent(new CustomEvent("doare:cart-updated"));
  }

  function getProducts() {
    return window.DoareAPI?.getProducts ? window.DoareAPI.getProducts() : Promise.resolve([]);
  }

  function cartDetails(products) {
    const cart = getCart();
    return cart
      .map((item) => {
        const product = products.find((entry) => entry.id === item.id);
        return product ? { ...product, quantity: item.quantity } : null;
      })
      .filter(Boolean);
  }

  function cartSubtotal(details) {
    return details.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  function renderCounts() {
    const count = getCart().reduce((sum, item) => sum + item.quantity, 0);
    $$("[data-shop-cart-count], #catalog-cart-count, #detail-cart-count, .cart-count").forEach((node) => {
      node.textContent = String(count);
    });
  }

  async function renderSummary() {
    const modal = $("#checkout-modal");
    if (!modal) return;
    const itemsNode = $("#checkout-items");
    const subtotalNode = $("#checkout-subtotal");
    const shippingNode = $("#checkout-shipping");
    const totalNode = $("#checkout-total");
    const emptyNode = $("#checkout-empty");
    const products = await getProducts();
    const details = cartDetails(products);
    const subtotal = cartSubtotal(details);
    const shipping =
      subtotal >= (window.DOARE_CONFIG?.FREE_SHIPPING_THRESHOLD || 500000)
        ? 0
        : (window.DOARE_CONFIG?.STANDARD_SHIPPING_FEE || 30000);

    if (itemsNode) {
      itemsNode.innerHTML = details.length
        ? details.map((item) => `
          <div class="checkout-item">
            <span>${item.quantity}× ${item.name}</span>
            <strong>${formatMoney(item.price * item.quantity)}</strong>
          </div>
        `).join("")
        : "";
    }
    if (emptyNode) emptyNode.hidden = details.length > 0;
    if (subtotalNode) subtotalNode.textContent = formatMoney(subtotal);
    if (shippingNode) shippingNode.textContent = shipping ? formatMoney(shipping) : "Miễn phí";
    if (totalNode) totalNode.textContent = formatMoney(subtotal + shipping);
  }

  async function openCheckout() {
    const modal = $("#checkout-modal");
    if (!modal) return;
    if (!window.DoareAuth?.isLoggedIn?.()) {
      if (window.DoareAuth?.open) {
        window.DoareAuth.open("login", () => openCheckout());
      }
      return;
    }
    await renderSummary();
    modal.hidden = false;
    document.body.classList.add("no-scroll");
  }

  function closeCheckout() {
    const modal = $("#checkout-modal");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("no-scroll");
  }

  function addToCart(productId, quantity = 1) {
    const cart = getCart();
    const current = cart.find((item) => item.id === productId);
    if (current) current.quantity += quantity;
    else cart.push({ id: productId, quantity });
    setCart(cart);
  }

  async function submitOrder(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $(".submit-order", form);
    const message = $(".form-message", form);
    const data = Object.fromEntries(new FormData(form));
    const products = await getProducts();
    const details = cartDetails(products);
    const subtotal = cartSubtotal(details);
    const shipping =
      subtotal >= (window.DOARE_CONFIG?.FREE_SHIPPING_THRESHOLD || 500000)
        ? 0
        : (window.DOARE_CONFIG?.STANDARD_SHIPPING_FEE || 30000);

    if (!details.length) {
      message.textContent = "Giỏ hàng đang trống.";
      return;
    }

    button.disabled = true;
    button.textContent = "Đang tạo đơn...";
    message.textContent = "";

    try {
      const order = await window.DoareAPI.createOrder({
        customer: {
          name: data.name.trim(),
          phone: data.phone.trim(),
          email: data.email.trim(),
          address: data.address.trim(),
          city: data.city.trim(),
          district: data.district.trim()
        },
        note: data.note.trim(),
        paymentMethod: "cod",
        items: getCart().map(({ id, quantity }) => ({ productId: id, quantity })),
        pricingPreview: { subtotal, shipping, total: subtotal + shipping }
      });

      setCart([]);
      form.reset();
      message.innerHTML = `<strong>Đặt hàng thành công: ${order.id}</strong> Chúng tôi sẽ gọi xác nhận trước khi giao.`;
      button.textContent = "Đã tạo đơn hàng";
      setTimeout(closeCheckout, 3000);
    } catch (error) {
      message.textContent = error.message || "Có lỗi xảy ra. Vui lòng thử lại.";
      button.disabled = false;
      button.textContent = "Xác nhận đặt hàng";
    }
  }

  function bind() {
    $("#checkout-close")?.addEventListener("click", closeCheckout);
    $("#checkout-modal")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeCheckout();
    });
    $("#checkout-form")?.addEventListener("submit", submitOrder);
    $("#catalog-cart-button")?.addEventListener("click", openCheckout);
    $("#detail-cart-button")?.addEventListener("click", openCheckout);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeCheckout();
    });
    window.addEventListener("doare:open-checkout", openCheckout);
    window.addEventListener("doare:cart-updated", () => {
      renderCounts();
      renderSummary();
    });
    renderCounts();
  }

  window.DoareShop = {
    addToCart,
    openCheckout,
    closeCheckout,
    renderCounts,
    renderSummary
  };

  bind();
})();
