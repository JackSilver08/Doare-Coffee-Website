(function () {
  const SITE_URL = "https://doraecoffee.io.vn";
  const DEFAULT_IMAGE = `${SITE_URL}/assets/images/hero/coffee-cup-illustration.webp`;

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  function setMeta(selector, content) {
    const element = document.querySelector(selector);
    if (element) element.setAttribute("content", content);
  }

  function setCanonical(url) {
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = url;
  }

  function setNoIndex() {
    setMeta('meta[name="robots"]', "noindex, follow");
  }

  function isPublicImage(url) {
    return /^https?:\/\//i.test(url || "");
  }

  function parsePostDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
    const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
    const date = new Date(hasTimezone ? normalized : `${normalized}Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function postIsoDate(value) {
    return (parsePostDate(value) || new Date()).toISOString();
  }

  function postDisplayDate(value) {
    const date = parsePostDate(value);
    return date ? date.toLocaleDateString("vi-VN") : "";
  }

  async function init() {
    const slug = new URLSearchParams(location.search).get("slug");
    const article = document.querySelector("#article");
    if (!slug || !window.DOARE_CONFIG.API_BASE_URL) {
      setNoIndex();
      article.innerHTML = "<h1>Không tìm thấy bài viết.</h1>";
      return;
    }
    try {
      const response = await fetch(`${window.DOARE_CONFIG.API_BASE_URL}/api/posts/${encodeURIComponent(slug)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      const post = data.post;
      const articleUrl = `${SITE_URL}/blog?slug=${encodeURIComponent(post.slug)}`;
      const image = isPublicImage(post.thumbnail_url) ? post.thumbnail_url : DEFAULT_IMAGE;
      const seoTitle = post.seo_title || `${post.title} | Dorae Coffee`;
      const description = post.seo_description || post.excerpt || "Kiến thức và câu chuyện cà phê từ Dorae Coffee.";
      const publishedAt = postIsoDate(post.published_at || post.created_at);
      const modifiedAt = postIsoDate(post.updated_at || post.published_at || post.created_at);

      document.title = seoTitle;
      setCanonical(articleUrl);
      setMeta('meta[name="description"]', description);
      setMeta('meta[property="og:title"]', seoTitle);
      setMeta('meta[property="og:description"]', description);
      setMeta('meta[property="og:url"]', articleUrl);
      setMeta('meta[property="og:image"]', image);
      setMeta('meta[name="twitter:title"]', seoTitle);
      setMeta('meta[name="twitter:description"]', description);
      setMeta('meta[name="twitter:image"]', image);

      document.querySelector("#article-structured-data").textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.title,
        description,
        image: [image],
        datePublished: publishedAt,
        dateModified: modifiedAt,
        inLanguage: "vi-VN",
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": articleUrl
        },
        author: {
          "@type": "Organization",
          name: "Dorae Coffee",
          url: SITE_URL
        },
        publisher: {
          "@type": "Organization",
          name: "Dorae Coffee",
          logo: {
            "@type": "ImageObject",
            url: `${SITE_URL}/assets/images/brand-logo.png`
          }
        }
      });

      article.innerHTML = `
        <header class="article-header">
          <p class="eyebrow dark">NHẬT KÝ DORAE</p>
          <h1>${escapeHtml(post.title)}</h1>
          <p>${escapeHtml(post.excerpt || "")}</p>
          <time datetime="${escapeHtml(publishedAt)}">${postDisplayDate(post.published_at || post.created_at)}</time>
        </header>
        ${post.thumbnail_url ? `<img class="article-cover" src="${escapeHtml(post.thumbnail_url)}" alt="${escapeHtml(post.title)}" />` : ""}
        <div class="article-body">${window.DoareMarkdown.render(post.markdown)}</div>`;
    } catch (error) {
      setNoIndex();
      article.innerHTML = `<h1>${escapeHtml(error.message || "Không thể tải bài viết.")}</h1>`;
    }
  }
  init();
})();
