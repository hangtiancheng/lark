/**
 * Post-build script: copies .d.ts → .d.cts for CJS consumers,
 * and copies static assets (file-content.ejs, shims.d.ts)
 * into dist/ so they are available to consumers at runtime.
 *
 * Vite 7's build.lib does not natively emit .d.cts files,
 * but our package.json exports map requires both .d.ts and .d.cts
 * for dual-format (ESM + CJS) type support.
 *
 * Recursively walks dist/ to handle subdirectories (e.g. dist/theme/).
 */
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const pkgRoot = resolve(import.meta.dirname, "..");
const distDir = resolve(pkgRoot, "dist");
const srcDir = resolve(pkgRoot, "src");

// --- copy static assets from src/ to dist/ ---

const STATIC_ASSETS = ["file-content.ejs", "client.d.ts", "client.css"];

for (const file of STATIC_ASSETS) {
  const src = resolve(srcDir, file);
  const dest = resolve(distDir, file);
  if (existsSync(src)) {
    copyFileSync(src, dest);
    console.log(`  ${file} → dist/${file}`);
  }
}

console.log("\nStatic assets copied to dist/");
