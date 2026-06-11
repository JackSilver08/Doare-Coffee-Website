const SITE_URL = "https://doraecoffee.io.vn";
const API_URL = "https://doare-coffee-api.trannntunnn.workers.dev";

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function dateOnly(value) {
  const date = new Date(`${value || ""}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export async function onRequestGet() {
  let posts = [];
  try {
    const response = await fetch(`${API_URL}/api/posts?limit=500&sitemap=1`, {
      cf: { cacheTtl: 60, cacheEverything: true }
    });
    if (response.ok) posts = (await response.json()).posts || [];
  } catch (error) {
    console.error("Unable to build blog sitemap", error);
  }

  const urls = [
    `  <url>
    <loc>${SITE_URL}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`,
    ...posts.map((post) => {
      const lastmod = dateOnly(post.updated_at || post.published_at || post.created_at);
      return `  <url>
    <loc>${escapeXml(`${SITE_URL}/blog?slug=${encodeURIComponent(post.slug)}`)}</loc>${lastmod ? `
    <lastmod>${lastmod}</lastmod>` : ""}
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
    })
  ];

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`,
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=60"
      }
    }
  );
}
