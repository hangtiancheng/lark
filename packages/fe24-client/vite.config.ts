import { fileURLToPath, URL } from "node:url";

import { checkbox } from "@inquirer/prompts";
import ViteConditionalBundlePlugin from "@lark.js/conditional-bundle-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, type UserConfig } from "vite";
import vueDevTools from "vite-plugin-vue-devtools";

import createJsonFiles from "./plugins/create-json";
import viteServer from "./plugins/vite-server";
import { sentryPlugin } from "@lark.js/sentry/vite";

const ROUTES = ["dashboard", "main", "main/grid", "map", "order", "order/detail"];

function getSelectedRoutesFromEnv(): string[] | null {
  const value = process.env.SELECTED_ROUTES;
  if (!value) {
    return null;
  }

  const selectedRoutes = value
    .split(",")
    .map((route) => route.trim())
    .filter(Boolean);

  return selectedRoutes.length > 0 ? selectedRoutes : null;
}

function canUseInteractivePrompt() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY && !process.env.CI);
}

async function resolveSelectedRoutes(command: string): Promise<string[] | null> {
  const selectedRoutesFromEnv = getSelectedRoutesFromEnv();
  if (command !== "build" || selectedRoutesFromEnv) {
    return selectedRoutesFromEnv;
  }

  if (!canUseInteractivePrompt()) {
    console.log("Interactive route selection is unavailable, using default routes");
    return ROUTES;
  }

  try {
    return await checkbox({
      message: "Select routes to compile:",
      choices: [
        { name: "All Routes", value: "*", checked: true },
        { name: "Dashboard", value: "dashboard" },
        { name: "Main (fe24)", value: "main" },
        { name: "Robot Grid", value: "main/grid" },
        { name: "Map", value: "map" },
        { name: "Order", value: "order" },
        { name: "Order Detail", value: "order/detail" },
      ],
      required: true,
    });
  } catch {
    console.log("Using default routes");
    return ROUTES;
  }
}

// https://vite.dev/config/
export default defineConfig(async ({ command }) => {
  console.log("command", command);
  const selectedRoutes = await resolveSelectedRoutes(command);

  // Create a record for fast lookup
  const isAllRoutes = command === "serve" || selectedRoutes?.includes("*");
  const routesToCompile = isAllRoutes ? ROUTES : selectedRoutes || [];

  const activeRoutes = routesToCompile.reduce<Record<string, boolean>>((acc, route) => {
    acc[`ROUTE_${route.toUpperCase().replace(/\//g, "_")}`] = true;
    return acc;
  }, {});

  return {
    plugins: [
      ViteConditionalBundlePlugin({
        includes: ["**/*.ts", "**/*.tsx", "**/*.vue"],
        vars: {
          MY_ENV: process.env.MY_ENV || "prod",
          app: process.env.app || "1",
          ...activeRoutes,
        },
      }),
      viteServer(),
      vue(),
      vueJsx(),
      vueDevTools(),
      tailwindcss(),
      // ./plugins/assets/robot-list.json
      // ./plugins/assets/order-list.json
      createJsonFiles(),
      visualizer({ open: true }),
      // @lark.js/sentry
      sentryPlugin({ dsn: "/sentry" }),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: "modern", // 清除 legacy-js-api 警告
        },
      },
    },
    // server: {
    //   proxy: {
    //     '/api/v1': {
    //       target: 'http://localhost:3000',
    //       changeOrigin: true,
    //       // rewrite: (path) => path.replace(/^\/api\/v1/, '/api'),
    //     },
    //   },
    // },
    build: {
      // 代码块 (chunk) 大小 >2000 KiB 时警告
      chunkSizeWarningLimit: 2000,
      cssCodeSplit: true, // 开启 CSS 拆分
      sourcemap: false, // 不生成源代码映射文件 sourcemap
      minify: "esbuild", // 最小化混淆, esbuild 打包速度最快, terser 打包体积最小
      cssMinify: "esbuild", // CSS 最小化混淆
      assetsInlineLimit: 5000, // 静态资源大小 <5000 Bytes 时, 将打包为 base64
    },
  } as UserConfig;
});
