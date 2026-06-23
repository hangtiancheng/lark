---
name: lark-docs
description: >
  Comprehensive guide to @lark.js/docs (v0.0.3), the documentation site generator
  for @lark.js/mvc (analogous to VitePress for Vue or Docusaurus for React).
  Use this skill any time the user works with documentation site generation
  using Lark -- configuring defineConfig() in lark-docs.config.ts, setting up
  bundler plugins (larkDocsPlugin for Vite, LarkDocsPlugin for Webpack or
  Rspack), writing Markdown with frontmatter, customizing the theme system
  (registerThemeViews, createDocsLayoutView, createSidebarView, createTocView,
  createSearchView), configuring search providers (local, docsearch, none),
  setting up Shiki code highlighting, working with auto-generated sidebars,
  understanding the markdown compilation pipeline (compileMarkdown), or
  anything mentioning .lark-docs/generated, DocsConfig, DocsRoute, PageData,
  SearchEntry, NavItem, SidebarItem, HeadingInfo, admonition containers
  (::: tip/warning/danger/details), [[toc]] syntax, heading anchors,
  internal link interception, or the three-phase architecture (configuration,
  compilation, runtime). Also trigger on questions about integrating Algolia
  DocSearch UI with local search index, the createLocalSearchClient adapter,
  the @lark.js/docs/client types export, the registerThemeViews API, or
  migrating from VitePress/Docusaurus to @lark.js/docs.
---

# @lark.js/docs

`@lark.js/docs` (v0.0.3) is a documentation site generator built on `@lark.js/mvc`. It scans a `docs/` directory of Markdown files, compiles each into a module exporting `pageData` and `contentHtml`, auto-generates routes/sidebars/search index, and provides a four-view theme system (layout, sidebar, TOC, search) styled with Tailwind CSS v4 + DaisyUI v5. It ships build-time plugins for Vite, Webpack, and Rspack.

This guide covers the three-phase architecture, the full configuration API, the Markdown compilation pipeline, the theme system, all three search providers, bundler plugin internals, generated output conventions, TypeScript setup, and common pitfalls. For the lark-mvc framework itself (Views, Router, State, templates), see the `lark-mvc` skill.

## When to reach for this skill

Any task that involves documentation site generation with Lark:

- Configuring `defineConfig()` in `lark-docs.config.ts` with `DocsConfig` options.
- Setting up bundler plugins: `larkDocsPlugin` (Vite), `LarkDocsPlugin` (Webpack/Rspack).
- Writing Markdown with YAML frontmatter (`title`, `description`, `sidebar_position`, `sidebar_label`, `sidebar_group`, `draft`).
- Using the theme: `registerThemeViews(View)` for one-call setup, or individual factories for custom registration.
- Configuring search: `"local"` (built-in modal), `"docsearch"` (Algolia UI + local index), `"none"`.
- Setting up Shiki syntax highlighting (`highlight.theme`, `highlight.languages`).
- Working with auto-generated sidebars (`sidebar: { "/prefix/": "auto" }`).
- Understanding the `.lark-docs/generated/` output directory and the `@lark-docs/generated` Vite alias.
- Setting up TypeScript: `/// <reference types="@lark.js/docs/client" />`, tsconfig paths, ambient module declarations.
- Using Markdown extensions: `::: tip/warning/danger/details` containers, `[[toc]]` inline TOC, heading anchors, internal link interception.
- The `compileMarkdown()` pipeline: frontmatter extraction, markdown-it parsing, Shiki highlighting, JS module emission.
- Build-time vs runtime separation: why `/vite`, `/webpack`, `/rspack` sub-paths re-export utilities separately from the main barrel.
- The `/client` types-only export for ambient module declarations.
- Migrating documentation from VitePress or Docusaurus to `@lark.js/docs`.

## Architecture: three phases

`@lark.js/docs` operates in three distinct phases. Understanding the boundary between them is essential for debugging and extending the system.

### Phase 1 -- Configuration (build startup)

