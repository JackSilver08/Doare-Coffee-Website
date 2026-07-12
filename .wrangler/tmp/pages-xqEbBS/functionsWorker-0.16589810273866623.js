var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// blog.js
var SITE_URL = "https://doraecoffee.io.vn";
var API_URL = "https://doare-coffee-api.trannntunnn.workers.dev";
var DEFAULT_IMAGE = `${SITE_URL}/assets/images/hero/coffee-cup-illustration.webp`;
function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
__name(escapeHtml, "escapeHtml");
function inlineMarkdown(text) {
  return escapeHtml(text).replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match2, alt, url) => {
    const src = safeMarkdownUrl(url);
    return src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" />` : "";
  }).replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match2, label, url) => {
    const href = safeMarkdownUrl(url);
    return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${label}</a>` : label;
  }).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
}
__name(inlineMarkdown, "inlineMarkdown");
function safeMarkdownUrl(value) {
  const url = String(value || "").trim();
  if (/^https?:\/\/[^\s)]+$/i.test(url)) return url;
  if (/^assets\/[^\s)]+$/i.test(url)) return url;
  if (/^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/i.test(url)) return url;
  return "";
}
__name(safeMarkdownUrl, "safeMarkdownUrl");
function renderMarkdown(markdown) {
  const output = [];
  let listOpen = "";
  const closeList = /* @__PURE__ */ __name(() => {
    if (listOpen) output.push(`</${listOpen}>`);
    listOpen = "";
  }, "closeList");
  for (const rawLine of String(markdown || "").replace(/\r/g, "").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeList();
      output.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`);
      continue;
    }
    const quote = line.match(/^>\s+(.+)$/);
    if (quote) {
      closeList();
      output.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }
    const item = line.match(/^[-*]\s+(.+)$/);
    if (item) {
      if (listOpen !== "ul") {
        closeList();
        output.push("<ul>");
        listOpen = "ul";
      }
      output.push(`<li>${inlineMarkdown(item[1])}</li>`);
      continue;
    }
    const orderedItem = line.match(/^\d+\.\s+(.+)$/);
    if (orderedItem) {
      if (listOpen !== "ol") {
        closeList();
        output.push("<ol>");
        listOpen = "ol";
      }
      output.push(`<li>${inlineMarkdown(orderedItem[1])}</li>`);
      continue;
    }
    closeList();
    output.push(`<p>${inlineMarkdown(line)}</p>`);
  }
  closeList();
  return output.join("");
}
__name(renderMarkdown, "renderMarkdown");
function seoDescription(post) {
  const value = String(post.seo_description || post.excerpt || "").replace(/\s+/g, " ").trim();
  if (value.length <= 160) return value;
  return `${value.slice(0, 157).trimEnd()}...`;
}
__name(seoDescription, "seoDescription");
function isoDate(value) {
  const date = /* @__PURE__ */ new Date(`${value || ""}Z`);
  return Number.isNaN(date.getTime()) ? (/* @__PURE__ */ new Date()).toISOString() : date.toISOString();
}
__name(isoDate, "isoDate");
function publicImage(value) {
  return /^https?:\/\//i.test(value || "") ? value : DEFAULT_IMAGE;
}
__name(publicImage, "publicImage");
async function loadPost(slug) {
  const response = await fetch(`${API_URL}/api/posts/${encodeURIComponent(slug)}`, {
    cf: { cacheTtl: 60, cacheEverything: true }
  });
  if (!response.ok) return null;
  return (await response.json()).post;
}
__name(loadPost, "loadPost");
async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const slug = url.searchParams.get("slug");
  const assetUrl = new URL("/blog", url.origin);
  const asset = await context.env.ASSETS.fetch(assetUrl);
  if (!slug) return asset;
  const post = await loadPost(slug);
  if (!post) {
    return new HTMLRewriter().on('meta[name="robots"]', {
      element(element) {
        element.setAttribute("content", "noindex, follow");
      }
    }).transform(asset);
  }
  const articleUrl = `${SITE_URL}/blog?slug=${encodeURIComponent(post.slug)}`;
  const title = post.seo_title || `${post.title} | Dorae Coffee`;
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
      <p class="eyebrow dark">NH\u1EACT K\xDD DORAE</p>
      <h1>${escapeHtml(post.title)}</h1>
      <p>${escapeHtml(post.excerpt || "")}</p>
      <time datetime="${escapeHtml(isoDate(post.published_at || post.created_at))}">${(/* @__PURE__ */ new Date(`${post.published_at || post.created_at}Z`)).toLocaleDateString("vi-VN")}</time>
    </header>
    ${/^https?:\/\//i.test(post.thumbnail_url || "") ? `<img class="article-cover" src="${escapeHtml(post.thumbnail_url)}" alt="${escapeHtml(post.title)}" />` : ""}
    <div class="article-body">${renderMarkdown(post.markdown)}</div>`;
  const metaContent = /* @__PURE__ */ new Map([
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
  const rewriter = new HTMLRewriter().on("title", {
    element(element) {
      element.setInnerContent(title);
    }
  }).on("head", {
    element(element) {
      element.append(`<link rel="canonical" href="${escapeHtml(articleUrl)}" />`, { html: true });
    }
  }).on("#article-structured-data", {
    element(element) {
      element.setInnerContent(structuredData);
    }
  }).on("#article", {
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
__name(onRequestGet, "onRequestGet");

// google56a1ffd0a01024d4.html.js
var VERIFICATION = "google-site-verification: google56a1ffd0a01024d4.html";
function onRequestGet2() {
  return new Response(VERIFICATION, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    }
  });
}
__name(onRequestGet2, "onRequestGet");

// sitemap.xml.js
var SITE_URL2 = "https://doraecoffee.io.vn";
var API_URL2 = "https://doare-coffee-api.trannntunnn.workers.dev";
function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
__name(escapeXml, "escapeXml");
function dateOnly(value) {
  const date = /* @__PURE__ */ new Date(`${value || ""}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}
__name(dateOnly, "dateOnly");
async function onRequestGet3() {
  let posts = [];
  try {
    const response = await fetch(`${API_URL2}/api/posts?limit=500&sitemap=1`, {
      cf: { cacheTtl: 60, cacheEverything: true }
    });
    if (response.ok) posts = (await response.json()).posts || [];
  } catch (error) {
    console.error("Unable to build blog sitemap", error);
  }
  const urls = [
    `  <url>
    <loc>${SITE_URL2}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`,
    ...posts.map((post) => {
      const lastmod = dateOnly(post.updated_at || post.published_at || post.created_at);
      return `  <url>
    <loc>${escapeXml(`${SITE_URL2}/blog?slug=${encodeURIComponent(post.slug)}`)}</loc>${lastmod ? `
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
__name(onRequestGet3, "onRequestGet");

// ../.wrangler/tmp/pages-xqEbBS/functionsRoutes-0.0923836480539385.mjs
var routes = [
  {
    routePath: "/blog",
    mountPath: "/",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/google56a1ffd0a01024d4.html",
    mountPath: "/",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/sitemap.xml",
    mountPath: "/",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  }
];

// ../../Users/tuant/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../Users/tuant/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
