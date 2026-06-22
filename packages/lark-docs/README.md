# @lark.js/docs

Documentation site generator for `@lark.js/mvc`.

If `@lark.js/mvc` is to React or Vue, then `@lark.js/docs` is to Docusaurus or VitePress -- providing an out-of-the-box documentation site experience built on top of the Lark MVC framework.

## Features

- File-based routing: recursively scans a `docs/` directory and generates SPA routes
- Dual routing modes: supports `@lark.js/mvc` Router in both `history` and `hash` modes
- Markdown compilation pipeline: `markdown-it` with four custom plugins (anchors, TOC, containers, code blocks)
- YAML frontmatter: metadata extraction via `js-yaml` for page titles, descriptions, sidebar positioning, and draft control
- Code syntax highlighting: Shiki-powered highlighting with lazy WASM initialization and singleton caching
- Admonition containers: `::: tip`, `::: warning`, `::: danger`, `::: details` rendered as DaisyUI alert components
- Auto-generated sidebar: directory-structure-based navigation with `sidebarPosition` and `sidebarLabel` frontmatter overrides
- Three search providers: built-in local search modal, Algolia DocSearch UI with local index (no account required), or disabled
- Table of contents: per-page heading outline with smooth-scroll navigation
- Three-column responsive layout: Tailwind CSS v4 + DaisyUI v5 with sticky navbar, frosted glass effect, and mobile-responsive sidebars
- Three bundler integrations: Vite, Webpack, and Rspack / Rsbuild
- Zero-config boot: `defineConfig()` auto-generates routes, sidebars, and search index into `.lark-docs/generated/`
- Dual-format library build: ships ESM + CJS with full TypeScript declarations

## Architecture

`@lark.js/docs` operates in three phases:

**Phase 1 -- Configuration (build startup).** `defineConfig()` scans the docs directory, extracts frontmatter and headings from every `.md` file, auto-generates sidebar trees per path prefix, builds a search index, and writes a generated module to `.lark-docs/generated/index.ts`. This module imports all `.md` files, calls `registerViewClass()` for each, and exports the route map plus runtime site configuration.

**Phase 2 -- Compilation (bundler plugin).** Each `.md` import is intercepted by the bundler plugin (`larkDocsPlugin` for Vite, `LarkDocsPlugin` for Webpack/Rspack) and compiled through `compileMarkdown()`. The pipeline extracts YAML frontmatter, initializes the Shiki highlighter on first call (async singleton), parses the markdown body with `markdown-it` plus four custom plugins, renders to HTML, builds page metadata, and emits a JS module that exports a `View.extend({ pageData, template })` class.

**Phase 3 -- Runtime (browser).** The `@lark.js/mvc` Framework boots with the generated routes. Five theme Views (layout, sidebar, content, TOC, search) render the documentation UI. Navigation is SPA-based via the lark-mvc Router. The pre-built search index is loaded from State and queried client-side.

```
lark-docs.config.ts          Bundler Plugin              Browser Runtime
       |                            |                          |
  defineConfig()              compileMarkdown()          Framework.boot()
       |                            |                          |
  scanDocsDir()               extractFrontmatter         routes + views
  generateSidebar()           createParser()             registered via
  buildSearchIndex()          getHighlighter()           generated module
       |                            |                          |
  .lark-docs/generated/        JS module string          5 theme Views
  (routes + config)            (View.extend)             render the docs UI
```

## Quick Start

### 1. Install

```bash
pnpm add @lark.js/docs @lark.js/mvc tailwindcss daisyui @tailwindcss/typography
```

The theme templates use Tailwind CSS utility classes, DaisyUI components, and the Typography plugin for `prose` styling. All are peer dependencies -- your project must have them installed and configured in your CSS entry:

```css
@import "tailwindcss";
@plugin "daisyui";
@plugin "@tailwindcss/typography";
```

### 2. Configure

Create `lark-docs.config.ts`:

```ts
import { defineConfig } from "@lark.js/docs/vite";

export default defineConfig({
  docs: "docs",
  baseUrl: "/docs/",
  routeMode: "history",
  title: "My Library",
  description: "Documentation for My Library",
  nav: [
    { text: "Guide", link: "/docs/guide/" },
    { text: "API", link: "/docs/api/" },
  ],
  sidebar: {
    "/docs/guide/": "auto",
    "/docs/api/": "auto",
  },
  highlight: {
    theme: "github-dark",
    languages: ["typescript", "javascript", "html", "css", "bash", "json"],
  },
  search: { provider: "local" },
});
```

