/**
 * @lark.js/mvc Rspack Integration for Template Compilation
 *
 * Provides two integration modes:
 *
 * 1. **Loader** (larkMvcLoader) — Direct file transformation
 *    - Transforms .html files into JS function modules
 *    - Requires manual rspack.config.ts setup
 *
 * 2. **Plugin** (LarkMvcPlugin) — Auto-registers the loader
 *    - Automatically configures the loader rule for .html files
 *    - Zero-config: just add the plugin to your rspack config
 *    - Recommended approach for most use cases
 *
 * Features:
 * - All template operators: = (escape), ! (raw), @ (ref lookup), : (binding)
 * - @event attribute processing with $g prefix
 * - $encUri (URI encoding), $encQuote (quote encoding), $refFn (reference lookup)
 * - Debug mode with line tracking
 * - View ID injection
 * - Auto variable extraction via AST analysis (Babel or SWC)
 * - Virtual DOM support (optional)
 *
 * Usage with Plugin (recommended):
 * ```js
 * import { LarkMvcPlugin } from '@lark.js/mvc/rspack';
 *
 * export default {
 *   plugins: [
 *     new LarkMvcPlugin({
 *       debug: process.env.NODE_ENV !== 'production',
 *       virtualDom: false,
 *       useSwc: false,
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
 *       loader: '@lark.js/mvc/rspack',
 *       options: { debug: false, virtualDom: false, useSwc: false },
 *     }],
 *   },
 * };
 * ```
 */
import type { Compiler, RspackPluginInstance } from "@rspack/core";
import { compileTemplate, extractGlobalVars } from "./compiler.js";
import type {
  LarkMvcWebpackLoaderOptions,
  LarkMvcWebpackPluginOptions,
} from "./webpack.js";
export type {
  LarkMvcWebpackLoaderOptions,
  LarkMvcWebpackPluginOptions,
} from "./webpack.js";

/** Rspack loader context */
interface LoaderContext {
  /** Whether in development mode */
  dev?: boolean;
  /** Loader options */
  getOptions: () => LarkMvcWebpackLoaderOptions;
}

/**
 * Rspack loader entry point.
 * Compiles .html template files into JS function modules.
 *
 * Unlike the webpack version, rspack async loaders must return the result
 * directly rather than calling `this.callback()`. Calling callback() inside
 * an async function causes "callback already called" errors because the
 * resolved promise also signals completion.
 */
export async function larkMvcLoader(
  this: LoaderContext,
  source: string,
): Promise<string> {
  try {
    const options = this.getOptions();
    const { debug = false, virtualDom = false, useSwc = false } = options;

    const globalVars = await extractGlobalVars(source);
    return await compileTemplate(source, {
      debug,
      globalVars,
      virtualDom,
      useSwc,
    });
  } catch (err) {
    console.error(err);
    return "";
  }
}

/**
 * Rspack plugin that auto-registers the lark-mvc loader.
 *
 * This is the recommended integration approach. The plugin:
 * 1. Automatically adds a loader rule for .html files
 * 2. Passes through all configuration options
 * 3. Handles edge cases (e.g., excluding node_modules)
 *
 * Usage:
 * ```js
 * import { LarkMvcPlugin } from '@lark.js/mvc/rspack';
 *
 * export default {
 *   plugins: [
 *     new LarkMvcPlugin({
 *       debug: true,
 *       virtualDom: false,
 *       useSwc: false,
 *     }),
 *   ],
 * };
 * ```
 */
export class LarkMvcPlugin implements RspackPluginInstance {
  private options: LarkMvcWebpackPluginOptions;

  constructor(options: LarkMvcWebpackPluginOptions = {}) {
    this.options = {
      debug: false,
      virtualDom: false,
      useSwc: false,
      test: /\.html$/,
      exclude: /node_modules/,
      ...options,
    };
  }

  /**
   * Rspack plugin entry point.
   * Called by rspack when the plugin is applied.
   */
  apply(compiler: Compiler): void {
    const { debug, virtualDom, useSwc, test, exclude } = this.options;

    // Push the loader rule into rspack's module.rules
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
          options: { debug, virtualDom, useSwc },
        },
      ],
    });
  }
}

export { larkMvcLoader as default };
