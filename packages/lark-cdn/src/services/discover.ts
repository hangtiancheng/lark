import fs from "node:fs/promises";
import path from "node:path";
import type { DiscoveredDist } from "../types/index.js";

const DIST_DIR_NAMES = [
  "dist",
  "dist-ssr",
  "dist-rsbuild",
  "dist-rollup",
  "dist-rspack",
  "dist-tsup",
  "dist-webpack",
  "dist-vite",
] as const;

const SKIP_DIRS = new Set([
  ...DIST_DIR_NAMES,
  ".cache",
  ".git",
  ".pnpm-store",
  ".vite",
  ".vscode",
  "bin",
  "build",
  "coverage",
  "node_modules",
  "out",
  "output",
  "temp",
  "tmp",
]);

const DEFAULT_VERSION = "0.0.0";
const MAX_SCAN_DEPTH = 3;

async function readDistVersion(distPath: string): Promise<string> {
  const pkgPath = path.resolve(distPath, "../package.json");
  try {
    const raw = await fs.readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    if (typeof pkg["version"] === "string" && pkg["version"].length > 0) {
      return pkg["version"];
    }
  } catch {
    // package.json missing, unreadable, or invalid JSON
  }
  return DEFAULT_VERSION;
}

export async function discoverDists(workspaceRoot: string): Promise<DiscoveredDist[]> {
  const results: DiscoveredDist[] = [];
  await scanDir(workspaceRoot, 0, results);
  return results;
}

async function scanDir(dir: string, depth: number, results: DiscoveredDist[]): Promise<void> {
  if (depth > MAX_SCAN_DEPTH) return;

  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;

    const entryPath = path.resolve(dir, entry);

    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(entryPath);
    } catch {
      continue;
    }

    if (!stat.isDirectory()) continue;

    let found = false;
    for (const distName of DIST_DIR_NAMES) {
      const distPath = path.resolve(entryPath, distName);
      try {
        const distStat = await fs.stat(distPath);
        if (distStat.isDirectory()) {
          results.push({
            name: `${entry}${distName === "dist" ? "" : `:${distName}`}`,
            distPath,
            type: distName,
            version: await readDistVersion(distPath),
          });
          found = true;
        }
      } catch {
        // dist directory doesn't exist
      }
    }

    if (!found) {
      await scanDir(entryPath, depth + 1, results);
    }
  }
}
