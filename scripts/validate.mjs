import { access, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const required = [
  "index.html",
  "admin.html",
  "assets/css/styles.css",
  "assets/css/admin.css",
  "assets/js/app.js",
  "assets/js/admin.js",
  "assets/js/api.js",
  "assets/images/brand-logo.png",
  "assets/images/products/doare-pack-02.webp",
  "worker/src/index.js",
  "worker/schema.sql"
];

for (const file of required) await access(file);

for (const file of ["assets/js/config.js", "assets/js/catalog.js", "assets/js/api.js", "assets/js/app.js", "assets/js/admin.js"]) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}

const index = await readFile("index.html", "utf8");
const admin = await readFile("admin.html", "utf8");
for (const id of ["featured-price", "featured-quantity", "cart-items", "checkout-form", "newsletter-form"]) {
  if (!index.includes(`id="${id}"`)) throw new Error(`Thiếu phần tử #${id}`);
}
if (!admin.includes('id="dashboard-view"')) throw new Error("Thiếu dashboard admin");

console.log(`Validation passed: ${required.length} required files and JavaScript syntax.`);
