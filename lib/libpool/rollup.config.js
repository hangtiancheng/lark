// @ts-check

import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";

export default {
  input: "src/index.ts",
  output: [
    {
      file: "lib/index.js",
      format: "es",
      sourcemap: true,
    },
    {
      file: "lib/index.min.js",
      format: "es",
      sourcemap: true,
      plugins: [terser()],
    },
    {
      file: "lib/index.cjs",
      format: "cjs",
      sourcemap: true,
    },
    {
      file: "lib/index.min.cjs",
      format: "cjs",
      sourcemap: true,
      plugins: [terser()],
    },
  ],
  plugins: [
    resolve(),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: false,
      declarationMap: false,
      outDir: "./lib",
      rootDir: "./src",
      exclude: ["node_modules", "tests/**/*"],
    }),
  ],
  external: [],
};
