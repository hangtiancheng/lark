import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import HtmlWebpackPlugin from "html-webpack-plugin";

// Resolve webpack from webpack-cli's location to ensure both use the same
// webpack instance. In pnpm's strict node_modules, `import "webpack"` here
// and webpack-cli's internal `require("webpack")` can resolve to different
// virtual store entries (different peer dependency hashes), causing
// "The 'compilation' argument must be an instance of Compilation".
const require = createRequire(import.meta.resolve("webpack-cli"));
const webpack = require("webpack");

const { ModuleFederationPlugin } = webpack.container;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  entry: "./src/remote-entry.ts",

  output: {
    clean: true,
    filename: "js/[name].[contenthash:8].js",
    // Async chunks from dynamic import() use this naming pattern
    chunkFilename: "js/[name].[contenthash:8].js",
    path: path.resolve(__dirname, "./dist-webpack"),
    publicPath: "auto",
  },

  resolve: {
    extensions: [".ts", ".js"],
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.module\.css$/,
        use: [
          "style-loader",
          {
            loader: "css-loader",
            options: {
              importLoaders: 1,
              modules: {
                namedExport: false,
                exportLocalsConvention: "asIs",
                localIdentName: "[name]__[local]--[hash:base64:5]",
              },
            },
          },
          "postcss-loader",
        ],
      },
      {
        test: /\.css$/,
        exclude: /\.module\.css$/,
        use: ["style-loader", "css-loader", "postcss-loader"],
      },
      // Lark template processing - compiles .html to template functions
      {
        test: /\.html$/,
        use: [
          {
            loader: "@lark.js/mvc/webpack",
            options: {
              virtualDom: true,
            },
          },
        ],
        exclude: /index\.html$/,
      },
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: "./webpack-index.html",
      inject: "body",
      minify: false,
    }),

    // ── Module Federation (Remote) ──
    // Exposes Lark views so that other apps can consume them at runtime.
    // Host apps load these via: import('lark-demo/counter-view')
    new ModuleFederationPlugin({
      name: "lark_demo",
      filename: "remoteEntry.js",
      exposes: {
        "./counter-view": "./src/exposed/counter-view.ts",
      },
      shared: {
        "@lark.js/mvc": { singleton: true, requiredVersion: "*" },
      },
    }),
  ],
  devServer: {
    port: 3000,
    open: true,
    hot: true,
    compress: true,
    historyApiFallback: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    client: {
      overlay: {
        errors: true,
        warnings: false,
      },
    },
  },

  optimization: {
    // ────────────────────────────────────────────────────────────────────────────────────
    // splitChunks.chunks: "initial" | "async" | "all"
    //   "initial" – process entry chunks only; ignore async (dynamic-import) chunks
    //   "async"   – process async chunks only; leave entry chunks untouched
    //   "all"     – process both entry and async chunks
    //
    // Why "async" instead of "all":
    //
    //   Module Federation shared modules (@lark.js/mvc, singleton: true) must be
    //   synchronously available in the initial chunk so that the shared scope can be
    //   correctly initialized when remoteEntry.js executes.
    //
    //   Failure chain with "all":
    //     1. Host (lark-devtool) calls import("lark-demo/counter-view")
    //     2. Host's MF runtime injects <script src="remoteEntry.js">
    //     3. remoteEntry.js initializes the shared scope — requires @lark.js/mvc
    //        synchronously
    //     4. "all" has already extracted @lark.js/mvc into a separate async vendor chunk
    //     5. Shared scope initialization fails — chunk not yet loaded
    //     6. window.__lark_DemoMF is never set
    //     7. Throws: ScriptExternalLoadError: Loading script failed. (missing)
    //
    //   Fix: use "async" so @lark.js/mvc stays in the initial chunk, remains
    //   synchronously available, and shared scope initialization succeeds.
    // ────────────────────────────────────────────────────────────────────────────────────

    // Split view modules into separate chunks
    splitChunks: {
      chunks: "async",
      minSize: 0,
      cacheGroups: {
        // ── View chunks (async, loaded by Framework.use → require) ──
        "view-home": {
          test: /src[\\/]views[\\/]home/,
          name: "view-home",
          chunks: "async",
          enforce: true,
        },
        "view-about": {
          test: /src[\\/]views[\\/]about/,
          name: "view-about",
          chunks: "async",
          enforce: true,
        },
        "view-counter": {
          test: /src[\\/]views[\\/]counter/,
          name: "view-counter",
          chunks: "async",
          enforce: true,
        },
        "view-404": {
          test: /src[\\/]views[\\/]404/,
          name: "view-404",
          chunks: "async",
          enforce: true,
        },
        "comp-counter-store": {
          test: /src[\\/]components[\\/]counter-store/,
          name: "comp-counter-store",
          chunks: "async",
          enforce: true,
        },
        "comp-counter-updater": {
          test: /src[\\/]components[\\/]counter-updater/,
          name: "comp-counter-updater",
          chunks: "async",
          enforce: true,
        },
        // ── MF shared dependency chunks ──
        // @lark.js/mvc singleton shared dependency
        "vendor-lark-mvc": {
          test: /lark[\\/]dist[\\/]index\.js$/,
          name: "vendor-lark-mvc",
          chunks: "async",
          enforce: true,
        },
        // CSS-related loaders (style-loader, css-loader, postcss-loader)
        "vendor-css-loaders": {
          test: /[\\/]node_modules[\\/].*?[\\/]style-loader|css-loader|postcss-loader/,
          name: "vendor-css-loaders",
          chunks: "async",
          enforce: true,
        },
        // @babel/parser (used by lark template compiler)
        "vendor-babel-parser": {
          test: /[\\/]node_modules[\\/].*?[\\/]@babel[\\/]parser/,
          name: "vendor-babel-parser",
          chunks: "async",
          enforce: true,
        },
      },
    },
  },

  devtool: "source-map",
};
