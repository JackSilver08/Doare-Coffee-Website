import { mkdir, writeFile } from "node:fs/promises";

const SITE_URL = "https://doraecoffee.io.vn";
const API_URL = "https://doare-coffee-api.trannntunnn.workers.dev";
const REPORT_PATH = "reports/kpi-audit.json";

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function extractLinks(html, pageUrl) {
  const links = [];
  const pattern = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(pattern)) {
    const href = decodeHtml(match[1].trim());
    if (!href || /^(?:#|mailto:|tel:|javascript:)/i.test(href)) continue;
    try {
      const url = new URL(href, pageUrl);
      url.hash = "";
      if (url.origin === SITE_URL) links.push(url.toString());
    } catch {}
  }
  return links;
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "DoraeKpiAudit/1.0" } });
  return { status: response.status, text: await response.text() };
}

function monthInVietnam(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}`;
}

const sitemapResponse = await fetchText(`${SITE_URL}/sitemap.xml?audit=${Date.now()}`);
if (sitemapResponse.status !== 200) throw new Error(`Sitemap returned ${sitemapResponse.status}`);
const sitemapUrls = [...sitemapResponse.text.matchAll(/<loc>(.*?)<\/loc>/g)]
  .map((match) => decodeHtml(match[1]));

const pageResults = await Promise.all(sitemapUrls.map(async (url) => {
  try {
    const response = await fetchText(url);
    return { url, status: response.status, links: extractLinks(response.text, url) };
  } catch (error) {
    return { url, status: 0, error: error.message, links: [] };
  }
}));

const postsResponse = await fetch(`${API_URL}/api/posts?limit=500`);
if (!postsResponse.ok) throw new Error(`Posts API returned ${postsResponse.status}`);
const posts = (await postsResponse.json()).posts || [];
const postsByMonth = {};
for (const post of posts) {
  const month = monthInVietnam(post.published_at || post.created_at);
  postsByMonth[month] = (postsByMonth[month] || 0) + 1;
}

const internalEdges = pageResults.flatMap((page) =>
  page.links.map((destination) => `${page.url} -> ${destination}`)
);
const report = {
  generatedAt: new Date().toISOString(),
  site: SITE_URL,
  measurementStatus: {
    traffic: "waiting_for_ga4_or_gtm",
    organicSocial: "waiting_for_ga4_or_gtm_and_utm_campaigns",
    backlinks: "waiting_for_search_console_or_backlink_provider",
    seoPosts: "measured_from_cms",
    internalLinks: "measured_by_site_crawl"
  },
  targets: {
    "2026-06": { traffic: 10, seoPosts: 4, backlinks: 5, organicSocial: 5 },
    "2026-07": { traffic: 20, seoPosts: 4, backlinks: 5, organicSocial: 10 },
    "2026-08": { traffic: 20, seoPosts: 4, backlinks: 5, organicSocial: 10 },
    threeMonth: { traffic: 50, seoPosts: 12, backlinks: 15, internalLinks: 41, organicSocial: 25 }
  },
  actual: {
    publishedPosts: posts.length,
    postsByMonth,
    sitemapUrls: sitemapUrls.length,
    crawledPages: pageResults.length,
    healthyPages: pageResults.filter((page) => page.status >= 200 && page.status < 400).length,
    brokenPages: pageResults.filter((page) => page.status === 0 || page.status >= 400),
    internalLinkOccurrences: internalEdges.length,
    uniqueInternalLinks: new Set(internalEdges).size,
    uniqueInternalDestinations: new Set(pageResults.flatMap((page) => page.links)).size
  },
  pages: pageResults.map((page) => ({
    url: page.url,
    status: page.status,
    internalLinks: page.links.length,
    error: page.error
  }))
};

await mkdir("reports", { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report.actual, null, 2));
console.log(`Report written to ${REPORT_PATH}`);
