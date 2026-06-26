# Lark MVC naming conventions

This document records every identifier that crosses a module or layer boundary in lark-mvc. Each entry lists the producer (who emits the name), the consumer (who references it), and the rationale for why it exists. Changing any name here requires updating both sides simultaneously.

## Overview

Lark-mvc has three compilation layers that emit code referencing identifiers by name:

1. **Template compiler** (`compile-template.ts`, `compile-to-vdom-function.ts`) emits ES module source from `.html` files
2. **HMR injector** (`hmr-inject.ts`) emits HMR snippet strings appended to compiled output
3. **Build plugins** (`vite.ts`, `webpack.ts`, `rspack.ts`) wire the compiler and injector into bundler hooks

The runtime framework (`frame.ts`, `view.ts`, `updater.ts`, `hmr.ts`) exports functions that the compiled code calls. Every name below is a contract between at least two of these layers.

## `__lark` prefixed identifiers

All identifiers prefixed with `__lark` appear in generated code (compiled templates or HMR snippets). The double underscore signals "framework internal, do not collide with user code."

### `__larkTemplate`

| Field    | Value                                                                                |
| -------- | ------------------------------------------------------------------------------------ |
| Producer | `compile-template.ts` emits `function __larkTemplate(data, viewId, refData) { ... }` |
| Consumer | `hmr-inject.ts` references it via `TEMPLATE_VAR` in the dispose callback             |
| Constant | `const TEMPLATE_VAR = "__larkTemplate"` in `hmr-inject.ts`                           |
| Purpose  | Lets the HMR dispose callback capture the old template function reference by name    |

The compiler emits a named function declaration (not anonymous) so the HMR snippet can write `__larkData.oldTemplate = __larkTemplate` to save the current function reference before module replacement. An anonymous `export default function(...)` would have no name to reference.

### `__larkViewDefault`

| Field    | Value                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Producer | `hmr-inject.ts` `injectViewHmr` rewrites `export default defineView(...)` (or `View.extend(...)`) to `const __larkViewDefault = defineView(...)` |
| Consumer | `hmr-inject.ts` view class HMR snippet references it via `VIEW_VAR`                                                                              |
| Constant | `const VIEW_VAR = "__larkViewDefault"` in `hmr-inject.ts` (defined in both `getViewHmrSnippet` and `injectViewHmr`)                              |
| Purpose  | Lets the HMR dispose callback capture the old View class reference                                                                               |

### `__larkEncHtml`, `__larkStrSafe`, `__larkEncUri`, `__larkEncQuote`, `__larkRefFn`

| Field          | Value                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------- |
| Producer       | `compile-template.ts` emits import statements with these aliases                         |
| Consumer       | `compile-template.ts` outer wrapper passes them as arguments to the inner arrow function |
| Source module  | `@lark.js/mvc/runtime`                                                                   |
| Actual exports | `encHtml`, `strSafe`, `encUri`, `encQuote`, `refFn`                                      |

These are the five runtime helpers that compiled templates import from `@lark.js/mvc/runtime` rather than inlining. The `__lark` prefix avoids collisions with user-defined variables in the template scope. Both string mode and VDOM mode import them (VDOM mode omits `__larkEncHtml` since VDOM text nodes use `createTextNode`).

### `__larkVdomCreate`

| Field         | Value                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| Producer      | `compile-template.ts` VDOM mode emits `import { vdomCreate as __larkVdomCreate } from "@lark.js/mvc"` |
| Consumer      | `compile-template.ts` VDOM wrapper assigns it to local `$vdomCreate`                                  |
| Source module | `@lark.js/mvc` (main entry, not runtime)                                                              |
| Actual export | `vdomCreate`                                                                                          |

Only VDOM mode emits this import. String mode does not need it.

### `__larkData`

| Field    | Value                                                                                |
| -------- | ------------------------------------------------------------------------------------ |
| Producer | `hmr-inject.ts` snippet uses it as the dispose callback parameter name               |
| Consumer | `hmr-inject.ts` snippet writes `__larkData.oldTemplate` or `__larkData.oldClass`     |
| Purpose  | The `hot.data` object that persists from dispose to accept within a single HMR cycle |

### `__larkNewModule`

| Field    | Value                                                                              |
| -------- | ---------------------------------------------------------------------------------- |
| Producer | `hmr-inject.ts` Vite snippet uses it as the accept callback parameter name         |
| Consumer | `hmr-inject.ts` Vite snippet reads `__larkNewModule.default`                       |
| Note     | Vite only. Webpack/Rspack accept callbacks do not receive the new module namespace |

### `__larkNew`, `__larkOld`

