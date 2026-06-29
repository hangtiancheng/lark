/**
 * HMR injection code generator — shared across Vite, Webpack, and Rspack.
 *
 * ## Why this file exists
 *
 * React's `@vitejs/plugin-react` and Vue's `@vitejs/plugin-vue` auto-inject
 * HMR boilerplate at compile time so users never write `import.meta.hot`
 * themselves. Lark's `larkMvcPlugin` / `larkMvcLoader` previously did NOT
 * inject any HMR code, forcing users to manually call `acceptView()` /
 * `disposeView()` in every view file — a poor DX.
 *
 * This module generates the HMR snippet strings that the three bundler
 * integrations (vite.ts, webpack.ts, rspack.ts) append to compiled output.
 * Extracting the logic here keeps the three plugin files DRY and makes the
 * cross-bundler differences (Vite's `import.meta.hot` vs Webpack/Rspack's
 * `module.hot`) explicit and testable.
 *
 * ## Two injection targets
 *
 * 1. **Template module** (compiled from `.html`): self-accepts. When the
 *    `.html` changes, the accept callback calls `hotSwapByTemplate(old, new)`
 *    to update the template on all mounted views — preserving state.
 *
 * 2. **View class module** (`.ts` file that imports `.html`): self-accepts.
 *    When the `.ts` changes, the accept callback calls
 *    `hotSwapByView(old, new)` to swap the setup function on all mounted
 *    instances — preserving state.
 *
 * ## Cross-bundler HMR API differences
 *
 * | Bundler        | HMR context         | accept cb receives new module? |
 * |----------------|------------------------------------------------------|
 * | Vite           | `import.meta.hot`   | Yes (`newModule.default`)      |
 * | Webpack (CJS)  | `module.hot`        | No (module already re-executed)|
 * | Rspack         | `module.hot`        | No (module already re-executed)|
 *
 * In Vite, the accept callback runs in the OLD module's scope, so local
 * variables are from the old module. In Webpack/Rspack, the callback runs
 * in the NEW module's scope (the module has already re-executed), so local
 * variables are from the new module. The snippets below account for this.
 */

// ============================================================
// Types
// ============================================================

/** Supported bundler identifiers. */
export type Bundler = "vite" | "webpack" | "rspack";

// ============================================================
// Template HMR injection
// ============================================================

/**
 * The named export identifier that `compileTemplate` uses for the template
 * function. The HMR snippet references this by name.
 */
const TEMPLATE_VAR = "__larkTemplate";

/**
 * Generate the HMR snippet for a compiled template module.
 *
 * The snippet assumes the module has a named function `__larkTemplate` (set
 * by `compileTemplate`) and a default export pointing to it. It:
 * 1. On `dispose`: saves the current `__larkTemplate` reference into
 *    `hot.data` so the accept callback can retrieve the OLD function.
 * 2. On `accept`: determines the NEW template function, then calls
 *    `hotSwapByTemplate(old, new)` to update all mounted views.
 *
 * Access to the framework's HMR swap functions is via `globalThis.__LARK_HMR__`
 * (registered by ./hmr.ts at module-load time), NOT via import/require of
 * "@lark.js/mvc". Under Module Federation (`@lark.js/mvc` shared singleton),
 * ANY import/require of @lark.js/mvc inside the accept callback registers the
 * calling module as a shared consumer, which causes webpack to mark the main
 * chunk (shared-scope initializer) as needing a hot-update. Since main's code
 * didn't actually change, no main.<hash>.hot-update.js is emitted →
 * `ChunkLoadError: Loading hot update chunk main failed` → accept callback
 * never runs → UI never updates. globalThis sidesteps all module resolution.
 *
 * In production builds, the entire `if` block is dead code (the HMR API is
 * undefined) and gets tree-shaken.
 */
