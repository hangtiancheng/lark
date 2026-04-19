import type { LoaderContext } from "webpack";
import {
  createFilter,
  transformConditionalSource,
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

  const result = transformConditionalSource(source, vars);
  if (result) {
    this.callback(null, result.code, result.map);
    return;
  }

  return source;
}
