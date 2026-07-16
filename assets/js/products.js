(function () {
  const CATEGORY_ORDER = [
    {
      id: "ground",
      label: "Cà Phê Rang Xay",
      shortLabel: "Rang xay",
      description: "Nhóm cà phê chính của Dorae Coffee, phù hợp cho pha phin và pha máy.",
      color: "#8dc6df"
    },
    {
      id: "instant",
      label: "Cà Phê Hòa Tan 3in1",
      shortLabel: "Hòa tan",
      description: "Nhóm sản phẩm hòa tan sẽ được bổ sung sau trong các đợt cập nhật tiếp theo.",
      color: "#f1c77a"
    },
    {
      id: "other",
      label: "Khác",
      shortLabel: "Khác",
      description: "Phụ kiện, gói quà và những sản phẩm đi kèm khác của Dorae Coffee.",
      color: "#a9d7ba"
    }
  ];

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
    activeCategory: new URLSearchParams(window.location.search).get("category") || "ground",
    cart: JSON.parse(localStorage.getItem("doare_cart") || "[]")
  };

  if (!CATEGORY_ORDER.some((category) => category.id === state.activeCategory)) {
    state.activeCategory = "ground";
  }

  function formatMoney(value) {
    return money.format(value).replace("₫", "đ");
  }

  function categoryMeta(id) {
    return CATEGORY_ORDER.find((entry) => entry.id === id) || CATEGORY_ORDER[0];
  }

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function productDisplayCategory(product) {
    const id = normalizeText(product.id);
    const name = normalizeText(product.name);
    if (id.includes("3in1") || name.includes("3in1") || name.includes("hoa tan")) {
      return "instant";
    }
    if (product.category === "other") return "other";
    return "ground";
  }

  function cartCount() {
    return state.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  function saveCart() {
    localStorage.setItem("doare_cart", JSON.stringify(state.cart));
    renderCartCount();
    window.dispatchEvent(new CustomEvent("doare:cart-updated"));
  }

  function addToCart(productId, quantity = 1) {
    const current = state.cart.find((item) => item.id === productId);
    if (current) current.quantity += quantity;
    else state.cart.push({ id: productId, quantity });
    saveCart();
    showToast("Đã thêm sản phẩm vào giỏ hàng.");
  }

  function showToast(message) {
    const toast = $("#catalog-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(showToast.timeout);
    showToast.timeout = setTimeout(() => toast.classList.remove("visible"), 2500);
  }

  function renderCartCount() {
    const count = cartCount();
    $("#catalog-cart-count").textContent = String(count);
  }

  function setUrlCategory(category) {
    const url = new URL(window.location.href);
    if (category === "ground") url.searchParams.delete("category");
    else url.searchParams.set("category", category);
    history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function filteredProducts() {
    if (state.activeCategory === "other") return state.products;
    return state.products.filter((product) => productDisplayCategory(product) === state.activeCategory);
  }

  function requireLogin(action) {
    if (window.DoareAuth?.isLoggedIn?.()) {
      action();
      return true;
    }
    window.DoareAuth?.open?.("login", action);
    return false;
  }

  function renderCategoryMenus() {
    const counts = CATEGORY_ORDER.reduce((acc, category) => {
      acc[category.id] = category.id === "other"
        ? state.products.length
        : state.products.filter((product) => productDisplayCategory(product) === category.id).length;
      return acc;
    }, {});

    $$(".js-category-menu").forEach((menu) => {
      menu.innerHTML = CATEGORY_ORDER.map((category) => `
        <button
          type="button"
          class="${category.id === state.activeCategory ? "active" : ""}"
          data-category="${category.id}"
          style="--category-color:${category.color}"
        >
          <span class="category-dot" aria-hidden="true"></span>
          <div>
            <strong>${escapeHtml(category.label)}</strong>
            <small>${counts[category.id] || 0} sản phẩm</small>
          </div>
        </button>
      `).join("");
    });
  }

  function renderHeroStats() {
    const stat = $("#catalog-stat-total");
    if (stat) stat.textContent = `${state.products.length}+`;
  }

  function renderGrid() {
    const grid = $("#catalog-grid");
    const empty = $("#catalog-empty");
    const toolbar = $("#catalog-result-count");
    const category = categoryMeta(state.activeCategory);
    const items = filteredProducts();

    $("#catalog-reset").hidden = state.activeCategory === "ground";

    if (toolbar) {
      toolbar.textContent = state.activeCategory === "other"
        ? `${state.products.length} sản phẩm · Tất cả`
        : `${items.length} sản phẩm · ${category.label}`;
    }

    if (!items.length) {
      grid.innerHTML = "";
      grid.hidden = true;
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    grid.hidden = false;
    grid.innerHTML = items
      .map((product) => {
        const displayCategory = productDisplayCategory(product);
        return `
          <article class="product-card" id="${escapeHtml(product.id)}">
            <div class="product-visual" style="--accent:${escapeHtml(product.accent || "#c9e5f2")}">
              ${product.badge ? `<span class="product-badge">${escapeHtml(product.badge)}</span>` : ""}
              <img class="product-packshot" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />
              <span class="weight">${escapeHtml(product.weight)}</span>
            </div>
            <div class="product-info">
              <p>${escapeHtml(categoryMeta(displayCategory).label)}</p>
              <h3>${escapeHtml(product.name)}</h3>
              <div class="taste-notes">
                ${(product.notes || []).map((note) => `<span>${escapeHtml(note)}</span>`).join("")}
              </div>
              <div class="product-buy">
                <strong>${formatMoney(product.price)}</strong>
                <div class="catalog-card-actions">
                  <a href="product.html?id=${encodeURIComponent(product.id)}">Xem chi tiết</a>
                  <button type="button" data-add="${escapeHtml(product.id)}">Thêm vào giỏ</button>
                  <button type="button" data-buy="${escapeHtml(product.id)}">Mua ngay</button>
                </div>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function loadProducts() {
    const products = await window.DoareAPI.getProducts();
    state.products = products;
    state.cart = state.cart.filter((item) => products.some((product) => product.id === item.id));
    saveCart();
    renderHeroStats();
    renderCategoryMenus();
    renderGrid();
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const categoryButton = event.target.closest("[data-category]");
      const addButton = event.target.closest("[data-add]");
      const buyButton = event.target.closest("[data-buy]");

      if (categoryButton) {
        state.activeCategory = categoryButton.dataset.category;
        setUrlCategory(state.activeCategory);
        renderCategoryMenus();
        renderGrid();
        $$(".nav-dropdown").forEach((dropdown) => (dropdown.open = false));
        $$(".mobile-nav-group").forEach((group) => (group.open = false));
        return;
      }

      if (addButton) {
        event.preventDefault();
        requireLogin(() => addToCart(addButton.dataset.add, 1));
        return;
      }

      if (buyButton) {
        event.preventDefault();
        const startPurchase = () => {
          addToCart(buyButton.dataset.buy, 1);
          window.dispatchEvent(new CustomEvent("doare:open-checkout"));
        };
        requireLogin(startPurchase);
      }
    });

    $("#catalog-reset").addEventListener("click", () => {
      state.activeCategory = "ground";
      setUrlCategory("ground");
      renderCategoryMenus();
      renderGrid();
      $$(".nav-dropdown").forEach((dropdown) => (dropdown.open = false));
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
    $$(".nav-dropdown-menu a").forEach((link) => link.addEventListener("click", () => {
      $$(".nav-dropdown").forEach((dropdown) => (dropdown.open = false));
    }));
    window.addEventListener("resize", () => {
      if (window.innerWidth > 760) closeMobileNav();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMobileNav();
    });
  }

  async function init() {
    bindEvents();
    renderCartCount();
    await loadProducts();
    renderCartCount();
    renderCategoryMenus();
    renderGrid();
  }

  init().catch((error) => {
    console.warn("Products page:", error.message);
    $("#catalog-result-count").textContent = "Không tải được danh mục.";
  });
})();
