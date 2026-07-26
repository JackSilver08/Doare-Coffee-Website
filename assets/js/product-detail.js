(function () {
  const money = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  });

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const state = {
    products: [],
    product: null,
    quantity: 1,
    cart: JSON.parse(localStorage.getItem("doare_cart") || "[]")
  };

  function productDisplayCategory(product) {
    const normalizeText = (value) =>
      String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const id = normalizeText(product.id);
    const name = normalizeText(product.name);
    if (id.includes("3in1") || name.includes("3in1") || name.includes("hoa tan")) {
      return "instant";
    }
    if (product.category === "other") return "other";
    return "ground";
  }

  function requireLogin(action) {
    if (window.DoareAuth?.isLoggedIn?.()) {
      action();
      return true;
    }
    window.DoareAuth?.open?.("login", action);
    return false;
  }

  function formatMoney(value) {
    return money.format(value).replace("₫", "đ");
  }

  function saveCart() {
    localStorage.setItem("doare_cart", JSON.stringify(state.cart));
    $("#detail-cart-count").textContent = String(
      state.cart.reduce((sum, item) => sum + item.quantity, 0)
    );
    window.dispatchEvent(new CustomEvent("doare:cart-updated"));
  }

  function addToCart(quantity = 1) {
    if (!state.product) return;
    const current = state.cart.find((item) => item.id === state.product.id);
    if (current) current.quantity += quantity;
    else state.cart.push({ id: state.product.id, quantity });
    saveCart();
    showToast("Đã thêm sản phẩm vào giỏ hàng.");
  }

  function showToast(message) {
    const toast = $("#detail-toast");
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(showToast.timeout);
    showToast.timeout = setTimeout(() => toast.classList.remove("visible"), 2400);
  }

  function categoryLabel(category) {
    if (category === "other") return "Khác";
    if (category === "ground") return "Cà Phê Rang Xay";
    if (category === "instant") return "Cà Phê Hòa Tan 3in1";
    return "Cà Phê Rang Xay";
  }

  function renderProduct(product) {
    state.product = product;
    document.title = `${product.name} | Dorae Coffee`;
    $("#detail-name").textContent = product.name;
    $("#detail-title").textContent = product.name;
    $("#detail-subtitle").textContent = product.subtitle;
    $("#detail-category").textContent = categoryLabel(product.category);
    $("#detail-desc").textContent = `${product.subtitle}. Mức rang: ${product.roast}. Khối lượng: ${product.weight}.`;
    $("#detail-price").textContent = formatMoney(product.price);
    $("#detail-weight").textContent = product.weight;
    $("#detail-quantity").textContent = String(state.quantity);

    $("#detail-visual").innerHTML = `
      <img class="product-packshot" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />
      ${product.badge ? `<span class="product-badge">${escapeHtml(product.badge)}</span>` : ""}
    `;

    $("#detail-notes").innerHTML = (product.notes || []).map((note) => `<span>${escapeHtml(note)}</span>`).join("");
    $("#detail-specs").innerHTML = `
      <div><span>Danh mục</span><strong>${escapeHtml(categoryLabel(product.category))}</strong></div>
      <div><span>Mức rang</span><strong>${escapeHtml(product.roast)}</strong></div>
      <div><span>Khối lượng</span><strong>${escapeHtml(product.weight)}</strong></div>
    `;

    const displayCategory = productDisplayCategory(product);
    const related = state.products
      .filter((item) => {
        if (displayCategory === "other") return item.id !== product.id;
        return productDisplayCategory(item) === displayCategory && item.id !== product.id;
      })
      .slice(0, 4);
    $("#related-grid").innerHTML = related.length
      ? related.map((item) => `
        <article class="product-card">
          <div class="product-visual" style="--accent:${escapeHtml(item.accent || "#c9e5f2")}">
            ${item.badge ? `<span class="product-badge">${escapeHtml(item.badge)}</span>` : ""}
            <img class="product-packshot" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" />
            <span class="weight">${escapeHtml(item.weight)}</span>
          </div>
          <div class="product-info">
            <p>${escapeHtml(categoryLabel(productDisplayCategory(item)))}</p>
            <h3><a href="product.html?id=${encodeURIComponent(item.id)}">${escapeHtml(item.name)}</a></h3>
            <div class="taste-notes">${(item.notes || []).map((note) => `<span>${escapeHtml(note)}</span>`).join("")}</div>
            <div class="product-buy">
              <strong>${formatMoney(item.price)}</strong>
              <div class="catalog-card-actions">
                <a href="product.html?id=${encodeURIComponent(item.id)}">Xem chi tiết</a>
                <button type="button" data-related-add="${escapeHtml(item.id)}">Thêm vào giỏ</button>
              </div>
            </div>
          </div>
        </article>
      `).join("")
      : `<div class="catalog-empty"><div><p class="eyebrow dark">CHƯA CÓ GỢI Ý</p><h3>Đang cập nhật thêm sản phẩm</h3><p>Nhóm này hiện chưa có sản phẩm liên quan để hiển thị.</p></div></div>`;
  }

  async function init() {
    state.products = await window.DoareAPI.getProducts();
    saveCart();

    const id = new URLSearchParams(window.location.search).get("id") || state.products[0]?.id;
    const product = state.products.find((item) => item.id === id) || state.products[0];
    if (!product) {
      $("#detail-name").textContent = "Không tìm thấy sản phẩm";
      $("#detail-subtitle").textContent = "Vui lòng quay lại danh mục.";
      return;
    }

    renderProduct(product);

    $$("[data-detail-quantity]").forEach((button) =>
      button.addEventListener("click", () => {
        state.quantity = Math.max(1, Math.min(20, state.quantity + Number(button.dataset.detailQuantity)));
        $("#detail-quantity").textContent = String(state.quantity);
      })
    );

    $("#detail-add").addEventListener("click", () => {
      addToCart(state.quantity);
      state.quantity = 1;
      $("#detail-quantity").textContent = "1";
    });

    $("#detail-buy").addEventListener("click", () => {
      const startPurchase = () => {
        addToCart(state.quantity);
        window.dispatchEvent(new CustomEvent("doare:open-checkout"));
      };
      requireLogin(startPurchase);
    });

    document.addEventListener("click", (event) => {
      const relatedAdd = event.target.closest("[data-related-add]");
      if (!relatedAdd) return;
      const item = state.products.find((entry) => entry.id === relatedAdd.dataset.relatedAdd);
      if (!item) return;
      event.preventDefault();
      requireLogin(() => {
        const current = state.cart.find((entry) => entry.id === item.id);
        if (current) current.quantity += 1;
        else state.cart.push({ id: item.id, quantity: 1 });
        saveCart();
        showToast("Đã thêm sản phẩm vào giỏ hàng.");
      });
    });

    const menuButton = $(".menu-button");
    const mobileNav = $(".mobile-nav");
    const mobileNavBackdrop = $(".mobile-nav-backdrop");
    const closeMobileNav = () => {
      mobileNav.classList.remove("open");
      mobileNav.setAttribute("aria-hidden", "true");
      menuButton.setAttribute("aria-expanded", "false");
      mobileNavBackdrop.hidden = true;
      document.body.classList.remove("mobile-menu-open");
    };
    const openMobileNav = () => {
      mobileNavBackdrop.hidden = false;
      mobileNav.classList.add("open");
      mobileNav.setAttribute("aria-hidden", "false");
      menuButton.setAttribute("aria-expanded", "true");
      document.body.classList.add("mobile-menu-open");
      $(".mobile-nav-close").focus();
    };

    menuButton.addEventListener("click", () => {
      if (menuButton.getAttribute("aria-expanded") === "true") closeMobileNav();
      else openMobileNav();
    });
    $(".mobile-nav-close").addEventListener("click", closeMobileNav);
    mobileNavBackdrop.addEventListener("click", closeMobileNav);
    $$(".mobile-nav a").forEach((link) => link.addEventListener("click", closeMobileNav));

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMobileNav();
    });
  }

  init().catch((error) => {
    console.warn("Product detail:", error.message);
    $("#detail-name").textContent = "Không tải được sản phẩm";
  });
})();
