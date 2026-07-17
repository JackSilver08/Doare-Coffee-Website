(function () {
  const money = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  });
  const state = {
    token: localStorage.getItem("doare_admin_session") || "",
    orders: [],
    customers: [],
    products: window.DOARE_CATALOG || [],
    posts: [],
    dashboard: null,
    editingProductId: ""
  };
  const titles = {
    dashboard: "Tổng quan",
    orders: "Đơn hàng",
    customers: "Khách hàng",
    products: "Sản phẩm",
    content: "Nội dung"
  };
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const formatMoney = (value) => money.format(value || 0).replace("₫", "đ");
  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  function requireLogin() {
    if (state.token) return true;
    alert("Vui lòng đăng nhập quản trị trước khi chỉnh sửa.");
    return false;
  }

  async function adminRequest(path, options = {}) {
    const response = await fetch(`${window.DOARE_CONFIG.API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
        ...(options.headers || {})
      }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || "Không thể kết nối backend.");
    return body;
  }

  function normalizeOrder(order) {
    return {
      ...order,
      customer: { name: order.customer_name, phone: order.phone },
      paymentMethod: order.payment_method,
      status: order.order_status,
      createdAt: order.created_at,
      total: order.total
    };
  }

  function statusLabel(status) {
    return status === "confirmed" ? "Đã xác nhận" : "Chờ xử lý";
  }

  function orderRow(order, detailed = false) {
    return `<tr>
      <td><strong>${escapeHtml(order.id)}</strong></td>
      ${detailed ? `<td>${new Date(order.createdAt).toLocaleDateString("vi-VN")}</td>` : ""}
      <td>${escapeHtml(order.customer?.name || "—")}</td>
      ${detailed ? `<td>${escapeHtml(order.customer?.phone || "—")}</td>` : ""}
      <td>COD</td>
      <td>${formatMoney(order.total)}</td>
      <td><span class="status ${escapeHtml(order.status)}">${statusLabel(order.status)}</span></td>
    </tr>`;
  }

  const findProduct = (id) => state.products.find((product) => product.id === id);
  const isProductActive = (product) => product.active !== 0 && product.active !== false;

  /*
   * R2 chưa bật nên ảnh từ API là base64 chất lượng thấp. Khi hiển thị, ưu tiên
   * ảnh webp gốc trong repo theo id (giống storefront) mà không sửa dữ liệu đã lưu.
   */
  function displayImage(product) {
    if (!product) return "";
    if (/^(https?:\/\/|data:image\/|blob:)/i.test(product.image || "")) return product.image;
    const fromCatalog = (window.DOARE_CATALOG || []).find((entry) => entry.id === product.id);
    return fromCatalog ? fromCatalog.image : product.image;
  }

  function upsertProduct(product) {
    if (!product) return;
    const index = state.products.findIndex((entry) => entry.id === product.id);
    if (index >= 0) state.products[index] = product;
    else state.products.push(product);
    state.products.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  function renderProductGrid() {
    const grid = $("#admin-product-grid");
    if (!grid) return;
    if ($("#products-heading")) $("#products-heading").textContent = `Danh mục cà phê (${state.products.length})`;
    if ($("#products-empty")) $("#products-empty").hidden = state.products.length > 0;
    grid.innerHTML = state.products.map((product) => {
      const active = isProductActive(product);
      return `
      <article class="admin-product-card${active ? "" : " is-hidden"}" data-product-id="${escapeHtml(product.id)}">
        <div class="admin-product-visual" style="--accent:${escapeHtml(product.accent)}">
          <img class="admin-packshot" src="${escapeHtml(displayImage(product))}" alt="" />
          ${active ? "" : `<span class="admin-status-flag">Đang ẩn</span>`}
        </div>
        <div class="admin-product-info">
          <h3>${escapeHtml(product.name)}</h3>
          <p>${escapeHtml(product.subtitle)}</p>
          <div class="admin-product-meta">
            <strong>${formatMoney(product.price)}</strong>
            <span>${escapeHtml(product.weight)} · ${escapeHtml(product.roast)}</span>
          </div>
          ${product.badge ? `<span class="admin-badge">${escapeHtml(product.badge)}</span>` : ""}
          <div class="admin-product-actions">
            <button class="admin-edit-btn" type="button" data-edit-product="${escapeHtml(product.id)}">Chỉnh sửa</button>
            <button type="button" data-toggle-product="${escapeHtml(product.id)}">${active ? "Ẩn" : "Hiện"}</button>
            <button class="admin-danger" type="button" data-delete-product="${escapeHtml(product.id)}">Xóa</button>
          </div>
        </div>
      </article>`;
    }).join("");
  }

  function openProductModal() {
    $("#product-edit-modal").hidden = false;
    document.body.classList.add("modal-open");
  }

  function resetImageFields(form) {
    form.elements.editImage.value = "";
    form.elements.editStorageKey.value = "";
    form.elements.editMimeType.value = "";
    form.elements.editSizeBytes.value = "";
  }

  function openProductCreate() {
    if (!requireLogin()) return;
    state.editingProductId = "";
    const form = $("#product-edit-form");
    form.reset();
    form.elements.editMode.value = "create";
    form.elements.editId.value = "";
    form.elements.editActive.value = "1";
    form.elements.editSortOrder.value = state.products.length + 1;
    form.elements.editSlug.disabled = false;
    resetImageFields(form);
    $("#product-edit-eyebrow").textContent = "THÊM SẢN PHẨM";
    $("#edit-product-title").textContent = "Sản phẩm mới";
    $("#delete-product").hidden = true;
    $("#product-edit-message").textContent = "";
    $("#product-image-status").textContent = "";
    $("#product-edit-preview").innerHTML = "";
    renderProductImageUpload("");
    openProductModal();
  }

  function openProductEdit(id) {
    const product = findProduct(id);
    if (!product) return;
    state.editingProductId = id;
    const form = $("#product-edit-form");
    form.elements.editMode.value = "edit";
    form.elements.editId.value = product.id;
    form.elements.editSlug.value = product.id;
    form.elements.editSlug.disabled = true;
    form.elements.editName.value = product.name;
    form.elements.editPrice.value = product.price;
    form.elements.editSubtitle.value = product.subtitle;
    form.elements.editWeight.value = product.weight;
    form.elements.editRoast.value = product.roast;
    form.elements.editNotes.value = (product.notes || []).join(", ");
    form.elements.editBadge.value = product.badge || "";
    form.elements.editSortOrder.value = product.sort_order ?? 0;
    form.elements.editActive.value = isProductActive(product) ? "1" : "0";
    form.elements.editImage.value = product.image;
    const primary = (product.gallery || []).find((item) => item.image_url === product.image)
      || (product.gallery || [])[0] || {};
    form.elements.editStorageKey.value = primary.storage_key || "";
    form.elements.editMimeType.value = primary.mime_type || "";
    form.elements.editSizeBytes.value = primary.size_bytes || "";
    $("#product-edit-eyebrow").textContent = "CHỈNH SỬA SẢN PHẨM";
    $("#edit-product-title").textContent = product.name;
    $("#delete-product").hidden = false;
    $("#product-edit-message").textContent = "";
    $("#product-image-status").textContent = "";
    $("#product-edit-preview").innerHTML = `
      <div class="admin-product-visual" style="--accent:${escapeHtml(product.accent)}">
        <img class="admin-packshot" src="${escapeHtml(displayImage(product))}" alt="" />
      </div>`;
    renderProductImageUpload(displayImage(product));
    openProductModal();
  }

  function closeProductEdit() {
    $("#product-edit-modal").hidden = true;
    document.body.classList.remove("modal-open");
    state.editingProductId = "";
  }

  async function saveProductEdit(event) {
    event.preventDefault();
    if (!requireLogin()) return;
    const form = event.currentTarget;
    const message = $("#product-edit-message");
    const mode = form.elements.editMode.value;
    const slug = form.elements.editSlug.value.trim().toLowerCase();
    const image = form.elements.editImage.value.trim();
    if (mode === "create" && !slug) {
      message.textContent = "Vui lòng nhập ID/slug cho sản phẩm mới.";
      return;
    }
    if (!image) {
      message.textContent = "Vui lòng tải ảnh sản phẩm lên trước khi lưu.";
      return;
    }
    const name = form.elements.editName.value.trim();
    const payload = {
      name,
      price: Number(form.elements.editPrice.value),
      subtitle: form.elements.editSubtitle.value.trim(),
      weight: form.elements.editWeight.value.trim(),
      roast: form.elements.editRoast.value.trim(),
      notes: form.elements.editNotes.value.split(",").map((item) => item.trim()).filter(Boolean),
      badge: form.elements.editBadge.value.trim(),
      sortOrder: Number(form.elements.editSortOrder.value) || 0,
      active: form.elements.editActive.value === "1",
      image,
      images: [{
        imageUrl: image,
        altText: name,
        storageKey: form.elements.editStorageKey.value.trim(),
        mimeType: form.elements.editMimeType.value.trim(),
        sizeBytes: Number(form.elements.editSizeBytes.value) || 0
      }]
    };
    try {
      message.textContent = "Đang lưu...";
      let result;
      if (mode === "create") {
        payload.id = slug;
        result = await adminRequest("/api/admin/products", { method: "POST", body: JSON.stringify(payload) });
      } else {
        result = await adminRequest(`/api/admin/products/${form.elements.editId.value}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
      }
      upsertProduct(result.product);
      renderProductGrid();
      if ($("#products-stat")) $("#products-stat").textContent = state.products.length;
      message.textContent = "Đã lưu và cập nhật storefront.";
      setTimeout(closeProductEdit, 1100);
    } catch (error) {
      message.textContent = error.message;
    }
  }

  async function toggleProductStatus(id) {
    if (!requireLogin()) return;
    const product = findProduct(id);
    if (!product) return;
    try {
      const result = await adminRequest(`/api/admin/products/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ active: !isProductActive(product) })
      });
      upsertProduct(result.product);
      renderProductGrid();
    } catch (error) {
      alert(error.message);
    }
  }

  async function deleteProduct(id) {
    if (!requireLogin()) return;
    const product = findProduct(id) || { name: id };
    if (!confirm(`Ẩn sản phẩm “${product.name}” khỏi cửa hàng? Đơn hàng cũ vẫn được giữ nguyên.`)) return;
    try {
      await adminRequest(`/api/admin/products/${id}`, { method: "DELETE" });
      state.products = state.products.filter((entry) => entry.id !== id);
      renderProductGrid();
      if ($("#products-stat")) $("#products-stat").textContent = state.products.length;
      if (state.editingProductId === id) closeProductEdit();
    } catch (error) {
      alert(error.message);
    }
  }

  function renderPosts() {
    const postList = $("#post-list");
    if (postList) {
      postList.innerHTML = state.posts.map((post) => `
        <button type="button" class="post-list-item" data-post-id="${post.id}">
          ${post.thumbnail_url ? `<img src="${escapeHtml(post.thumbnail_url)}" alt="" />` : "<span>MD</span>"}
          <div><strong>${escapeHtml(post.title)}</strong><small>${post.status === "published" ? "Đã đăng" : "Bản nháp"}</small></div>
        </button>`).join("");
    }
    if ($("#posts-empty")) $("#posts-empty").hidden = state.posts.length > 0;
  }

  function render() {
    const orderCount = state.dashboard?.orders || state.orders.length;
    if ($("#revenue-stat")) $("#revenue-stat").textContent = formatMoney(state.dashboard?.revenue || 0);
    if ($("#orders-stat")) $("#orders-stat").textContent = orderCount;
    if ($("#products-stat")) $("#products-stat").textContent = state.products.length;
    if ($("#pending-count")) $("#pending-count").textContent = orderCount;

    if ($("#recent-orders")) $("#recent-orders").innerHTML = state.orders.slice(0, 5).map((order) => orderRow(order)).join("");
    if ($("#all-orders")) $("#all-orders").innerHTML = state.orders.map((order) => orderRow(order, true)).join("");
    if ($("#all-customers")) $("#all-customers").innerHTML = state.customers.map((customer) => `
      <tr><td><strong>${escapeHtml(customer.name)}</strong></td><td>${escapeHtml(customer.phone)}</td>
      <td>${escapeHtml(customer.email || "—")}</td><td>${customer.order_count}</td>
      <td>${formatMoney(customer.total_spent)}</td>
      <td>${new Date(customer.last_order_at).toLocaleDateString("vi-VN")}</td></tr>`).join("");
      
    if ($("#dashboard-empty")) $("#dashboard-empty").hidden = state.orders.length > 0;
    if ($("#orders-empty")) $("#orders-empty").hidden = state.orders.length > 0;
    if ($("#customers-empty")) $("#customers-empty").hidden = state.customers.length > 0;
    
    renderProductGrid();
    renderPosts();
  }

  async function loadBackend() {
    const button = $("#connect-api");
    button.disabled = true;
    button.textContent = "Đang kết nối...";
    try {
      const [dashboard, orderData, customerData, productData, postData] = await Promise.all([
        adminRequest("/api/admin/dashboard"),
        adminRequest("/api/admin/orders?limit=100"),
        adminRequest("/api/admin/customers?limit=100"),
        adminRequest("/api/admin/products"),
        adminRequest("/api/admin/posts")
      ]);
      state.dashboard = dashboard;
      state.orders = orderData.orders.map(normalizeOrder);
      state.customers = customerData.customers;
      state.products = productData.products;
      state.posts = postData.posts;
      localStorage.setItem("doare_admin_session", state.token);
      button.textContent = "Đăng xuất";
      button.classList.add("connected");
      render();
    } catch (error) {
      state.token = "";
      localStorage.removeItem("doare_admin_session");
      button.textContent = "Đăng nhập";
      button.classList.remove("connected");
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
    return body.token;
  }

  async function connectBackend() {
    if (!window.DOARE_CONFIG.API_BASE_URL) return alert("Chưa cấu hình API_BASE_URL.");
    if (state.token && $("#connect-api").classList.contains("connected")) {
      await adminRequest("/api/admin/logout", { method: "POST" }).catch(() => {});
      state.token = "";
      localStorage.removeItem("doare_admin_session");
      location.reload();
      return;
    }
    openLoginModal();
  }

  function openLoginModal() {
    const modal = $("#login-modal");
    modal.hidden = false;
    document.body.classList.add("modal-open");
    $("#login-error").textContent = "";
    setTimeout(() => $("#login-form").elements.password.focus(), 0);
  }

  function closeLoginModal() {
    $("#login-modal").hidden = true;
    document.body.classList.remove("modal-open");
    $("#login-form").reset();
    $("#login-form").elements.email.value = "admin@dorae.com";
    $("#login-form").elements.password.type = "password";
    $("#toggle-password").textContent = "Hiện";
    $("#login-error").textContent = "";
  }

  async function submitLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $(".login-submit", form);
    const errorNode = $("#login-error");
    const data = Object.fromEntries(new FormData(form));
    try {
      button.disabled = true;
      button.textContent = "Đang xác thực...";
      errorNode.textContent = "";
      state.token = await loginAdmin(data.email.trim(), data.password);
      await loadBackend();
      closeLoginModal();
    } catch (error) {
      errorNode.textContent = error.message;
      form.elements.password.select();
    } finally {
      button.disabled = false;
      button.textContent = "Đăng nhập quản trị";
    }
  }

  function switchView(view) {
    $$(".view").forEach((node) => node.classList.toggle("active", node.id === `${view}-view`));
    $$("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    $("#page-title").textContent = titles[view];
  }

  function slugify(value) {
    return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function plainTextFromMarkdown(value) {
    return String(value || "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[`*_>#~-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9\s-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function keywordCount(text, keyword) {
    const normalizedText = normalizeSearchText(text);
    const normalizedKeyword = normalizeSearchText(keyword);
    if (!normalizedText || !normalizedKeyword) return 0;
    const pattern = new RegExp(`(^|\\s)${normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`, "g");
    return (normalizedText.match(pattern) || []).length;
  }

  function markdownImages(markdown) {
    return [...String(markdown || "").matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)]
      .map((match) => ({ alt: match[1] || "", url: match[2] || "" }));
  }

  function markdownLinks(markdown) {
    return [...String(markdown || "").matchAll(/(?<!!)\[([^\]]+)\]\(([^)]+)\)/g)]
      .map((match) => match[2] || "");
  }

  function seoTitle(form) {
    const title = form.elements.title.value.trim();
    const template = form.elements.seoTitle?.value.trim();
    return template ? template.replaceAll("%title%", title) : `${title} | Dorae Coffee`;
  }

  function seoDescription(form) {
    const explicit = form.elements.seoDescription?.value.trim() || form.elements.excerpt.value.trim();
    const source = explicit || plainTextFromMarkdown(form.elements.markdown.value);
    if (!source) return "";
    return source.length > 160 ? `${source.slice(0, 157).trimEnd()}...` : source;
  }

  function analyzeSeo(form) {
    const title = form.elements.title.value.trim();
    const titleForSeo = seoTitle(form);
    const slug = form.elements.slug.value.trim() || slugify(title);
    const description = seoDescription(form);
    const markdown = form.elements.markdown.value;
    const plain = plainTextFromMarkdown(markdown);
    const words = plain.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const keyword = form.elements.focusKeyword?.value.trim() || "";
    const images = markdownImages(markdown);
    const links = markdownLinks(markdown);
    const internalLinks = links.filter((url) => /doraecoffee\.io\.vn|^\/|^#|^assets\//i.test(url)).length;
    const externalLinks = links.filter((url) => /^https?:\/\//i.test(url) && !/doraecoffee\.io\.vn/i.test(url)).length;
    const headingCount = (markdown.match(/^#{2,3}\s+.+$/gm) || []).length;
    const keywordHits = keywordCount(plain, keyword);
    const density = wordCount && keyword ? keywordHits / wordCount * 100 : 0;
    const firstPart = words.slice(0, Math.max(30, Math.ceil(wordCount * 0.1))).join(" ");
    const hasKeyword = Boolean(keyword);
    const rules = [
      { ok: hasKeyword, weight: 10, label: hasKeyword ? `Từ khóa chính: "${keyword}"` : "Nhập từ khóa chính cho bài viết" },
      { ok: hasKeyword && keywordCount(titleForSeo, keyword) > 0, weight: 10, label: "Từ khóa xuất hiện trong SEO title" },
      { ok: hasKeyword && keywordCount(description, keyword) > 0, weight: 10, label: "Từ khóa xuất hiện trong meta description" },
      { ok: hasKeyword && normalizeSearchText(slug).includes(normalizeSearchText(keyword).replace(/\s+/g, "-")), weight: 8, label: "Slug URL có chứa từ khóa" },
      { ok: hasKeyword && keywordCount(firstPart, keyword) > 0, weight: 8, label: "Từ khóa nằm ở đoạn mở đầu" },
      { ok: titleForSeo.length >= 35 && titleForSeo.length <= 60, weight: 8, label: `SEO title ${titleForSeo.length}/60 ký tự` },
      { ok: description.length >= 120 && description.length <= 160, weight: 8, label: `Meta description ${description.length}/160 ký tự` },
      { ok: wordCount >= 600, weight: 10, label: `${wordCount} từ nội dung, nên từ 600 từ trở lên` },
      { ok: headingCount >= 2, weight: 7, label: `${headingCount} heading H2/H3 trong thân bài` },
      { ok: images.length > 0 || Boolean(form.elements.thumbnailUrl.value.trim()), weight: 7, label: `${images.length} ảnh trong bài và thumbnail` },
      { ok: !hasKeyword || images.some((image) => keywordCount(image.alt, keyword) > 0), weight: 6, label: "Alt ảnh có chứa từ khóa chính" },
      { ok: density >= 0.5 && density <= 2.5, weight: 8, label: `Mật độ từ khóa ${density.toFixed(1)}%` },
      { ok: internalLinks > 0, weight: 4, label: "Có liên kết nội bộ" },
      { ok: externalLinks > 0, weight: 4, label: "Có liên kết ngoài đáng tin cậy" }
    ];
    const score = Math.min(100, rules.reduce((sum, rule) => sum + (rule.ok ? rule.weight : 0), 0));
    return { score, rules, titleForSeo, slug, description };
  }

  function updateSeoPreview() {
    const form = $("#post-form");
    if (!form || !$("#seo-preview-title-text")) return;
    const title = form.elements.title.value.trim();
    const analysis = analyzeSeo(form);
    const score = $("#seo-score");

    $("#seo-preview-url").textContent = `https://doraecoffee.io.vn/blog?slug=${analysis.slug || "duong-dan-bai-viet"}`;
    $("#seo-preview-title-text").textContent = analysis.titleForSeo || `${title || "Tiêu đề bài viết"} | Dorae Coffee`;
    $("#seo-preview-description").textContent = analysis.description || "Meta description sẽ hiển thị tại đây khi nhập mô tả SEO, mô tả ngắn hoặc nội dung bài viết.";
    if (score) {
      score.querySelector("strong").textContent = analysis.score;
      score.classList.toggle("good", analysis.score >= 80);
      score.classList.toggle("warn", analysis.score >= 50 && analysis.score < 80);
      score.classList.toggle("poor", analysis.score < 50);
    }
    $("#seo-checklist").innerHTML = analysis.rules.map((rule) => {
      const state = rule.ok ? "pass" : rule.weight >= 8 ? "fail" : "warning";
      return `<li class="${state === "pass" ? "" : state}"><span>${rule.ok ? "Đạt" : "Sửa"}</span>${escapeHtml(rule.label)}</li>`;
    }).join("");
  }

  async function selectPost(post) {
    const form = $("#post-form");
    let resolvedPost = post;
    if (resolvedPost?.id && !Object.prototype.hasOwnProperty.call(resolvedPost, "markdown")) {
      try {
        const response = await adminRequest(`/api/admin/posts/${resolvedPost.id}`);
        resolvedPost = response.post || resolvedPost;
      } catch (error) {
        $("#post-message").textContent = error.message;
      }
    }
    form.elements.id.value = resolvedPost?.id || "";
    form.elements.title.value = resolvedPost?.title || "";
    form.elements.slug.value = resolvedPost?.slug || "";
    form.elements.excerpt.value = resolvedPost?.excerpt || "";
    form.elements.thumbnailUrl.value = resolvedPost?.thumbnail_url || "";
    form.elements.markdown.value = resolvedPost?.markdown || "";
    if (form.elements.focusKeyword) form.elements.focusKeyword.value = resolvedPost?.focus_keyword || resolvedPost?.focusKeyword || "";
    if (form.elements.seoTitle) form.elements.seoTitle.value = resolvedPost?.seo_title || resolvedPost?.seoTitle || "";
    if (form.elements.seoDescription) form.elements.seoDescription.value = resolvedPost?.seo_description || resolvedPost?.seoDescription || "";
    form.elements.status.value = resolvedPost?.status || "draft";
    $("#delete-post").hidden = !resolvedPost;
    $("#post-message").textContent = "";
    renderThumbnailUpload(resolvedPost?.thumbnail_url || "");
    updateMarkdownPreview();
    updateSeoPreview();
  }

  function renderThumbnailUpload(source) {
    const preview = $("#thumbnail-upload-preview");
    const hasImage = Boolean(source);
    preview.classList.toggle("has-image", hasImage);
    preview.innerHTML = hasImage
      ? `<img src="${escapeHtml(source)}" alt="Xem trước thumbnail" />`
      : "<strong>Chọn ảnh</strong><small>JPEG, PNG hoặc WebP</small><small>Ảnh sẽ tự crop thành 720 × 720</small>";
    $("#replace-thumbnail").hidden = !hasImage;
    $("#remove-thumbnail").hidden = !hasImage;
  }

  function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Không thể đọc file ảnh."));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("File ảnh không hợp lệ."));
        image.onload = () => resolve(image);
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function makeSquareThumbnail(file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.");
    }
    if (file.size > 12 * 1024 * 1024) throw new Error("Ảnh gốc không được lớn hơn 12MB.");
    const image = await readImage(file);
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = Math.floor((image.naturalWidth - side) / 2);
    const sourceY = Math.floor((image.naturalHeight - side) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 720;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 720, 720);
    context.drawImage(image, sourceX, sourceY, side, side, 0, 0, 720, 720);
    const output = canvas.toDataURL("image/webp", 0.82);
    if (output.length > 380000) {
      return canvas.toDataURL("image/webp", 0.68);
    }
    return output;
  }

  async function makeContentImageBlob(file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.");
    }
    if (file.size > 12 * 1024 * 1024) throw new Error("Ảnh gốc không được lớn hơn 12MB.");
    const image = await readImage(file);
    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / image.naturalWidth);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Không thể nén ảnh."))),
        "image/webp",
        0.84
      );
    });
  }

  async function uploadBlogImageRequest(formData) {
    const response = await fetch(`${window.DOARE_CONFIG.API_BASE_URL}/api/admin/blog-images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${state.token}` },
      body: formData
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.message || "Không tải được ảnh nội dung lên cloud.");
      error.status = response.status;
      throw error;
    }
    return body;
  }

  function insertIntoMarkdown(markdown) {
    const textarea = $("#post-form").elements.markdown;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    const needsBefore = before && !before.endsWith("\n") ? "\n\n" : "";
    const needsAfter = after && !after.startsWith("\n") ? "\n\n" : "";
    textarea.value = `${before}${needsBefore}${markdown}${needsAfter}${after}`;
    const cursor = (before + needsBefore + markdown).length;
    textarea.focus();
    textarea.setSelectionRange(cursor, cursor);
    updateMarkdownPreview();
    updateSeoPreview();
  }

  function applyMarkdownAction(action) {
    const textarea = $("#post-form").elements.markdown;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const selected = textarea.value.slice(start, end) || "nội dung";
    const replacements = {
      h2: `\n\n## ${selected.replace(/^#+\s*/, "")}\n\n`,
      bold: `**${selected}**`,
      italic: `*${selected}*`,
      list: selected.split("\n").map((line) => `- ${line.replace(/^[-*]\s*/, "")}`).join("\n"),
      quote: selected.split("\n").map((line) => `> ${line.replace(/^>\s*/, "")}`).join("\n"),
      link: `[${selected}](https://doraecoffee.io.vn/)`,
      "image-url": `![Mô tả ảnh](https://example.com/anh-bai-viet.webp)`
    };
    textarea.setRangeText(replacements[action] || selected, start, end, "end");
    textarea.focus();
    updateMarkdownPreview();
    updateSeoPreview();
  }

  async function selectContentImageFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const status = $("#content-image-status");
    if (!requireLogin()) {
      event.target.value = "";
      return;
    }
    try {
      status.textContent = "Đang xử lý ảnh nội dung...";
      const blob = await makeContentImageBlob(file);
      const form = $("#post-form");
      const slug = form.elements.slug.value.trim().toLowerCase() || slugify(form.elements.title.value) || "bai-viet";
      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || form.elements.title.value.trim() || "Ảnh bài viết";
      try {
        status.textContent = "Đang tải ảnh nội dung lên cloud...";
        const data = new FormData();
        data.append("file", blob, `${slug}.webp`);
        data.append("postSlug", slug);
        const result = await uploadBlogImageRequest(data);
        insertIntoMarkdown(`![${alt}](${result.imageUrl})`);
        status.textContent = `Đã chèn ảnh vào bài · ${Math.round((result.sizeBytes || blob.size) / 1024)}KB`;
      } catch (uploadError) {
        const dataUrl = await blobToDataUrl(blob);
        if (dataUrl.length > 28000) {
          throw new Error("Ảnh nội dung cần cloud/R2 để lưu ổn định. Hãy bật R2 hoặc dùng URL ảnh công khai.");
        }
        insertIntoMarkdown(`![${alt}](${dataUrl})`);
        status.textContent = "Đã chèn ảnh dạng đính kèm nhỏ. Nên bật R2 để tối ưu tốc độ tải.";
      }
    } catch (error) {
      status.textContent = error.message;
    } finally {
      event.target.value = "";
    }
  }

  function renderProductImageUpload(source) {
    const preview = $("#product-image-preview");
    if (!preview) return;
    const hasImage = Boolean(source);
    preview.classList.toggle("has-image", hasImage);
    preview.innerHTML = hasImage
      ? `<img src="${escapeHtml(source)}" alt="Xem trước ảnh" />`
      : "<strong>Chọn ảnh</strong><small>JPEG, PNG hoặc WebP</small>";
    if ($("#replace-product-image")) $("#replace-product-image").hidden = !hasImage;
    if ($("#remove-product-image")) $("#remove-product-image").hidden = !hasImage;
  }

  async function makeProductImageBlob(file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.");
    }
    if (file.size > 12 * 1024 * 1024) throw new Error("Ảnh gốc không được lớn hơn 12MB.");
    const image = await readImage(file);
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = Math.floor((image.naturalWidth - side) / 2);
    const sourceY = Math.floor((image.naturalHeight - side) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 720;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, 720, 720);
    context.drawImage(image, sourceX, sourceY, side, side, 0, 0, 720, 720);
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Không thể nén ảnh."))),
        "image/webp",
        0.9
      );
    });
  }

  async function uploadProductImageRequest(formData) {
    const response = await fetch(`${window.DOARE_CONFIG.API_BASE_URL}/api/admin/product-images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${state.token}` },
      body: formData
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.message || "Không tải được ảnh lên cloud.");
      error.status = response.status;
      throw error;
    }
    return body;
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Không thể đọc ảnh."));
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  function applyProductImage(form, source) {
    renderProductImageUpload(source);
    const accent = findProduct(state.editingProductId)?.accent || "#c9e5f2";
    $("#product-edit-preview").innerHTML = `
      <div class="admin-product-visual" style="--accent:${escapeHtml(accent)}">
        <img class="admin-packshot" src="${escapeHtml(source)}" alt="" />
      </div>`;
  }

  async function selectProductImageFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const status = $("#product-image-status");
    const form = $("#product-edit-form");
    if (!requireLogin()) {
      event.target.value = "";
      return;
    }
    try {
      status.textContent = "Đang xử lý ảnh...";
      const blob = await makeProductImageBlob(file);
      const productId = form.elements.editSlug.value.trim().toLowerCase()
        || form.elements.editId.value || "misc";
      try {
        status.textContent = "Đang tải ảnh lên cloud...";
        const data = new FormData();
        data.append("file", blob, `${productId}.webp`);
        data.append("productId", productId);
        const result = await uploadProductImageRequest(data);
        form.elements.editImage.value = result.imageUrl;
        form.elements.editStorageKey.value = result.storageKey || "";
        form.elements.editMimeType.value = result.mimeType || "";
        form.elements.editSizeBytes.value = result.sizeBytes || 0;
        applyProductImage(form, result.imageUrl);
        status.textContent = `Đã tải ảnh lên cloud · ${Math.round((result.sizeBytes || 0) / 1024)}KB`;
      } catch (uploadError) {
        /* R2 chưa bật (503) hoặc lỗi mạng: lưu ảnh kèm sản phẩm để vẫn dùng được. */
        const dataUrl = await blobToDataUrl(blob);
        if (dataUrl.length > 400000) {
          throw new Error("Ảnh quá lớn để lưu kèm. Hãy chọn ảnh nhỏ hơn hoặc bật R2.");
        }
        form.elements.editImage.value = dataUrl;
        form.elements.editStorageKey.value = "";
        form.elements.editMimeType.value = "image/webp";
        form.elements.editSizeBytes.value = Math.round(dataUrl.length * 0.75);
        applyProductImage(form, dataUrl);
        status.textContent = "Đã đính kèm ảnh (chưa dùng cloud — bật R2 để tối ưu).";
      }
    } catch (error) {
      status.textContent = error.message;
    } finally {
      event.target.value = "";
    }
  }

  function removeProductImage() {
    resetImageFields($("#product-edit-form"));
    $("#product-image-status").textContent = "Đã xóa ảnh. Hãy tải ảnh khác trước khi lưu.";
    renderProductImageUpload("");
    $("#product-edit-preview").innerHTML = "";
  }

  async function selectThumbnailFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const status = $("#thumbnail-status");
    try {
      status.textContent = "Đang crop và nén ảnh...";
      const thumbnail = await makeSquareThumbnail(file);
      if (thumbnail.length > 400000) throw new Error("Ảnh sau khi nén vẫn quá lớn. Hãy chọn ảnh khác.");
      $("#post-form").elements.thumbnailUrl.value = thumbnail;
      renderThumbnailUpload(thumbnail);
      updateMarkdownPreview();
      updateSeoPreview();
      status.textContent = `Đã tạo thumbnail vuông · ${Math.round(thumbnail.length * 0.75 / 1024)}KB`;
    } catch (error) {
      status.textContent = error.message;
    } finally {
      event.target.value = "";
    }
  }

  function removeThumbnail() {
    $("#post-form").elements.thumbnailUrl.value = "";
    $("#thumbnail-status").textContent = "Đã xóa thumbnail khỏi bài viết.";
    renderThumbnailUpload("");
    updateMarkdownPreview();
    updateSeoPreview();
  }

  function updateMarkdownPreview() {
    const form = $("#post-form");
    const title = escapeHtml(form.elements.title.value || "Tiêu đề bài viết");
    const thumbnail = form.elements.thumbnailUrl.value.trim();
    $("#markdown-preview").innerHTML = `
      ${thumbnail ? `<img class="preview-thumbnail" src="${escapeHtml(thumbnail)}" alt="" />` : ""}
      <h1>${title}</h1>${window.DoareMarkdown.render(form.elements.markdown.value)}`;
  }

  async function savePost(event) {
    event.preventDefault();
    if (!requireLogin()) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    if (!data.excerpt.trim()) data.excerpt = seoDescription(form);
    if (!data.seoDescription?.trim()) data.seoDescription = seoDescription(form);
    const id = data.id;
    const message = $("#post-message");
    try {
      message.textContent = "Đang lưu...";
      const result = await adminRequest(id ? `/api/admin/posts/${id}` : "/api/admin/posts", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(data)
      });
      const index = state.posts.findIndex((post) => post.id === result.post.id);
      if (index >= 0) state.posts[index] = result.post;
      else state.posts.unshift(result.post);
      renderPosts();
      await selectPost(result.post);
      message.textContent = "Đã lưu bài viết.";
    } catch (error) {
      message.textContent = error.message;
    }
  }

  async function deletePost() {
    const id = $("#post-form").elements.id.value;
    if (!id || !requireLogin() || !confirm("Xóa bài viết này?")) return;
    try {
      await adminRequest(`/api/admin/posts/${id}`, { method: "DELETE" });
      state.posts = state.posts.filter((post) => post.id !== id);
      renderPosts();
      selectPost(null);
    } catch (error) {
      $("#post-message").textContent = error.message;
    }
  }

  function exportOrders() {
    if (!state.orders.length) return;
    const lines = [["Ma don", "Ngay", "Khach hang", "Dien thoai", "Thanh toan", "Tong tien", "Trang thai"]];
    state.orders.forEach((order) => lines.push([
      order.id, order.createdAt, order.customer?.name, order.customer?.phone,
      order.paymentMethod, order.total, order.status
    ]));
    const csv = lines.map((line) => line.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    link.download = `doare-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  $$("[data-view]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
  $$("[data-go]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.go)));
  $("#connect-api")?.addEventListener("click", connectBackend);
  $("#login-form")?.addEventListener("submit", submitLogin);
  $("#login-close")?.addEventListener("click", closeLoginModal);
  $("#login-modal")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeLoginModal();
  });
  $("#toggle-password")?.addEventListener("click", (event) => {
    const input = $("#login-form").elements.password;
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    event.currentTarget.textContent = showing ? "Hiện" : "Ẩn";
  });
  $("#export-orders")?.addEventListener("click", exportOrders);

  /* Product editing events */
  $("#admin-product-grid")?.addEventListener("click", (event) => {
    const toggleBtn = event.target.closest("[data-toggle-product]");
    const deleteBtn = event.target.closest("[data-delete-product]");
    const editBtn = event.target.closest("[data-edit-product]");
    if (toggleBtn) return toggleProductStatus(toggleBtn.dataset.toggleProduct);
    if (deleteBtn) return deleteProduct(deleteBtn.dataset.deleteProduct);
    if (editBtn) return openProductEdit(editBtn.dataset.editProduct);
  });
  $("#new-product")?.addEventListener("click", openProductCreate);
  $("#delete-product")?.addEventListener("click", () =>
    deleteProduct($("#product-edit-form").elements.editId.value)
  );
  $("#product-edit-form")?.addEventListener("submit", saveProductEdit);
  $("#close-product-edit")?.addEventListener("click", closeProductEdit);
  $("#product-edit-modal")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeProductEdit();
  });
  
  $("#product-image-file")?.addEventListener("change", selectProductImageFile);
  $("#replace-product-image")?.addEventListener("click", () => $("#product-image-file").click());
  $("#remove-product-image")?.addEventListener("click", removeProductImage);

  /* Post editing events */
  $("#post-form")?.addEventListener("submit", savePost);
  $("#delete-post")?.addEventListener("click", deletePost);
  $("#new-post")?.addEventListener("click", () => selectPost(null));
  $("#thumbnail-file")?.addEventListener("change", selectThumbnailFile);
  $("#content-image-file")?.addEventListener("change", selectContentImageFile);
  $("#insert-content-image")?.addEventListener("click", () => $("#content-image-file").click());
  $(".markdown-toolbar")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-md-action]");
    if (button) applyMarkdownAction(button.dataset.mdAction);
  });
  $("#replace-thumbnail")?.addEventListener("click", () => $("#thumbnail-file").click());
  $("#remove-thumbnail")?.addEventListener("click", removeThumbnail);
  $("#post-list")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-post-id]");
    if (button) selectPost(state.posts.find((post) => post.id === button.dataset.postId));
  });
  $("#post-form")?.addEventListener("input", (event) => {
    if (event.target.name === "title" && !event.currentTarget.elements.id.value) {
      event.currentTarget.elements.slug.value = slugify(event.target.value);
    }
    updateMarkdownPreview();
    updateSeoPreview();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!$("#product-edit-modal").hidden) closeProductEdit();
      else if (!$("#login-modal").hidden) closeLoginModal();
    }
  });

  render();
  selectPost(null);
  if (state.token && window.DOARE_CONFIG.API_BASE_URL) {
    loadBackend().catch(() => alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."));
  }
})();
