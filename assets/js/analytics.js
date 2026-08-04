(function () {
  "use strict";

  const CONSENT_KEY = "doare_analytics_consent";
  const config = window.DOARE_CONFIG || {};
  const gtmId = /^GTM-[A-Z0-9]+$/.test(config.GTM_CONTAINER_ID || "")
    ? config.GTM_CONTAINER_ID
    : "";
  const measurementId = /^G-[A-Z0-9]+$/.test(config.GA4_MEASUREMENT_ID || "")
    ? config.GA4_MEASUREMENT_ID
    : "";

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }

  // Consent Mode starts denied. Google tags are only loaded after an explicit choice.
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    wait_for_update: 500
  });

  function clean(value) {
    if (value === undefined || value === null || value === "") return undefined;
    if (Array.isArray(value)) return value.map(cleanObject);
    if (typeof value === "object") return cleanObject(value);
    return value;
  }

  function cleanObject(object) {
    return Object.fromEntries(
      Object.entries(object || {})
        .map(([key, value]) => [key, clean(value)])
        .filter(([, value]) => value !== undefined)
    );
  }

  function productItem(product, quantity) {
    if (!product) return null;
    return cleanObject({
      item_id: product.id,
      item_name: product.name,
      item_category: product.category,
      item_variant: product.weight,
      price: Number(product.price) || 0,
      quantity: Number(quantity) || 1
    });
  }

  function track(eventName, parameters = {}) {
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(eventName)) return;
    const cleanedParameters = cleanObject(parameters);
    if (measurementId && !gtmId) {
      // Direct gtag integrations require the event command. Do not queue
      // behavioral events while analytics consent is denied.
      if (localStorage.getItem(CONSENT_KEY) === "granted") {
        gtag("event", eventName, cleanedParameters);
      }
      return;
    }
    window.dataLayer.push({ event: eventName, ...cleanedParameters });
  }

  function loadScript(src) {
    if (document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    document.head.append(script);
  }

  function loadGoogleTag() {
    if (loadGoogleTag.done || (!gtmId && !measurementId)) return;
    loadGoogleTag.done = true;
    if (gtmId) {
      window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
      loadScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`);
      return;
    }
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`);
    gtag("js", new Date());
    gtag("config", measurementId, { send_page_view: true });
  }

  function applyConsent(granted) {
    localStorage.setItem(CONSENT_KEY, granted ? "granted" : "denied");
    gtag("consent", "update", {
      analytics_storage: granted ? "granted" : "denied"
    });
    if (granted) loadGoogleTag();
    document.querySelector(".analytics-consent")?.remove();
  }

  function showConsent() {
    if (!gtmId && !measurementId) return;
    const banner = document.createElement("aside");
    banner.className = "analytics-consent";
    banner.setAttribute("aria-label", "Tùy chọn đo lường website");
    banner.innerHTML = `
      <p>Chúng tôi dùng dữ liệu truy cập ẩn danh để cải thiện website. Không gửi thông tin liên hệ hoặc địa chỉ của bạn cho công cụ đo lường.</p>
      <div>
        <button type="button" data-analytics-consent="denied">Từ chối</button>
        <button type="button" class="analytics-consent__accept" data-analytics-consent="granted">Đồng ý</button>
      </div>`;
    banner.addEventListener("click", (event) => {
      const button = event.target.closest("[data-analytics-consent]");
      if (button) applyConsent(button.dataset.analyticsConsent === "granted");
    });
    document.body.append(banner);
  }

  const savedConsent = localStorage.getItem(CONSENT_KEY);
  if (savedConsent === "granted") {
    gtag("consent", "update", { analytics_storage: "granted" });
    loadGoogleTag();
  } else if (savedConsent !== "denied") {
    document.addEventListener("DOMContentLoaded", showConsent, { once: true });
  }

  document.addEventListener("click", (event) => {
    const socialLink = event.target.closest(".social-float__link");
    if (!socialLink) return;
    const className = socialLink.className;
    const platform = ["facebook", "zalo", "tiktok"].find((name) => className.includes(name));
    track("social_link_clicked", {
      platform: platform || "unknown",
      link_location: "floating_navigation"
    });
  });

  window.DoareAnalytics = Object.freeze({ track, productItem });
})();
