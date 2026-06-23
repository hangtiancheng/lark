/**
 * Search index builder.
 *
 * Builds a JSON-serializable search index from all docs routes.
 * The index is embedded into a virtual module and loaded lazily
 * at runtime when the user opens the search dialog.
 */
import type { DocsRoute, SearchEntry } from "./types";

/**
 * Build search entries from all scanned routes.
 *
 * Each entry contains the page title, link, heading texts,
 * and a plain-text excerpt (first ~200 chars of content).
 */
export function buildSearchIndex(routes: DocsRoute[]): SearchEntry[] {
  return routes
    .filter((r) => !r.pageData.draft && !r.isDirectoryIndex)
    .map((route) => ({
      title: route.pageData.title,
      link: route.path,
      headings: route.pageData.headings.map((h) => h.text),
      excerpt: route.pageData.description || "",
    }));
}

/**
 * Serialize the search index as a JS module source string.
 * Emitted as a virtual module by the build plugins.
 */
export function emitSearchIndexModule(index: SearchEntry[]): string {
  return `export default ${JSON.stringify(index, null, 2)};`;
}
