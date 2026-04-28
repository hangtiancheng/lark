import fs from "fs/promises";
import path from "path";
import type { Loader, OnLoadArgs, Plugin, PluginBuild } from "esbuild";
import {
  createFilter,
  transformConditionalSource,
  type ConditionalBundleOptions,
} from "../core/index.js";

const EXTENSION_TO_LOADER: Record<string, Loader> = {
  ".cjs": "js",
  ".cts": "ts",
  ".css": "css",
  ".js": "js",
  ".json": "json",
  ".jsx": "jsx",
  ".mjs": "js",
  ".mts": "ts",
  ".ts": "ts",
  ".tsx": "tsx",
  ".txt": "text",
};

function inferLoader(filePath: string): Loader | undefined {
  return EXTENSION_TO_LOADER[path.extname(filePath).toLowerCase()];
}

export default function EsbuildConditionalBundlePlugin(
  options: ConditionalBundleOptions = {},
): Plugin {
  const { includes, excludes, vars = {} } = options;
  const filter = createFilter(includes, excludes);

  return {
    name: "esbuild-plugin-conditional-compile",
    setup(build: PluginBuild) {
      build.onLoad({ filter: /.*/ }, async (args: OnLoadArgs) => {
        if (args.namespace !== "file" || !filter(args.path)) {
          return null;
        }

        const source = await fs.readFile(args.path, "utf8");
        const result = transformConditionalSource(source, vars);

        if (!result) {
          return null;
        }

        return {
          contents: result.code,
          loader: inferLoader(args.path),
          resolveDir: path.dirname(args.path),
        };
      });
    },
  };
}