When the bundler loads `lark-docs.config.ts`, `defineConfig()` runs synchronously:

1. `scanDocsDir(docsDir, baseUrl)` walks the filesystem, extracts frontmatter and headings from each `.md` file, and produces `DocsRoute[]`.
2. `generateSidebar(routes, prefix, baseUrl)` produces `SidebarItem[]` trees for each prefix configured as `"auto"`.
3. The generated module is written to `.lark-docs/generated/index.js` with:
   - Dynamic import loaders for every `.md` file (absolute paths)
   - `loadContent(path)` function that imports and returns `{ pageData, contentHtml }`
   - Exported `routes: Record<string, string>` (path to `"theme/docs-layout"`)
   - Exported `docsConfig` (title, description, lang, nav, sidebar)
   - `getSearchIndex()` that lazily builds the search index on first call (filtering out virtual index routes)

This phase runs in Node.js. It has access to `node:fs`, `node:path`, and all build-time dependencies. It does NOT have access to the browser DOM.

### Phase 2 -- Compilation (bundler plugin)

Each `import ... from "./foo.md"` is intercepted by the bundler plugin:

1. `resolveId` (Vite) or loader rule (Webpack/Rspack) matches `.md` files.
2. The raw source is read and passed to `compileMarkdown(source, options)`.
3. The compilation pipeline runs:
   - `extractFrontmatter(source)` -- regex `^---\r?\n([\s\S]*?)\r?\n---\r?\n?` matches YAML frontmatter, parses with `js-yaml`.
   - `createParser(options)` -- creates `markdown-it` instance with `html: true`, `linkify: true`, applies 4 plugins:
     - `anchorPlugin` -- adds `id` attributes to h1-h3, injects `#` permalink links, deduplicates slugs.
     - `tocPlugin` -- registers `[[toc]]` inline rule, renders as `<div v-lark="theme/toc"></div>`.
     - `containerPlugin` -- registers `::: tip/warning/danger/details` via `markdown-it-container`, renders as DaisyUI `alert` components.
     - `codeBlockPlugin` -- overrides `fence` renderer to delegate to Shiki when configured.
   - `getHighlighter(theme, languages)` -- lazy-loaded Shiki singleton (async on first call, cached thereafter).
   - `md.parse(content, {})` produces token stream.
   - `renderToLarkTemplate(tokens, md)` renders to HTML string.
   - Title resolution: frontmatter `title` > first `# heading` > filename derivation.
   - `extractHeadings(content)` produces `HeadingInfo[]` (h2/h3 only).
   - JS module emission: exports `pageData` (metadata object) and `contentHtml` (rendered HTML string).

The output is a JS module string that the bundler treats as a normal ES module.

### Phase 3 -- Runtime (browser)

The generated module is imported by `boot.ts`:

```ts
import {
  routes,
  docsConfig,
  loadContent,
  getSearchIndex,
} from "@lark-docs/generated";
```

At boot time:

1. `registerThemeViews(View)` registers all four theme views with their compiled templates.
2. `State.set({ docsConfig, loadContent, getSearchIndex })` injects site data and content loader.
3. `Framework.boot(config)` starts the SPA with the generated routes.

At runtime, all `/docs/*` routes map to `theme/docs-layout`. The layout stays mounted across navigation. When the user navigates, `observeLocation` triggers an async `render()` that calls `loadContent(path)` to fetch the compiled markdown for the new page, then updates the view with `contentHtml`. The four theme Views render the documentation UI. Search is lazily initialized on first query via `getSearchIndex()`.

## Consumer project setup

### Project structure

```
my-docs-site/
+-- app/
|   +-- index.html
|   +-- boot.ts
|   +-- main.css
+-- docs/
|   +-- index.md
|   +-- guide/
|   |   +-- index.md
|   |   +-- config.md
|   +-- api/
|       +-- index.md
+-- lark-docs.config.ts
+-- vite.config.ts
+-- tsconfig.json
+-- shims.d.ts
+-- .lark-docs/           (generated, gitignored)
    +-- generated/
        +-- index.js
```