function getTemplateHmrSnippet(bundler: Bundler): string {
  if (bundler === "vite") {
    return `
// ── Lark template HMR (auto-injected by larkMvcPlugin — Vite) ──
if (import.meta.hot) {
  import.meta.hot.dispose(function(__larkData) {
    __larkData.oldTemplate = ${TEMPLATE_VAR};
  });
  import.meta.hot.accept(function(__larkNewModule) {
    var __larkNew = __larkNewModule && __larkNewModule.default;
    var __larkOld = import.meta.hot.data && import.meta.hot.data.oldTemplate;
    if (__larkOld && __larkNew && __larkOld !== __larkNew) {
      var __hmr = globalThis.__LARK_HMR__;
      if (__hmr && __hmr.hotSwapByTemplate) __hmr.hotSwapByTemplate(__larkOld, __larkNew);
    }
  });
}
`;
  }

  // Webpack / Rspack: module.hot
  // The accept callback does NOT receive the new module namespace — the
  // module has already re-executed by the time the callback runs, so
  // `__larkTemplate` in the callback scope IS the new function.
  //
  // HMR swap functions are accessed via globalThis.__LARK_HMR__ (registered
  // by ./hmr.ts) rather than import/require("@lark.js/mvc"): under Module
  // Federation (shared singleton), ANY reference to @lark.js/mvc inside the
  // accept callback registers the template module as a shared consumer,
  // which causes webpack to mark the main chunk (shared-scope initializer)
  // as needing a hot-update — but since main didn't actually change, no
  // .hot-update.js is emitted, producing ChunkLoadError. globalThis avoids
  // all module-resolution / chunk-graph side effects. See the
  // getTemplateHmrSnippet doc comment above for the full rationale.
  return `
// ── Lark template HMR (auto-injected by larkMvcPlugin — ${bundler}) ──
if (typeof module !== "undefined" && module.hot) {
  module.hot.dispose(function(__larkData) {
    __larkData.oldTemplate = ${TEMPLATE_VAR};
  });
  module.hot.accept(function() {
    var __larkNew = ${TEMPLATE_VAR};
    var __larkOld = module.hot && module.hot.data && module.hot.data.oldTemplate;
    if (__larkOld && __larkNew && __larkOld !== __larkNew) {
      var __hmr = globalThis.__LARK_HMR__;
      var __swapped = false;
      if (__hmr && __hmr.hotSwapByTemplate) __swapped = __hmr.hotSwapByTemplate(__larkOld, __larkNew);
      // Fallback: if no mounted view matched oldTemplate (HMR state corrupted
      // by a prior ChunkLoadError on the main chunk), full-reload to reset.
      if (!__swapped && typeof globalThis !== "undefined" && globalThis.location) globalThis.location.reload();
    }
  });
}
`;
}

/**
 * Append HMR code to a compiled template module source.
 *
 * Called by the Vite `load` hook and the Webpack/Rspack loader after
 * `compileTemplate` returns. The `bundler` parameter selects the correct
 * HMR API (`import.meta.hot` for Vite, `module.hot` for Webpack/Rspack).
 *
 * @param source - The compiled template module source from `compileTemplate`
 * @param bundler - Which bundler's HMR API to use
 * @returns The source with HMR accept/dispose code appended
 */
export function injectTemplateHmrSnippet(source: string, bundler: Bundler): string {
  return source + "\n" + getTemplateHmrSnippet(bundler);
}

// ============================================================
// View class HMR injection (for .ts files)
// ============================================================

/**
 * Generate the HMR snippet for a view `.ts` module.
 *
 * This snippet references `__larkViewDefault`, which must be a named const
 * holding the View class. The `transformViewClassSource` function (below)
 * rewrites `export default defineView(...)` into
 * `const __larkViewDefault = defineView(...); export default __larkViewDefault;`
 * so that the HMR callback can capture the old class reference.
 */
function getViewHmrSnippet(bundler: Bundler): string {
  const VIEW_VAR = "__larkViewDefault";

  if (bundler === "vite") {
    return `
// ── Lark view class HMR (auto-injected by larkMvcPlugin — Vite) ──
if (import.meta.hot) {
  import.meta.hot.dispose(function(__larkData) {
    __larkData.oldClass = ${VIEW_VAR};
  });
  import.meta.hot.accept(function(__larkNewModule) {
    var __larkNew = __larkNewModule && __larkNewModule.default;
    var __larkOld = import.meta.hot.data && import.meta.hot.data.oldClass;
    if (__larkOld && __larkNew && __larkOld !== __larkNew) {
      var __hmr = globalThis.__LARK_HMR__;
      if (__hmr && __hmr.hotSwapByView) __hmr.hotSwapByView(__larkOld, __larkNew);
    }
  });
}
`;
  }

  // Webpack / Rspack — globalThis.__LARK_HMR__ access; see
  // getTemplateHmrSnippet above for the full rationale (any import/require
  // of @lark.js/mvc inside the accept callback registers the module as a
  // shared consumer → main chunk flagged for hot-update → ChunkLoadError).
  return `
// ── Lark view class HMR (auto-injected by larkMvcPlugin — ${bundler}) ──
if (typeof module !== "undefined" && module.hot) {
  module.hot.dispose(function(__larkData) {
    __larkData.oldClass = ${VIEW_VAR};
  });
  module.hot.accept(function() {
    var __larkNew = ${VIEW_VAR};
    var __larkOld = module.hot && module.hot.data && module.hot.data.oldClass;
    if (__larkOld && __larkNew && __larkOld !== __larkNew) {
      var __hmr = globalThis.__LARK_HMR__;
      var __swapped = false;
      if (__hmr && __hmr.hotSwapByView) __swapped = __hmr.hotSwapByView(__larkOld, __larkNew);
      // Fallback: if no mounted frame matched (HMR state corrupted by a prior
      // ChunkLoadError on the main chunk), full-reload to reset.
      if (!__swapped && globalThis.location) globalThis.location.reload();
    }
  });
}
`;
}

