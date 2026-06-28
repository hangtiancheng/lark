/**
 * Vite plugin for @lark.js/docs.
 *
 * A single plugin that handles BOTH:
 * 1. .md file compilation (frontmatter, markdown-it, Shiki)
 * 2. .html template compilation (lark-mvc template engine)
 *
 * Consumers only need this one plugin — no separate larkMvcPlugin7() required.
 *
 * Usage:
 * ```ts
 * import { larkDocsPlugin } from "@lark.js/docs/vite";
 *
 * export default defineConfig({
 *   plugins: [larkDocsPlugin({ config: docsConfig })],
 * });
 * ```
 */
import fs from "node:fs";
import type { DocsConfig } from "./types";
import { compileMarkdown } from "./compile-markdown";
import type { Plugin } from "vite";
import {
  larkMvcPlugin,
  type LarkMvcVitePluginOptions,
} from "@lark.js/mvc/vite";

// Re-export build-time utilities for use in vite.config
// (avoids importing from main entry which pulls in lucide-static SVG ?raw imports)
export { defineConfig } from "./define-config";
export { scanDocsDir } from "./scanner";
export { generateRouteMap, generateBootModule } from "./route-map";
export { generateSidebar } from "./sidebar-generator";
export { buildSearchIndex } from "./search-index";
export type { DocsConfig, SidebarConfig } from "./types";

export interface LarkDocsVitePluginOptions extends LarkMvcVitePluginOptions {
  /** Full docs config. */
  config: DocsConfig;
}

// Suffix used to mark compiled .md files in the module graph
const MD_SUFFIX = "?lark-docs";

/**
 * Create a Vite plugin array that handles both .md and .html compilation.
 *
 * Returns an array of two plugins:
 * 1. lark-docs: compiles .md files to JS modules
 * 2. lark-template (from @lark.js/mvc): compiles .html templates
 *
 * The vdom option is read from `config.vdom` automatically.
 */
export function larkDocsPlugin(options: LarkDocsVitePluginOptions): Plugin[] {
  const { config, debug = false, vdom = false } = options;

  const docsPlugin: Plugin = {
    name: "lark-docs",
    enforce: "pre",

    resolveId(source: string) {
      // Strip query params (Vite 8 may add ?import, ?url, etc.)
      const cleanSource = source.split("?")[0];
      if (cleanSource.endsWith(".md")) {
        return cleanSource + MD_SUFFIX;
      }
      return null;
    },

    async load(id: string) {
      // Vite may add extra query params (e.g. ?import&lark-docs),
      // so check if lark-docs is in the query, not just endsWith.
      const qIdx = id.indexOf("?");
      const query = qIdx >= 0 ? id.slice(qIdx + 1) : "";
      if (!query.split("&").includes("lark-docs")) return null;

      // Extract file path: strip query params
      let filePath = qIdx >= 0 ? id.slice(0, qIdx) : id;

      // Strip Vite's @fs prefix (used for files outside the root)
      if (filePath.startsWith("/@fs")) {
        filePath = filePath.slice("/@fs".length); // "/@fs/path" → "/path"
      }

      const source = fs.readFileSync(filePath, "utf-8");

      return await compileMarkdown(source, {
        config,
        filePath,
        debug,
      });
    },
  };

  // The lark-mvc template plugin handles .html template compilation.
  // We integrate it internally so consumers don't need to configure it separately.
  const mvcPlugin = larkMvcPlugin({ debug, vdom });

  return [docsPlugin, mvcPlugin as Plugin];
}
