const SITE_URL = "https://doraecoffee.io.vn";
const API_URL = "https://doare-coffee-api.trannntunnn.workers.dev";
const DEFAULT_IMAGE = `${SITE_URL}/assets/images/hero/coffee-cup-illustration.webp`;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function renderMarkdown(markdown) {
  const output = [];
  let listOpen = false;
  const closeList = () => {
    if (listOpen) output.push("</ul>");
    listOpen = false;
  };

  for (const rawLine of String(markdown || "").replace(/\r/g, "").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      output.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`);
      continue;
    }
    const item = line.match(/^[-*]\s+(.+)$/);
    if (item) {
      if (!listOpen) output.push("<ul>");
      listOpen = true;
      output.push(`<li>${inlineMarkdown(item[1])}</li>`);
      continue;
    }
    closeList();
    output.push(`<p>${inlineMarkdown(line)}</p>`);
  }
  closeList();
  return output.join("");
}

function seoDescription(post) {
  const value = String(post.excerpt || "").replace(/\s+/g, " ").trim();
  if (value.length <= 160) return value;
  return `${value.slice(0, 157).trimEnd()}...`;
}

function isoDate(value) {
  const date = new Date(`${value || ""}Z`);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function publicImage(value) {
  return /^https?:\/\//i.test(value || "") ? value : DEFAULT_IMAGE;
}

async function loadPost(slug) {
  const response = await fetch(`${API_URL}/api/posts/${encodeURIComponent(slug)}`, {
    cf: { cacheTtl: 60, cacheEverything: true }
  });
  if (!response.ok) return null;
  return (await response.json()).post;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const slug = url.searchParams.get("slug");
  const assetUrl = new URL("/blog", url.origin);
  const asset = await context.env.ASSETS.fetch(assetUrl);
  if (!slug) return asset;

  const post = await loadPost(slug);
  if (!post) {
    return new HTMLRewriter()
      .on('meta[name="robots"]', {
        element(element) {
          element.setAttribute("content", "noindex, follow");
        }
      })
      .transform(asset);
  }

  const articleUrl = `${SITE_URL}/blog?slug=${encodeURIComponent(post.slug)}`;
  const title = `${post.title} | Dorae Coffee`;
  const description = seoDescription(post);
  const image = publicImage(post.thumbnail_url);
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description,
    image: [image],
    datePublished: isoDate(post.published_at || post.created_at),
    dateModified: isoDate(post.updated_at || post.published_at || post.created_at),
    inLanguage: "vi-VN",
    mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
    author: { "@type": "Organization", name: "Dorae Coffee", url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "Dorae Coffee",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/assets/images/brand-logo.png` }
    }
  });
  const articleHtml = `
    <header class="article-header">
      <p class="eyebrow dark">NHẬT KÝ DORAE</p>
      <h1>${escapeHtml(post.title)}</h1>
      <p>${escapeHtml(post.excerpt || "")}</p>
      <time datetime="${escapeHtml(isoDate(post.published_at || post.created_at))}">${new Date(`${post.published_at || post.created_at}Z`).toLocaleDateString("vi-VN")}</time>
    </header>
    ${/^https?:\/\//i.test(post.thumbnail_url || "") ? `<img class="article-cover" src="${escapeHtml(post.thumbnail_url)}" alt="${escapeHtml(post.title)}" />` : ""}
    <div class="article-body">${renderMarkdown(post.markdown)}</div>`;

  const metaContent = new Map([
    ['meta[name="description"]', description],
    ['meta[property="og:title"]', title],
    ['meta[property="og:description"]', description],
    ['meta[property="og:url"]', articleUrl],
    ['meta[property="og:image"]', image],
    ['meta[property="og:image:alt"]', post.title],
    ['meta[name="twitter:title"]', title],
    ['meta[name="twitter:description"]', description],
    ['meta[name="twitter:image"]', image]
  ]);

  const rewriter = new HTMLRewriter()
    .on("title", {
      element(element) {
        element.setInnerContent(title);
      }
    })
    .on("head", {
      element(element) {
        element.append(`<link rel="canonical" href="${escapeHtml(articleUrl)}" />`, { html: true });
      }
    })
    .on("#article-structured-data", {
      element(element) {
        element.setInnerContent(structuredData);
      }
    })
    .on("#article", {
      element(element) {
        element.setInnerContent(articleHtml, { html: true });
      }
    });

  for (const [selector, content] of metaContent) {
    rewriter.on(selector, {
      element(element) {
        element.setAttribute("content", content);
      }
    });
  }

  const transformed = rewriter.transform(asset);
  const response = new Response(transformed.body, transformed);
  response.headers.set("Cache-Control", "public, max-age=60");
  return response;
}
