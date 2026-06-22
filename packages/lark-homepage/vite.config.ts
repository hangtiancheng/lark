/**
 * Vite configuration for lark-homepage documentation site.
 *
 * Generates routes from docs/ directory at startup, then serves
 * the site via Vite dev server or builds it for production.
 */
import {
  defineConfig,
  type Plugin,
  type PluginOption,
  type UserConfig,
} from "vite";
import { resolve } from "node:path";
import { larkDocsPlugin } from "@lark.js/docs/vite";
import { larkMvcPlugin7 } from "@lark.js/mvc/vite";
import tailwindcss from "@tailwindcss/vite";
import docsConfig from "./lark-docs.config";

// === Mode router ===

export default defineConfig(({ mode }) => {
  return docsSiteConfig();
});

// === Documentation site build ===

function docsSiteConfig(): UserConfig {
  return {
    root: resolve(import.meta.dirname, "docs/app"),
    plugins: [
      larkDocsPlugin({ config: docsConfig }) as Plugin,
      larkMvcPlugin7({
        debug: true,
        useSwc: true,
      }) as Plugin,
      tailwindcss() as PluginOption,
    ],
    // build: {
    //   outDir: resolve(import.meta.dirname, "dist"),
    //   emptyOutDir: true,
    // },
    server: {
      port: 3300,
      open: true,
    },
  };
}
