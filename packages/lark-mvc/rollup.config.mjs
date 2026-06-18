// @ts-check

import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";
import { defineConfig } from "rollup";

const deps = Object.keys(
  (await import("./package.json", { with: { type: "json" } })).default
    .dependencies ?? {},
);
const peerDeps = Object.keys(
  (await import("./package.json", { with: { type: "json" } })).default
    .peerDependencies ?? {},
);

// Entries where @babel/parser and @babel/types are bundled (not external),
// matching tsup's `noExternal: ["@babel/parser", "@babel/types"]`.
const /** @type{({ name: string, external: boolean }[])} */ entries = [
  { name: "index", external: true },
  { name: "compiler", external: false },
  { name: "webpack", external: false },
  { name: "rspack", external: false },
  { name: "vite", external: false },
  { name: "runtime", external: true },
  { name: "devtool", external: true },
];

/** Externalize deps/peerDeps except @babel packages when the entry bundles them. */

/**
 *
 * @param {boolean} external
 * @returns
 */
const makeExternal = (external) => (/** @type {string} */ id) => {
  if (id.startsWith("node:") || id.startsWith(".")) return false;
  if (
    !external &&
    (id === "@babel/parser" ||
      id === "@babel/types" ||
      id === "@swc/core" ||
      id.startsWith("@babel/parser/") ||
      id.startsWith("@babel/types/")) ||
    id.startsWith("@swc/core")
  ) {
    return false;
  }
  const pkg = id.startsWith("@")
    ? id.split("/").slice(0, 2).join("/")
    : id.split("/")[0];
  return deps.includes(pkg) || peerDeps.includes(pkg);
};

const outputConfigs = [
  { file: "dist/[name].js", format: "es" },
  { file: "dist/[name].cjs", format: "cjs", exports: "named" },
];

// --- JS bundles (ESM + CJS, no sourcemap, matching tsup) ---
const /** @type {import("rollup").OutputOptions[]} */ jsConfigs = entries.map(
  ({ name, external }) => ({
    input: `src/${name}.ts`,
    output: outputConfigs.map((o) => ({
      ...o,
      file: o.file.replace("[name]", name),
    })),
    external: makeExternal(external),
    plugins: [
      resolve(),
      commonjs(),
      typescript({ tsconfig: "./tsconfig.build.json" }),
    ],
  }),
);

// --- Type declarations (.d.ts for ESM consumers) ---
const /** @type {import("rollup").RollupOptions[]} */ dtsConfigs = entries.map(
  ({ name }) => ({
    input: `src/${name}.ts`,
    output: {
      file: `dist/${name}.d.ts`,
      format: "es",
    },
    plugins: [dts({ tsconfig: "./tsconfig.build.json" })],
  }),
);

// --- Type declarations (.d.cts for CJS consumers) ---
const /** @type {import("rollup").RollupOptions[]} */ dtsCjsConfigs =
  entries.map(({ name }) => ({
    input: `src/${name}.ts`,
    output: {
      file: `dist/${name}.d.cts`,
      format: "es",
    },
    plugins: [dts({ tsconfig: "./tsconfig.build.json" })],
  }));

export default defineConfig([...jsConfigs, ...dtsConfigs, ...dtsCjsConfigs]);
