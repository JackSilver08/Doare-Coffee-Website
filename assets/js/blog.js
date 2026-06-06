(function () {
  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  async function init() {
    const slug = new URLSearchParams(location.search).get("slug");
    const article = document.querySelector("#article");
    if (!slug || !window.DOARE_CONFIG.API_BASE_URL) {
      article.innerHTML = "<h1>Không tìm thấy bài viết.</h1>";
      return;
    }
    try {
      const response = await fetch(`${window.DOARE_CONFIG.API_BASE_URL}/api/posts/${encodeURIComponent(slug)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      const post = data.post;
      document.title = `${post.title} | Doare Coffee`;
      article.innerHTML = `
        <header class="article-header">
          <p class="eyebrow dark">NHẬT KÝ DOARE</p>
          <h1>${escapeHtml(post.title)}</h1>
          <p>${escapeHtml(post.excerpt || "")}</p>
          <time>${new Date(post.published_at || post.created_at).toLocaleDateString("vi-VN")}</time>
        </header>
        ${post.thumbnail_url ? `<img class="article-cover" src="${escapeHtml(post.thumbnail_url)}" alt="" />` : ""}
        <div class="article-body">${window.DoareMarkdown.render(post.markdown)}</div>`;
    } catch (error) {
      article.innerHTML = `<h1>${escapeHtml(error.message || "Không thể tải bài viết.")}</h1>`;
    }
  }
  init();
})();
