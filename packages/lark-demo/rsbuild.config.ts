import { defineConfig } from "@rsbuild/core";
import { LarkMvcPlugin } from "@lark.js/mvc/rspack";
import tailwindcss from "@tailwindcss/postcss";

export default defineConfig({
  source: {
    entry: {
      index: "./src/remote-entry.ts",
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
    assetPrefix: "auto",
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
      // Lark template processing
      config.plugins = config.plugins ?? [];
      config.plugins.push(
        new LarkMvcPlugin({ virtualDom: true, exclude: /index\.html$/ }),
      );

      // Module Federation (Remote)
      config.plugins.push(
        new rspack.container.ModuleFederationPlugin({
          name: "lark_demo",
          filename: "remoteEntry.js",
          exposes: {
            "./counter-view": "./src/exposed/counter-view.ts",
          },
          shared: {
            "@lark.js/mvc": { singleton: true, requiredVersion: "*" },
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
  },

  dev: {
    hmr: true,
  },
});
