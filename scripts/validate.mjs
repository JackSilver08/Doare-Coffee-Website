import { access, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const required = [
  "index.html",
  "blog.html",
  "admin.html",
  "google56a1ffd0a01024d4.html",
  "robots.txt",
  "functions/sitemap.xml.js",
  "functions/blog.js",
  "functions/google56a1ffd0a01024d4.html.js",
  "assets/css/styles.css",
  "assets/css/admin.css",
  "assets/js/app.js",
  "assets/js/admin.js",
  "assets/js/blog.js",
  "assets/js/markdown.js",
  "assets/js/api.js",
  "assets/images/brand-logo.png",
  "assets/images/products/doare-pack-02.webp",
  "worker/src/index.js",
  "worker/schema.sql"
];

for (const file of required) await access(file);

for (const file of ["assets/js/config.js", "assets/js/catalog.js", "assets/js/api.js", "assets/js/app.js", "assets/js/admin.js", "assets/js/blog.js", "assets/js/markdown.js", "functions/sitemap.xml.js", "functions/blog.js", "functions/google56a1ffd0a01024d4.html.js", "worker/src/index.js"]) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}

const index = await readFile("index.html", "utf8");
const admin = await readFile("admin.html", "utf8");
const robots = await readFile("robots.txt", "utf8");
const sitemapFunction = await readFile("functions/sitemap.xml.js", "utf8");
for (const id of ["featured-price", "featured-quantity", "cart-items", "checkout-form", "contact-form"]) {
  if (!index.includes(`id="${id}"`)) throw new Error(`Thiếu phần tử #${id}`);
}
if (!index.includes('class="cod-payment-note"')) throw new Error("Thiếu thông báo thanh toán COD");
if (!admin.includes('id="dashboard-view"')) throw new Error("Thiếu dashboard admin");
if (!admin.includes('name="robots" content="noindex')) throw new Error("Trang admin phải có noindex");
if (!index.includes('rel="canonical" href="https://doraecoffee.io.vn/"')) throw new Error("Thiếu canonical trang chủ");
if (!index.includes("<title>Dorae Coffee |")) throw new Error("Tiêu đề trang chủ phải bắt đầu bằng thương hiệu");
if (!index.includes('"alternateName": "DoraeCoffee"')) throw new Error("Thiếu tên thương hiệu thay thế trong structured data");
if (!index.includes('type="application/ld+json"')) throw new Error("Thiếu structured data trang chủ");
if (!robots.includes("Sitemap: https://doraecoffee.io.vn/sitemap.xml")) throw new Error("robots.txt thiếu sitemap");
if (!sitemapFunction.includes("<urlset") || !sitemapFunction.includes("/api/posts?limit=500&sitemap=1")) throw new Error("Sitemap động không hợp lệ");
if (!admin.includes('class="seo-preview"')) throw new Error("Thiếu SEO preview trong trình soạn bài");
for (const id of ["product-edit-form", "post-form", "markdown-preview"]) {
  if (!admin.includes(`id="${id}"`)) throw new Error(`Thiếu phần tử admin #${id}`);
}

console.log(`Validation passed: ${required.length} required files and JavaScript syntax.`);
