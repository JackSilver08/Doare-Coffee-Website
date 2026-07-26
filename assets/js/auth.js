(function () {
  const USERS_KEY = "doare_auth_users";
  const CURRENT_KEY = "doare_auth_current";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const state = {
    mode: "login",
    onSuccess: null,
    currentUser: JSON.parse(localStorage.getItem(CURRENT_KEY) || "null"),
    users: JSON.parse(localStorage.getItem(USERS_KEY) || "[]")
  };

  function save() {
    localStorage.setItem(USERS_KEY, JSON.stringify(state.users));
    localStorage.setItem(CURRENT_KEY, JSON.stringify(state.currentUser));
  }

  function isLoggedIn() {
    return Boolean(state.currentUser?.email);
  }

  function setStatus(message, error = false) {
    const status = $("#auth-status");
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("is-error", error);
  }

  function showToast(message) {
    const toast = $("#catalog-toast") || $("#detail-toast") || $(".toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(showToast.timeout);
    showToast.timeout = setTimeout(() => toast.classList.remove("visible"), 2800);
  }

  function showMode(mode, options = {}) {
    state.mode = mode;
    $$(".auth-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));
    $$(".auth-panel").forEach((panel) => {
      const active = panel.dataset.panel === mode;
      panel.hidden = !active;
      panel.style.display = active ? "grid" : "none";
      panel.setAttribute("aria-hidden", String(!active));
    });
    if (!options.preserveStatus) setStatus("");

    const focusMap = {
      login: "#auth-email",
      register: '#register-form input[name="name"]',
      forgot: '#forgot-form input[name="email"]'
    };
    const field = $(focusMap[mode]);
    field?.focus();
  }

  function open(mode = "login", onSuccess = null) {
    const modal = $("#auth-modal");
    if (!modal) return;
    state.onSuccess = typeof onSuccess === "function" ? onSuccess : null;
    modal.hidden = false;
    document.body.classList.add("no-scroll");
    showMode(mode);
  }

  function close() {
    const modal = $("#auth-modal");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("no-scroll");
    setStatus("");
  }

  function authenticate(user) {
    state.currentUser = user;
    save();
    close();
    if (state.onSuccess) {
      const callback = state.onSuccess;
      state.onSuccess = null;
      callback(user);
    }
    const label = $("#auth-button-label");
    if (label) label.textContent = state.currentUser?.name || "Tài khoản";
  }

  function registerUser(payload) {
    const email = payload.email.trim().toLowerCase();
    if (state.users.some((user) => user.email === email)) {
      throw new Error("Email này đã được đăng ký.");
    }
    const user = {
      name: payload.name.trim(),
      email,
      password: payload.password
    };
    state.users.push(user);
    save();
    authenticate(user);
    showToast("Đăng ký thành công. Bạn đã được đăng nhập.");
  }

  function loginUser(payload) {
    const email = payload.email.trim().toLowerCase();
    const user = state.users.find((entry) => entry.email === email && entry.password === payload.password);
    if (!user) throw new Error("Email hoặc mật khẩu không đúng.");
    authenticate(user);
    showToast("Đăng nhập thành công.");
  }

  function resetPassword(payload) {
    const email = payload.email.trim().toLowerCase();
    const user = state.users.find((entry) => entry.email === email);
    if (!user) throw new Error("Không tìm thấy tài khoản với email này.");
    user.password = payload.password;
    save();
    showMode("login");
    setStatus("Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.");
  }

  function bind() {
    const modal = $("#auth-modal");
    if (!modal) return;

    $$("[data-auth-trigger], #auth-button").forEach((button) =>
      button.addEventListener("click", () => open("login"))
    );

    $$(".auth-tab").forEach((tab) => tab.addEventListener("click", () => showMode(tab.dataset.mode)));
    $(".auth-close")?.addEventListener("click", close);
    $(".auth-backdrop")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) close();
    });

    $("#login-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      try {
        loginUser(data);
      } catch (error) {
        setStatus(error.message || "Không thể đăng nhập.", true);
      }
    });

    $("#register-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      try {
        registerUser(data);
      } catch (error) {
        setStatus(error.message || "Không thể đăng ký.", true);
      }
    });

    $("#forgot-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      try {
        resetPassword(data);
      } catch (error) {
        setStatus(error.message || "Không thể đặt lại mật khẩu.", true);
      }
    });

    $("#auth-logout")?.addEventListener("click", () => {
      state.currentUser = null;
      save();
      setStatus("Đã đăng xuất.");
      showMode("login");
      open("login");
    });

    $("#auth-forgot-link")?.addEventListener("click", (event) => {
      event.preventDefault();
      showMode("forgot");
    });

    $("#auth-register-link")?.addEventListener("click", (event) => {
      event.preventDefault();
      showMode("register");
    });

    $$(".auth-login-link").forEach((link) =>
      link.addEventListener("click", (event) => {
        event.preventDefault();
        showMode("login");
      })
    );

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) close();
    });

    if (state.currentUser?.name) {
      const label = $("#auth-button-label");
      if (label) label.textContent = state.currentUser.name;
    }
  }

  window.DoareAuth = {
    open,
    close,
    isLoggedIn,
    getCurrentUser: () => state.currentUser
  };

  bind();
})();
