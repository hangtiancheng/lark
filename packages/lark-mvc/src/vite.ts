/**
 * @lark.js/mvc Vite Plugin for Template Compilation
 *
 * Compiles .html template files using @lark.js/mvc template syntax
 * into JS function modules at build/dev time.
 *
 * 0 configuration — just add the plugin and it works.
 * - All template operators: = (escape), ! (raw), @ (ref lookup), : (binding)
 * - @event attribute processing with $g prefix
 * - $eu (URI encoding), $eq (quote encoding), $i (reference lookup)
 * - Debug mode with line tracking
 * - View ID injection
 * - Auto variable extraction
 *
 * Usage in vite.config.ts:
 * ```ts
 * import { larkMvcPlugin } from '@lark.js/mvc/vite';
 *
 * export default defineConfig({
 *   plugins: [larkMvcPlugin()],
 * });
 * ```
 */
import type { Plugin } from "vite";
import { dirname, isAbsolute, join, resolve } from "path";
import { existsSync, readFileSync } from "fs";
import { compileTemplate, extractGlobalVars } from "./compiler";
import { injectTemplateHmrSnippet, injectViewHmrSnippet, importsHtmlTemplate } from "./hmr-inject";

export interface LarkMvcVitePluginOptions {
  /** Enable debug mode with line tracking (default: false) */
  debug?: boolean;
  /** Enable virtual DOM output (default: false) */
  vdom?: boolean;
}

/** Suffix appended to resolved IDs to mark them as lark template modules */
const LARK_TEMPLATE_SUFFIX = "?lark-template";

/**
 * Create a Vite plugin that compiles .html template files.
 *
 * @param options - Plugin options
 * @param options.vdom - Generate VDOM output instead of HTML string (default: false)
 * @returns Vite plugin instance
 */
export function larkMvcPlugin(options: LarkMvcVitePluginOptions = {}): Plugin {
  const { debug = false, vdom = false } = options;
  let root = __dirname;

  return {
    name: "lark-template",
    enforce: "pre",

    configResolved(config) {
      root = config.root;
    },

    resolveId(source, importer) {
      // Strip query params from source (Vite may add ?url, ?raw, etc.)
      const sourcePath = source.split("?")[0];
      if (sourcePath.endsWith(".html") && importer) {
        const importerPath = importer.split("?")[0];
        let resolved = resolve(dirname(importerPath), sourcePath);

        // Strip Vite's @fs prefix (used for files outside the root)
        if (resolved.startsWith("/@fs")) {
          resolved = resolved.slice("/@fs".length); // "/@fs/path" → "/path"
        }

        // Handle URL-style paths from Rolldown scanner (e.g. /src/main.ts):
        // path.isAbsolute returns true for /src on Unix, but it's not a
        // real filesystem path — fall back to joining with project root.
        if (!isAbsolute(resolved) || !existsSync(resolved)) {
          const rootResolved = join(root, resolved);
          if (existsSync(rootResolved)) {
            resolved = rootResolved;
          }
        }
        return resolved + LARK_TEMPLATE_SUFFIX;
      }
      return undefined;
    },

    async load(id) {
      // Match lark-template modules. Vite may add ?import before our suffix,
      // producing ?import&lark-template, so use includes instead of endsWith.
      const qIdx = id.indexOf("?");
      const query = qIdx >= 0 ? id.slice(qIdx + 1) : "";
      if (query.split("&").includes("lark-template")) {
        let filePath = qIdx >= 0 ? id.slice(0, qIdx) : id;

        // Strip Vite's @fs prefix (used for files outside the root)
        if (filePath.startsWith("/@fs")) {
          filePath = filePath.slice(4); // "/@fs/path" → "/path"
        }

        // Handle URL-style paths from Rolldown dependency scanner (Vite 8)
        if (!isAbsolute(filePath) || !existsSync(filePath)) {
          const rootResolved = join(root, filePath);
          if (existsSync(rootResolved)) {
            filePath = rootResolved;
          }
        }
        if (!existsSync(filePath)) return undefined;
        const raw = readFileSync(filePath, "utf-8");
        // Auto-extract variables from template for 0-config experience
        const globalVars = await extractGlobalVars(raw);
        const compiled = await compileTemplate(raw, {
          debug,
          globalVars,
          vdom,
        });
        // Auto-inject HMR: the compiled template module self-accepts, so
        // .html changes hot-swap the template on all mounted views without
        // a full page reload — no user-side code required (like React/Vue).
        //
        // Return { code, map: null } so Rolldown knows this plugin does not
        // emit a sourcemap for the compiled output. Returning a bare string
        // triggers [SOURCEMAP_BROKEN] warnings when build.sourcemap is true.
        return { code: injectTemplateHmrSnippet(compiled, "vite"), map: null };
      }
      return undefined;
    },

    /**
     * Transform hook: inject view-class HMR into .ts files that import .html.
     *
     * When a .ts view file changes, the auto-injected HMR snippet captures
     * the old View setup function (via dispose) and the new one (via accept),
     * then calls `hotSwapByView(old, new)` to hot-swap all mounted views
     * — preserving state.
     */
    transform(code, id) {
      // Only process .ts files (skip .html, node_modules, etc.)
      if (!/\.[tj]s$/.test(id)) return undefined;
      if (id.includes("node_modules")) return undefined;
      // Fast-path: skip files that don't import .html templates.
      // Running injectViewHmr on every .ts file and returning the (unchanged)
      // string would be treated as a transformation by Rolldown, triggering
      // [SOURCEMAP_BROKEN] warnings when build.sourcemap is true.
      if (!importsHtmlTemplate(code)) return undefined;
      const transformed = injectViewHmrSnippet(code, "vite");
      // If no `export default` was found, injectViewHmr returns the source
      // unchanged — skip to avoid a no-op transformation.
      if (transformed === code) return undefined;
      // Return { code, map: null } so Rolldown knows we don't emit a
      // sourcemap for the HMR injection, suppressing SOURCEMAP_BROKEN.
      return { code: transformed, map: null };
    },
  };
}

export default larkMvcPlugin;
