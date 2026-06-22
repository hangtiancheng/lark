# @lark.js/docs

Documentation site generator for [@lark.js/mvc](https://github.com/hangtiancheng/lark/tree/main/packages/lark-mvc).

If `@lark.js/mvc` is to React/Vue, then `@lark.js/docs` is to Docusaurus/VitePress -- providing an out-of-the-box documentation site experience.

## Features

- Recursively scans a `docs/` directory and generates file-based routes
- Supports `@lark.js/mvc` Router in both `history` and `hash` modes
- Accepts `baseUrl` as a common route prefix
- Markdown parsing via `markdown-it` with custom plugins
- YAML frontmatter extraction via `js-yaml`
- Code syntax highlighting (Shiki-ready)
- Admonition containers (`::: tip`, `::: warning`, `::: danger`, `::: details`)
- Auto-generated sidebar from directory structure
- Client-side full-text search
- Table of contents (TOC) per page
- Fixed theme using Tailwind CSS + DaisyUI
- Supports Vite, Webpack, and Rspack / Rsbuild

## Quick Start

### 1. Install

```bash
pnpm add @lark.js/docs @lark.js/mvc tailwindcss daisyui
```

The theme templates use Tailwind CSS utility classes and DaisyUI components. Both are peer dependencies -- your project must have them installed and configured in your CSS entry:

```css
/* src/styles.css */
@import "tailwindcss";
@plugin "daisyui";
```

### 2. Configure

Create `lark-docs.config.ts`:

```ts
import { defineConfig } from "@lark.js/docs";

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
  markdown: {
    lineNumbers: true,
    anchor: { permalink: true },
    toc: { level: [2, 3] },
  },
  search: { provider: "local" },
});
```

### 3. Configure Your Bundler

**Vite:**

```ts
import { larkDocsPlugin } from "@lark.js/docs/vite";
import { larkMvcPlugin } from "@lark.js/mvc/vite";
import docsConfig from "./lark-docs.config";

export default defineConfig({
  plugins: [larkDocsPlugin({ config: docsConfig }), larkMvcPlugin()],
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
import docsConfig from "./lark-docs.config;

export default {
  plugins: [new LarkDocsPlugin({ config: docsConfig })],
};
```

### 4. Write Markdown

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
````

::: tip
Always call `registerViewClass` before `Framework.boot()`.
:::

## Configuration

See [Configuration Guide](/docs/guide/config) for details.

````

### 5. Boot

```ts
import { Framework, registerViewClass, State } from "@lark.js/mvc";
import { scanDocsDir, generateRouteMap, generateSidebar } from "@lark.js/docs";

const routes = scanDocsDir("docs", "/docs/");
const routeMap = generateRouteMap(routes);

Framework.boot({
  rootId: "app",
  routeMode: "history",
  routes: routeMap,
  defaultPath: "/docs/",
});
````

## Package Exports

| Sub-path                 | Description                                           |
| ------------------------ | ----------------------------------------------------- |
| `@lark.js/docs`          | Main API (scanner, route-map, sidebar, config, theme) |
| `@lark.js/docs/compiler` | Markdown-to-JS compiler                               |
| `@lark.js/docs/vite`     | Vite plugin for `.md` files                           |
| `@lark.js/docs/webpack`  | Webpack loader + plugin for `.md` files               |
| `@lark.js/docs/rspack`   | Rspack loader + plugin for `.md` files                |
| `@lark.js/docs/runtime`  | Lightweight runtime helpers (search, slugify)         |

## Icons

Theme views use [lucide-static](https://lucide.dev) for SVG icons, imported as raw strings via Vite's `?raw` suffix. Icons are centralized in `src/theme/icons.ts` and passed to the view's `updater.set()` in `init()` (not in `assign()`, since they are static data).

Templates render icons with the raw output operator `{{!}}`:

```html
<span class="h-5 w-5 [&>svg]:h-full [&>svg]:w-full"> {{!icons.search}} </span>
```

The wrapper `<span>` controls sizing. The Tailwind utilities `[&>svg]:w-full [&>svg]:h-full` force the child `<svg>` to fill the container. Icons inherit `currentColor` from their parent, so color is controlled via standard CSS utilities (e.g., `text-primary`).

Inline SVG is prohibited in all theme templates. All icons must come from `lucide-static` raw imports.

## Frontmatter

Each `.md` file can include YAML frontmatter:

```yaml
---
title: Page Title
description: Page description for SEO
sidebar_position: 1
sidebar_label: Custom Label
sidebar_group: Guide
draft: false
---
```

| Field              | Type      | Description                                              |
| ------------------ | --------- | -------------------------------------------------------- |
| `title`            | `string`  | Page title (falls back to first `# heading` or filename) |
| `description`      | `string`  | Page description for meta tags and search                |
| `sidebar_position` | `number`  | Sort order in sidebar (lower = higher)                   |
| `sidebar_label`    | `string`  | Override sidebar display text                            |
| `sidebar_group`    | `string`  | Sidebar group name                                       |
| `draft`            | `boolean` | Exclude from production builds                           |

## Markdown Extensions

### Admonition Containers

```markdown
::: tip
Useful advice.
:::

::: warning
Be careful.
:::

::: danger
Critical warning.
:::

::: details Click to expand
Hidden content.
:::
```

### Table of Contents

Insert `[[toc]]` anywhere in your markdown to render a table of contents.

### Heading Anchors

All h1-h3 headings automatically get anchor IDs and `#` permalink links.

### Internal Links

Links starting with `/` or `#` are automatically intercepted for SPA navigation via the lark-mvc Router.

## API Reference

### `defineConfig(config)`

Type-safe configuration helper. Returns the argument unchanged.

### `scanDocsDir(docsDir, baseUrl, options?)`

Recursively scan a docs directory and return route entries.

### `generateRouteMap(routes)`

Convert scanned routes to a lark-mvc `routes` config object.

### `generateSidebar(routes, prefix, baseUrl)`

Auto-generate sidebar items from scanned routes.

### `buildSearchIndex(routes)`

Build a search index from all docs routes.

### `compileMarkdown(source, options)`

Compile a `.md` source string into a JS module.

### `searchDocs(index, query, limit?)`

Client-side full-text search over the pre-built index.

### Theme View Factories

- `createDocsLayoutView(View, template)` -- main layout
- `createSidebarView(View, template)` -- sidebar navigation
- `createContentView(View, template)` -- content area
- `createTocView(View, template)` -- right-side heading outline
- `createSearchView(View, template)` -- search dialog

## License

ISC
