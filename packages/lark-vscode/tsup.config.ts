import { defineConfig } from "tsup";

const domShim = `
if (typeof document === "undefined") {
  var _el = function() { return { style: {}, href: "", childNodes: [], setAttribute: function(){}, getAttribute: function(){ return null; }, appendChild: function(){}, removeChild: function(){}, append: function(){}, insertBefore: function(){}, replaceChild: function(){}, cloneNode: function(){ return _el(); }, addEventListener: function(){}, removeEventListener: function(){}, querySelector: function(){ return null; }, querySelectorAll: function(){ return []; }, contains: function(){ return false; }, firstChild: null, parentNode: null, nextSibling: null, tagName: "DIV", nodeType: 1, ownerDocument: null, id: "" }; };
  var _doc = { createElement: _el, createElementNS: _el, createTextNode: function(){ return { nodeType: 3, textContent: "" }; }, createComment: function(){ return { nodeType: 8, data: "" }; }, getElementById: function(){ return null; }, head: _el(), body: _el(), title: "", documentElement: _el(), location: { href: "https://localhost/", pathname: "/", hash: "", replace: function(){} }, addEventListener: function(){}, removeEventListener: function(){}, implementation: { createHTMLDocument: function(){ var d = { createElement: _el, head: _el(), body: _el() }; return d; } } };
  globalThis.document = _doc;
  globalThis.window = globalThis;
  globalThis.Element = function Element(){};
  Element.prototype.getAttribute = function(){ return null; };
  globalThis.HTMLElement = Element;
  globalThis.navigator = { userAgent: "" };
}
`;

export default defineConfig({
  entry: ["src/extension.ts"],
  format: ["cjs"],
  target: "node18",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  external: ["vscode", "@swc/core"],
  noExternal: ["zod", "@lark.js/mvc"],
  banner: { js: domShim },
  shims: false,
  splitting: false,
});
