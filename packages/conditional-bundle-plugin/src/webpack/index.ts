import path from "path";
import type { Compiler } from "webpack";
import { createFilter, type ConditionalBundleOptions } from "../core/index.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class WebpackConditionalBundlePlugin {
  private options: ConditionalBundleOptions;

  constructor(options: ConditionalBundleOptions = {}) {
    this.options = options;
  }

  apply(compiler: Compiler) {
    if (!compiler.options.module) {
      // @ts-ignore
      compiler.options.module = { rules: [] };
    }
    if (!compiler.options.module.rules) {
      compiler.options.module.rules = [];
    }

    const filter = createFilter(this.options.includes, this.options.excludes);

    compiler.options.module.rules.unshift({
      enforce: "pre",
      resource: (resourcePath: string) => filter(resourcePath),
      use: [
        {
          loader: path.resolve(__dirname, "./loader.js"),
          options: this.options,
        },
      ],
    });
  }
}
