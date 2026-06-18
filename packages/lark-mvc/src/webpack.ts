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
 * - Auto variable extraction via AST analysis (Babel or SWC)
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
 *       loader: '@lark.js/mvc/webpack',
 *       options: { debug: false, virtualDom: false, useSwc: false },
 *     }],
 *   },
 * };
 * ```
 */
import { compileTemplate, extractGlobalVars } from "./compiler";

/** Webpack loader context */
interface LoaderContext {
  /** Callback to return the result */
  callback: (error: Error | null, result?: string) => void;
  /** Whether in development mode */
  dev?: boolean;
  /** Loader options */
  getOptions: () => { debug?: boolean; virtualDom?: boolean; useSwc?: boolean };
}

/** Plugin options */
interface LarkMvcPluginOptions {
  /** Enable debug mode with line tracking (default: false) */
  debug?: boolean;
  /** Enable virtual DOM output (default: false) */
  virtualDom?: boolean;
  /** Use SWC instead of Babel for AST analysis (default: false) */
  useSwc?: boolean;
  /** File extension to match (default: /\.html$/) */
  test?: RegExp;
  /** Exclude pattern (default: /node_modules/) */
  exclude?: RegExp;
}

/**
 * Webpack loader entry point.
 * Compiles .html template files into JS function modules.
 */
async function larkMvcLoader(
  this: LoaderContext,
  source: string,
): Promise<void> {
  const options = this.getOptions();
  const { debug = false, virtualDom = false, useSwc = false } = options;

  try {
    // Auto-extract variables from template for 0-config experience
    const globalVars = await extractGlobalVars(source);
    const result = await compileTemplate(source, {
      debug,
      globalVars,
      virtualDom,
      useSwc,
    });
    this.callback(null, result);
  } catch (error) {
    this.callback(error instanceof Error ? error : new Error(String(error)));
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
 *       useSwc: false,
 *     }),
 *   ],
 * };
 * ```
 */
class LarkMvcPlugin {
  private options: LarkMvcPluginOptions;

  constructor(options: LarkMvcPluginOptions = {}) {
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
   * Webpack plugin entry point.
   * Called by webpack when the plugin is applied.
   */
  apply(compiler: any): void {
    const { debug, virtualDom, useSwc, test, exclude } = this.options;

    // Resolve the loader path (this file)
    // In production builds, this will be the compiled webpack.js
    const loaderPath = __filename;

    // Push the loader rule into webpack's module.rules
    compiler.options.module = compiler.options.module || {};
    compiler.options.module.rules = compiler.options.module.rules || [];

    compiler.options.module.rules.push({
      test,
      exclude,
      use: [
        {
          loader: loaderPath,
          options: {
            debug,
            virtualDom,
            useSwc,
          },
        },
      ],
    });
  }
}

export { larkMvcLoader, LarkMvcPlugin };
