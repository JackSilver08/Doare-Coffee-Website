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
  let products = [];
  try {
    const [postsResponse, productsResponse] = await Promise.all([
      fetch(`${API_URL}/api/posts?limit=500&sitemap=1`, {
        cf: { cacheTtl: 60, cacheEverything: true }
      }),
      fetch(`${API_URL}/api/products`, {
        cf: { cacheTtl: 60, cacheEverything: true }
      })
    ]);
    if (postsResponse.ok) posts = (await postsResponse.json()).posts || [];
    if (productsResponse.ok) products = (await productsResponse.json()).products || [];
  } catch (error) {
    console.error("Unable to build sitemap", error);
  }

  const urls = [
    `  <url>
    <loc>${SITE_URL}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`,
    `  <url>
    <loc>${SITE_URL}/products</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`,
    ...products.map((product) => `  <url>
    <loc>${escapeXml(`${SITE_URL}/product?id=${encodeURIComponent(product.id)}`)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`),
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