`defineConfig()` is an identity function that also triggers route generation. It scans the docs directory, generates sidebar trees, builds the search index, and writes the generated module -- all at configuration load time.

### 3. Configure Your Bundler

**Vite:**

```ts
import { defineConfig } from "vite";
import { larkDocsPlugin } from "@lark.js/docs/vite";
import { larkMvcPlugin7 } from "@lark.js/mvc/vite";
import tailwindcss from "@tailwindcss/vite";
import docsConfig from "./lark-docs.config";
import { resolve } from "node:path";

const PKG_DIR = import.meta.dirname;

export default defineConfig({
  root: resolve(PKG_DIR, "app"),
  plugins: [
    larkDocsPlugin({ config: docsConfig }),
    larkMvcPlugin7({ debug: true, useSwc: true }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@lark.js/docs": resolve(PKG_DIR, "../lark-docs/src"),
      "@lark-docs/generated": resolve(PKG_DIR, ".lark-docs/generated"),
    },
  },
});
```

**Webpack:**

```ts
import { LarkDocsPlugin } from "@lark.js/docs/webpack";
import docsConfig from "./lark-docs.config";

export default {
  plugins: [new LarkDocsPlugin({ config: docsConfig })],
};
```

**Rspack:**

```ts
import { LarkDocsPlugin } from "@lark.js/docs/rspack";
import docsConfig from "./lark-docs.config";

export default {
  plugins: [new LarkDocsPlugin({ config: docsConfig })],
};
```

### 4. Boot

Create `app/boot.ts`:

```ts
import { Framework, View, State, registerViewClass } from "@lark.js/mvc";
import type { FrameworkConfig } from "@lark.js/mvc";

// Auto-generated by defineConfig()
import { routes, docsConfig } from "@lark-docs/generated";

// Theme view factories + templates
import {
  createDocsLayoutView,
  createSidebarView,
  createContentView,
  createTocView,
  createSearchView,
} from "@lark.js/docs/theme";

import docLayoutTemplate from "@lark.js/docs/theme/docs-layout.html";
import sidebarTemplate from "@lark.js/docs/theme/sidebar.html";
import contentTemplate from "@lark.js/docs/theme/content.html";
import tocTemplate from "@lark.js/docs/theme/toc.html";
import searchTemplate from "@lark.js/docs/theme/search.html";

import "./main.css";

// Register theme views
registerViewClass(
  "theme/docs-layout",
  createDocsLayoutView(View, docLayoutTemplate),
);
registerViewClass("theme/sidebar", createSidebarView(View, sidebarTemplate));
registerViewClass("theme/content", createContentView(View, contentTemplate));
registerViewClass("theme/toc", createTocView(View, tocTemplate));
registerViewClass("theme/search", createSearchView(View, searchTemplate));

// Inject site data into State
State.set({ docsConfig });

// Boot the framework
const config: FrameworkConfig = {
  rootId: "app",
  routeMode: "history",
  defaultPath: "/docs/",
  defaultView: "index",
  routes,
  unmatchedView: "index",
};

Framework.boot(config);
```

### 5. Write Markdown

````markdown
---
title: Getting Started
description: Learn how to use the framework
sidebar_position: 1
---

# Getting Started

Welcome to the documentation.

## Installation

Install via npm:

```bash
pnpm add @lark.js/mvc
```

::: tip
Always call `registerViewClass` before `Framework.boot()`.
:::
````

## Configuration Reference

The `DocsConfig` interface defines all configuration options:

