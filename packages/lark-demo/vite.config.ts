import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { larkMvcPlugin } from "@lark.js/mvc/vite";
import { fileURLToPath } from "url";
import { federation } from "@module-federation/vite";

// const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    larkMvcPlugin({ virtualDom: true }),
    federation({
      name: "lark_demo", // Module federation name
      filename: "remoteEntry.js", // Entry point
      // optional: additional "var" remoteEntry file
      // needed only for legacy hosts with "var" usage (remote.type = 'var')
      varFilename: "varRemoteEntry.js",
      exposes: {
        "./counter-view": "./src/exposed/counter-view.ts",
      },
      remotes: {
        lark_devtool: {
          type: "module",
          name: "lark_devtool",
          entry: "http://localhost:5173/remoteEntry.js",
          entryGlobalName: "lark_devtool",
          shareScope: "default",
        },
      },
      shared: {
        "@lark.js/mvc": {
          singleton: true,
          requiredVersion: "*",
        },
        react: {
          singleton: true,
          requiredVersion: "*",
        },
        "react-dom": {
          singleton: true,
          requiredVersion: "*",
        },
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
  // Prevent Vite from pre-bundling react/react-dom — they must go through
  // MF shared scope so that host and remote use the same React instance.
  // Without this, Vite creates a local pre-bundled copy that bypasses
  // the shared scope, resulting in two React copies and "Invalid hook call".
  optimizeDeps: {
    exclude: ["react", "react-dom", "react/jsx-runtime", "react-dom/client"],
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
