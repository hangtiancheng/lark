import { defineConfig } from "@rsbuild/core";
import { LarkMvcPlugin } from "@lark.js/mvc/rspack";
import tailwindcss from "@tailwindcss/postcss";

// Module Federation requires an absolute publicPath in dev mode so that the
// remote's chunk URLs resolve against the remote's own dev server, not the
// host's.
//
// Problem: when `assetPrefix` is "/" (relative) or "auto", rspack's MF
// runtime does NOT infer the remote's origin at runtime the way webpack
// does. The `inferAutoPublicPath(version)` branch in the generated
// remoteEntry.js requires a `version` argument that MF runtime fails to
// pass in dev mode, so `publicPath` stays as the string "auto" → the browser
// resolves chunk URLs against the host page's origin (lark-devtool:5173) →
// the host's dev server returns index.html (historyApiFallback) →
// "Unexpected token '<'".
//
// Fix: set an absolute URL (`http://localhost:3000/`) in dev mode so
// `manifest.metaData.publicPath` is a concrete origin, not "auto".
// Production builds use "/" and rely on the CDN / static host to serve
// chunks from the same origin.
const MF_DEV_ORIGIN = "http://localhost:3000/";

export default defineConfig(({ command }) => {
  const isDev = command === "dev";
  return {
    source: {
      entry: {
        index: "./src/remoteEntry.ts",
      },
    },

    resolve: {
      alias: {
        "@": "./src",
      },
    },

    output: {
      sourceMap: true,
      distPath: {
        root: "./dist-rsbuild",
      },
      filename: {
        js: "js/[name].[contenthash:8].js",
      },
      // Absolute URL in dev so MF chunks load from the remote's own dev server.
      // In production this falls back to "/" (served from the same origin).
      assetPrefix: command === "dev" ? MF_DEV_ORIGIN : "/",
      cssModules: {
        localIdentName: "[name]__[local]--[hash:base64:5]",
        exportLocalsConvention: "asIs",
      },
    },

    html: {
      template: "./webpack-index.html",
      inject: "body",
    },

    tools: {
      postcss(_, { addPlugins }) {
        addPlugins([tailwindcss]);
      },

      rspack(config, { rspack }) {
        // Force absolute publicPath in dev so MF chunks load from this remote's
        // own dev server, not the host's. rsbuild's `assetPrefix` alone is
        // insufficient — rspack's MF runtime stores `output.publicPath` into
        // `manifest.metaData.publicPath` at compile time, and the "auto"
        // string survives into the generated remoteEntry.js because the runtime
        // `inferAutoPublicPath(version)` branch never fires (no `version` arg).
        config.output = config.output ?? {};
        config.output.publicPath = isDev ? MF_DEV_ORIGIN : "/";

        // Lark template processing
        config.plugins = config.plugins ?? [];
        config.plugins.push(
          new LarkMvcPlugin({ vdom: true, exclude: /index\.html$/ }),
        );

        // Module Federation (Remote + Consumer)
        config.plugins.push(
          new rspack.container.ModuleFederationPlugin({
            name: "lark_demo",
            filename: "remoteEntry.js",
            exposes: {
              "./counter-view": "./src/exposed/counter-view.ts",
            },
            remotes: {
              lark_devtool: "lark_devtool@http://localhost:5173/remoteEntry.js",
            },
            shared: {
              "@lark.js/mvc": {
                singleton: true,
                requiredVersion: "*",
              },
            },
          }),
        );

        // splitChunks: "async" to keep @lark.js/mvc synchronous in entry chunk
        // for MF shared scope initialization.
        config.optimization = config.optimization ?? {};
        config.optimization.splitChunks = {
          chunks: "async",
          minSize: 0,
          cacheGroups: {
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
            "vendor-lark-mvc": {
              test: /lark[\\/]dist[\\/]index\.js$/,
              name: "vendor-lark-mvc",
              chunks: "async",
              enforce: true,
            },
            "vendor-babel-parser": {
              test: /[\\/]node_modules[\\/].*?[\\/]@babel[\\/]parser/,
              name: "vendor-babel-parser",
              chunks: "async",
              enforce: true,
            },
          },
        };
      },
    },

    server: {
      port: 3000,
      open: true,
      // CORS headers — required so the host (lark-devtool:5173) can fetch
      // this remote's chunks cross-origin via dynamic import / fetch.
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    },

    dev: {
      hmr: true,
    },
  };
});
