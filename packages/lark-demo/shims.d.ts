// CSS module type declarations
// Regular .css files return a string (the CSS text)
declare module "*.css" {
  const content: string;
  export default content;
}

// CSS Module files (*.module.css) return a mapping of original class names
// to scoped (hashed) class names. Used `{{=styles['bem-class-name']}}` in HTML templates.
declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}

// HTML template module declarations
// Lark's Vite/Webpack/Rspack plugin compiles .html files into template
// functions at build time. The default export is a function, not a string.
//
// The return type is `any` because the same template function returns:
// - `string` when virtualDom is disabled (HTML string rendering path)
// - `VDomNode` when virtualDom is enabled (VDOM rendering path)
//
// Using `any` here avoids the union-type incompatibility with ViewSetup's
// `template?: ViewTemplate | VDomTemplate` — the two function signatures
// have incompatible return types (`string` vs `VDomNode`), so a union
// return type would not be assignable to either.

// import type { VDomTemplate, ViewSetup, ViewTemplate } from "@lark.js/mvc";
type ViewTemplate = (
  data: unknown,
  viewId: string,
  refData: unknown,
  ...encoders: unknown[]
) => string;
type VDomTemplate = (
  data: unknown,
  viewId: string,
  refData: unknown,
) => VDomNode;

declare module "*.html" {
  const template: ViewTemplate | VDomTemplate;
  export default template;
}
