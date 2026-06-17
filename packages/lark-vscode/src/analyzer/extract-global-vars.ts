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
let parserSync: ParseSyncFn | null = null;
let parserLoadAttempted = false;

function getParserSync(): ParseSyncFn | null {
  if (!parserLoadAttempted) {
    parserLoadAttempted = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const swc = require("@swc/core") as typeof import("@swc/core");
      parserSync = swc.parseSync;
    } catch (error: unknown) {
      logError("Failed to load @swc/core", error);
    }
  }
  return parserSync;
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Extract global variable names from a template source using AST analysis.
 *
 * @param source - The raw HTML template content (with {{ }} syntax)
 * @returns Array of global variable names found in the template
 */
export function extractGlobalVars(source: string): string[] {
  // Step 1: Convert {{ }} art syntax to <% %> so we can analyze it
  const { protectedSource, comments: _comments } = protectComments(source);
  const viewEventProcessed = processViewEvents(protectedSource);
  const converted = convertArtSyntax(viewEventProcessed, false);
  const template = restoreComments(converted, _comments);

  // Step 2: Convert <% %> template commands into a JS-parsable form
  const templateCmdRegExp = /<%([@=!:])?([\s\S]*?)%>|$/g;
  const fnParts: string[] = [];
  const htmlStore: Record<string, string> = {};
  let htmlIndex = 0;
  let lastIndex = 0;
  const htmlKey = String.fromCharCode(0x05);

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
  const parseSync = getParserSync();
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
      globalExists[node.identifier.value] = 3;
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
        globalExists[(node.callee as Identifier).value] = 1;
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
      if (globalExists[name]) return;
      if (functionParams[name]) return;
      globalVars[name] = 1;
    },
    AssignmentExpression(node: AssignmentExpression) {
      if (node.left.type === "Identifier") {
        const name = (node.left as Identifier).value;
        if (!globalExists[name] || globalExists[name] === 1) {
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
  function visit(node: Record<string, unknown>): void {
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
      if (type === "KeyValueProperty" && key === "key") {
        const kv = node as unknown as KeyValueProperty;
        if (kv.key.type !== "Computed") continue;
      }
      // Skip non-computed MethodProperty.key
      if (type === "MethodProperty" && key === "key") {
        const mp = node as unknown as MethodProperty;
        if (mp.key.type !== "Computed") continue;
      }

      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (isSwcNode(item)) visit(item as Record<string, unknown>);
        }
      } else if (isSwcNode(child)) {
        visit(child as Record<string, unknown>);
      }
    }
  }
  visit(ast as unknown as Record<string, unknown>);
}

/** Type guard: is `v` an SWC-style AST node (has a string `type` field)? */
function isSwcNode(v: unknown): boolean {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as { type?: unknown }).type === "string"
  );
}

// ─── Built-in globals exclusion list ───────────────────────────────────────

/**
 * Built-in globals that should not be treated as template data variables.
 */
const BUILTIN_GLOBALS = new Set([
  // Template runtime helpers (injected by compileToFunction)
  "$splitter",
  "$data",
  "$strSafe",
  "$encHtml",
  "$entMap",
  "$entReg",
  "$entFn",
  "$out",
  "$refFn",
  "$encUri",
  "$uriMap",
  "$uriFn",
  "$uriReg",
  "$encQuote",
  "$qReg",
  "$viewId",
  "$dbgExpr",
  "$dbgArt",
  "$dbgLine",
  "$refAlt",
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

  // Common helpers
  "arguments",
  "this",
  "require",

  // Lark framework
  "Lark",
]);