| Field         | Type                            | Default                 | Description                                     |
| ------------- | ------------------------------- | ----------------------- | ----------------------------------------------- |
| `docs`        | `string`                        | `"docs"`                | Docs source directory, relative to project root |
| `baseUrl`     | `string`                        | `"/docs/"`              | Base URL prefix for all generated routes        |
| `routeMode`   | `"history" \| "hash"`           | `"history"`             | Routing mode, maps to `@lark.js/mvc` Router     |
| `title`       | `string`                        | (required)              | Site title displayed in the navbar              |
| `description` | `string`                        | `""`                    | Site description for meta tags                  |
| `lang`        | `string`                        | `"en-US"`               | Language code                                   |
| `nav`         | `NavItem[]`                     | `[]`                    | Top navigation items                            |
| `sidebar`     | `Record<string, SidebarConfig>` | `{}`                    | Sidebar config per path prefix                  |
| `markdown`    | `MarkdownOptions`               | `{}`                    | Markdown processing options                     |
| `highlight`   | `HighlightOptions`              | `undefined`             | Shiki code highlighting options                 |
| `search`      | `SearchOptions`                 | `{ provider: "local" }` | Search provider configuration                   |

### NavItem

```ts
interface NavItem {
  text: string; // Display text
  link: string; // Link URL (internal or external)
  items?: NavItem[]; // Nested dropdown items
}
```

### Sidebar Configuration

Each sidebar prefix maps to either `"auto"` (filesystem-based generation) or an explicit `SidebarItem[]` array.

```ts
sidebar: {
  "/docs/guide/": "auto",        // auto-generate from directory structure
  "/docs/api/": [                 // explicit items
    { text: "Overview", link: "/docs/api/" },
    { text: "Classes", link: "/docs/api/classes" },
  ],
}
```

Auto-generated sidebars group routes by subdirectory, sort by `sidebarPosition` frontmatter (then alphabetically), and use `sidebarLabel` frontmatter for display text when provided.

### MarkdownOptions

| Field              | Type                                | Default    | Description                       |
| ------------------ | ----------------------------------- | ---------- | --------------------------------- |
| `lineNumbers`      | `boolean`                           | `false`    | Show line numbers in code blocks  |
| `anchor.permalink` | `boolean`                           | `true`     | Add permalink anchors to h1-h3    |
| `toc.level`        | `number[]`                          | `[2, 3]`   | Heading levels to extract for TOC |
| `containers`       | `Record<string, { label: string }>` | (built-in) | Custom container labels           |

### HighlightOptions

| Field       | Type       | Default            | Description       |
| ----------- | ---------- | ------------------ | ----------------- |
| `theme`     | `string`   | `"github-dark"`    | Shiki theme name  |
| `languages` | `string[]` | (common web langs) | Languages to load |

When `highlight` is configured, the Shiki highlighter is initialized as a lazy singleton on the first `.md` compilation. The WASM and TextMate grammars are loaded once and cached for all subsequent files. Languages not in the loaded list fall back to the `"text"` grammar.

### SearchOptions

| Provider      | Description                                                                                |
| ------------- | ------------------------------------------------------------------------------------------ |
| `"local"`     | Built-in search modal with substring matching and weighted scoring                         |
| `"docsearch"` | Algolia DocSearch UI widget backed by the local search index (no Algolia account required) |
| `"none"`      | Disable search entirely                                                                    |

## Frontmatter

Each `.md` file can include YAML frontmatter delimited by `---`:

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

| Field              | Type      | Description                                                              |
| ------------------ | --------- | ------------------------------------------------------------------------ |
| `title`            | `string`  | Page title. Falls back to first `# heading`, then filename-derived title |
| `description`      | `string`  | Page description for meta tags and search index                          |
| `sidebar_position` | `number`  | Sort order in auto-generated sidebar (lower = higher). Default: 999      |
| `sidebar_label`    | `string`  | Override sidebar display text                                            |
| `sidebar_group`    | `string`  | Sidebar group name for grouping                                          |
| `draft`            | `boolean` | When `true`, excluded from production builds via `excludeDrafts` option  |

### Title Resolution Chain

The page title is resolved in this priority order:

1. `title` field in frontmatter
2. First `# heading` in the markdown body (excluding headings inside fenced code blocks)
3. Filename-derived title: `index.md` uses the parent directory name (title-cased), other files use the stem with dashes replaced by spaces

The root `index.md` (at the docs directory root) falls back to `"Home"`.

## Markdown Extensions

### Heading Anchors

All h1, h2, and h3 headings automatically receive:

