import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import tailwindcss from "@tailwindcss/postcss";

export default defineConfig({
  plugins: [pluginReact()],

  source: {
    entry: {
      index: "./src/remote-entry.tsx",
    },
  },

  output: {
    distPath: {
      root: "./dist",
    },
    filename: {
      js: "[name].[contenthash:8].js",
    },
    assetPrefix: "auto",
    copy: [{ from: "./public", to: "." }],
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
      // Module Federation (Host / Consumer)
      config.plugins = config.plugins ?? [];
      config.plugins.push(
        new rspack.container.ModuleFederationPlugin({
          name: "lark_devtool",
          filename: "remoteEntry.js",
          remotes: {
            lark_demo: "lark_demo@http://localhost:3000/remoteEntry.js",
          },
          shared: {
            "@lark.js/mvc": { singleton: true, requiredVersion: "*" },
            react: { singleton: true, eager: true },
            "react-dom": { singleton: true, eager: true },
          },
        }),
      );

      // splitChunks: vendor cache group for node_modules
      config.optimization = config.optimization ?? {};
      config.optimization.splitChunks = {
        chunks: "all",
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendor",
            chunks: "all",
          },
        },
      };
    },
  },

  server: {
    port: 5173,
    open: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  },

  dev: {
    hmr: true,
    lazyCompilation: false,
  },
});
