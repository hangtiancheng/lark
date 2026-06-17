# Lark MVC - VS Code Extension

A VS Code extension for developers working with the Lark MVC framework (`@lark.js/mvc`). It provides go-to-definition, intelligent autocompletion, syntax highlighting, template folding, image hover previews, and utility commands to streamline day-to-day development.

## Table of Contents

- [Installation](#installation)
- [Activation and Project Detection](#activation-and-project-detection)
- [Features](#features)
  - [Go-to-Definition](#go-to-definition)
  - [Autocompletion](#autocompletion)
  - [Syntax Highlighting](#syntax-highlighting)
  - [Template Folding](#template-folding)
  - [Image Hover Preview](#image-hover-preview)
  - [Status Bar Shortcuts](#status-bar-shortcuts)
- [Commands](#commands)
- [Configuration](#configuration)
- [Output Logs](#output-logs)
- [Architecture](#architecture)
- [Development](#development)
- [Dependencies](#dependencies)
- [License](#license)

## Installation

Build from source and install the packaged `.vsix`:

```bash
pnpm build
pnpm package
code --install-extension lark-vscode-0.0.1.vsix
```

Or use the included script shortcut after packaging:

```bash
pnpm code
```

## Activation and Project Detection

The extension activates when the workspace contains any `package.json` file (`workspaceContains:**/package.json`).

Once activated, it determines whether the workspace is a Lark project through a two-step detection process:

1. Checks whether `package.json` lists `@lark.js/mvc` under `dependencies` or `devDependencies`.
2. If step 1 does not match, scans bundler configuration files (`vite.config.*`, `webpack.config.*`) for references to `larkMvcPlugin` or `larkMvcLoader`.

When detection succeeds the extension sets the context key `vs-lark:isLark`. All Lark-specific features (definition, completion, folding, copy view path) are gated behind this context and remain inactive in non-Lark workspaces.

## Features

### Go-to-Definition

Cmd+Click (macOS) or Ctrl+Click (Windows/Linux) to jump to the precise source location.

In HTML templates:

- `v-lark="components/child"` resolves to `src/components/child.ts`, `.js`, or `.html` under the workspace root.
- `@click="handlerName(...)"` jumps to the method definition in the paired TypeScript file. Methods following the Lark naming convention `"handlerName<click>"` are matched first; plain `handlerName` is used as a fallback.

In TypeScript/JavaScript files:

- `import template from "./home.html"` jumps to the referenced HTML template file.

Jump targets include exact line and column positions, computed from byte offsets in the SWC AST.

### Autocompletion

Event type suggestions:

When you type `@` inside an HTML template, the extension offers all 22 supported DOM event types as completion items with snippet insertion:

```
click, dblclick, change, input, submit,
focus, blur, keyup, keydown, keypress,
mouseenter, mouseleave, mouseover, mouseout, mousedown,
mouseup, scroll, wheel, contextmenu, touchstart,
touchend, touchmove
```

Selecting an item inserts the full attribute pattern, e.g. `@click="$1()"`.

Handler method suggestions:

After typing `@eventType="`, the extension parses the paired View TypeScript file and presents all available method names. Methods that use the `<eventType>` suffix convention are displayed without the suffix for readability.

Template variable suggestions:

Inside `{{= }}` expressions, the extension offers variable names extracted from the template context through `@lark.js/mvc`'s `extractGlobalVars` utility.

### Syntax Highlighting

A TextMate grammar (`text.html.lark-template`) is injected into `text.html.basic`, providing highlighting for:

- Output expressions: `{{=expr}}`, `{{!expr}}`, `{{@expr}}`, `{{:expr}}`
- Control flow: `{{if ...}}`, `{{else if ...}}`, `{{else}}`, `{{/if}}`
- Loops: `{{forOf list as item idx}}...{{/forOf}}`, `{{forIn obj as val key}}...{{/forIn}}`, `{{for(...)}}...{{/for}}`
- Assignment: `{{set var = expr}}`
- Comment blocks: `{{!-- comment --}}`
- Event binding attributes: `@click="handler()"`
- Sub-view directives: `v-lark="path"`
- Optimization attributes: `ldk`, `lak`, `lvk`

### Template Folding

The extension provides folding ranges for Lark template control-flow blocks. A stack-based algorithm correctly handles arbitrary nesting depth:

- `{{if ...}}` / `{{/if}}`
- `{{forOf ...}}` / `{{/forOf}}`
- `{{forIn ...}}` / `{{/forIn}}`
- `{{for(...)}}` / `{{/for}}`

### Image Hover Preview

Hovering over an image path in any file displays an inline preview of the image. This feature works in all projects regardless of whether the workspace is a Lark project.

Supported formats: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.bmp`, `.ico`

Supported path types:

- Absolute URLs: `https://example.com/logo.png`
- Relative paths: `./assets/icon.png`

### Status Bar Shortcuts

Custom shortcut buttons appear in the status bar. Clicking a shortcut opens its configured URL in the default browser. Buttons update in real time when the configuration changes.

## Commands

| Command             | Title                | Context Menu | Condition          |
| ------------------- | -------------------- | ------------ | ------------------ |
| `lark.copyViewPath` | Lark: Copy View Path | Yes          | Lark projects only |
| `lark.openInGithub` | Lark: Open in GitHub | Yes          | All projects       |

Copy View Path:

Copies the current file path formatted for use in `v-lark` directives. The transformation strips the `src/` prefix and removes the file extension:

```
src/views/home.ts           -> views/home
src/components/counter.html -> components/counter
```

Open in GitHub:

Opens the current file (or directory) in the browser on GitHub. The extension reads the git remote URL (SSH and HTTPS formats are both supported) and the current branch name to construct the correct link. Files open as `blob` links; directories open as `tree` links.

## Configuration

All settings live under the `lark` namespace in VS Code settings.

### lark.statusBar.shortcuts

Type: `Array<{ name: string; url: string }>`
Default: `[]`

Defines status bar shortcut buttons. Each entry must include a display `name` and a target `url`. The schema is validated at runtime with zod.

Example (`settings.json`):

```json
{
  "lark.statusBar.shortcuts": [
    { "name": "Wiki", "url": "https://wiki.example.com" },
    { "name": "CI/CD", "url": "https://ci.example.com" }
  ]
}
```

## Output Logs

Runtime diagnostics are written to the VS Code Output panel under the channel name "Lark MVC". To view logs:

1. Open the bottom panel (Cmd+J / Ctrl+J).
2. Switch to the Output tab.
3. Select "Lark MVC" from the channel dropdown.

Logs include: activation status, project detection results, file index counts, file change events, SWC parser loading, definition resolution steps, and error details.

## Architecture

```
src/
  extension.ts                  Entry point (activate/deactivate)
  activation.ts                 Lark project detection (git ls-files + fallback scan)
  logger.ts                     Output channel logger
  model/
    method-info.ts              Method metadata type
    view-file-info.ts           View file mapping type
  analyzer/
    view-analyzer.ts            SWC-based parser for View.extend() / defineView() methods
    template-analyzer.ts        Extracts events, v-lark refs, and template variables
  cache/
    view-file-cache.ts          Bidirectional HTML <-> TS file mapping
    view-method-cache.ts        LRU cache (max 500 entries) with mtime-based invalidation
  provider/
    completion-provider.ts      Event type and handler method completions
    definition-provider.ts      Go-to-definition for v-lark, @event, and template imports
    folding-range-provider.ts   Stack-based folding for template control-flow blocks
    hover-provider.ts           Image path hover preview (local + remote)
  command/
    copy-view-path-command.ts   Copies stripped view path to clipboard
    open-in-github-command.ts   Opens file/directory in GitHub
  status-bar/
    status-bar-manager.ts       Manages configurable shortcut buttons
  watcher/
    file-watcher.ts             File system watchers for cache invalidation
syntaxes/
  lark-template.tmLanguage.json TextMate grammar injection into HTML
```

### Key Design Decisions

- SWC is loaded lazily at runtime to avoid slowing extension startup.
- The view method cache uses an LRU eviction strategy (500 entries max) and checks file mtime before returning cached results, ensuring stale data is never served after edits.
- The view file cache maintains a bidirectional mapping between HTML templates and their paired TypeScript/JavaScript files, enabling instant lookups in either direction.
- File watchers invalidate relevant cache entries on create, rename, and delete events.

## Development

Prerequisites: Node.js, pnpm

```bash
# Install dependencies
pnpm install

# Build once
pnpm build

# Watch mode (rebuild on change)
pnpm watch

# Type-check without emitting
pnpm lint

# Package .vsix for distribution
pnpm package

# Install the packaged extension locally
pnpm code
```

The build is handled by tsup. Packaging uses `@vscode/vsce` with `--no-dependencies` since all runtime dependencies are bundled.

## Dependencies

Runtime:

- `@lark.js/mvc` -- provides `extractGlobalVars` for template variable extraction
- `zod` -- runtime validation of configuration schemas

Development / Build:

- `@swc/core` -- AST parsing for TypeScript View files (bundled into the extension via a copy script)
- `tsup` -- bundler
- `@vscode/vsce` -- extension packaging
- `typescript` -- type checking

Engine requirement: VS Code ^1.120.0

## License

MIT
