// @ts-check

import typescript from "rollup-plugin-typescript2";
import dts from "rollup-plugin-dts";
import resolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import { defineConfig } from "rollup";

const external = [
  "@vue/reactivity",
  "@vue/shared",
  "@vue/runtime-core",
  "react",
];

const __DEV__ = "(process.env.NODE_ENV === 'development')";
const __BROWSER__ = "(typeof window !== 'undefined')";

/** @type {import('rollup').WarningHandlerWithDefault} */
const onwarn = (warning, defaultHandler) => {
  if (
    !/Circular|preventAssignment/.test(warning.message || warning.code || "")
  ) {
    defaultHandler(warning);
  }
};

export default defineConfig([
  {
    input: "src/index.ts",
    output: [
      {
        file: "dist/index.js",
        format: "cjs",
      },
    ],
    plugins: [replace({ __DEV__, __BROWSER__ }), resolve(), typescript()],
    external,
    onwarn,
  },
  {
    input: "src/index.ts",
    output: [
      {
        file: "dist/index.mjs",
        format: "esm",
      },
    ],
    plugins: [replace({ __DEV__, __BROWSER__ }), resolve(), typescript()],
    external,
    onwarn,
  },
  {
    input: "src/index.ts",
    output: [
      {
        file: "dist/index.module.js",
        format: "es",
      },
    ],
    plugins: [
      replace({ __DEV__: false, __BROWSER__: true }),
      resolve(),
      typescript(),
    ],
    external,
    onwarn,
  },
  {
    input: "src/index.ts",
    output: [
      {
        file: "dist/index.module.dev.js",
        format: "es",
      },
    ],
    plugins: [replace({ __DEV__, __BROWSER__ }), resolve(), typescript()],
    external,
    onwarn,
  },
  {
    input: "src/index.ts",
    output: [
      {
        file: "dist/index.d.ts",
        format: "es",
      },
    ],
    plugins: [dts()],
    external,
  },
]);
