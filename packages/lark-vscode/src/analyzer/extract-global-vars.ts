/**
 * Extract global variable names from a template source using SWC AST analysis.
 *
 * 1. Convert template commands ({{ }} blocks) into a form parseable by SWC
 * 2. Walk the AST to find all Identifier nodes
 * 3. Track variable declarations (VariableDeclarator, FunctionDeclaration) as local vars
 * 4. Track function parameters as local vars
 * 5. Remaining identifiers that are not local and not in the exclusion list are "global"
 */

import type {
  ArrowFunctionExpression,
  AssignmentExpression,
  CallExpression,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  MemberExpression,
  Module,
  Param,
  Pattern,
  VariableDeclarator,
  KeyValueProperty,
  MethodProperty,
} from "@swc/core";
import { logError } from "../logger.js";
import {
  convertArtSyntax,
  processViewEvents,
  protectComments,
  restoreComments,
} from "./template-syntax.js";

// ─── SWC parser (lazy-loaded, synchronous) ──────────────────────────────

type ParseSyncFn = typeof import("@swc/core").parseSync;
let parseSyncFn: ParseSyncFn | null = null;
let parseSyncLoadAttempted = false;

async function getParser(): Promise<ParseSyncFn | null> {
  if (!parseSyncLoadAttempted) {
    parseSyncLoadAttempted = true;
    try {
      const swc = await import("@swc/core");
      parseSyncFn = swc.parseSync;
    } catch (err) {
      // SWC native binding not available — extractGlobalVars will fall back to regex
      logError("Failed to load @swc/core", err);
    }
  }
  return parseSyncFn;
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Extract global variable names from a template source using AST analysis.
 *
 * 1. Convert template commands (<% %> blocks) into a form parseable by an AST parser
 * 2. Walk the AST to find all Identifier nodes
 * 3. Track variable declarations (VariableDeclarator, FunctionDeclaration) as local vars
 * 4. Track function parameters as local vars
 * 5. Remaining identifiers that are not local and not in the exclusion list are "global" —
 *    they must be passed in as part of the data context ($$)
 *
 * This replaces the old regex-based `extractVariables()` with proper scope analysis,
 * eliminating false positives from local template variables and function parameters.
 *
 * @param source - The raw HTML template content (with {{ }} syntax)
 * @returns Array of global variable names found in the template
 */

export async function extractGlobalVars(source: string): Promise<string[]> {
  // Step 1: Convert {{ }} art syntax to <% %> so we can analyze it
  // (reuse the same pipeline as compilation, but without debug markers)
  const { protectedSource, comments: _comments } = protectComments(source);
  const viewEventProcessed = processViewEvents(protectedSource);
  const converted = convertArtSyntax(viewEventProcessed, false);
  const template = restoreComments(converted, _comments);

  // Step 2: Convert <% %> template commands into a JS-parsable form
  //   - Replace HTML text between <% %> with unique placeholders
  //   - Keep the JS code from <% %> blocks
  //   - Wrap in backtick template literal for parsing
  const templateCmdRegExp = /<%([@=!:])?([\s\S]*?)%>|$/g;
  const fnParts: string[] = [];
  const htmlStore: Record<string, string> = {};
  let htmlIndex = 0;
  let lastIndex = 0;
  const htmlKey = String.fromCharCode(0x05);
  // htmlHolderRegExp is used at restore time; kept for future template command analysis
  // const htmlHolderRegExp = new RegExp(htmlKey + "\\d+" + htmlKey, "g");

  template.replace(
    templateCmdRegExp,
    (match, operate: string | undefined, content: string, offset: number) => {
      const start = operate ? 3 : 2;
      const htmlText = template.substring(lastIndex, offset + start);
      const key = htmlKey + htmlIndex++ + htmlKey;
      htmlStore[key] = htmlText;
      lastIndex = offset + match.length - 2;

      if (operate && content.trim()) {
        fnParts.push(';"' + key + '";', "[" + content + "]");
      } else {
        fnParts.push(';"' + key + '";', content || "");
      }
      return match;
    },
  );

  let fn = fnParts.join("");

  // Wrap in a function body so it's valid JS
  fn = `(function(){${fn}})`;

  // Step 3: Parse with SWC
  const parseSync = await getParser();
  if (!parseSync) {
    return fallbackExtractVariables(source);
  }

  let ast: Module;
  try {
    ast = parseSync(fn, {
      syntax: "ecmascript",
      target: "es2022",
    });
  } catch {
    // If parsing fails, fall back to regexp extraction
    return fallbackExtractVariables(source);
  }

  // Step 4: Walk the AST to find identifiers and track scopes
  const globalExists: Record<string, number> = {};
  for (const name of BUILTIN_GLOBALS) globalExists[name] = 1;
  const globalVars: Record<string, number> = Object.create(null);

  // Track function nodes for scope analysis
  const fnNodes: (FunctionDeclaration | FunctionExpression | ArrowFunctionExpression)[] = [];

  // First pass: collect variable declarations and function scopes
  walkSwcAst(ast, {
    VariableDeclarator(node: VariableDeclarator) {
      if (node.id.type === "Identifier") {
        const name = node.id.value;
        globalExists[name] = node.init ? 3 : 2;
      }
    },
    FunctionDeclaration(node: FunctionDeclaration) {
      if (node.identifier) {
        globalExists[node.identifier.value] = 3;
      }
      fnNodes.push(node);
    },
    FunctionExpression(node: FunctionExpression) {
      fnNodes.push(node);
    },
    ArrowFunctionExpression(node: ArrowFunctionExpression) {
      fnNodes.push(node);
    },
    CallExpression(node: CallExpression) {
      if (node.callee.type === "Identifier") {
        globalExists[node.callee.value] = 1; // treat as built-in/const
      }
    },
  });

  // Collect function params
  const functionParams: Record<string, number> = Object.create(null);
  for (const fnNode of fnNodes) {
    const patterns = getParamPatterns(fnNode);
    for (const pat of patterns) {
      if (pat.type === "Identifier") {
        functionParams[(pat as Identifier).value] = 1;
      } else if (pat.type === "AssignmentPattern" && pat.left.type === "Identifier") {
        functionParams[(pat.left as Identifier).value] = 1;
      } else if (pat.type === "RestElement" && pat.argument.type === "Identifier") {
        functionParams[(pat.argument as Identifier).value] = 1;
      }
    }
  }

  // Second pass: collect all identifiers, determine which are global
  walkSwcAst(ast, {
    Identifier(node: Identifier) {
      const name = node.value;
      // Skip if already known (declared, built-in, etc.)
      if (globalExists[name]) return;
      // Skip function parameters
      if (functionParams[name]) return;
      // This is a global variable that needs to be passed in
      globalVars[name] = 1;
    },
    AssignmentExpression(node: AssignmentExpression) {
      if (node.left.type === "Identifier") {
        const name = (node.left as Identifier).value;
        if (!globalExists[name] || globalExists[name] === 1) {
          // Undeclared variable being assigned — mark as existing to avoid duplicate reports
          globalExists[name] = (globalExists[name] || 0) + 1;
        }
      }
    },
  });

  return Object.keys(globalVars);
}

/**
 * Extract Pattern[] from function params, handling SWC's Param wrapper.
 */
function getParamPatterns(
  fnNode: FunctionDeclaration | FunctionExpression | ArrowFunctionExpression,
): Pattern[] {
  if (fnNode.type === "ArrowFunctionExpression") {
    return fnNode.params;
  }
  // FunctionDeclaration and FunctionExpression use Fn interface: params: Param[]
  return (fnNode as { params: Param[] }).params.map((p: Param) => p.pat);
}

// ─── Fallback ────────────────────────────────────────────────────────────

/**
 * Fallback regex-based variable extraction when AST parsing fails.
 * Kept for robustness — handles malformed templates gracefully.
 */
function fallbackExtractVariables(source: string): string[] {
  const vars = new Set<string>();

  const outputRegExp = /\{\{[:=!@]\s*([a-zA-Z_$][\w$]*)[^}]*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = outputRegExp.exec(source)) !== null) {
    vars.add(m[1]);
  }

  const eachRegExp = /\{\{forOf\s+([a-zA-Z_$][\w$]*)\s+as/g;
  while ((m = eachRegExp.exec(source)) !== null) {
    vars.add(m[1]);
  }

  const ifRegExp = /\{\{(?:else\s+)?if\s+([a-zA-Z_$][\w$]*)[^}]*\}\}/g;
  while ((m = ifRegExp.exec(source)) !== null) {
    vars.add(m[1]);
  }

  return Array.from(vars).filter((v) => !BUILTIN_GLOBALS.has(v));
}

// ─── AST walker ────────────────────────────────────────────────────────────

/**
 * Simple AST walker for SWC nodes.
 */
function walkSwcAst(
  ast: Module,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visitors: Record<string, (node: any) => void>,
): void {
  function visit(node: { type: string }): void {
    const type = node.type as string;
    if (visitors[type]) {
      visitors[type](node);
    }
    for (const key of Object.keys(node)) {
      // Skip metadata keys
      if (key === "type" || key === "span" || key === "ctxt") continue;

      // Skip non-computed MemberExpression.property
      // (e.g., obj.prop — 'prop' is not a standalone variable)
      if (type === "MemberExpression" && key === "property") {
        const me = node as unknown as MemberExpression;
        if (me.property.type !== "Computed") continue;
      }
      // Skip non-computed KeyValueProperty.key
      // (e.g., {key: value} — 'key' is not a standalone variable).
      if (type === "KeyValueProperty" && key === "key") {
        const kv = node as unknown as KeyValueProperty;
        if (kv.key.type !== "Computed") continue;
      }
      // Skip non-computed MethodProperty.key
      if (type === "MethodProperty" && key === "key") {
        const mp = node as unknown as MethodProperty;
        if (mp.key.type !== "Computed") continue;
      }

      const child = Reflect.get(node, key);
      if (Array.isArray(child)) {
        for (const item of child) {
          if (isSwcNode(item)) visit(item);
        }
      } else if (isSwcNode(child)) {
        visit(child);
      }
    }
  }
  visit(ast);
}

/** Type guard: is `v` an SWC-style AST node (has a string `type` field)? */
function isSwcNode(v: unknown): v is { type: string } {
  return !!v && typeof v === "object" && typeof (v as { type?: unknown }).type === "string";
}

// ─── Built-in globals exclusion list ───────────────────────────────────────

/**
 * Built-in globals that should not be treated as template data variables.
 */
const BUILTIN_GLOBALS = new Set([
  // ─── Template runtime helpers (injected by compileToFunction) ───────
  //
  // These variables appear in the generated template function signature
  // or body. They must be excluded from extractGlobalVars() so that
  // they are not mistaken for user data variables and destructured from $data.

  // SPLITTER character constant (same as \x1e), used as namespace separator
  // for refData keys, event attribute encoding, and internal data structures.
  // Declared as: let $splitter='\x1e'
  "$splitter",

  // Data — the data object passed from Updater to the template function.
  // User variables are destructured from $data at the top of the function:
  //   let {name, age} = $data;
  // This is the first parameter of the generated arrow function.
  "$data",

  // Null-safe toString: v => '' + (v == null ? '' : v)
  // Converts null/undefined to empty string, otherwise calls toString().
  // Wraps every {{!raw}} output to prevent "null" / "undefined" rendering.
  "$strSafe",

  // HTML entity encoder: v => $strSafe(v).replace(/[&<>"'`]/g, entityMap)
  // Encodes &, <, >, ", ', ` to HTML entities (&amp; &lt; etc.)
  // Applied to all {{=escaped}} and {{:binding}} outputs.
  "$encHtml",

  // HTML entity map — internal object used by $encHtml:
  //   {'&':'amp','<':'gt','>':'gt','"':'#34','\'':'#39','`':'#96'}
  // Not a standalone function; referenced inside $encHtml's closure.
  "$entMap",

  // HTML entity RegExp — internal regexp used by $encHtml:
  //   /[&<>"'`]/g
  "$entReg",

  // HTML entity replacer function — internal helper used by $encHtml:
  //   m => '&' + $entMap[m] + ';'
  // Maps matched character to its entity string.
  "$entFn",

  // Output buffer — the string accumulator for rendered HTML.
  // All template output is appended via $out += '...'.
  // Declared as: let $out = ''
  "$out",

  // Reference lookup: (refData, value) => key
  // Finds or allocates a SPLITTER-prefixed key in refData for a given
  // object reference. Used by {{@ref}} operator for passing object
  // references to child views via v-lark attributes.
  "$refFn",

  // URI encoder: v => encodeURIComponent($strSafe(v)).replace(/[!')(*]/g, extraMap)
  // Extends encodeURIComponent with encoding of ! ' ( ) *.
  // Applied to values in @event URL parameters and {{!uri}} contexts.
  "$encUri",

  // URI encode map — internal object used by $encUri:
  //   {'!':'%21','\'':'%27','(':'%28',')':'%29','*':'%2A'}
  "$uriMap",

  // URI encode replacer — internal helper used by $encUri:
  //   m => $uriMap[m]
  "$uriFn",

  // URI encode regexp — internal regexp used by $encUri:
  //   /[!')(*]/g
  "$uriReg",

  // Quote encoder: v => $strSafe(v).replace(/['"\\]/g, '\\$&')
  // Escapes quotes and backslashes for safe embedding in HTML attribute
  // values (e.g. data-json='...').
  "$encQuote",

  // Quote encode regexp — internal regexp used by $encQuote:
  //   /['"\\]/g
  "$qReg",

  // View ID — the unique identifier of the owning View instance.
  // Injected into @event attribute values at render time so that
  // EventDelegator can dispatch events to the correct View handler.
  // The \x1f placeholder in compiled output is replaced with '+$viewId+'.
  "$viewId",

  // Debug: current expression text — stores the template expression being
  // evaluated, for error reporting. Only present in debug mode.
  // e.g. $dbgExpr='<%=user.name%>'
  "$dbgExpr",

  // Debug: original art syntax — stores the {{}} template syntax before
  // conversion, for error reporting. Only present in debug mode.
  // e.g. $dbgArt='{{=user.name}}'
  "$dbgArt",

  // Debug: source line number — tracks the current line in the template
  // source, for error reporting. Only present in debug mode.
  "$dbgLine",

  // RefData alias — fallback reference lookup table.
  // Defaults to $data when no explicit $refAlt is provided.
  // Ensures $refFn() does not crash when @ operator is used without refData.
  "$refAlt",

  // Temporary variable — used by the compiler for intermediate
  // expression results in generated code (e.g. loop variables,
  // conditional branches). Declared as: let $tmp
  "$tmp",

  // JS literals
  "undefined",
  "null",
  "true",
  "false",
  "NaN",
  "Infinity",

  // JS built-in globals
  "window",
  "self",
  "globalThis",
  "document",
  "console",
  "JSON",
  "Math",
  "Intl",
  "Promise",
  "Symbol",
  "Number",
  "String",
  "Boolean",
  "Array",
  "Object",
  "Date",
  "RegExp",
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "Proxy",
  "Reflect",
  "ArrayBuffer",
  "DataView",
  "Float32Array",
  "Float64Array",
  "Int8Array",
  "Int16Array",
  "Int32Array",
  "Uint8Array",
  "Uint16Array",
  "Uint32Array",
  "Uint8ClampedArray",

  // Functions
  "parseInt",
  "parseFloat",
  "isNaN",
  "isFinite",
  "encodeURIComponent",
  "decodeURIComponent",
  "encodeURI",
  "decodeURI",

  // SWC helpers
  "arguments",
  "this",
  "require",

  // Lark framework
  "Lark",
]);
