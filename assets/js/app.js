(function () {
  const state = {
    products: [],
    posts: [],
    cart: JSON.parse(localStorage.getItem("doare_cart") || "[]"),
    featuredQuantity: 1
  };

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

  function formatMoney(value) {
    return money.format(value).replace("₫", "đ");
  }

  function saveCart() {
    localStorage.setItem("doare_cart", JSON.stringify(state.cart));
    renderCart();
  }

  function cartDetails() {
    return state.cart
      .map((item) => {
        const product = state.products.find((entry) => entry.id === item.id);
        return product ? { ...product, quantity: item.quantity } : null;
      })
      .filter(Boolean);
  }

  function cartSubtotal() {
    return cartDetails().reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  function renderFeaturedProduct() {
    const product = state.products[0];
    if (!product) return;
    $("#featured-price").textContent = formatMoney(product.price);
    $("#featured-quantity").textContent = state.featuredQuantity;
    const gallery = product.gallery?.length
      ? product.gallery
      : [{ image_url: product.image, alt_text: product.name }];
    const mainImage = $(".single-product-image");
    mainImage.src = gallery[0].image_url;
    mainImage.alt = gallery[0].alt_text || product.name;
    $("#product-thumbnails").innerHTML = gallery.map((image, index) => `
      <button type="button" class="${index === 0 ? "active" : ""}" data-gallery-image="${escapeHtml(image.image_url)}" data-gallery-alt="${escapeHtml(image.alt_text || product.name)}">
        <img src="${escapeHtml(image.image_url)}" alt="" />
      </button>`).join("");
  }

  function renderPosts() {
    $("#journal-grid").innerHTML = state.posts.map((post) => `
      <article class="journal-card">
        <a class="journal-image" href="blog.html?slug=${encodeURIComponent(post.slug)}">
          ${post.thumbnail_url ? `<img src="${escapeHtml(post.thumbnail_url)}" alt="" />` : "<span>DOARE JOURNAL</span>"}
        </a>
        <div><time>${new Date(post.published_at || post.created_at).toLocaleDateString("vi-VN")}</time>
        <h3><a href="blog.html?slug=${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h3>
        <p>${escapeHtml(post.excerpt || "")}</p><a class="journal-link" href="blog.html?slug=${encodeURIComponent(post.slug)}">Đọc bài viết →</a></div>
      </article>`).join("");
    $("#journal-empty").hidden = state.posts.length > 0;
  }

  function renderCart() {
    const details = cartDetails();
    const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    $$(".cart-count").forEach((node) => (node.textContent = count));

    $("#cart-empty").hidden = details.length > 0;
    $(".cart-summary").hidden = details.length === 0;
    $("#cart-items").innerHTML = details
      .map(
        (item) => `
          <article class="cart-item">
            <div class="mini-bag" style="--accent:${item.accent}"><img src="${item.image}" alt="" /></div>
            <div>
              <h3>${item.name}</h3>
              <p>${item.weight} · ${item.roast}</p>
              <div class="quantity">
                <button type="button" data-quantity="${item.id}" data-delta="-1" aria-label="Giảm số lượng">−</button>
                <span>${item.quantity}</span>
                <button type="button" data-quantity="${item.id}" data-delta="1" aria-label="Tăng số lượng">+</button>
              </div>
            </div>
            <strong>${formatMoney(item.price * item.quantity)}</strong>
            <button class="remove-item" type="button" data-remove="${item.id}" aria-label="Xóa sản phẩm">×</button>
          </article>`
      )
      .join("");
    $("#cart-subtotal").textContent = formatMoney(cartSubtotal());
  }

  function addToCart(id, quantity = 1) {
    const current = state.cart.find((item) => item.id === id);
    if (current) current.quantity += quantity;
    else state.cart.push({ id, quantity });
    saveCart();
    showToast("Đã thêm cà phê vào giỏ hàng.");
  }

  function updateQuantity(id, delta) {
    const item = state.cart.find((entry) => entry.id === id);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) state.cart = state.cart.filter((entry) => entry.id !== id);
    saveCart();
  }

  function openCart() {
    $(".drawer-backdrop").hidden = false;
    $(".cart-drawer").setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
  }

  function closeCart() {
    $(".drawer-backdrop").hidden = true;
    $(".cart-drawer").setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
  }

  function renderCheckout() {
    const items = cartDetails();
    const subtotal = cartSubtotal();
    const shipping =
      subtotal >= window.DOARE_CONFIG.FREE_SHIPPING_THRESHOLD
        ? 0
        : window.DOARE_CONFIG.STANDARD_SHIPPING_FEE;
    $("#checkout-items").innerHTML = items
      .map(
        (item) =>
          `<div class="checkout-item"><span>${item.quantity}× ${item.name}</span><strong>${formatMoney(item.price * item.quantity)}</strong></div>`
      )
      .join("");
    $("#checkout-subtotal").textContent = formatMoney(subtotal);
    $("#checkout-shipping").textContent = shipping ? formatMoney(shipping) : "Miễn phí";
    $("#checkout-total").textContent = formatMoney(subtotal + shipping);
  }

  function openCheckout() {
    closeCart();
    renderCheckout();
    $(".modal-backdrop").hidden = false;
    document.body.classList.add("no-scroll");
  }

  function closeCheckout() {
    $(".modal-backdrop").hidden = true;
    document.body.classList.remove("no-scroll");
  }

  function showToast(message) {
    const toast = $(".toast");
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(showToast.timeout);
    showToast.timeout = setTimeout(() => toast.classList.remove("visible"), 2600);
  }

  async function submitOrder(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $(".submit-order", form);
    const message = $(".form-message", form);
    const data = Object.fromEntries(new FormData(form));
    const subtotal = cartSubtotal();
    const shipping =
      subtotal >= window.DOARE_CONFIG.FREE_SHIPPING_THRESHOLD
        ? 0
        : window.DOARE_CONFIG.STANDARD_SHIPPING_FEE;

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
        paymentMethod: data.payment,
        items: state.cart.map(({ id, quantity }) => ({ productId: id, quantity })),
        pricingPreview: { subtotal, shipping, total: subtotal + shipping }
      });

      state.cart = [];
      saveCart();
      form.reset();
      const paymentText =
        order.status === "waiting_payment"
          ? " Vui lòng chuyển khoản đúng số tiền và nội dung bên dưới."
          : " Chúng tôi sẽ gọi xác nhận trước khi giao.";
      const paymentMarkup = order.payment
        ? `<div class="payment-result">
            <img src="${order.payment.qrImageUrl}" alt="Mã QR thanh toán đơn ${order.id}" />
            <div>
              <span>Số tiền</span><strong>${formatMoney(order.payment.amount)}</strong>
              <span>Nội dung chuyển khoản</span><strong>${order.payment.content}</strong>
              <small>${order.payment.accountName} · ${order.payment.accountNo}</small>
            </div>
          </div>`
        : "";
      message.innerHTML = `<strong>Đặt hàng thành công: ${order.id}</strong>${paymentText}${paymentMarkup}`;
      button.textContent = "Đã tạo đơn hàng";
      if (!order.payment) setTimeout(closeCheckout, 4200);
    } catch (error) {
      message.textContent = error.message || "Có lỗi xảy ra. Vui lòng thử lại.";
      button.disabled = false;
      button.textContent = "Xác nhận đặt hàng";
    }
  }

  function bindEvents() {
    if (!window.DOARE_CONFIG.BANK_TRANSFER_ENABLED) {
      $("#bank-transfer-option").hidden = true;
    }

    document.addEventListener("click", (event) => {
      const add = event.target.closest("[data-add]");
      const quantity = event.target.closest("[data-quantity]");
      const remove = event.target.closest("[data-remove]");
      const galleryImage = event.target.closest("[data-gallery-image]");
      if (add) addToCart(add.dataset.add);
      if (quantity) updateQuantity(quantity.dataset.quantity, Number(quantity.dataset.delta));
      if (remove) {
        state.cart = state.cart.filter((item) => item.id !== remove.dataset.remove);
        saveCart();
      }
      if (galleryImage) {
        $(".single-product-image").src = galleryImage.dataset.galleryImage;
        $(".single-product-image").alt = galleryImage.dataset.galleryAlt;
        $$("[data-gallery-image]").forEach((button) => button.classList.toggle("active", button === galleryImage));
      }
    });

    $$("[data-feature-quantity]").forEach((button) =>
      button.addEventListener("click", () => {
        state.featuredQuantity = Math.max(
          1,
          Math.min(20, state.featuredQuantity + Number(button.dataset.featureQuantity))
        );
        renderFeaturedProduct();
      })
    );

    $(".featured-buy").addEventListener("click", () => {
      addToCart(state.products[0].id, state.featuredQuantity);
      state.featuredQuantity = 1;
      renderFeaturedProduct();
    });

    $(".featured-buy-now").addEventListener("click", () => {
      addToCart(state.products[0].id, state.featuredQuantity);
      state.featuredQuantity = 1;
      renderFeaturedProduct();
      openCart();
    });

    $(".cart-button").addEventListener("click", openCart);
    $(".close-drawer").addEventListener("click", closeCart);
    $(".drawer-backdrop").addEventListener("click", closeCart);
    $(".checkout-button").addEventListener("click", openCheckout);
    $(".close-checkout").addEventListener("click", closeCheckout);
    $(".modal-backdrop").addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeCheckout();
    });
    $("#checkout-form").addEventListener("submit", submitOrder);
    const announcementClose = $(".announcement button");
    if (announcementClose) announcementClose.addEventListener("click", () => $(".announcement").remove());

    $(".menu-button").addEventListener("click", (event) => {
      const expanded = event.currentTarget.getAttribute("aria-expanded") === "true";
      event.currentTarget.setAttribute("aria-expanded", String(!expanded));
      $(".mobile-nav").classList.toggle("open", !expanded);
    });
    $$(".mobile-nav a").forEach((link) =>
      link.addEventListener("click", () => {
        $(".mobile-nav").classList.remove("open");
        $(".menu-button").setAttribute("aria-expanded", "false");
      })
    );

    $("#contact-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = $(".contact-submit", form);
      const status = $(".contact-form-status", form);
      const data = Object.fromEntries(new FormData(form));

      button.disabled = true;
      button.firstChild.textContent = "Đang gửi... ";
      status.textContent = "";
      status.classList.remove("is-error");

      try {
        const result = await window.DoareAPI.sendContact({
          name: data.name.trim(),
          phone: data.phone.trim(),
          email: data.email.trim(),
          message: data.message.trim()
        });
        form.reset();
        status.textContent = result.emailSent
          ? "Lời nhắn đã được chuyển đến hệ thống tiếp nhận. Doare sẽ phản hồi bạn sớm."
          : "Lời nhắn đã được lưu. Hệ thống email đang chờ kích hoạt.";
        showToast(
          result.emailSent
            ? "Lời nhắn đã được chuyển đến Doare Coffee."
            : "Đã lưu lời nhắn, nhưng email chưa được gửi."
        );
      } catch (error) {
        status.textContent = error.message || "Chưa thể gửi lời nhắn. Vui lòng thử lại.";
        status.classList.add("is-error");
      } finally {
        button.disabled = false;
        button.firstChild.textContent = "Gửi lời nhắn ";
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeCart();
        closeCheckout();
      }
    });
  }

  function initExperience() {
    const main = $("#main");
    [$(".hero"), $(".trust-strip"), $("#story"), $("#process"), $("#products"), $("#journal"), $("#contact")]
      .filter(Boolean)
      .forEach((section) => main.append(section));

    const intro = $("#brand-intro");
    const finishIntro = () => {
      if (!intro || intro.classList.contains("leaving")) return;
      intro.classList.add("leaving");
      document.body.classList.add("intro-complete");
      setTimeout(() => intro.remove(), 850);
    };
    $("#skip-intro")?.addEventListener("click", finishIntro);
    setTimeout(finishIntro, 3000);

    const header = $("#site-header");
    const updateHeader = () => header?.classList.toggle("scrolled", window.scrollY > 40);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });

    const revealObserver = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      }),
      { threshold: 0.12 }
    );
    $$("[data-reveal]").forEach((section) => revealObserver.observe(section));
  }

  async function init() {
    initExperience();
    [state.products, state.posts] = await Promise.all([
      window.DoareAPI.getProducts(),
      window.DoareAPI.getPosts()
    ]);
    const validIds = new Set(state.products.map((product) => product.id));
    state.cart = state.cart.filter((item) => validIds.has(item.id));
    localStorage.setItem("doare_cart", JSON.stringify(state.cart));
    renderFeaturedProduct();
    renderPosts();
    renderCart();
    bindEvents();
  }

  init();
})();
