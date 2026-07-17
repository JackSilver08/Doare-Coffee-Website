const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

window.DOARE_CONFIG = Object.freeze({
  API_BASE_URL: isLocalHost ? "http://127.0.0.1:8788" : "https://doare-coffee-api.trannntunnn.workers.dev",
  STORE_NAME: "Dorae Coffee",
  CURRENCY: "VND",
  FREE_SHIPPING_THRESHOLD: 500000,
  STANDARD_SHIPPING_FEE: 30000
});