- An `id` attribute derived from the heading text via `slugify()` (lowercase, strip non-word chars, dashes for spaces)
- A `#` permalink link injected as a child anchor element (when `markdown.anchor.permalink` is not `false`)
- A `scroll-mt-20` CSS class to offset the sticky navbar height during scroll-to-anchor
- Slug deduplication: if two headings produce the same slug, the second gets a `-1` suffix, the third `-2`, etc.

### Internal Links

Links starting with `/` or `#` are automatically tagged with `data-lark-nav="true"` for SPA navigation interception by the lark-mvc Router. External links receive `target="_blank"` and `rel="noopener noreferrer"`.

### Table of Contents

Insert `[[toc]]` anywhere in your markdown to render a table of contents inline. The `[[toc]]` marker is compiled to `<div v-lark="theme/toc"></div>`, which mounts the TOC theme View at that position.

### Admonition Containers

Four container types are supported via the `:::` fenced syntax:

```markdown
::: tip
Useful advice displayed in an info-styled alert.
:::

::: warning
Cautionary note displayed in a warning-styled alert.
:::

::: danger
Critical warning displayed in an error-styled alert.
:::

::: details Click to expand
Hidden content revealed on click.
:::
```

Containers are rendered as DaisyUI `alert` components:

- `tip` maps to `alert-info`
- `warning` maps to `alert-warning`
- `danger` maps to `alert-error`
- `details` maps to a `<details>` element with `<summary>`, styled as `alert-neutral`

Container labels can be customized via `markdown.containers` config.

### Code Blocks

Fenced code blocks with a language identifier are syntax-highlighted when Shiki is configured:

````markdown
```typescript
const x: number = 42;
```
````

Without Shiki, code blocks fall back to a styled `<pre>` with `bg-neutral text-neutral-content rounded-box p-4 overflow-x-auto` classes.

## Theme System

The theme consists of five View factories, each paired with an HTML template. Users register them in their `boot.ts` via `registerViewClass()`.

### View Factories

| Factory                                | View ID             | Purpose                                               |
| -------------------------------------- | ------------------- | ----------------------------------------------------- |
| `createDocsLayoutView(View, template)` | `theme/docs-layout` | Root layout: navbar, three-column body, prev/next nav |
| `createSidebarView(View, template)`    | `theme/sidebar`     | Left sidebar navigation tree                          |
| `createContentView(View, template)`    | `theme/content`     | Main content area (compiled markdown HTML)            |
| `createTocView(View, template)`        | `theme/toc`         | Right-side heading outline with smooth scroll         |
| `createSearchView(View, template)`     | `theme/search`      | Search modal (local provider only)                    |

### Layout Structure

```
docs-layout (root)
+-- Navbar (sticky top, backdrop-blur)
|   +-- Site title
|   +-- Nav items (horizontal menu, hidden on mobile)
|   +-- Search (local button or DocSearch container)
+-- Flex container (max-w-7xl, centered)
|   +-- Sidebar (w-64, left, visible on lg+)
|   +-- Content (flex-1, prose max-w-none)
|   +-- TOC (w-56, right, visible on xl+)
+-- Prev/Next navigation (bottom of content)
+-- Search modal (conditional, local provider only)
```

### Responsive Behavior

- Below `lg` breakpoint (1024px): sidebar is hidden
- Below `xl` breakpoint (1280px): TOC is hidden
- Nav items hidden on small screens, visible from `md` breakpoint
- Search button always visible; DocSearch provides its own keyboard shortcut (Ctrl+K)

### Icons

Theme views use `lucide-static` for SVG icons, imported as raw strings via Vite's `?raw` suffix. Icons are centralized in `src/theme/icons.ts` and set in `init()` (not `assign()`) since they are static data. Templates render icons with the raw output operator:

```html
<span class="h-5 w-5 [&>svg]:h-full [&>svg]:w-full"> {{!icons.search}} </span>
```

The wrapper `<span>` controls sizing. Tailwind utilities `[&>svg]:w-full [&>svg]:h-full` force the child `<svg>` to fill the container. Icons inherit `currentColor` from their parent, so color is controlled via standard CSS utilities (e.g., `text-primary`).

## Search System

### Local Search (provider: "local")

The built-in search provides a modal dialog with:

