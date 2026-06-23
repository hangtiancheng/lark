/**
 * Vite configuration for @lark.js/docs.
 *
 * Dual-mode config:
 *   --mode lib   → Library build (6 entries, ESM+CJS+dts)
 *   --mode docs  → Documentation site (generates routes.ts, Vite dev/build)
 *
 * Vite 7 uses Rollup internally, so build.lib is Rollup-based.
 */
import {
  defineConfig,
  type LibraryFormats,
  type PluginOption,
  type UserConfig,
  type Rollup,
} from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "node:path";
import { larkMvcPlugin7 } from "@lark.js/mvc/vite";
import tailwindcss from "@tailwindcss/vite";
import { larkDocsPlugin } from "./src/vite";
import { defineConfig as defineDocsConfig } from "./src/define-config";
import { existsSync, copyFileSync } from "node:fs";

// === Shared constants ===

const PKG_DIR = import.meta.dirname;

/** All deps + peerDeps are externalized in lib mode (users install them). */
const EXTERNAL_PKGS = [
  "js-yaml",
  "lucide-static",
  "markdown-it",
  "markdown-it-container",
  "shiki",
  "@lark.js/mvc",
  "@tailwindcss/typography",
  "daisyui",
  "tailwindcss",
  "node:fs",
  "node:path",
  "node:process",
  "node:url",
];

/**
 * __filename / __dirname ESM shims.
 * webpack.ts and rspack.ts use __filename to self-reference as loaders.
 * Injected via Rollup output.banner for ESM chunks only.
 */
const CJS_SHIMS = [
  'import { fileURLToPath as __cjs_fileURLToPath } from "url";',
  'import { dirname as __cjs_dirname } from "path";',
  "const __filename = __cjs_fileURLToPath(import.meta.url);",
  "const __dirname = __cjs_dirname(__filename);",
].join("\n");

/** Documentation site configuration used in docs mode. */
const docsConfig = defineDocsConfig({
  docs: "docs",
  baseUrl: "/docs/",
  routeMode: "history",
  title: "@lark.js/docs",
  description: "Documentation site generator for @lark.js/mvc",
  lang: "en-US",
  nav: [
    { text: "Get Started", link: "/docs/get-started/" },
    { text: "Markdown", link: "/docs/markdown/" },
    { text: "Search", link: "/docs/search/" },
  ],
  sidebar: {
    "/docs/get-started/": "auto",
    "/docs/markdown/": "auto",
    "/docs/theme/": "auto",
    "/docs/style/": "auto",
    "/docs/router/": "auto",
    "/docs/search/": "auto",
    "/docs/api/": "auto",
  },
  highlight: {
    theme: "github-light",
    languages: [
      "javascript",
      "typescript",
      "html",
      "css",
      "bash",
      "json",
      "yaml",
      "markdown",
    ],
  },
  search: { provider: "docsearch" },
});

// === Mode router ===

export default defineConfig(({ mode }) => {
  if (mode === "lib") {
    return libConfig();
  }
  return docsUserConfig();
});

// === Library build ===

/**
 * Rollup plugin: copies static assets (ejs, client.d.ts, client.css)
 * from src/ to dist/ after each build, and registers them as watch
 * dependencies so changes trigger a rebuild in --watch mode.
 */
function copyAssetsPlugin(): Rollup.Plugin {
  const ASSETS = ["file-content.ejs", "client.d.ts", "client.css"];

  return {
    name: "copy-static-assets",
    buildStart() {
      for (const file of ASSETS) {
        this.addWatchFile(resolve(PKG_DIR, "src", file));
      }
    },
    writeBundle() {
      const srcDir = resolve(PKG_DIR, "src");
      const distDir = resolve(PKG_DIR, "dist");
      for (const file of ASSETS) {
        const src = resolve(srcDir, file);
        const dest = resolve(distDir, file);
        if (existsSync(src)) {
          copyFileSync(src, dest);
        }
      }
    },
  };
}

function libConfig(): UserConfig {
  return {
    build: {
      lib: {
        entry: {
          index: resolve(PKG_DIR, "src/index.ts"),
          compiler: resolve(PKG_DIR, "src/compiler.ts"),
          vite: resolve(PKG_DIR, "src/vite.ts"),
          webpack: resolve(PKG_DIR, "src/webpack.ts"),
          rspack: resolve(PKG_DIR, "src/rspack.ts"),
          runtime: resolve(PKG_DIR, "src/runtime.ts"),
          theme: resolve(PKG_DIR, "src/theme/index.ts"),
        },
        formats: ["es", "cjs"] satisfies LibraryFormats[],
        fileName: (format: string, entryName: string) =>
          format === "es" ? `${entryName}.js` : `${entryName}.cjs`,
      },
      rollupOptions: {
        external: (id: string) =>
          EXTERNAL_PKGS.some((e) => id === e || id.startsWith(e + "/")),
      },
      outDir: "dist",
      emptyOutDir: true,
      minify: false,
      sourcemap: false,
    },
    plugins: [
      // Compile .html template imports in theme/ into JS functions so
      // they are bundled into theme.js — consumers never import .html.
      larkMvcPlugin7({ useSwc: true }) as PluginOption,
      {
        name: "cjs-shims",
        renderChunk(code, _chunk, outputOptions) {
          if (outputOptions.format !== "es") return null;
          // Only inject __filename/__dirname shims when the chunk actually
          // references them (webpack.ts and rspack.ts use __filename as a
          // loader self-reference). Browser-targeted chunks (theme, runtime,
          // index) must not import Node.js built-in modules (url, path).
          if (!/\b__(?:filename|dirname)\b/.test(code)) return null;
          return CJS_SHIMS + "\n" + code;
        },
      },
      dts({
        tsconfigPath: "./tsconfig.build.json",
        outDirs: "dist",
      }),
      copyAssetsPlugin() as PluginOption,
    ],
  };
}

// === Documentation site build ===

function docsUserConfig(): UserConfig {
  return {
    root: resolve(PKG_DIR, "docs/app"),
    plugins: [
      larkDocsPlugin({ config: docsConfig }),
      larkMvcPlugin7({
        debug: true,
        useSwc: true,
      }),
      tailwindcss() as PluginOption,
    ],
    resolve: {
      alias: {
        "@lark.js/docs": resolve(PKG_DIR, "src"),
        "@lark-docs/generated": resolve(PKG_DIR, ".lark-docs/generated"),
      },
    },
    build: {
      outDir: resolve(PKG_DIR, "dist-docs"),
      emptyOutDir: true,
    },
    server: {
      port: 3200,
      open: true,
    },
  };
}
