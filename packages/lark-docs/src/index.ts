/**
 * @lark.js/docs barrel exports.
 *
 * Main entry point — browser-safe exports only.
 * Includes re-exports from @lark.js/mvc so consumers only need
 * to install @lark.js/docs — no separate @lark.js/mvc dependency required.
 *
 * Build-time utilities (defineConfig, scanDocsDir, generateSidebar, etc.)
 * are available from sub-path exports:
 *   - "@lark.js/docs/vite"     (Vite plugin + build-time helpers)
 *   - "@lark.js/docs/webpack"  (Webpack loader + build-time helpers)
 *   - "@lark.js/docs/rspack"   (Rspack loader + build-time helpers)
 *   - "@lark.js/docs/compiler" (compileMarkdown)
 */

import type { FrameworkConfig as LarkMvcFrameworkConfig } from "@lark.js/mvc";

// ============================================================
// Re-exports from @lark.js/mvc (so consumers don't need it directly)
// ============================================================

export {
  Framework,
  defineView,
  State,
  Router,
  registerViewClass,
} from "@lark.js/mvc";

export type FrameworkConfig = Omit<LarkMvcFrameworkConfig, "routeMode"> & {
  routeMode: "history";
};

export type { ViewCtx, ViewSetup } from "@lark.js/mvc";

// ============================================================
// @lark.js/docs types (browser-safe)
// ============================================================

export type {
  DocsConfig,
  NavItem,
  SidebarConfig,
  SidebarItem,
  MarkdownOptions,
  HighlightOptions,
  SearchOptions,
  PageData,
  HeadingInfo,
  DocsRoute,
  SearchEntry,
  FrontmatterResult,
  CompileMarkdownOptions,
} from "./types";

// ============================================================
// Runtime utilities (browser-safe)
// ============================================================

// Browser-safe runtime utility (also available at @lark.js/docs/runtime)
export { slugify } from "./runtime";

// Theme view factories
export {
  createDocsLayoutView,
  createSidebarView,
  createTocView,
  createSearchView,
  createLocalSearchClient,
  registerThemeViews,
} from "./theme";

// Theme icons (lucide-static raw SVG strings)
export { icons } from "./theme/icons";
