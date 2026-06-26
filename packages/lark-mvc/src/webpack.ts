/**
 * @lark.js/mvc Webpack Integration for Template Compilation
 *
 * Provides two integration modes:
 *
 * 1. **Loader** (larkMvcLoader) — Direct file transformation
 *    - Transforms .html files into JS function modules
 *    - Requires manual webpack.config.mjs setup
 *
 * 2. **Plugin** (LarkMvcPlugin) — Auto-registers the loader
 *    - Automatically configures the loader rule for .html files
 *    - Zero-config: just add the plugin to your webpack config
 *    - Recommended approach for most use cases
 *
 * Features:
 * - All template operators: = (escape), ! (raw), @ (ref lookup), : (binding)
 * - @event attribute processing with $g prefix
 * - $encUri (URI encoding), $encQuote (quote encoding), $refFn (reference lookup)
 * - Debug mode with line tracking
 * - View ID injection
 * - Auto variable extraction via AST analysis (Babel)
 * - Virtual DOM support (optional)
 *
 * Usage with Plugin (recommended):
 * ```js
 * import { LarkMvcPlugin } from '@lark.js/mvc/webpack';
 *
 * export default {
 *   plugins: [
 *     new LarkMvcPlugin({
 *       debug: process.env.NODE_ENV !== 'production',
 *       virtualDom: false,
 *     }),
 *   ],
 * };
 * ```
 *
 * Usage with Loader (manual):
 * ```js
 * export default {
 *   module: {
 *     rules: [{
 *       test: /\.html$/,
 *       loader: '@lark.js/mvc/webpack',
 *       options: { debug: false, virtualDom: false },
 *     }],
 *   },
 * };
 * ```
 */
import { compileTemplate, extractGlobalVars } from "./compiler";
import { injectTemplateHmrSnippet } from "./hmr-inject";
import type { LarkMvcVitePluginOptions } from "./vite";

export type LarkMvcWebpackLoaderOptions = LarkMvcVitePluginOptions;

/** Webpack loader context */
interface LoaderContext {
  /** Whether in development mode */
  dev?: boolean;
  /** Loader options */
  getOptions: () => LarkMvcWebpackLoaderOptions;
}

/** Plugin options */
export interface LarkMvcWebpackPluginOptions extends LarkMvcWebpackLoaderOptions {
  /** File extension to match (default: /\.html$/) */
  test?: RegExp;
  /** Exclude pattern (default: /node_modules/) */
  exclude?: RegExp;
}

/**
 * Webpack loader entry point.
 * Compiles .html template files into JS function modules.
 *
 * Uses this.callback() for async result delivery — this is the standard
 * webpack pattern for async loaders. Unlike rspack, webpack 5 does not
 * reliably support returning a Promise from the loader function; the
 * callback approach works across all webpack 5.x versions.
 */
async function larkMvcLoader(
  this: LoaderContext,
  source: string,
): Promise<string> {
  try {
    const options = this.getOptions() || {};
    const { debug = false, virtualDom = false } = options;

    const globalVars = await extractGlobalVars(source);
    const compiled = await compileTemplate(source, {
      debug,
      globalVars,
      virtualDom,
    });
    // Auto-inject HMR: the compiled template module self-accepts, so
    // .html changes hot-swap the template on all mounted views without
    // a full page reload — no user-side code required (like React/Vue).
    return injectTemplateHmrSnippet(compiled, "webpack");
  } catch (err) {
    console.error(err);
    return "";
  }
}

/**
 * Webpack plugin that auto-registers the lark-mvc loader.
 *
 * This is the recommended integration approach. The plugin:
 * 1. Automatically adds a loader rule for .html files
 * 2. Passes through all configuration options
 * 3. Handles edge cases (e.g., excluding node_modules)
 *
 * Usage:
 * ```js
 * import { LarkMvcPlugin } from '@lark.js/mvc/webpack';
 *
 * export default {
 *   plugins: [
 *     new LarkMvcPlugin({
 *       debug: true,
 *       virtualDom: false,
 *     }),
 *   ],
 * };
 * ```
 */
class LarkMvcPlugin {
  private options: LarkMvcWebpackPluginOptions;

  constructor(options: LarkMvcWebpackPluginOptions = {}) {
    this.options = {
      debug: false,
      virtualDom: false,
      test: /\.html$/,
      exclude: /node_modules/,
      ...options,
    };
  }

  /**
   * Webpack plugin entry point.
   * Called by webpack when the plugin is applied.
   */
  apply(compiler: {
    options: {
      module: {
        rules: unknown[];
      };
    };
  }): void {
    const { debug, virtualDom, test, exclude } = this.options;

    // Push the loader rule into webpack's module.rules
    compiler.options.module = compiler.options.module || {};
    compiler.options.module.rules = compiler.options.module.rules || [];

    compiler.options.module.rules.push({
      test,
      exclude,
      use: [
        {
          // Resolve the loader path (this file).

          // Deprecated implementation
          // isCjs() ? __filename : fileURLToPath(import.meta.url);

          // __filename is provided by tsup's ESM shim (shims: true) in ESM output,
          // and is a native CJS global in CJS output.
          loader: __filename,
          options: { debug, virtualDom },
        },
      ],
    });
  }
}

export { larkMvcLoader, LarkMvcPlugin };
export { larkMvcLoader as default };
