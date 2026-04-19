import {
  createFilter,
  transformConditionalSource,
  type ConditionalBundleOptions,
} from "../core/index.js";

interface RsbuildTransformResult {
  code: string;
  map?: unknown;
}

interface RsbuildTransformDescriptor {
  test?: RegExp;
  enforce?: "pre" | "post";
}

interface RsbuildTransformContext {
  code: string;
  resourcePath: string;
}

interface RsbuildPluginAPI {
  transform(
    descriptor: RsbuildTransformDescriptor,
    handler: (
      context: RsbuildTransformContext,
    ) => string | RsbuildTransformResult,
  ): void;
}

interface RsbuildPlugin {
  name: string;
  enforce?: "pre" | "post";
  setup(api: RsbuildPluginAPI): void;
}

export default function RsbuildConditionalBundlePlugin(
  options: ConditionalBundleOptions = {},
): RsbuildPlugin {
  const { includes, excludes, vars = {} } = options;
  const filter = createFilter(includes, excludes);

  return {
    name: "rsbuild-plugin-conditional-compile",
    enforce: "pre",
    setup(api) {
      api.transform(
        {
          enforce: "pre",
          test: /.*/,
        },
        ({ code, resourcePath }) => {
          if (!filter(resourcePath)) {
            return code;
          }

          const result = transformConditionalSource(code, vars);
          if (!result) {
            return code;
          }

          return {
            code: result.code,
            map: result.map,
          };
        },
      );
    },
  };
}
