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
} from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "node:path";
import { larkMvcPlugin7 } from "@lark.js/mvc/vite";
import tailwindcss from "@tailwindcss/vite";
import { larkDocsPlugin } from "./src/vite";
import type { DocsConfig, SidebarConfig } from "./src/types";
import { scanDocsDir } from "./src/scanner";
import { generateRouteMap } from "./src/route-map";
import { generateSidebar } from "./src/sidebar-generator";
import { buildSearchIndex } from "./src/search-index";
import path from "node:path";
import fs from "node:fs";

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
const docsConfig: DocsConfig = {
  docs: "docs",
  baseUrl: "/docs/",
  routeMode: "history",
  title: "@lark.js/docs",
  description: "Documentation site generator for @lark.js/mvc",
  lang: "en-US",
  nav: [
    { text: "Get Started", link: "/docs/get-started/" },
    { text: "Markdown", link: "/docs/markdown/" },
    { text: "Router", link: "/docs/router/" },
    { text: "Styling", link: "/docs/style/" },
  ],
  sidebar: {
    "/docs/get-started/": "auto",
    "/docs/markdown/": "auto",
    "/docs/router/": "auto",
    "/docs/style/": "auto",
  },
  highlight: {
    theme: "github-dark",
    languages: [
      "typescript",
      "javascript",
      "html",
      "css",
      "json",
      "bash",
      "yaml",
      "markdown",
    ],
  },
  search: { provider: "docsearch" },
};

// === Mode router ===

export default defineConfig(({ mode }) => {
  if (mode === "lib") {
    return libConfig();
  }
  // Docs mode: generate routes.ts before returning config
  generateRoutesFile(docsConfig);
  return docsUserConfig();
});

// === Library build ===

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
      {
        name: "cjs-shims",
        renderChunk(code, _chunk, outputOptions) {
          if (outputOptions.format === "es") {
            return CJS_SHIMS + "\n" + code;
          }
          return null;
        },
      },
      dts({
        tsconfigPath: "./tsconfig.build.json",
        outDirs: "dist",
      }),
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

// === Routes file generator ===

/**
 * Generate a physical routes module into `node_modules/@lark.js/docs/generated/`.
 *
 * This file is regenerated each time `vite --mode docs` starts (dev or build).
 * It imports all .md files (compiled by larkDocsPlugin), registers each as a
 * View class, and exports the route map + site data for boot.ts to consume.
 *
 * Written to node_modules so it can be imported with a bare module name
 * (`@lark.js/docs/generated`), which TypeScript can resolve via ambient
 * `declare module` — relative module names are not valid in ambient
 * module declarations.
 */
function generateRoutesFile(config: DocsConfig): void {
  const docsDir = path.isAbsolute(config.docs)
    ? config.docs
    : resolve(PKG_DIR, config.docs);

  const routes = scanDocsDir(docsDir, config.baseUrl);
  const routeMap = generateRouteMap(routes);

  // Build sidebar
  const sidebar: Record<string, SidebarConfig> = {};
  if (config.sidebar) {
    for (const [prefix, sidebarConfig] of Object.entries(config.sidebar)) {
      if (sidebarConfig === "auto") {
        sidebar[prefix] = generateSidebar(routes, prefix, config.baseUrl);
      } else {
        sidebar[prefix] = sidebarConfig;
      }
    }
  }

  // Build search index
  const searchIndex =
    config.search?.provider === "none" ? [] : buildSearchIndex(routes);

  // Generate import statements for each .md file.
  // Use absolute paths to avoid resolution issues from node_modules location.
  const generatedDir = resolve(PKG_DIR, "node_modules/@lark.js/docs/generated");
  const imports = routes
    .map((r, i) => {
      // Use absolute path for reliable resolution
      return `// @ts-ignore
      import view${i} from ${JSON.stringify(r.filePath)};`;
    })
    .join("\n");

  // Generate registerViewClass calls
  const registrations = routes
    .map((r, i) => `registerViewClass(${JSON.stringify(r.viewId)}, view${i});`)
    .join("\n");

  // Compose docsConfig (includes build-time searchIndex, not the user-facing DocsConfig type)
  const docsConfig = {
    title: config.title,
    description: config.description || "",
    lang: config.lang || "en-US",
    nav: config.nav || [],
    sidebar,
    searchIndex,
  };

  const fileContent = `// Auto-generated by vite.config.ts — DO NOT EDIT!!!
// Generated at: ${new Date().toISOString()}

import { registerViewClass } from "@lark.js/mvc";

${imports}

${registrations}

export const routes: Record<string, string> = ${JSON.stringify(routeMap, null, 2)};

export const docsConfig = ${JSON.stringify(docsConfig, null, 2)};
`;

  // Write generated module to node_modules/@lark.js/docs/generated/
  fs.mkdirSync(generatedDir, { recursive: true });
  fs.writeFileSync(resolve(generatedDir, "index.ts"), fileContent, "utf-8");

  // Write package.json so Node/Vite can resolve the bare module name
  fs.writeFileSync(
    resolve(generatedDir, "package.json"),
    JSON.stringify(
      { name: "@lark.js/docs/generated", type: "module", main: "index.ts" },
      null,
      2,
    ),
    "utf-8",
  );
}
