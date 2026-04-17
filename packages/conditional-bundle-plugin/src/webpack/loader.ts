import type { LoaderContext } from "webpack";
import {
  createFilter,
  transformConditional,
  type ConditionalBundleOptions,
} from "../core/index.js";

export default function loader(
  this: LoaderContext<ConditionalBundleOptions>,
  source: string,
) {
  const options = this.getOptions();
  const { includes, excludes, vars = {} } = options;
  const filter = createFilter(includes, excludes);

  // webpack loader 'this.resourcePath' gives the absolute file path
  if (!filter(this.resourcePath)) {
    return source;
  }

  // Quick check to avoid parsing files that definitely don't have directives
  if (!source.includes("#if")) {
    return source;
  }

  const result = transformConditional(source, vars);
  if (result) {
    this.callback(null, result.code, result.map);
    return;
  }

  return source;
}