- Case-insensitive substring matching across title, headings, and excerpt
- AND logic: all query terms must match at least one field
- Weighted scoring: title match = 10 points, heading match = 5 points, excerpt match = 1 point
- Per-field boundary checking: each term is matched against individual fields independently to avoid false matches across field boundaries (e.g., term spanning title and heading)
- Results sorted by score descending, then alphabetically by title
- Configurable result limit (default: 20)

### DocSearch Integration (provider: "docsearch")

The DocSearch provider renders Algolia's styled search button and modal UI, but queries the local search index instead of Algolia's hosted API. No Algolia account or credentials are required.

Implementation: `createLocalSearchClient(index)` returns an Algolia-compatible search client with a `search(requests)` method. The client is injected into the DocSearch widget via `transformSearchClient`, replacing the default Algolia API call. The search client converts `SearchEntry[]` results into DocSearch's expected hit format with `hierarchy.lvl0` (page title), `hierarchy.lvl1` (first heading), `url`, `_highlightResult`, and `_snippetResult` fields.

The DocSearch widget provides:

- Styled search button in the navbar
- Modal with keyboard shortcut (Ctrl+K / Cmd+K)
- Recent searches (stored in localStorage)
- Result highlighting

## Bundler Plugins

### Vite Plugin

```ts
import { larkDocsPlugin } from "@lark.js/docs/vite";

export default defineConfig({
  plugins: [larkDocsPlugin({ config: docsConfig, debug: false })],
});
```

The plugin runs in the `pre` enforcement phase. Its `resolveId` hook appends a `?lark-docs` suffix to `.md` imports so Vite does not treat them as static assets. Its `load` hook reads the raw markdown, compiles it through `compileMarkdown()`, and returns the JS module string.

Options: `{ config: DocsConfig, debug?: boolean }`.

### Webpack Plugin + Loader

```ts
import { LarkDocsPlugin } from "@lark.js/docs/webpack";

export default {
  plugins: [new LarkDocsPlugin({ config: docsConfig })],
};
```

`LarkDocsPlugin` pushes a loader rule onto `compiler.options.module.rules` at the `compilation` hook. The loader (`larkDocsLoader`) uses Webpack 5's `this.callback()` pattern for async result delivery. It self-references via `__filename` to resolve the loader path.

Options: `{ config: DocsConfig, test?: RegExp, exclude?: RegExp }`. Defaults: `test: /\.md$/`, `exclude: /node_modules/`.

### Rspack Plugin + Loader

```ts
import { LarkDocsPlugin } from "@lark.js/docs/rspack";

export default {
  plugins: [new LarkDocsPlugin({ config: docsConfig })],
};
```

Same API as Webpack, but the loader returns `Promise<string>` directly (Rspack async loader convention, no `this.callback()`).

## Package Exports

| Sub-path                     | Description                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `@lark.js/docs`              | Main barrel: all types, scanner, route-map, sidebar, search, markdown, compiler, runtime, theme factories, icons |
| `@lark.js/docs/compiler`     | `compileMarkdown()` + `CompileMarkdownOptions` type                                                              |
| `@lark.js/docs/vite`         | `larkDocsPlugin()` Vite plugin + build-time utility re-exports                                                   |
| `@lark.js/docs/webpack`      | `LarkDocsPlugin` class + `larkDocsLoader()` function                                                             |
| `@lark.js/docs/rspack`       | `LarkDocsPlugin` class + `larkDocsLoader()` async function                                                       |
| `@lark.js/docs/runtime`      | `searchDocs()` + `slugify()` (browser-safe, no build deps)                                                       |
| `@lark.js/docs/theme`        | Five view factories + `createLocalSearchClient` + `icons`                                                        |
| `@lark.js/docs/theme/*.html` | Raw HTML template strings (5 templates)                                                                          |

The `/vite`, `/webpack`, and `/rspack` sub-paths re-export build-time utilities (`scanDocsDir`, `generateRouteMap`, `generateSidebar`, `buildSearchIndex`, `defineConfig`) to avoid pulling in the main entry's `lucide-static` SVG `?raw` imports, which are not valid in Node.js contexts.

## API Reference

### `defineConfig(config: DocsConfig, projectRoot?: string): DocsConfig`

