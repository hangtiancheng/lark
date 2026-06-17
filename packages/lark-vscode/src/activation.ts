import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { log } from "./logger.js";

const BUNDLER_CONFIG_FILES = [
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mts",
  "vite.config.mjs",
  "webpack.config.ts",
  "webpack.config.js",
  "webpack.config.mjs",
] as const;
const BUNDLER_KEYWORDS = ["larkMvcPlugin", "larkMvcLoader"] as const;

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  ".git",
  ".next",
  ".nuxt",
  ".vite",
  ".cache",
  ".turbo",
  ".nx",
  ".pnpm-store",
  ".yarn",
]);

export function findLarkRoots(workspaceRoot: string): readonly string[] {
  const packageJsonPaths = findAllPackageJsons(workspaceRoot);
  log(`Found ${String(packageJsonPaths.length)} package.json file(s)`);

  const larkRoots: string[] = [];
  for (const pkgPath of packageJsonPaths) {
    const dir = path.dirname(pkgPath);
    if (isLarkProject(dir)) {
      log(`Lark project found: ${dir}`);
      larkRoots.push(dir);
    }
  }

  return larkRoots;
}

function findAllPackageJsons(workspaceRoot: string): readonly string[] {
  try {
    const output = execSync(
      'git ls-files --cached --others --exclude-standard -- "package.json" "**/package.json"',
      { cwd: workspaceRoot, encoding: "utf-8", timeout: 5000 },
    ).trim();

    if (output.length === 0) {
      return [];
    }

    return output.split("\n").map((rel) => path.join(workspaceRoot, rel));
  } catch {
    log("git ls-files failed, falling back to manual scan");
    return scanForPackageJsons(workspaceRoot);
  }
}

function scanForPackageJsons(dir: string): readonly string[] {
  const results: string[] = [];
  scanDirectory(dir, results, 0);
  return results;
}

function scanDirectory(dir: string, out: string[], depth: number): void {
  if (depth > 5) {
    return;
  }

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name === "package.json") {
        out.push(path.join(dir, entry.name));
      } else if (
        entry.isDirectory() &&
        !SKIP_DIRS.has(entry.name) &&
        !entry.name.startsWith(".")
      ) {
        scanDirectory(path.join(dir, entry.name), out, depth + 1);
      }
    }
  } catch {
    // unreadable directory
  }
}

function isLarkProject(dir: string): boolean {
  const packageJsonPath = path.join(dir, "package.json");

  if (fs.existsSync(packageJsonPath)) {
    try {
      const content = fs.readFileSync(packageJsonPath, "utf-8");
      const pkg: unknown = JSON.parse(content);
      if (hasLarkDependency(pkg)) {
        return true;
      }
    } catch {
      // invalid package.json, fall through
    }
  }

  return hasBundlerConfig(dir);
}

function hasLarkDependency(pkg: unknown): boolean {
  if (typeof pkg !== "object" || pkg === null) {
    return false;
  }

  const record = pkg as Record<string, unknown>;
  const deps = record["dependencies"];
  const devDeps = record["devDependencies"];

  if (
    isRecordWithKey(deps, "@lark.js/mvc") ||
    isRecordWithKey(devDeps, "@lark.js/mvc")
  ) {
    return true;
  }

  return false;
}

function isRecordWithKey(
  value: unknown,
  key: string,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && key in value;
}

function hasBundlerConfig(dir: string): boolean {
  for (const configFile of BUNDLER_CONFIG_FILES) {
    const configPath = path.join(dir, configFile);
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, "utf-8");
        for (const keyword of BUNDLER_KEYWORDS) {
          if (content.includes(keyword)) {
            return true;
          }
        }
      } catch {
        continue;
      }
    }
  }
  return false;
}

export function setLarkContext(isLark: boolean): void {
  void vscode.commands.executeCommand(
    "setContext",
    "vs-lark:isLark",
    isLark || undefined,
  );
}