| Field    | Value                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------- |
| Producer | `hmr-inject.ts` snippet declares them as local `var`                                                                |
| Consumer | `hmr-inject.ts` snippet compares `__larkOld !== __larkNew` and passes them to `hotSwapByTemplate` / `hotSwapByView` |

## `hot.data` keys

These are property names written on the `hot.data` object in the dispose callback and read in the accept callback. They persist across a single HMR cycle within the same module.

### `oldTemplate`

| Field   | Value                                                                                |
| ------- | ------------------------------------------------------------------------------------ |
| Writer  | dispose callback: `__larkData.oldTemplate = __larkTemplate`                          |
| Reader  | accept callback: `import.meta.hot.data.oldTemplate` or `module.hot.data.oldTemplate` |
| Used in | Template HMR snippet                                                                 |

### `oldClass`

| Field   | Value                                                                          |
| ------- | ------------------------------------------------------------------------------ |
| Writer  | dispose callback: `__larkData.oldClass = __larkViewDefault`                    |
| Reader  | accept callback: `import.meta.hot.data.oldClass` or `module.hot.data.oldClass` |
| Used in | View class HMR snippet                                                         |

## Framework function names called from generated code

These functions are called via dynamic `import("@lark.js/mvc").then(m => m.fn(...))` inside HMR snippets. They must be exported from the main entry (`index.ts`).

### `hotSwapByTemplate`

| Field            | Value                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| Producer         | `hmr.ts` exports it                                                    |
| Consumer         | Template HMR snippet calls `m.hotSwapByTemplate(__larkOld, __larkNew)` |
| Re-exported from | `index.ts`                                                             |

### `hotSwapByView`

| Field            | Value                                                                |
| ---------------- | -------------------------------------------------------------------- |
| Producer         | `hmr.ts` exports it                                                  |
| Consumer         | View class HMR snippet calls `m.hotSwapByView(__larkOld, __larkNew)` |
| Re-exported from | `index.ts`                                                           |

## Module path contracts

### `@lark.js/mvc`

| Field                              | Value                                                                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Consumers                          | Compiled VDOM templates import `vdomCreate`. HMR snippets dynamically `import("@lark.js/mvc")` to call `hotSwapByTemplate` / `hotSwapByView` |
| Exports required by generated code | `vdomCreate`, `hotSwapByTemplate`, `hotSwapByView`                                                                                           |

### `@lark.js/mvc/runtime`

| Field                              | Value                                                                |
| ---------------------------------- | -------------------------------------------------------------------- |
| Consumers                          | All compiled templates (string and VDOM mode) import runtime helpers |
| Exports required by generated code | `encHtml`, `strSafe`, `encUri`, `encQuote`, `refFn`                  |

## Compiled template inner function parameters

The inner arrow function signature is a contract between `compileToFunction` / `compileToVDomFunction` (which emit the body) and `compileTemplate` (which emits the wrapper that calls it).

### String mode (8 parameters)

```
($data, $viewId, $refAlt, $encHtml, $strSafe, $encUri, $refFn, $encQuote) => { ... }
```

### VDOM mode (7 parameters, no `$encHtml`)

```
($data, $viewId, $refAlt, $strSafe, $refFn, $encUri, $encQuote) => { ... }
```

The wrapper passes arguments in this exact order. The `$` prefix prevents collisions with user template variables (which are declared without `$` via the `{{VARS}}` mechanism).

## Compiled template inner function locals

| Name                              | Mode              | Purpose                                                     |
| --------------------------------- | ----------------- | ----------------------------------------------------------- |
| `$out`                            | Both              | HTML output string accumulator                              |
| `$splitter`                       | Both              | `'\x1e'` (SPLITTER character), used as namespace separator  |
| `$tmp`                            | Both              | Temporary scratch variable                                  |
| `$vdomCreate`                     | VDOM              | Alias for `__larkVdomCreate`, used in `$vdomCreate()` calls |
| `$v0`, `$v1`, ..., `$vN`          | VDOM              | Child node arrays, allocated on demand                      |
| `__p0`, `__p1`, ..., `__pN`       | VDOM              | Props objects for `$vdomCreate(tag, props, children)` calls |
| `$dbgExpr`, `$dbgArt`, `$dbgLine` | Both (debug only) | Error reporting: expression, art-template name, line number |

The `$vN` variables are declared on demand (no fixed cap). The `__pN` variables use a `__` prefix (not `$`) to distinguish props objects from node arrays.

## Compiled template global variable declarations

The `{{VARS}}` placeholder in the compiled function body is replaced with variable declarations extracted from the template source by `extractGlobalVars`:

```
,varName=$data.varName
```

