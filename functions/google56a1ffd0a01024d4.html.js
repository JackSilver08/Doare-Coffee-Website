const VERIFICATION = "google-site-verification: google56a1ffd0a01024d4.html";

export function onRequestGet() {
  return new Response(VERIFICATION, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    }
  });
}
