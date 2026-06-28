/**
 * Route map generator.
 *
 * Converts scanned DocsRoute[] into the format expected by
 * @lark.js/mvc's FrameworkConfig.routes.
 */
import type { DocsRoute } from "./types";
import { relative } from "node:path";

/**
 * Generate a routes map object for Framework.boot({ routes }).
 *
 * Each entry maps a URL path to a viewId:
 * ```
 * { "/docs/guide/": "docs-guide-index", "/docs/guide/config": "docs-guide-config" }
 * ```
 */
export function generateRouteMap(routes: DocsRoute[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const route of routes) {
    map[route.path] = route.viewId;
  }
  return map;
}

/**
 * Generate a JS module source string that imports all compiled docs views
 * and registers them with registerViewClass.
 *
 * This is emitted as a virtual module by the build plugins.
 */
export function generateBootModule(
  routes: DocsRoute[],
  projectRoot: string = process.cwd(),
): string {
  // Use relative import specifiers so the generated module is portable.
  // Absolute paths leak the developer's local directory and cannot be
  // resolved by bundlers on other machines.
  const imports = routes
    .map((r, i) => {
      const rel = relative(projectRoot, r.filePath).replace(/\\/g, "/");
      const specifier = rel.startsWith(".") ? rel : "./" + rel;
      return `import view${i} from ${JSON.stringify(specifier)};`;
    })
    .join("\n");

  const registrations = routes
    .map((r, i) => `registerViewClass(${JSON.stringify(r.viewId)}, view${i});`)
    .join("\n");

  return [
    'import { registerViewClass } from "@lark.js/mvc";',
    imports,
    "",
    registrations,
  ].join("\n");
}
