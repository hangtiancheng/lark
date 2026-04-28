import type { Plugin } from "rollup";
import {
  createFilter,
  transformConditionalSource,
  type ConditionalBundleOptions,
} from "../core/index.js";

export default function RollupConditionalBundlePlugin(
  options: ConditionalBundleOptions = {},
): Plugin {
  const { includes, excludes, vars = {} } = options;
  const filter = createFilter(includes, excludes);

  return {
    name: "rollup-plugin-conditional-compile",
    transform(code: string, id: string) {
      if (!filter(id)) {
        return null;
      }

      const result = transformConditionalSource(code, vars);
      if (!result) {
        return null;
      }

      return {
        code: result.code,
        map: result.map,
      };
    },
  };
}
