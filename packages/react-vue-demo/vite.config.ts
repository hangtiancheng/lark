import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import v8 from "v8";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    {
      name: "hardware",
      configureServer(server) {
        server.middlewares.use("/json", (req, res) => {
          setTimeout(() => {
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                nodeMemory: process.memoryUsage(),
                v8HeapStats: v8.getHeapStatistics(),
              }),
            );
          }, 5000);
        });
      },
    },
  ],
  resolve: {
    alias: {
      vue: "@lark/react-vue",
      "@vue/composition-api": "@lark/react-vue",
      "@vue/runtime-dom": "@lark/react-vue",
      "@": resolve(__dirname, "src"),
    },
  },
  /**
   * Actually listing `react-vue` here is not required.
   * It's only required for our yarn workspaces setup.
   * For some reason Vite don't optimizes locally linked deps.
   */
  optimizeDeps: {
    include: ["@lark/react-vue"],
  },
});
