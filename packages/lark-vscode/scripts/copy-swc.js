import { cpSync, realpathSync, readdirSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const dest = "dist/node_modules/@swc";
const swcCorePath = realpathSync("node_modules/@swc/core");
const swcRoot = dirname(swcCorePath);

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

for (const entry of readdirSync(swcRoot)) {
  const src = join(swcRoot, entry);
  if (existsSync(src)) {
    cpSync(src, join(dest, entry), { recursive: true, dereference: true });
    console.log(`Copied @swc/${entry}`);
  }
}
