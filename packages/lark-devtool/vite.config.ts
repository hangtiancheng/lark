import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { federation } from "@module-federation/vite";
import tailwindcss from "@tailwindcss/vite";

// const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    federation({
      name: "lark_devtool",
      remotes: {
        // "lark_demo": "lark_demo@http://localhost:3000/remoteEntry.js",
        lark_demo: {
          // Import alias of the remote module: import xxx from "lark-demo/counter-view"
          type: "module", // ESM
          name: "lark_demo", // Module federation name of the remote module
          entry: "http://localhost:3000/remoteEntry.js", // Entry point of the remote module
          entryGlobalName: "lark_demo", // window.lark_demo
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
  server: {
    port: 5173,
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
          if (id.includes("/src/components/counter-store")) return "comp-counter-store";
          if (id.includes("/src/components/counter-updater")) return "comp-counter-updater";
        },
      },
    },
  },
});
