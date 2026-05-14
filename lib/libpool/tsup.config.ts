import { defineConfig } from "tsup";

const noExternal = ["ffi-napi", "ref-array-napi", "ref-napi", "uuid"];

const shared = {
  format: ["esm", "cjs"],
  outDir: "lib",
  sourcemap: true,
  dts: false,
  splitting: false,
  noExternal,
};

export default defineConfig([
  {
    ...shared,
    entry: {
      index: "src/index.ts",
    },
    clean: true,
  },
  {
    ...shared,
    entry: {
      "index.min": "src/index.ts",
    },
    clean: false,
    minify: true,
  },
]);
