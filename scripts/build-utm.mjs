const allowedKeys = new Set(["base", "source", "medium", "campaign", "content", "term"]);
const args = process.argv.slice(2);
const options = { base: "https://doraecoffee.io.vn/" };

for (let index = 0; index < args.length; index += 2) {
  const key = args[index]?.replace(/^--/, "");
  const value = args[index + 1];
  if (!allowedKeys.has(key) || !value) {
    throw new Error("Usage: npm run utm -- --source facebook --medium organic_social --campaign august_2026 [--content post_01] [--base URL]");
  }
  options[key] = value;
}

for (const required of ["source", "medium", "campaign"]) {
  if (!options[required]) throw new Error(`Missing --${required}`);
}

const tokenPattern = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;
for (const key of ["source", "medium", "campaign", "content", "term"]) {
  if (options[key] && !tokenPattern.test(options[key])) {
    throw new Error(`${key} must be lowercase and use only letters, numbers, underscores, or hyphens`);
  }
}

const url = new URL(options.base);
for (const key of ["source", "medium", "campaign", "content", "term"]) {
  if (options[key]) url.searchParams.set(`utm_${key}`, options[key]);
}

console.log(url.toString());
