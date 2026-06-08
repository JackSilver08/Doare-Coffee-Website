(function () {
  const config = window.DOARE_CONFIG;

  async function request(path, options = {}) {
    if (!config.API_BASE_URL) {
      throw new Error("MOCK_MODE");
    }

    const response = await fetch(`${config.API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || "Không thể kết nối máy chủ.");
    }

    return response.json();
  }

  function mockOrder(payload) {
    const order = {
      ...payload,
      id: `DR${Date.now().toString().slice(-8)}`,
      status: payload.paymentMethod === "cod" ? "confirmed" : "waiting_payment",
      createdAt: new Date().toISOString()
    };
    const orders = JSON.parse(localStorage.getItem("doare_demo_orders") || "[]");
    orders.unshift(order);
    localStorage.setItem("doare_demo_orders", JSON.stringify(orders));
    return new Promise((resolve) => setTimeout(() => resolve(order), 700));
  }

  window.DoareAPI = {
    async getProducts() {
      try {
        const data = await request("/api/products");
        return data.products;
      } catch (error) {
        if (error.message !== "MOCK_MODE") console.warn("API fallback:", error.message);
        return window.DOARE_CATALOG;
      }
    },

    async getPosts(limit = 6) {
      try {
        const data = await request(`/api/posts?limit=${limit}`);
        return data.posts;
      } catch (error) {
        if (error.message !== "MOCK_MODE") console.warn("Posts API:", error.message);
        return [];
      }
    },

    async createOrder(payload) {
      try {
        return await request("/api/orders", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      } catch (error) {
        if (error.message !== "MOCK_MODE") throw error;
        return mockOrder(payload);
      }
    },

    async subscribe(email) {
      try {
        return await request("/api/subscribers", {
          method: "POST",
          body: JSON.stringify({ email })
        });
      } catch (error) {
        if (error.message !== "MOCK_MODE") throw error;
        return { success: true };
      }
    },

    async sendContact(payload) {
      return request("/api/contact", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }
  };
})();
