# Migrate to TypeScript and Modernize Build Pipeline

## Overview

This PR migrates the `marked-terminal` codebase from plain JavaScript to TypeScript, restructures the build output into a dedicated `dist/` directory, upgrades the `marked` peer dependency to v17–v18, and refreshes all runtime and development dependencies.

---

## 1. TypeScript Migration

- **`index.js` → `index.ts`** (680 lines removed, 760 lines added)
  - Full rewrite in TypeScript with `strict: true` and `exactOptionalPropertyTypes: true`.
  - Exported a public `TerminalRendererOptions` interface with typed configuration for every renderer option (`code`, `heading`, `table`, `link`, etc.).
  - Imported marked's official token types (`Tokens.Text`, `Tokens.Escape`, `Tokens.Heading`, `Tokens.Table`, `Tokens.Code`, `Tokens.List`, `Tokens.Blockquote`, `Tokens.Strong`, `Tokens.Em`, `Tokens.Del`, `Tokens.Link`, `Tokens.Image`, `Tokens.HTML`, `Tokens.Hr`, `Tokens.Br`, `Tokens.Codespan`, `Tokens.Checkbox`, `Tokens.Space`, `Tokens.Paragraph`) for method signatures.
  - Used `MarkedExtension`, `MarkedOptions`, `RendererObject`, `Parser` from the `marked` package.
  - Applied `verbatimModuleSyntax: true` and `isolatedModules: true` for modern ESM/CJS interop.
  - Internal helpers (`compose`, `identity`, `unescapeEntities`, `insertEmojis`, etc.) carry full type annotations.

- **`tsconfig.json`** (new file)
  - `module: "nodenext"`, `target: "esnext"`, `lib: ["esnext"]`.
  - `outDir: "./dist"` with `declaration`, `declarationMap`, and `sourceMap` all enabled.
  - Scoped to `["index.ts"]` via `include`.

---

## 2. Build System

- **`rollup.config.js`** — completely restructured:
  - Input changed from `index.js` to `index.ts`.
  - Added `@rollup/plugin-typescript` to compile TypeScript and emit declaration files.
  - Now produces dual output:
    - `dist/index.js` — ES module format
    - `dist/index.cjs` — CommonJS format with `exports: 'named'` (previously `exports: 'auto'`, which triggered a mixed-exports warning).
  - Output moved from repository root into `dist/`.
  - Fixed typo in external list: `highlight-cli` → `cli-highlight`.
  - Expanded external dependencies to include all runtime deps: `chalk`, `cli-table3`, `cli-highlight`, `node-emoji`, `supports-hyperlinks`, `ansi-escapes`, `ansi-regex`, `marked`, plus `node:process`, `node:tty`, `node:os`.

- **`.gitignore`**
  - Changed from ignoring individual `index.cjs` to ignoring the entire `dist/` directory.

---

## 3. Package Configuration (`package.json`)

### Entry Points and Exports

| Field                  | Before                  | After                        |
| ---------------------- | ----------------------- | ---------------------------- |
| `main`                 | `./index.cjs`           | `./dist/index.cjs`           |
| `browser`              | `./index.js`            | `./dist/index.js`            |
| `types`                | _(none)_                | `./dist/index.d.ts`          |
| `exports.node.import`  | `./index.js`            | `./dist/index.js`            |
| `exports.node.require` | `./index.cjs`           | `./dist/index.cjs`           |
| `exports.node.types`   | _(none)_                | `./dist/index.d.ts`          |
| `exports.default`      | `"./index.js"` (string) | `{ types, import }` (object) |

- `files` simplified from `["./index.js", "./index.cjs"]` to `["dist"]`.

### Scripts

- `test` now runs `npm run build` before mocha, ensuring tests run against the compiled output.

### Peer Dependencies (Breaking Change)

- `marked`: `>=1 <17` → `>17 <=18`. This drops support for marked v1 through v16 and requires v17 or v18.

### Runtime Dependencies

| Package               | Before    | After                 |
| --------------------- | --------- | --------------------- |
| `ansi-escapes`        | `^7.0.0`  | `^7.3.0`              |
| `ansi-regex`          | `^6.1.0`  | `^6.2.2`              |
| `chalk`               | `^5.4.1`  | `^5.6.2`              |
| `supports-hyperlinks` | `^3.1.0`  | `^4.5.0`              |
| `cli-highlight`       | `^2.1.11` | `^2.1.11` (unchanged) |
| `cli-table3`          | `^0.6.5`  | `^0.6.5` (unchanged)  |
| `node-emoji`          | `^2.2.0`  | `^2.2.0` (unchanged)  |

### Dev Dependencies

| Package                       | Change                |
| ----------------------------- | --------------------- |
| `@rollup/plugin-typescript`   | `^12.3.0` (new)       |
| `@types/node`                 | `^26.0.1` (new)       |
| `tslib`                       | `^2.8.1` (new)        |
| `typescript`                  | `^6.0.3` (new)        |
| `marked`                      | `^16.0.0` → `^18.0.5` |
| `@rollup/plugin-commonjs`     | `^28.0.2` (unchanged) |
| `@rollup/plugin-node-resolve` | `^16.0.0` (unchanged) |
| `cross-env`                   | `^7.0.3` (unchanged)  |
| `mocha`                       | `^11.0.1` (unchanged) |
| `rollup`                      | `^4.29.1` (unchanged) |

---

## 4. Test Suite Updates

All 7 test files updated their import paths from `../index.js` to `../dist/index.js`:

- `tests/e2e.js`
- `tests/markedTerminal-e2e.js`
- `tests/markedTerminal-options.js`
- `tests/markedTerminal-usage.js`
- `tests/options.js`
- `tests/termesc.js`
- `tests/usage.js`

No test logic was modified — only the import target changed to point at the compiled output.

---

## 5. Code Simplification: `table()` Method

The `table()` method was refactored from ~35 lines of manual string serialization to 18 lines of direct array construction:

**Before** (origin/master):

- Iterated header cells, concatenated with `TABLE_CELL_SPLIT` delimiter.
- Wrapped each row with `TABLE_ROW_WRAP` markers via `tablerow()`.
- Assembled a single string, then parsed it back into arrays via `generateTableRow()`.

**After** (this PR):

- Maps `token.header` cells directly to parsed inline tokens.
- Maps each `token.rows` row to an array of transformed inline tokens.
- Pushes arrays directly into `cli-table3`.

Both approaches apply `this.transform` to body cells and skip it for header cells — behavior is preserved.

---

## 6. Build Artifacts

The build produces the following files in `dist/`:

| File         | Description                 |
| ------------ | --------------------------- |
| `index.js`   | ES module output            |
| `index.cjs`  | CommonJS output             |
| `index.d.ts` | TypeScript declaration file |

---

## Breaking Changes

1. **`marked` peer dependency** bumped from `>=1 <17` to `>17 <=18`. Consumers on marked v1–v16 must upgrade.
2. **Import paths** for anyone importing source files directly (not from npm) have moved to `dist/`.

---

## Version Number Not Updated

The `package.json` version remains at `7.3.0`. Given the breaking nature of the `marked` peer dependency change (`>=1 <17` → `>17 <=18`), a major version bump (e.g., `8.0.0`) should be applied before publishing, following semantic versioning conventions.