Each global variable used in the template (e.g., `{{=count}}`) becomes a local destructured from `$data`. The names match the template variable names exactly (no prefix), which is why inner function params use `$` prefixes to avoid collisions.

## Control characters

### `\x1e` (SPLITTER, U+001E)

| Field            | Value                                                               |
| ---------------- | ------------------------------------------------------------------- |
| Constant         | `export const SPLITTER = String.fromCharCode(0x1e)` in `common.ts`  |
| Used as          | Namespace separator in refData keys, raw HTML node tag in VDOM mode |
| In compiled code | `let $splitter='\x1e'`                                              |

### `\x1f` (VIEW_ID_PLACEHOLDER, U+001F)

| Field                    | Value                                                                    |
| ------------------------ | ------------------------------------------------------------------------ |
| Used as                  | View ID placeholder in compiled template output                          |
| Replaced at compile time | `\x1f` in the compiled string is replaced with `'+$viewId+'`             |
| In event attributes      | `@click="\x1f\x1ehandlerName()"` prefix marks the event binding boundary |

## Vite plugin query suffix

### `?lark-template`

| Field    | Value                                                                                                 |
| -------- | ----------------------------------------------------------------------------------------------------- |
| Constant | `const LARK_TEMPLATE_SUFFIX = "?lark-template"` in `vite.ts`                                          |
| Producer | `resolveId` hook appends it to resolved `.html` import IDs                                            |
| Consumer | `load` hook checks `query.split("&").includes("lark-template")` to identify compiled template modules |

Vite may add `?import` or other queries before our suffix, producing `?import&lark-template`. The load hook uses `includes` rather than `endsWith` for this reason.

## Template attribute and syntax

### `v-lark` (LARK_VIEW)

| Field       | Value                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| Constant    | `export const LARK_VIEW = "v-lark"` in `common.ts`                                                                 |
| Used in     | `.html` templates to embed sub-views: `<div v-lark="components/child"></div>`                                      |
| Consumed by | `frame.ts` `mountZone` does `querySelectorAll("[v-lark]")`, `dom.ts` and `vdom.ts` check the attribute during diff |

### `@` event prefix

Templates use `@click="handlerName()"` syntax. The compiler's `processViewEvents` transforms this into `\x1f\x1ehandlerName(...)` internal format. At runtime, the `EventDelegator` resolves the handler name by looking it up on the View prototype.

### Template operators

| Syntax                       | Operator | Purpose                                |
| ---------------------------- | -------- | -------------------------------------- |
| `{{=expr}}`                  | `=`      | HTML-escaped output                    |
| `{{!expr}}`                  | `!`      | Raw HTML output (no escaping)          |
| `{{@expr}}`                  | `@`      | RefData lookup                         |
| `{{:expr}}`                  | `:`      | Two-way binding (rendered same as `=`) |
| `{{if cond}}`                |          | Conditional block                      |
| `{{else}}`                   |          | Else branch                            |
| `{{/if}}`                    |          | Close conditional                      |
| `{{forOf list as item idx}}` |          | Loop over iterable                     |
| `{{/forOf}}`                 |          | Close loop                             |

## View context event storage

In the functional API, event handlers are stored in the `events` map returned by the setup function, not on a prototype. The map is accessed via `ctx.getEvents()` / `ctx.setEvents()`.

| Name       | Type                      | Set by           | Read by                            |
| ---------- | ------------------------- | ---------------- | ---------------------------------- |
| `events`   | `Record<string, AnyFunc>` | `mountCtx`       | `registerEvents`, `EventDelegator` |
| `cleanups` | `Array<() => void>`       | `useEffect` hook | `unmountCtx`, `hotSwapView`        |
| `assign`   | `(options?) => boolean`   | `mountCtx`       | Framework `endUpdate` cycle        |

Event handler keys use the original `"name<eventType>"` format (e.g. `"navigateTo<click>"`). The `EventDelegator` looks up handlers by this key via `ctx.getEvents()[key]` at event dispatch time.

## Naming convention summary

| Prefix          | Scope                                             | Meaning                                                                |
| --------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| `__lark`        | Generated code (compiled templates, HMR snippets) | Framework internal identifier crossing module boundaries               |
| `__p`           | VDOM compiled code                                | Props object for a `$vdomCreate` call                                  |
| `$`             | Compiled template inner function                  | Parameter or local variable (avoids collision with user template vars) |
| `$v`            | VDOM compiled code                                | Child node array variable                                              |
| `$` (prototype) | View prototype                                    | Event map or wrapped method (avoids collision with user methods)       |

User template variables (from `{{=varName}}`) are declared without any prefix, directly destructured from `$data`. This is safe because all framework-internal names in the compiled function scope use `$` or `__` prefixes.
