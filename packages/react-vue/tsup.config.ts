import { defineConfig } from "tsup";

const external = [
  "@vue/reactivity",
  "@vue/shared",
  "@vue/runtime-core",
  "react",
];

const runtimeBanner = {
  js: [
    "const __DEV__ = process.env.NODE_ENV === 'development';",
    "const __BROWSER__ = typeof window !== 'undefined';",
  ].join("\n"),
};

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
    },
    format: ["cjs"],
    outDir: "dist",
    dts: false,
    clean: true,
    external,
    banner: runtimeBanner,
    outExtension: () => ({ js: ".js" }),
  },
  {
    entry: {
      index: "src/index.ts",
    },
    format: ["esm"],
    outDir: "dist",
    dts: true,
    clean: false,
    external,
    banner: runtimeBanner,
    outExtension: () => ({ js: ".mjs" }),
  },
  {
    entry: {
      "index.module": "src/index.ts",
    },
    format: ["esm"],
    outDir: "dist",
    clean: false,
    external,
    define: {
      __DEV__: "false",
      __BROWSER__: "true",
    },
  },
  {
    entry: {
      "index.module.dev": "src/index.ts",
    },
    format: ["esm"],
    outDir: "dist",
    clean: false,
    external,
    banner: runtimeBanner,
  },
]);
