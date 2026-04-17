import type { Plugin } from "vite";
import {
  createFilter,
  transformConditional,
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
      // Quick check to avoid parsing files that definitely don't have directives
      if (!code.includes("#if")) return null;

      const result = transformConditional(code, vars);
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