### shims.d.ts

```ts
/// <reference types="@lark.js/docs/client" />
/// <reference types="vite/client" />
```

### tsconfig.json paths

```json
{
  "compilerOptions": {
    "paths": {
      "@lark-docs/generated/*": ["./.lark-docs/generated/*"]
    }
  }
}
```

### boot.ts

```ts
import { Framework, View, State } from "@lark.js/mvc";
import {
  routes,
  docsConfig,
  loadContent,
  getSearchIndex,
} from "@lark-docs/generated";
import { registerThemeViews } from "@lark.js/docs/theme";

registerThemeViews(View);
State.set({ docsConfig, loadContent, getSearchIndex });

Framework.boot({
  rootId: "app",
  routeMode: "history",
  defaultPath: "/docs/",
  defaultView: "theme/docs-layout",
  routes,
  unmatchedView: "theme/docs-layout",
});
```

## Configuration reference

### DocsConfig

```ts
interface DocsConfig {
  docs: string; // Source directory, relative to project root
  baseUrl: string; // Route prefix (e.g. "/docs/")
  routeMode: "history" | "hash"; // Routing mode
  title: string; // Site title (navbar)
  description?: string; // Site meta description
  lang?: string; // Language code (default: "en-US")
  nav?: NavItem[]; // Top navbar items
  sidebar?: Record<string, SidebarConfig>; // Sidebar per prefix
  markdown?: MarkdownOptions; // Markdown processing
  highlight?: HighlightOptions; // Shiki highlighting
  search?: SearchOptions; // Search provider
}
```

### NavItem

```ts
interface NavItem {
  text: string;
  link: string;
  items?: NavItem[]; // Nested dropdown (recursive)
}
```

### SidebarConfig

```ts
type SidebarConfig = "auto" | SidebarItem[];

interface SidebarItem {
  text: string;
  link?: string; // Optional for group headers
  collapsed?: boolean; // Group starts collapsed
  items?: SidebarItem[];
  isActive?: boolean; // Set at runtime
}
```

### MarkdownOptions

```ts
interface MarkdownOptions {
  lineNumbers?: boolean; // Reserved for future line number support (not yet implemented)
  anchor?: { permalink?: boolean }; // Heading permalink anchors
  toc?: { level?: number[] }; // TOC extraction levels (default: [2, 3])
  containers?: Record<string, { label: string }>; // Custom container labels
}
```

### HighlightOptions

```ts
interface HighlightOptions {
  theme?: string; // Shiki theme (default: "github-dark")
  languages?: string[]; // Languages to load (default: common web languages)
}
```

The Shiki highlighter is initialized as a lazy singleton. First call is async (~200-800ms for WASM + grammar loading). Subsequent calls return the cached instance instantly. Languages not in the loaded list fall back to the `"text"` grammar.

### SearchOptions

```ts
interface SearchOptions {
  provider: "local" | "docsearch" | "none";
}
```

| Provider      | UI                       | Index                                      | Keyboard shortcut      |
| ------------- | ------------------------ | ------------------------------------------ | ---------------------- |
| `"local"`     | Built-in modal           | Pre-built local index                      | Manual open via button |
| `"docsearch"` | Algolia DocSearch widget | Pre-built local index (no Algolia account) | Ctrl+K / Cmd+K         |
| `"none"`      | No search UI             | N/A                                        | N/A                    |

## Frontmatter

```yaml
---
title: Page Title
description: Page description for SEO and search
sidebar_position: 1
sidebar_label: Custom Label
sidebar_group: Guide
draft: false
---
```

| Field              | Type      | Description                                                                                                                                                   |
| ------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`            | `string`  | Page title. Falls back to first `# heading`, then filename                                                                                                    |
| `description`      | `string`  | Meta description and search excerpt. Falls back to filename-derived title                                                                                     |
| `sidebar_position` | `number`  | Sort order in auto-sidebar (lower = higher). Uses all-or-nothing rule: if any page in a group lacks this field, all pages in that group sort by filename only |
| `sidebar_label`    | `string`  | Override sidebar display text                                                                                                                                 |
| `sidebar_group`    | `string`  | Sidebar group name                                                                                                                                            |
| `draft`            | `boolean` | Exclude from production builds                                                                                                                                |

