import type { Plugin } from "vite";
import {
  createFilter,
  transformConditionalSource,
  type ConditionalBundleOptions,
} from "../core/index.js";

export default function ViteConditionalBundlePlugin(
  options: ConditionalBundleOptions = {},
): Plugin {
  const { includes, excludes, vars = {} } = options;
  const filter = createFilter(includes, excludes);

  return {
    name: "vite-plugin-conditional-compile",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (!filter(id)) return null;

      const result = transformConditionalSource(code, vars);
      if (result) {
        return {
          code: result.code,
          map: result.map,
        };
      }
      return null;
    },
  };
}
