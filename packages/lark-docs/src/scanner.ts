/**
 * Recursive docs directory scanner.
 *
 * Walks the filesystem to discover .md files, extracts frontmatter
 * and headings from each, and produces DocsRoute entries.
 *
 * Routing rules:
 * - Files/dirs starting with `_` or `.` are skipped
 * - `index.md` maps to the directory root (e.g. `/guide/`)
 * - Other `.md` files map to their stem (e.g. `/guide/config`)
 * - Every route gets a trailing/non-trailing slash alias so both
 *   `/guide/config` and `/guide/config/` resolve to the same page.
 * - Directories without `index.md` get a virtual index route that
 *   points to the first page (by sidebar_position or filename order).
 * - Files with `draft: true` in frontmatter are excluded when `excludeDrafts` is set
 */
import fs from "node:fs";
import path from "node:path";
import type { DocsRoute, PageData } from "./types";
import { extractFrontmatter } from "./markdown/frontmatter";
import { deriveTitleFromPath } from "./utils/derive-title";
import {
  extractFirstHeading,
  extractHeadings,
} from "./utils/heading-extraction";
import { getFirstRoute } from "./utils/route-sorting";

const IGNORED_PREFIXES = ["_", "."];
const IGNORED_DIRS = new Set([
  "node_modules",
  "__tests__",
  "__fixtures__",
  ".git",
  ".vitepress",
  ".lark-docs",
  "dist",
]);

interface DirInfo {
  hasIndex: boolean;
  children: DocsRoute[];
}

/**
 * Recursively scan a docs directory and return route entries.
 */
export function scanDocsDir(
  docsDir: string,
  baseUrl: string,
  options?: { excludeDrafts?: boolean },
): DocsRoute[] {
  const routes: DocsRoute[] = [];
  const normalizedBase = normalizeBase(baseUrl);

  // Track directory info for virtual index route generation.
  // Key: directory prefix (e.g. "", "/guide", "/markdown").
  const dirInfoMap = new Map<string, DirInfo>();

  function getOrCreateDirInfo(prefix: string): DirInfo {
    if (!dirInfoMap.has(prefix)) {
      dirInfoMap.set(prefix, { hasIndex: false, children: [] });
    }
    return dirInfoMap.get(prefix)!;
  }

  function walk(dir: string, prefix: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // directory doesn't exist or not readable
    }

    for (const entry of entries) {
      if (IGNORED_PREFIXES.some((p) => entry.name.startsWith(p))) continue;
      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath, `${prefix}/${entry.name}`);
        continue;
      }

      if (!entry.name.endsWith(".md")) continue;

      const stem = entry.name.replace(/\.md$/, "");
      const isIndex = stem === "index";
      const routePath = isIndex ? `${prefix}/` : `${prefix}/${stem}`;
      const fullRoutePath = normalizedBase + routePath.replace(/^\//, "");
      const viewId = generateViewId(routePath);

      // Read and parse
      const raw = fs.readFileSync(fullPath, "utf-8");
      const { data: frontmatter, content } = extractFrontmatter(raw);

      if (options?.excludeDrafts && frontmatter["draft"]) continue;

      const relativePath = path.relative(docsDir, fullPath);
      const derivedTitle = deriveTitleFromPath(relativePath);

      const pageData: PageData = {
        title:
          (frontmatter["title"] as string) ||
          extractFirstHeading(content) ||
          derivedTitle,
        description: (frontmatter["description"] as string) || derivedTitle,
        sidebarPosition: frontmatter["sidebar_position"] as number | undefined,
        sidebarLabel: frontmatter["sidebar_label"] as string | undefined,
        sidebarGroup: frontmatter["sidebar_group"] as string | undefined,
        draft: frontmatter["draft"] as boolean | undefined,
        headings: extractHeadings(content),
        relativePath,
        lastUpdated: fs.statSync(fullPath).mtimeMs,
      };

      const route: DocsRoute = {
        path: fullRoutePath,
        viewId,
        filePath: fullPath,
        pageData,
      };

      routes.push(route);

      // Track directory membership for virtual index generation
      const info = getOrCreateDirInfo(prefix);
      if (isIndex) {
        info.hasIndex = true;
      } else {
        info.children.push(route);
      }
    }
  }

  walk(docsDir, "");

  // Generate virtual index routes for directories without index.md.
  // These routes point to the first page (by sidebar_position or filename)
  // so that /docs/markdown/ serves content even without markdown/index.md.
  for (const [prefix, info] of dirInfoMap) {
    if (info.hasIndex) continue;
    if (info.children.length === 0) continue;

    const firstRoute = getFirstRoute(info.children);
    if (!firstRoute) continue;

    const routePath = `${prefix}/`;
    const fullRoutePath = normalizedBase + routePath.replace(/^\//, "");

    const virtualRoute: DocsRoute = {
      path: fullRoutePath,
      viewId: generateViewId(routePath),
      filePath: firstRoute.filePath,
      pageData: firstRoute.pageData,
      isDirectoryIndex: true,
    };

    routes.push(virtualRoute);
  }

  // Generate trailing/non-trailing slash aliases for all routes.
  for (const route of routes) {
    route.aliases = generateAliases(route.path);
  }

  return routes;
}

function normalizeBase(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed ? trimmed + "/" : "/";
}

/**
 * Generate the trailing/non-trailing slash alias for a route path.
 *
 * - "/docs/guide/config" → ["/docs/guide/config/"]
 * - "/docs/guide/"       → ["/docs/guide"]
 * - "/docs/"             → ["/docs"]
 * - "/"                  → []  (empty alias skipped)
 */
function generateAliases(routePath: string): string[] {
  const aliases: string[] = [];

  if (routePath.endsWith("/")) {
    const alias = routePath.replace(/\/+$/, "");
    if (alias && alias !== routePath) {
      aliases.push(alias);
    }
  } else {
    aliases.push(routePath + "/");
  }

  return aliases;
}

function generateViewId(routePath: string): string {
  return (
    routePath
      .replace(/^\//, "")
      .replace(/\/$/, "-index")
      .replace(/\//g, "-")
      .replace(/[^a-zA-Z0-9-]/g, "") || "index"
  );
}