Title resolution priority:

1. `title` in frontmatter
2. First `# heading` in body (excluding headings inside fenced code blocks)
3. Filename derivation: `index.md` uses parent directory name (title-cased), others use stem with dashes replaced by spaces. Root `index.md` falls back to `"Home"`.

## Markdown extensions

### Heading anchors

All h1-h3 headings receive:

- `id` attribute via `slugify()` (lowercase, strip non-word, dashes for spaces)
- `#` permalink link (when `markdown.anchor.permalink !== false`)
- `scroll-mt-20` class for sticky navbar offset
- Slug deduplication: `-1`, `-2`, etc. for duplicates

### Internal links

Links starting with `/` or `#` get `data-lark-nav="true"` for SPA navigation. External links get `target="_blank" rel="noopener noreferrer"`.

### [[toc]]

Insert `[[toc]]` to mount the TOC theme View inline: `<div v-lark="theme/toc"></div>`.

### Admonition containers

```markdown
::: tip
Info-styled alert (DaisyUI alert-info).
:::

::: warning
Warning-styled alert (DaisyUI alert-warning).
:::

::: danger
Error-styled alert (DaisyUI alert-error).
:::

::: details Click to expand
Details element with summary (DaisyUI alert-neutral).
:::
```

### Code blocks

Fenced code blocks with language identifier are syntax-highlighted when Shiki is configured. Without Shiki, they fall back to `<pre class="bg-neutral text-neutral-content rounded-box p-4 overflow-x-auto">`.

## Theme system

### registerThemeViews (recommended)

```ts
import { View } from "@lark.js/mvc";
import { registerThemeViews } from "@lark.js/docs/theme";

registerThemeViews(View);
```

Registers all four theme views in one call. Internally imports `.html` templates (compiled by `larkMvcPlugin` at build time), creates view classes, and calls `registerViewClass()` for each. Consumers never import `.html` files directly.

### Four View factories (for advanced/custom use)

```ts
createDocsLayoutView(View, template); // Root layout: navbar + 3-column body
createSidebarView(View, template); // Left sidebar navigation
createTocView(View, template); // Right-side heading outline
createSearchView(View, template); // Search modal (local provider)
```

Each factory takes the lark-mvc `View` class and a compiled template string, returns a View subclass ready for `registerViewClass()`.

### Layout structure

```
docs-layout (root)
+-- Navbar (sticky top, bg-base-100/80 backdrop-blur)
|   +-- navbar-start: site title
|   +-- navbar-center: nav items (hidden below md)
|   +-- navbar-end: search button or DocSearch container
+-- Flex container (max-w-7xl mx-auto)
|   +-- Sidebar (w-64, sticky, hidden below lg)
|   +-- Content (flex-1, prose max-w-none)
|   +-- TOC (w-56, sticky, hidden below xl)
+-- Prev/Next navigation
+-- Search modal (conditional, local provider only)
```

### How content rendering works

The layout view stays mounted across all `/docs/*` routes. It does NOT unmount/remount on navigation. Instead:

1. `init()` calls `this.observeLocation([], true)` to subscribe to route changes.
2. On navigation, `render()` fires asynchronously.
3. `render()` calls `loadContent(path)` from State to dynamically import the compiled `.md` module.
4. The result contains `{ pageData, contentHtml }`.
5. `contentHtml` is set on the updater and rendered inline.
6. `pageData.headings` are published to State for the TOC sub-view.
7. A signature guard short-circuits stale loads if the user navigates again before the previous import resolves.

### Child view mounting

Theme views use `v-lark="theme/..."` in templates to mount child views. The layout template includes:

- `v-lark="theme/sidebar"` in the left column
- `v-lark="theme/toc"` in the right column

### DocSearch integration

