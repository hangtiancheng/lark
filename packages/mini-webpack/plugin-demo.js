// @ts-check
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dist = join(__dirname, "./dist");

export class SetOutputPathPlugin {
  apply(hooks) {
    // subscribe
    hooks.setOutputPathHook.tap("setOutputPath", (context) => {
      context.setOutputPath(join(dist, "./bundle.js"));
    });
  }
}
