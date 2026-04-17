import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

export default {
  input: {
    "core/index": "src/core/index.ts",
    "vite/index": "src/vite/index.ts",
    "webpack/index": "src/webpack/index.ts",
    "webpack/loader": "src/webpack/loader.ts",
  },
  output: [
    {
      dir: "dist",
      format: "cjs",
      entryFileNames: "[name].cjs",
      sourcemap: true,
      exports: "auto",
    },
    {
      dir: "dist",
      format: "es",
      entryFileNames: "[name].js",
      sourcemap: true,
    },
  ],
  external: [
    "magic-string",
    "picomatch",
    "vite",
    "webpack",
    "path",
    "url",
    "fs",
  ],
  plugins: [
    resolve(),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: true,
      declarationDir: "dist",
      rootDir: "src",
    }),
  ],
};
