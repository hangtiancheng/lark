import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { federation } from "@module-federation/vite";

// const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "lark_devtool",
      remotes: {
        // "lark-demo": "lark_demo@http://localhost:3000/remoteEntry.js",
        "lark-demo": {
          type: "module",
          name: "lark_demo",
          entry: "http://localhost:3000/remoteEntry.js",
          entryGlobalName: "lark_demo",
          shareScope: "default",
        },
      },
      filename: "remoteEntry.js",
      shared: {
        "@lark.js/mvc": { singleton: true, requiredVersion: "*" },
        react: { singleton: true, requiredVersion: "*" },
        "react-dom": { singleton: true, requiredVersion: "*" },
      },
    }),
  ],
  root: "./",
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  css: {
    postcss: "./postcss.config.js",
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    sourcemap: true,
    outDir: "./dist",
    rollupOptions: {
      input: resolve(__dirname, "./index.html"),
      output: {
        // Named chunks for view modules — each dynamic import creates
        // a separate file with a readable name instead of random hash.
        manualChunks(id) {
          if (id.includes("/src/views/home")) return "view-home";
          if (id.includes("/src/views/about")) return "view-about";
          if (id.includes("/src/views/counter")) return "view-counter";
          if (id.includes("/src/views/404")) return "view-404";
          if (id.includes("/src/components/counter-store"))
            return "comp-counter-store";
          if (id.includes("/src/components/counter-updater"))
            return "comp-counter-updater";
        },
      },
    },
  },
});