When `search.provider === "docsearch"`, the layout View's `init()` method:

1. Reads `getSearchIndex` from `State.get("getSearchIndex")`.
2. Calls `await getSearchIndex()` to lazily build the search index (loads all non-virtual .md modules on first call).
3. Creates a local search client via `createLocalSearchClient(searchIndex)`.
4. Dynamically imports `@docsearch/css` and `@docsearch/js`.
5. Mounts the widget into `#docsearch-container` with dummy credentials.
6. Uses `transformSearchClient` to replace the Algolia API call with the local client.

The local search client (`createLocalSearchClient`) returns `{ async search(requests) }` where each request extracts `params.query` and `params.hitsPerPage`, queries the local index with per-field AND-logic matching and weighted scoring (title=10, heading=5, excerpt=1), and converts results to DocSearch hit format with `hierarchy.lvl0` (title), `hierarchy.lvl1` (first heading), `url`, `_highlightResult`, and `_snippetResult`.

## Search internals

### Local search scoring

```ts
searchDocs(index: SearchEntry[], query: string, limit = 20): SearchEntry[]
```

- Case-insensitive substring matching
- AND logic: all query terms must match at least one field
- Per-field boundary checking: each term matched against individual fields (title, each heading, excerpt) independently to avoid false matches spanning field boundaries
- Scoring: title = 10pts/term, heading = 5pts/term, excerpt = 1pt/term
- Sort: score descending, then alphabetically by title

### Search index structure

```ts
interface SearchEntry {
  title: string; // Page title
  link: string; // Route URL
  headings: string[]; // All heading texts
  excerpt: string; // First ~200 chars or frontmatter description
}
```

### Lazy search index

The search index is NOT serialized into the generated file. Instead, `getSearchIndex()` in the generated module lazily loads all non-virtual `.md` modules on first search call (filtering through `_searchablePaths` to exclude virtual index routes):

```js
// In .lark-docs/generated/index.js
let _searchIndex = null;
export async function getSearchIndex() {
  if (_searchIndex) return _searchIndex;
  // Filter to canonical content paths (excludes virtual index routes)
  const entries = Object.entries(loaders).filter(([k]) =>
    _searchablePaths.has(k),
  );
  const mods = await Promise.all(entries.map(([, loader]) => loader()));
  _searchIndex = mods.map((mod, i) => ({
    title: mod.pageData?.title || "",
    link: entries[i][0],
    headings: (mod.pageData?.headings || []).map((h) => h.text || ""),
    excerpt: mod.pageData?.description || "",
  }));
  return _searchIndex;
}
```

This keeps the generated file small. The cost is one batch of dynamic imports on first search.

## Bundler plugins

### Vite: larkDocsPlugin

```ts
larkDocsPlugin({ config: DocsConfig, debug?: boolean }): Plugin
```

- `enforce: "pre"` -- runs before other plugins
- `resolveId`: appends `?lark-docs` suffix to `.md` imports
- `load`: reads raw source, calls `compileMarkdown()`, returns JS module string

### Webpack: LarkDocsPlugin + larkDocsLoader

```ts
new LarkDocsPlugin({ config: DocsConfig, test?: RegExp, exclude?: RegExp })
```

The plugin pushes a loader rule at the `compilation` hook. The loader uses `this.callback()` for async delivery (Webpack 5 pattern). Self-references via `__filename`.

### Rspack: LarkDocsPlugin + larkDocsLoader

Same API as Webpack, but the loader returns `Promise<string>` directly (Rspack async loader convention).

### Why separate sub-paths?

The main barrel (`@lark.js/docs`) re-exports everything including `icons` from `lucide-static` SVG `?raw` imports. These raw imports are Vite-specific and fail in Node.js contexts (like `vite.config.ts` evaluation). The `/vite`, `/webpack`, `/rspack` sub-paths re-export only build-time utilities (`scanDocsDir`, `generateRouteMap`, `generateSidebar`, `buildSearchIndex`, `defineConfig`) without the SVG imports.