/** Regex to detect a `.html` import statement in a `.ts` source. */
const HTML_IMPORT_RE = /import\s+(?:template\s+from\s+|.*from\s+)?["'][^"']+\.html["']/;

/**
 * Quick check: does this `.ts` source import a `.html` template?
 *
 * Used by the plugin's `transform` hook to decide whether to inject view
 * class HMR. Files that don't import `.html` are left untouched.
 */
export function importsHtmlTemplate(source: string): boolean {
  return HTML_IMPORT_RE.test(source);
}

/**
 * Transform a `.ts` view file source to add view class HMR.
 *
 * Steps:
 * 1. Check if the source imports a `.html` template. If not, return as-is.
 * 2. Find the `export default` declaration (via @babel/parser AST).
 * 3. Rewrite it to a named const + export, so the HMR snippet can reference
 *    the View class by name (`__larkViewDefault`).
 * 4. Append the HMR snippet.
 *
 * If the source has no `export default`, or if parsing fails, the source is
 * returned unchanged (graceful degradation — the file just won't have HMR).
 *
 * @param source - The `.ts` source code
 * @param bundler - Which bundler's HMR API to use
 * @returns The transformed source with HMR code, or the original if ineligible
 */
export function injectViewHmr(source: string, bundler: Bundler): string {
  if (!importsHtmlTemplate(source)) return source;

  // Find `export default <expression>;` and rewrite to named const + export.
  // We use a regex for the common patterns; if it doesn't match, skip HMR
  // (the file might use a non-standard export pattern).
  //
  // Supported patterns:
  //   export default defineView(...);
  //   export default defineView({...});
  //   export default <anything>;
  //
  // We capture the expression after `export default` up to the line ending
  // with `);` or `};` or just `;`. This handles the vast majority of cases.
  // For multi-line expressions, we rely on the fact that `export default`
  // is almost always a single statement ending with `);` (from defineView() or
  // defineView()).
  const exportDefaultRe = /export\s+default\s+/;
  const match = exportDefaultRe.exec(source);
  if (!match) return source;

  // Find the end of the `export default <expr>` statement.
  // We look for the matching closing paren/brace by counting depth.
  const startIdx = match.index + match[0].length;
  const endIdx = findExpressionEnd(source, startIdx);
  if (endIdx === -1) return source;

  const expression = source.substring(startIdx, endIdx);
  const before = source.substring(0, match.index);
  const after = source.substring(endIdx);

  const VIEW_VAR = "__larkViewDefault";
  const transformed =
    before +
    `const ${VIEW_VAR} = ${expression};` +
    `\nexport default ${VIEW_VAR};` +
    after +
    "\n" +
    getViewHmrSnippet(bundler);

  return transformed;
}

/**
 * Find the end position (exclusive) of the expression in an
 * `export default <expression>` statement.
 *
 * Counts paren/brace/bracket depth starting from `startIdx` until depth
 * returns to zero AND a semicolon or newline-terminated statement boundary
 * is reached.
 *
 * Returns -1 if no valid boundary is found.
 */
function findExpressionEnd(source: string, startIdx: number): number {
  let depth = 0;
  let inString: string | null = null;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = startIdx; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    // Handle string/template/comment states
    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (ch === "\\") {
        i++; // skip escaped char
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }
    if (inTemplate) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === "`") inTemplate = false;
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }
    if (ch === "`") {
      inTemplate = true;
      continue;
    }

    // Track depth
    if (ch === "(" || ch === "{" || ch === "[") {
      depth++;
      continue;
    }
    if (ch === ")" || ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) {
        // Found the closing of the top-level expression.
        // Include the closing char and return the next position.
        return i + 1;
      }
      continue;
    }

    // If depth is 0 and we hit a semicolon, that's the end
    if (depth === 0 && ch === ";") {
      return i;
    }
  }

  return -1;
}
