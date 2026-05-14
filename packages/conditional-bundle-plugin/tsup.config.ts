import { defineConfig } from "tsup";

const external = [
  "magic-string",
  "picomatch",
  "@rsbuild/core",
  "esbuild",
  "rollup",
  "vite",
  "webpack",
  "path",
  "url",
  "fs",
];

export default defineConfig({
  entry: {
    "core/index": "src/core/index.ts",
    "esbuild/index": "src/esbuild/index.ts",
    "rollup/index": "src/rollup/index.ts",
    "rsbuild/index": "src/rsbuild/index.ts",
    "vite/index": "src/vite/index.ts",
    "webpack/index": "src/webpack/index.ts",
    "webpack/loader": "src/webpack/loader.ts",
  },
  format: ["cjs", "esm"],
  outDir: "dist",
  sourcemap: true,
  dts: true,
  clean: true,
  splitting: false,
  shims: true,
  external,
});
