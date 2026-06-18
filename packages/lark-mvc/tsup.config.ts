import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    clean: true,
    dts: {
      resolve: true,
    },
    format: ["esm", "cjs"],
    minify: false,
    noExternal: [],
    sourcemap: false,
    tsconfig: "./tsconfig.build.json",
  },
  {
    entry: [
      "src/compiler.ts",
      "src/webpack.ts",
      "src/rspack.ts",
      "src/vite.ts",
    ],
    dts: true,
    format: ["esm", "cjs"],
    minify: false,
    noExternal: ["@babel/parser", "@babel/types", "@swc/core"],
    sourcemap: false,
    tsconfig: "./tsconfig.build.json",
  },
  {
    // Template runtime — imported by compiled `.html` modules. Kept tiny so
    // pulling in `@lark.js/mvc/runtime` doesn't drag the whole framework in.
    entry: ["src/runtime.ts", "src/devtool.ts"],
    dts: true,
    format: ["esm", "cjs"],
    minify: false,
    noExternal: [],
    sourcemap: false,
    tsconfig: "./tsconfig.build.json",
  },
]);