Type-safe configuration helper. Returns the config unchanged while triggering route generation. The optional `projectRoot` parameter controls path resolution for the `docs` directory and the generated output. Defaults to `process.cwd()`.

### `scanDocsDir(docsDir: string, baseUrl: string, options?: { excludeDrafts?: boolean }): DocsRoute[]`

Recursively scans a docs directory and returns route entries. Skips entries starting with `_` or `.`, plus `node_modules`, `__tests__`, `__fixtures__`, `.git`, `.vitepress`, `.lark-docs`, and `dist`. `index.md` maps to the directory root with trailing `/`. Generates a unique `viewId` from the route path.

### `generateRouteMap(routes: DocsRoute[]): Record<string, string>`

Maps `route.path` to `route.viewId` for use as the lark-mvc `routes` config.

### `generateBootModule(routes: DocsRoute[]): string`

Generates a JS module source string that imports all `.md` files and calls `registerViewClass()` for each.

### `generateSidebar(routes: DocsRoute[], prefix: string, baseUrl: string): SidebarItem[]`

Auto-generates sidebar items for routes under a given prefix. Groups by subdirectory, sorts by `sidebarPosition` then title, produces a `SidebarItem[]` tree.

### `buildSearchIndex(routes: DocsRoute[]): SearchEntry[]`

Maps non-draft routes to `{ title, link, headings[], excerpt }` entries for client-side search.

### `compileMarkdown(source: string, options: CompileMarkdownOptions): Promise<string>`

Compiles a `.md` source string into a JS module string that exports a lark-mvc View class. The pipeline: extract frontmatter, create parser, optionally initialize Shiki, parse and render to HTML, build page metadata, emit JS module.

### `searchDocs(index: SearchEntry[], query: string, limit?: number): SearchEntry[]`

Client-side full-text search over the pre-built index. Uses AND-logic substring matching with weighted scoring.

### `slugify(text: string): string`

Converts text to a URL-safe slug: lowercase, strip non-word chars (except spaces and dashes), replace whitespace with dashes, collapse consecutive dashes.

### Theme View Factories

```ts
createDocsLayoutView(View, template); // root layout
createSidebarView(View, template); // sidebar navigation
createContentView(View, template); // content area
createTocView(View, template); // heading outline
createSearchView(View, template); // search modal
createLocalSearchClient(index); // Algolia-compatible search client
```

## Type Definitions

All types are exported from the main entry and available for import:

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

## Generated Output

`defineConfig()` writes a generated module to `.lark-docs/generated/index.ts` (a dot directory at project root, similar to VitePress's `.vitepress/` and Docusaurus's `.docusaurus/`). This directory should be added to `.gitignore`.

The generated module:

- Imports all discovered `.md` files (compiled by the bundler plugin at build time)
- Calls `registerViewClass()` for each file
- Exports `routes: Record<string, string>` (path-to-viewId map)
- Exports `docsConfig` (runtime site configuration with sidebar and search index)

Consumers import it via a Vite resolve alias:

```ts
// vite.config.ts
resolve: {
  alias: {
    "@lark-docs/generated": resolve(PKG_DIR, ".lark-docs/generated"),
  },
}

// boot.ts
import { routes, docsConfig } from "@lark-docs/generated";
```

## Dependencies

**Runtime:**

- `@docsearch/css` ^4.6.3 -- DocSearch widget styles (dynamic import, only for `"docsearch"` provider)
- `@docsearch/js` ^4.6.3 -- DocSearch widget (dynamic import, only for `"docsearch"` provider)
- `js-yaml` ^5.0.0 -- YAML frontmatter parsing
- `lucide-static` ^1.21.0 -- SVG icons via `?raw` import
- `markdown-it` ^14.2.0 -- Markdown parser
- `markdown-it-container` ^4.0.0 -- Admonition container syntax
- `shiki` ^4.2.0 -- Code syntax highlighting (dynamic import, lazy singleton)

**Peer:**

- `@lark.js/mvc` >=0.0.12 -- MVC framework (View, Router, State, Framework)
- `@tailwindcss/typography` ^0.5.0 -- `prose` class for markdown content
- `daisyui` ^5.0.0 -- UI component classes
- `tailwindcss` ^4.0.0 -- Utility-first CSS

## License

ISC