### CJS shims for **filename/**dirname

Only `webpack.ts` and `rspack.ts` use `__filename` (to self-reference as bundler loaders). The library build injects CJS shims (`import { fileURLToPath } from "url"`) only into chunks whose code actually references `__filename` or `__dirname` (detected via regex `/\b__(?:filename|dirname)\b/`). Browser-targeted chunks (theme, runtime, index) are NOT shimmed -- injecting Node.js built-in imports into them would break browser builds with Vite's "module externalized for browser compatibility" error.

## Package exports map

| Sub-path     | Source               | Contents                                                                                    |
| ------------ | -------------------- | ------------------------------------------------------------------------------------------- |
| `.`          | `src/index.ts`       | Full barrel: types, scanner, route-map, sidebar, search, markdown, compiler, runtime, theme |
| `./compiler` | `src/compiler.ts`    | `compileMarkdown` + `CompileMarkdownOptions`                                                |
| `./vite`     | `src/vite.ts`        | `larkDocsPlugin` + `defineConfig` + build-time re-exports                                   |
| `./webpack`  | `src/webpack.ts`     | `LarkDocsPlugin` + `larkDocsLoader`                                                         |
| `./rspack`   | `src/rspack.ts`      | `LarkDocsPlugin` + `larkDocsLoader`                                                         |
| `./runtime`  | `src/runtime.ts`     | `searchDocs` + `slugify` (browser-safe)                                                     |
| `./theme`    | `src/theme/index.ts` | `registerThemeViews` + 4 view factories + `createLocalSearchClient` + `icons`               |
| `./client`   | `src/client.d.ts`    | Types-only: ambient `declare module "@lark-docs/generated"` + `declare module "*.html"`     |

## Generated output

`defineConfig()` writes to `.lark-docs/generated/index.js`:

```js
// Auto-generated by defineConfig() -- DO NOT EDIT!!!
const LAYOUT_VIEW = "theme/docs-layout";

const loaders = {
  "/docs": () => import("/absolute/path/to/docs/index.md"),
  "/docs/guide": () => import("/absolute/path/to/docs/guide/index.md"),
};

export async function loadContent(path) {
  const loader = loaders[path];
  if (!loader) return null;
  const mod = await loader();
  return { pageData: mod.pageData, contentHtml: mod.contentHtml };
}

export const routes = Object.fromEntries(
  Object.keys(loaders).map((k) => [k, LAYOUT_VIEW]),
);

export const docsConfig = { title: "...", nav: [...], sidebar: {...} };

let _searchIndex = null;
export async function getSearchIndex() { /* lazy build */ }
```

Key points:

- All routes map to a single view ID (`"theme/docs-layout"`). The layout stays mounted and swaps content via `loadContent()`.
- Content loaders are dynamic `import()` calls with absolute paths to `.md` files. The bundler plugin intercepts these and compiles them.
- The search index is lazily built at runtime (not serialized at build time) to keep the generated file small.
- No `registerViewClass()` calls in the generated file -- views are registered by `registerThemeViews()` in boot.ts.

Consumers import via Vite resolve alias:

```ts
// vite.config.ts
resolve: {
  alias: {
    "@lark-docs/generated": resolve(PKG_DIR, ".lark-docs/generated"),
  },
}

// boot.ts
import { routes, docsConfig, loadContent, getSearchIndex } from "@lark-docs/generated";
```

The `.lark-docs/` directory should be in `.gitignore`. It is regenerated each time `defineConfig()` runs (on every dev server start and build).

## TypeScript integration

### The `@lark.js/docs/client` export

This is a types-only export (no runtime code). It ships `client.d.ts` which contains:

```ts
/// <reference types="vite/client" />
declare module "*.html" {
  const content: string;
  export default content;
}
declare module "@docsearch/css";
declare module "@lark-docs/generated" {
  import type { DocsConfig, PageData } from "@lark.js/docs";
  export function loadContent(
    path: string,
  ): Promise<{ pageData: PageData; contentHtml: string } | null>;
  export const routes: Record<string, string>;
  export const docsConfig: DocsConfig;
  export interface SearchEntry {
    title: string;
    link: string;
    headings: string[];
    excerpt: string;
  }
  export function getSearchIndex(): Promise<SearchEntry[]>;
}
```

