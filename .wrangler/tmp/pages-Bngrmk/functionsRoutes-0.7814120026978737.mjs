import { onRequestGet as __blog_js_onRequestGet } from "C:\\Doare-Coffee-Website\\functions\\blog.js"
import { onRequestGet as __google56a1ffd0a01024d4_html_js_onRequestGet } from "C:\\Doare-Coffee-Website\\functions\\google56a1ffd0a01024d4.html.js"
import { onRequestGet as __sitemap_xml_js_onRequestGet } from "C:\\Doare-Coffee-Website\\functions\\sitemap.xml.js"

export const routes = [
    {
      routePath: "/blog",
      mountPath: "/",
      method: "GET",
      middlewares: [],
      modules: [__blog_js_onRequestGet],
    },
  {
      routePath: "/google56a1ffd0a01024d4.html",
      mountPath: "/",
      method: "GET",
      middlewares: [],
      modules: [__google56a1ffd0a01024d4_html_js_onRequestGet],
    },
  {
      routePath: "/sitemap.xml",
      mountPath: "/",
      method: "GET",
      middlewares: [],
      modules: [__sitemap_xml_js_onRequestGet],
    },
  ]