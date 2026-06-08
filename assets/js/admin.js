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
    editingProductIndex: -1
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
    return status === "confirmed" ? "Đã xác nhận" : "Chờ thanh toán";
  }

  function orderRow(order, detailed = false) {
    return `<tr>
      <td><strong>${escapeHtml(order.id)}</strong></td>
      ${detailed ? `<td>${new Date(order.createdAt).toLocaleDateString("vi-VN")}</td>` : ""}
      <td>${escapeHtml(order.customer?.name || "—")}</td>
      ${detailed ? `<td>${escapeHtml(order.customer?.phone || "—")}</td>` : ""}
      <td>${order.paymentMethod === "cod" ? "COD" : "Chuyển khoản"}</td>
      <td>${formatMoney(order.total)}</td>
      <td><span class="status ${escapeHtml(order.status)}">${statusLabel(order.status)}</span></td>
    </tr>`;
  }

  function renderProductGrid() {
    const grid = $("#admin-product-grid");
    if (!grid) return;
    grid.innerHTML = state.products.map((product, index) => `
      <article class="admin-product-card" data-edit-product="${index}">
        <div class="admin-product-visual" style="--accent:${escapeHtml(product.accent)}">
          <img class="admin-packshot" src="${escapeHtml(product.image)}" alt="" />
        </div>
        <div class="admin-product-info">
          <h3>${escapeHtml(product.name)}</h3>
          <p>${escapeHtml(product.subtitle)}</p>
          <div class="admin-product-meta">
            <strong>${formatMoney(product.price)}</strong>
            <span>${escapeHtml(product.weight)} · ${escapeHtml(product.roast)}</span>
          </div>
          ${product.badge ? `<span class="admin-badge">${escapeHtml(product.badge)}</span>` : ""}
          <button class="admin-edit-btn" type="button" data-edit-product="${index}">Chỉnh sửa</button>
        </div>
      </article>`).join("");
  }

  function openProductEdit(index) {
    const product = state.products[index];
    if (!product) return;
    state.editingProductIndex = index;
    const form = $("#product-edit-form");
    form.elements.editIndex.value = index;
    form.elements.editName.value = product.name;
    form.elements.editPrice.value = product.price;
    form.elements.editSubtitle.value = product.subtitle;
    form.elements.editWeight.value = product.weight;
    form.elements.editRoast.value = product.roast;
    form.elements.editNotes.value = (product.notes || []).join(", ");
    form.elements.editBadge.value = product.badge || "";
    form.elements.editImage.value = product.image;
    $("#edit-product-title").textContent = product.name;
    $("#product-edit-preview").innerHTML = `
      <div class="admin-product-visual" style="--accent:${escapeHtml(product.accent)}">
        <img class="admin-packshot" src="${escapeHtml(product.image)}" alt="" />
      </div>`;
    $("#product-edit-message").textContent = "";
    $("#product-image-status").textContent = "";
    renderProductImageUpload(product.image);
    $("#product-edit-modal").hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeProductEdit() {
    $("#product-edit-modal").hidden = true;
    document.body.classList.remove("modal-open");
    state.editingProductIndex = -1;
  }

  async function saveProductEdit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const index = Number(form.elements.editIndex.value);
    const product = state.products[index];
    if (!product) return;
    const message = $("#product-edit-message");

    const updatedProduct = {
      ...product,
      name: form.elements.editName.value.trim(),
      price: Number(form.elements.editPrice.value),
      subtitle: form.elements.editSubtitle.value.trim(),
      weight: form.elements.editWeight.value.trim(),
      roast: form.elements.editRoast.value.trim(),
      notes: form.elements.editNotes.value.split(",").map(s => s.trim()).filter(Boolean),
      badge: form.elements.editBadge.value.trim(),
      image: form.elements.editImage.value.trim()
    };

    if (state.token && window.DOARE_CONFIG.API_BASE_URL) {
      try {
        message.textContent = "Đang lưu...";
        const result = await adminRequest(`/api/admin/products/${product.id}`, {
          method: "PUT",
          body: JSON.stringify({
            ...updatedProduct,
            images: [updatedProduct.image]
          })
        });
        state.products[index] = result.product || updatedProduct;
        renderProductGrid();
        message.textContent = "Đã lưu và cập nhật storefront.";
        setTimeout(closeProductEdit, 1200);
      } catch (error) {
        message.textContent = error.message;
      }
    } else {
      /* Demo mode: save to local catalog */
      state.products[index] = updatedProduct;
      renderProductGrid();
      message.textContent = "Đã cập nhật (chế độ demo).";
      setTimeout(closeProductEdit, 1200);
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
    const waiting = state.dashboard?.waitingPayment || 0;
    if ($("#revenue-stat")) $("#revenue-stat").textContent = formatMoney(state.dashboard?.revenue || 0);
    if ($("#orders-stat")) $("#orders-stat").textContent = state.dashboard?.orders || state.orders.length;
    if ($("#payment-stat")) $("#payment-stat").textContent = waiting;
    if ($("#products-stat")) $("#products-stat").textContent = state.products.length;
    if ($("#pending-count")) $("#pending-count").textContent = waiting;

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
        fetch(`${window.DOARE_CONFIG.API_BASE_URL}/api/products`).then((response) => response.json()),
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
    $("#login-form").elements.email.value = "admindorae.com";
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

  function selectPost(post) {
    const form = $("#post-form");
    form.elements.id.value = post?.id || "";
    form.elements.title.value = post?.title || "";
    form.elements.slug.value = post?.slug || "";
    form.elements.excerpt.value = post?.excerpt || "";
    form.elements.thumbnailUrl.value = post?.thumbnail_url || "";
    form.elements.markdown.value = post?.markdown || "";
    form.elements.status.value = post?.status || "draft";
    $("#delete-post").hidden = !post;
    $("#post-message").textContent = "";
    renderThumbnailUpload(post?.thumbnail_url || "");
    updateMarkdownPreview();
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

  async function makeTransparentThumbnail(file) {
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
    const output = canvas.toDataURL("image/webp", 0.9);
    if (output.length > 500000) {
      return canvas.toDataURL("image/webp", 0.75);
    }
    return output;
  }

  async function selectProductImageFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const status = $("#product-image-status");
    try {
      status.textContent = "Đang xử lý ảnh...";
      const thumbnail = await makeTransparentThumbnail(file);
      if (thumbnail.length > 550000) throw new Error("Ảnh sau khi nén vẫn quá lớn. Hãy chọn ảnh khác.");
      $("#product-edit-form").elements.editImage.value = thumbnail;
      renderProductImageUpload(thumbnail);
      $("#product-edit-preview").innerHTML = `
        <div class="admin-product-visual" style="--accent:${escapeHtml(state.products[state.editingProductIndex]?.accent || '#c9e5f2')}">
          <img class="admin-packshot" src="${escapeHtml(thumbnail)}" alt="" />
        </div>`;
      status.textContent = `Đã tạo ảnh sản phẩm · ${Math.round(thumbnail.length * 0.75 / 1024)}KB`;
    } catch (error) {
      status.textContent = error.message;
    } finally {
      event.target.value = "";
    }
  }

  function removeProductImage() {
    $("#product-edit-form").elements.editImage.value = "";
    $("#product-image-status").textContent = "Đã xóa ảnh sản phẩm.";
    renderProductImageUpload("");
    $("#product-edit-preview").innerHTML = `
        <div class="admin-product-visual" style="--accent:${escapeHtml(state.products[state.editingProductIndex]?.accent || '#c9e5f2')}">
        </div>`;
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
      selectPost(result.post);
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
    const editBtn = event.target.closest("[data-edit-product]");
    if (editBtn) openProductEdit(Number(editBtn.dataset.editProduct));
  });
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
