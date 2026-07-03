(function () {
  const escapeHtml = (value) =>
    String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  function safeUrl(value) {
    const url = String(value || "").trim();
    if (/^https?:\/\/[^\s)]+$/i.test(url)) return url;
    if (/^assets\/[^\s)]+$/i.test(url)) return url;
    if (/^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/i.test(url)) return url;
    return "";
  }

  function inline(text) {
    return escapeHtml(text)
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
        const src = safeUrl(url);
        return src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" />` : "";
      })
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
        const href = safeUrl(url);
        return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${label}</a>` : label;
      })
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }

  function render(markdown) {
    const lines = String(markdown || "").replace(/\r/g, "").split("\n");
    const output = [];
    let listOpen = "";
    const closeList = () => {
      if (listOpen) output.push(`</${listOpen}>`);
      listOpen = "";
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        closeList();
        continue;
      }
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        closeList();
        output.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
        continue;
      }
      const quote = line.match(/^>\s+(.+)$/);
      if (quote) {
        closeList();
        output.push(`<blockquote>${inline(quote[1])}</blockquote>`);
        continue;
      }
      const unorderedItem = line.match(/^[-*]\s+(.+)$/);
      if (unorderedItem) {
        if (listOpen !== "ul") {
          closeList();
          output.push("<ul>");
          listOpen = "ul";
        }
        output.push(`<li>${inline(unorderedItem[1])}</li>`);
        continue;
      }
      const orderedItem = line.match(/^\d+\.\s+(.+)$/);
      if (orderedItem) {
        if (listOpen !== "ol") {
          closeList();
          output.push("<ol>");
          listOpen = "ol";
        }
        output.push(`<li>${inline(orderedItem[1])}</li>`);
        continue;
      }
      closeList();
      output.push(`<p>${inline(line)}</p>`);
    }
    closeList();
    return output.join("");
  }

  window.DoareMarkdown = { render };
})();