### Why `/// <reference types>` and not `/// <reference path>`

When referencing type declarations inside `node_modules`, always use `/// <reference types="..." />`:

- `/// <reference types="@lark.js/docs/client" />` uses TypeScript's full module resolution algorithm. It reads `package.json` exports, resolves pnpm workspace symlinks correctly, and maintains proper resolution context for the referenced file's internal `import type` statements.
- `/// <reference path="../node_modules/@lark.js/docs/dist/client.d.ts" />` performs a raw filesystem path lookup. It does not understand package structure or symlink resolution. Under `moduleResolution: "bundler"`, the referenced file's internal `import type { ... } from "@lark.js/docs"` may fail to resolve because the resolution context is lost, silently invalidating the ambient `declare module` block.

This is a common pitfall in pnpm workspaces where packages are symlinked.

### tsconfig.json paths

The `paths` entry uses a wildcard pattern to match both bare and subpath imports:

```json
{
  "compilerOptions": {
    "paths": {
      "@lark-docs/generated/*": ["./.lark-docs/generated/*"]
    }
  }
}
```

This works alongside the `/// <reference types>` directive: the reference provides the type declarations, the paths mapping helps the IDE resolve the module location.

## Scanner rules

`scanDocsDir()` applies these filtering rules:

- Skips entries starting with `_` or `.`
- Skips directories: `node_modules`, `__tests__`, `__fixtures__`, `.git`, `.vitepress`, `.lark-docs`, `dist`
- `index.md` maps to directory root: `guide/index.md` becomes `/docs/guide`
- Other files: `guide/config.md` becomes `/docs/guide/config`
- View IDs: `guide-config`, `guide-index`, etc. (slashes become dashes, `index` suffix for root files)
- Draft files (`draft: true` in frontmatter) excluded when `excludeDrafts` option is set

## Sidebar generation rules

`generateSidebar()` applies these rules:

1. Routes filtered by prefix match
2. Grouped by subdirectory under the prefix
3. Root-level items (no subdirectory) processed first
4. Sorted by `sidebarPosition` (frontmatter), then alphabetically by title
5. Display text: `sidebarLabel` (frontmatter) if set, otherwise `title`
6. Subdirectory groups get title-cased labels with dashes/underscores replaced by spaces

## Common patterns

### Adding a custom theme view

To add a custom theme view (e.g., a footer) alongside the built-in four:

```ts
import { View } from "@lark.js/mvc";
import { registerThemeViews } from "@lark.js/docs/theme";
import footerTemplate from "./footer.html";

// Register built-in views first
registerThemeViews(View);

// Then register your custom view
registerViewClass(
  "theme/footer",
  View.extend({
    template: footerTemplate,
    init() {
      this.assign();
    },
    assign() {
      const docsConfig = State.get("docsConfig") || {};
      this.updater.set({ siteTitle: docsConfig.title });
      return this.updater.altered();
    },
    render() {
      this.updater.digest();
    },
  }),
);
```

### Overriding a built-in theme view

Call `registerViewClass` with the same view ID after `registerThemeViews` to replace it:

```ts
registerThemeViews(View);

// Override the layout with a custom version
registerViewClass(
  "theme/docs-layout",
  createDocsLayoutView(View, myCustomTemplate),
);
```

### Customizing the search algorithm

The local search uses `searchDocs()` from `@lark.js/docs/runtime`. To customize scoring, wrap the search client:

```ts
import { createLocalSearchClient } from "@lark.js/docs/theme";

const baseClient = createLocalSearchClient(searchIndex);
const customClient = {
  async search(requests) {
    const result = await baseClient.search(requests);
    // Post-process hits...
    return result;
  },
};
```

## Type definitions

All types are exported from the main entry:

```ts
import type {
  DocsConfig,
  NavItem,
  SidebarConfig,
  SidebarItem,
  MarkdownOptions,
  HighlightOptions,
  SearchOptions,
  PageData,
  HeadingInfo,
  DocsRoute,
  SidebarData,
  TocData,
  SearchEntry,
  FrontmatterResult,
  CompileMarkdownOptions,
} from "@lark.js/docs";
```

Key type relationships:

- `DocsConfig` is the user-facing configuration. `defineConfig()` returns it unchanged.
- `DocsRoute` is the scanner output: `{ path, viewId, filePath, pageData }`.
- `PageData` is extracted per-file: `{ title, description, sidebarPosition, sidebarLabel, sidebarGroup, draft, headings, relativePath, lastUpdated }`.
- `SearchEntry` is the search index entry: `{ title, link, headings, excerpt }`.
- `CompileMarkdownOptions` is passed to `compileMarkdown()`: `{ config, filePath, debug }`.

## Pitfalls

**Importing from `@lark.js/docs` in `vite.config.ts`** pulls in `lucide-static` SVG `?raw` imports which fail in Node.js. Use `@lark.js/docs/vite` instead, which re-exports only build-time utilities.

**Shiki initialization is async on first call.** The `compileMarkdown()` function is `async` because `getHighlighter()` loads WASM and grammars. Subsequent calls use the cached singleton and resolve instantly. This means the bundler plugin's `load` hook must be async (all three plugins handle this correctly).

**Frontmatter regex is non-greedy.** The pattern `^---\r?\n([\s\S]*?)\r?\n---\r?\n?` matches the first `---` block. If your markdown body contains `---` on its own line, it will not interfere because the regex anchors to the start of the file.

**`[[toc]]` is an inline rule, not a block rule.** It must appear on its own line with no surrounding text. It compiles to `<div v-lark="theme/toc"></div>` which mounts the TOC theme View at that position.

**Container syntax requires `:::` followed by a space and the type keyword.** `:::tip` (no space) will not be recognized. The type keyword is case-sensitive: `::: Tip` will not match.

**Generated module uses absolute paths.** The `.lark-docs/generated/index.js` file contains absolute filesystem paths to `.md` files. This is intentional -- the generated module lives outside the docs directory and must reference files unambiguously.

**`node:fs`, `node:path`, `node:process`, `node:url` must be externalized** in library builds. If these appear in the bundled output as `const fs = {}`, add them to the `external` array in your Vite/Rollup config.

**CJS shims must NOT be injected into browser-targeted chunks.** The library build's `cjs-shims` plugin only injects `import { fileURLToPath } from "url"` and `import { dirname } from "path"` into chunks that actually reference `__filename` or `__dirname` (webpack.js and rspack.js). Injecting these into browser-targeted chunks (theme.js, runtime.js, index.js) causes Vite's "Module has been externalized for browser compatibility" error and Rollup's `"fileURLToPath" is not exported by "__vite-browser-external"` build failure.

**`/// <reference types="..." />` vs `/// <reference path="..." />` for node_modules types.** When referencing `client.d.ts` from `@lark.js/docs`, always use `/// <reference types="@lark.js/docs/client" />`. The `path` directive does raw filesystem lookup and fails with pnpm workspace symlinks under `moduleResolution: "bundler"`. The `types` directive uses TypeScript's module resolution which correctly handles package exports and symlinks. See the "TypeScript integration" section above for details.

**The layout view stays mounted across navigation.** All `/docs/*` routes map to `theme/docs-layout`. Navigation does not unmount/remount the view -- it triggers `observeLocation` which calls `render()` asynchronously. Content is loaded via `loadContent(path)` and swapped in-place. This means `init()` runs only once, and any per-page setup must happen in `render()`.

**State must include `loadContent` and `getSearchIndex`.** The layout view reads these from `State.get("loadContent")` and `State.get("getSearchIndex")` at render time. If they are not set via `State.set({ loadContent, getSearchIndex })` in boot.ts, the layout will render "Page not found."
