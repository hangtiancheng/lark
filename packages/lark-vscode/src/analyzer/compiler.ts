/**
 * @lark.js/mvc Template Compiler
 *
 *   convertArtSyntax()    ({{}} → <% %>)
 *   processViewEvents()      (@event prefix + param encoding)
 *   compileToFunction()  (<% %> → JS template function)
 *   extractGlobalVars()   (AST-based global var analysis via @babel/parser)
 *
 * - All template operators: = (escape), ! (raw), @ (ref lookup), : (binding)
 * - @event attribute processing with $splitter prefix + \x1e separator
 * - $strSafe (null-safe toString), $encHtml (HTML entity encode), $encUri (URI encode), $encQuote (quote encode), $refFn (ref lookup)
 * - Debug mode with line tracking ($dbgExpr/$dbgArt/$dbgLine) and try-catch error wrapper
 * - View ID injection (\x1f → '+$viewId+')
 * - Post-processing cleanup of empty concatenations
 * - 0 configuration: auto-extract variables via AST analysis
 *
 * Template syntax:
 *   {{=variable}}              → escaped output
 *   {{:variable}}              → two-way binding (same as = for rendering)
 *   {{!variable}}              → raw output (no HTML escaping)
 *   {{@variable}}              → reference lookup for component data passing
 *   {{forOf list as item}}      → loop
 *   {{forOf list as item idx}}  → loop with index
 *   {{forIn obj as val key}}   → object iteration
 *   {{for(let i=0;i<n;i++)}}  → generic for loop
 *   {{if condition}}           → conditional
 *   {{else if condition}}      → else-if
 *   {{else}}                   → else
 *   {{/if}} / {{/forOf}} / {{/forIn}} / {{/for}} → close blocks
 *   {{set a = b}}              → variable declaration
 */

import { parse as babelParse } from "@babel/parser";
import type * as t from "@babel/types";
// ─── Compilation options ──────────────────────────────────────────────────
/** Options for compileTemplate() */
export interface CompileOptions {
  /** Enable debug mode with line tracking (default: false) */
  debug?: boolean;
  /** Global variable names to destructure from $$ (refData) */
  globalVars?: string[];
  /** File path for debug error messages (default: undefined) */
  file?: string;
}


/**
 * SPLITTER character (U+001E). Kept local rather than importing from common.ts
 * because compiler.ts runs at build-time (Node.js) while common.ts is a
 * runtime module — avoids pulling runtime dependencies into the build path.
 */
const SPLITTER = String.fromCharCode(0x1e);

/** View ID placeholder character (U+001F). */
const VIEW_ID_PLACEHOLDER = String.fromCharCode(0x1f);

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Convert JS object literal parameters to URL query parameter format.
 *
 * {key: 'value', key2: 123} → key=value&key2=123
 * key=value (already URL format) → key=value
 */
function jsObjectToUrlParams(paramsStr: string): string {
  const trimmed = paramsStr.trim();
  // Already URL format: key=value&key2=value2
  if (!/^[{[]/.test(trimmed) && /=/.test(trimmed)) {
    return trimmed;
  }
  // JS object literal: {key: 'value', key2: 123}
  const objMatch = trimmed.match(/^\{(.*)\}$/s);
  if (objMatch) {
    const inner = objMatch[1];
    const pairs: string[] = [];
    const pairRegExp = /(\w+)\s*:\s*(?:'([^']*)'|"([^"]*)"|([^,}]+))/g;
    let m: RegExpExecArray | null;
    while ((m = pairRegExp.exec(inner)) !== null) {
      const key = m[1];
      const value = m[2] ?? m[3] ?? m[4]?.trim() ?? "";
      pairs.push(`${key}=${value}`);
    }
    return pairs.join("&");
  }
  return trimmed;
}

// ─── Phase 1: Pre-processing ─────────────────────────────────────────────

/** Protected comment store — used internally by protectComments */

/**
 * Preserve HTML comments to prevent template syntax inside comments from being converted.
 */
function protectComments(source: string): {
  protectedSource: string;
  comments: string[];
} {
  const comments: string[] = [];
  const protectedSource = source.replace(/<!--[\s\S]*?-->/g, (match) => {
    comments.push(match);
    return `__lark_comment_${comments.length - 1}__`;
  });
  return { protectedSource, comments };
}

/**
 * Restore previously protected HTML comments.
 */
function restoreComments(source: string, comments: string[]): string {
  return source.replace(/__lark_comment_(\d+)__/g, (_, index: string) => {
    return comments[parseInt(index, 10)];
  });
}

/**
 * Process @event attributes.
 *
 * 1. Add \x1f (VIEW_ID_PLACEHOLDER, becomes $viewId at render time) prefix + \x1e separator
 * 2. Convert JS object literal params to URL query params
 *
 * @click="handlerName({key: 'value'})" → @click="\x1f\x1ehandlerName(key=value)"
 * @click="handlerName()"               → @click="\x1f\x1ehandlerName()"
 * @click="goHome"                      → unchanged (no parens = not an event handler)
 */
function processViewEvents(source: string): string {
  return source.replace(
    /@(\w+)="([^"]+)"/g,
    (fullAttr: string, eventName: string, attrValue: string) => {
      // Parse handlerName(params) format
      const eventMatch = attrValue.match(/^(\w+)\((.*)\)$/s);
      if (!eventMatch) return fullAttr; // No parens, e.g., plain string value

      const handlerName = eventMatch[1];
      const paramsStr = eventMatch[2].trim();

      if (!paramsStr) {
        // No parameters: handlerName() → \x1f\x1ehandlerName()
        return `@${eventName}="${VIEW_ID_PLACEHOLDER}${SPLITTER}${handlerName}()"`;
      }

      // Convert JS object literal to URL query params
      const urlParams = jsObjectToUrlParams(paramsStr);
      return `@${eventName}="${VIEW_ID_PLACEHOLDER}${SPLITTER}${handlerName}(${urlParams})"`;
    },
  );
}

// ─── Phase 2: Art-template syntax → Internal <% %> syntax ────────────────

/**
 * Add line number markers for debug mode.
 * Inserts \x1e + lineNo before forOf {{ tag.
 */
function addLineMarkers(source: string): string {
  const lines = source.split(/\r\n?|\n/);
  const result: string[] = [];
  let lineNo = 0;
  const openTag = "{{";

  for (const line of lines) {
    // Split by {{ and rejoin with \x1e + lineNo prefix
    const parts = line.split(openTag);
    if (parts.length > 1) {
      const reconstructed = parts
        .map((part, i) => {
          if (i === 0) return part;
          // FIXME return openTag + SPLITTER + ++lineNo;
          return openTag + SPLITTER + ++lineNo + part;
        })
        .join("");
      result.push(reconstructed);
    } else {
      result.push(line);
    }
  }
  return result.join("\n");
}

/**
 * Extract art info (line number + code) from a {{ }} block that has a line marker.
 */
function extractArtInfo(art: string): { line: number; art: string } | null {
  const m = art.match(new RegExp(`^${SPLITTER}(\\d+)([\\s\\S]+)`));
  if (m) {
    let code = m[2].trimStart();
    // Normalize "if(" → "if (" and "for(" → "for ("
    if (code.startsWith("if(")) {
      code = code.substring(0, 2) + " " + code.substring(2);
    } else if (code.startsWith("for(")) {
      code = code.substring(0, 3) + " " + code.substring(3);
    }
    return { line: parseInt(m[1], 10), art: code };
  }
  return null;
}

/**
 * Convert {{=}}/{{:}}/{{!}}/{{@}} and control flow syntax to internal <% %> syntax.
 *
 * In debug mode, adds \x11-delimited line tracking markers:
 *   <%'lineNo\x11code\x11'%> before forOf art expression
 */
function convertArtSyntax(source: string, debug: boolean): string {
  // Step 1: Add line markers for debug mode
  const markedSource = debug ? addLineMarkers(source) : source;

  // Step 2: Split by {{ and process forOf art block
  const openTag = "{{";
  const parts = markedSource.split(openTag);
  const result: string[] = [parts[0]]; // First part is always plain text

  // Block stack for validation
  const blockStack: { ctrl: string; line: number }[] = [];

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    // Find the closing }}
    const closeIdx = findCloseBrace(part);
    if (closeIdx === -1) {
      // No closing }} found, treat as plain text
      result.push(openTag + part);
      continue;
    }

    const code = part.substring(0, closeIdx);
    const rest = part.substring(closeIdx + 2);

    // Extract debug info if present
    let lineNo = -1;
    let cleanCode = code;
    if (debug) {
      const info = extractArtInfo(code);
      if (info) {
        lineNo = info.line;
        cleanCode = info.art;
      }
    } else {
      cleanCode = code.trim();
    }

    // Convert the art expression to <% %> syntax
    const converted = convertArtExpression(
      cleanCode,
      debug,
      lineNo,
      blockStack,
    );
    result.push(converted);
    result.push(rest);
  }

  // Check for unclosed blocks at end
  if (blockStack.length > 0) {
    const unclosed = blockStack
      .map((b) => `"${b.ctrl}" at line ${b.line}`)
      .join(", ");
    throw new Error(`[@lark.js/mvc error] unclosed block(s): ${unclosed}`);
  }

  return result.join("");
}

/**
 * Find the closing }} in a string, handling nested braces.
 */
function findCloseBrace(str: string): number {
  let leftCount = 0;
  let rightCount = 0;
  let maybeCount = 0;
  let maybeAt = -1;

  for (let i = 0; i < str.length; i++) {
    const c = str.charAt(i);
    if (c !== "}") {
      if (maybeCount >= 2 && maybeAt === -1) {
        maybeAt = i;
      }
      maybeCount = 0;
      rightCount = 0;
    }
    if (c === "{") {
      leftCount++;
    } else if (c === "}") {
      maybeCount++;
      if (!leftCount) {
        rightCount++;
        if (rightCount === 2) {
          return i - 1;
        }
      } else {
        leftCount--;
      }
    }
  }

  if (!leftCount && maybeCount >= 2 && maybeAt === -1) {
    maybeAt = str.length - 2;
  }

  if (maybeAt > -1) {
    return maybeAt - 2;
  }

  return -1;
}

/**
 * Strip matched outer parentheses from an expression.
 *
 * Examples:
 *   "(a > b)"     → "a > b"
 *   "((a > b))"   → "(a > b)"
 *   "a > b"       → "a > b"
 *   "(a) && (b)"  → "(a) && (b)" (inner parens prevent outer stripping)
 */
function trimOuterParens(expr: string): string {
  expr = expr.trim();
  while (expr.startsWith("(") && expr.endsWith(")")) {
    let depth = 0;
    let matched = true;
    for (let i = 0; i < expr.length - 1; i++) {
      const c = expr.charAt(i);
      if (c === "(") depth++;
      else if (c === ")") depth--;
      // If depth hits 0 before the last char, outer parens don't fully wrap
      if (depth === 0 && i < expr.length - 1) {
        matched = false;
        break;
      }
    }
    if (!matched) break;
    // Strip one layer of outer parens
    expr = expr.substring(1, expr.length - 1).trim();
  }
  return expr;
}

/**
 * Convert art expression to <% %> syntax.
 */
function convertArtExpression(
  code: string,
  debug: boolean,
  lineNo: number,
  blockStack: { ctrl: string; line: number }[] = [],
): string {
  code = code.trim();

  // Debug line marker: <%'lineNo\x11code\x11'%>
  const debugPrefix =
    debug && lineNo > -1
      ? `<%'${lineNo}\x11${code.replace(/\\|'/g, "\\$&").replace(/\r\n?|\n/g, "\\n")}\x11'%>`
      : "";

  // Detect if/for shorthand: "if(condition)" or "for(init;test;update)"
  const ifForMatch = code.match(/^\s*(if|for)\s*\(/);
  if (ifForMatch) {
    const keyword = ifForMatch[1];
    const expr = code.substring(ifForMatch[0].length);
    if (keyword === "if") {
      blockStack.push({ ctrl: "if", line: lineNo });
      // then trimParentheses on the condition expression
      const rawExpr = expr.replace(/\)\s*$/, "");
      const cleanExpr = trimOuterParens(rawExpr);
      return `${debugPrefix}<%if(${cleanExpr}){%>`;
    }
    // {{for(init;test;update)}} → for(init;test;update){
    // expr has trailing ")" from the original "for(...)", need to strip it
    blockStack.push({ ctrl: "for", line: lineNo });
    const forExpr = expr.replace(/\)\s*$/, "");
    return `${debugPrefix}<%for(${forExpr}){%>`;
  }

  // Split by whitespace to get keyword + args. `String.prototype.split` on
  // a non-empty string always yields at least one element, and `code` is
  // trimmed/non-empty above (the `if (!code)` short-circuits earlier in
  // the calling pipeline), so `tokens.shift()` is always a string.
  const tokens = code.split(/\s+/);
  const keyword = tokens.shift() ?? "";

  switch (keyword) {
    case "if": {
      blockStack.push({ ctrl: "if", line: lineNo });
      const rawExpr = tokens.join(" ").trim();
      // Strip matched outer parentheses, e.g., "((a > b))" → "(a > b)"
      const expr = trimOuterParens(rawExpr);
      return `${debugPrefix}<%if(${expr}){%>`;
    }

    case "else": {
      // else/else if doesn't push to stack — it stays within the if block
      if (tokens[0] === "if") {
        tokens.shift(); // consume "if"
        const rawExpr = tokens.join(" ").trim();
        const expr = trimOuterParens(rawExpr);
        return `${debugPrefix}<%}else if(${expr}){%>`;
      }
      return `${debugPrefix}<%}else{%>`;
    }

    case "forOf": {
      blockStack.push({ ctrl: "forOf", line: lineNo });
      const object = tokens[0];
      // Validate "as" keyword
      // {{forOf list as item}} is valid; {{forOf list item}} is NOT
      if (tokens.length > 1 && tokens[1] !== "as") {
        throw new Error(
          `[@lark.js/mvc error] bad forOf syntax: {{${code}}}. ` +
            `Expected "as" keyword, got "${tokens[1]}". ` +
            `Usage: {{forOf list as item [index]}}`,
        );
      }
      const restTokens = tokens.slice(2);
      const asValue = restTokens.join(" ");

      // Parse as expression: "value index" or "{value} key"
      const asExpr = parseAsExpr(asValue);
      const index = asExpr.key || "_i";
      const refObj = /[.[\]]/.test(object)
        ? `_art_obj_${object.replace(/[^\w]/g, "_")}`
        : object;
      const refExpr = /[.[\]]/.test(object) ? `,${refObj}=${object}` : "";

      // Length cache variable
      // Using _l which is scoped to the for block, won't conflict with user vars
      const refObjCount = "_l";

      const valueDecl = asExpr.vars
        ? `let ${asExpr.vars}=${refObj}[${index}]`
        : "";

      // Support first/last helpers
      let firstAndLast = "";
      let lastCount = "";
      if (asExpr.first) {
        firstAndLast += `let ${asExpr.first}=${index}===0;`;
      }
      if (asExpr.last) {
        lastCount = `,_lc=${refObjCount}-1`;
        firstAndLast += `let ${asExpr.last}=${index}===_lc;`;
      }

      return `${debugPrefix}<%for(let ${index}=0${refExpr},${refObjCount}=${refObj}.length${lastCount};${index}<${refObjCount};${index}++){${firstAndLast}${valueDecl}%>`;
    }

    case "forIn": {
      blockStack.push({ ctrl: "forIn", line: lineNo });
      const object = tokens[0];
      // Validate "as" keyword
      if (tokens.length > 1 && tokens[1] !== "as") {
        throw new Error(
          `[@lark.js/mvc error] bad forIn syntax: {{${code}}}. ` +
            `Expected "as" keyword, got "${tokens[1]}". ` +
            `Usage: {{forIn obj as val [key]}}`,
        );
      }
      const restTokens2 = tokens.slice(2);
      const asValue2 = restTokens2.join(" ");
      const asExpr2 = parseAsExpr(asValue2);
      const key1 = asExpr2.key || "_k";
      const refObj2 = /[.[\]]/.test(object)
        ? `_art_obj_${object.replace(/[^\w]/g, "_")}`
        : object;
      const refExpr2 = /[.[\]]/.test(object) ? `let ${refObj2}=${object};` : "";
      const valueDecl2 = asExpr2.vars
        ? `let ${asExpr2.vars}=${refObj2}[${key1}]`
        : "";

      return `${debugPrefix}<%${refExpr2}for(let ${key1} in ${refObj2}){${valueDecl2}%>`;
    }

    case "for": {
      blockStack.push({ ctrl: "for", line: lineNo });
      const expr = tokens.join(" ").trim();
      return `${debugPrefix}<%for(${expr}){%>`;
    }

    case "set":
      return `${debugPrefix}<%let ${tokens.join(" ")};%>`;

    case "/if":
    case "/forOf":
    case "/forIn":
    case "/for": {
      // Validate block matching
      const expectedCtrl = keyword.substring(1); // "/if" → "if"
      const last = blockStack.pop();
      if (!last) {
        throw new Error(
          `[@lark.js/mvc error] unexpected {{${code}}}: no matching open block`,
        );
      }
      if (last.ctrl !== expectedCtrl) {
        throw new Error(
          `[@lark.js/mvc error] unexpected {{${code}}}: expected {{/${last.ctrl}}} to close block opened at line ${last.line}`,
        );
      }
      return `${debugPrefix}<%}%>`;
    }

    default:
      // Unknown keyword or inline expression — pass through
      return `${debugPrefix}<%${code}%>`;
  }
}

/** Parsed "as" expression from forOf/forIn */
interface AsExpr {
  vars: string;
  key: string;
  last: string;
  first: string;
  bad: boolean;
}

/**
 * Parse the "as" expression in forOf/forIn loops.
 *
 * Examples:
 *   "value index"     → { vars: "value", key: "index" }
 *   "value"           → { vars: "value", key: "" }
 *   "{a,b} index"     → { vars: "{a,b}", key: "index" }
 *   "value index last" → { vars: "value", key: "index", last: "last" }
 */
function parseAsExpr(expr: string): AsExpr {
  expr = expr.trim();
  if (!expr) {
    return { vars: "", key: "", last: "", first: "", bad: false };
  }

  // Destructuring: starts with { or [
  if (expr.startsWith("{") || expr.startsWith("[")) {
    const stack: string[] = [];
    let vars = "";
    let key = "";
    let last = "";
    let first = "";
    let pos = 0;
    let bad = false;

    for (const c of expr) {
      if (pos === 0) vars += c;
      else if (pos === 1) key += c;
      else if (pos === 2) last += c;
      else if (pos === 3) first += c;

      if (c === "{" || c === "[") stack.push(c);
      else if (c === "}") {
        if (stack[stack.length - 1] === "{") stack.pop();
        else {
          bad = true;
          break;
        }
      } else if (c === "]") {
        if (stack[stack.length - 1] === "[") stack.pop();
        else {
          bad = true;
          break;
        }
      } else if (c === " " && !stack.length) {
        pos++;
      }
    }
    return {
      vars: vars.trim(),
      key: key.trim(),
      last: last.trim(),
      first: first.trim(),
      bad: bad || stack.length > 0,
    };
  }

  // Simple: "value index last first"
  const parts = expr.split(/\s+/);
  return {
    vars: parts[0] || "",
    key: parts[1] || "",
    last: parts[2] || "",
    first: parts[3] || "",
    bad: false,
  };
}

// ─── Phase 3: Compile to template function ───────────────────────────────

/**
 * Compile internal <% %> syntax to a JS template function string.
 *
 * Output is an arrow function: ($data,$viewId,$refAlt,$encHtml,$strSafe,$encUri,$refFn,$encQuote)=>{...}
 * that returns the rendered HTML string.
 */
function compileToFunction(
  source: string,
  debug: boolean,
  file?: string,
): string {
  const matcher = /<%([@=!:])?([\s\S]*?)%>|$/g;
  let index = 0;
  let funcSource = `$out+='`;
  let hasAtRule = false;

  // Escape regexp for string literals
  const escapeSlashRegExp = /\\|'/g;
  const escapeBreakReturnRegExp = /\r|\n/g;

  source.replace(matcher, (match, operate, content, offset) => {
    // Escape plain text between template expressions
    funcSource += source
      .substring(index, offset)
      .replace(escapeSlashRegExp, "\\$&")
      .replace(escapeBreakReturnRegExp, "\\n");
    index = offset + match.length;

    if (debug) {
      // Debug mode: extract expression and art info for error reporting
      let expr = source.substring(
        index - match.length + 2 + (operate ? 1 : 0),
        index - 2,
      );
      // Use String.fromCharCode to safely construct regexp with \x11 control character
      const x11 = String.fromCharCode(0x11);
      const artRegExp = new RegExp(`^'(\\d+)${x11}([^${x11}]+)${x11}'$`);
      const artM = expr.match(artRegExp);
      let art = "";
      let line = -1;

      if (artM) {
        expr = expr.replace(artRegExp, "");
        art = artM[2];
        line = parseInt(artM[1], 10);
      } else {
        expr = expr
          .replace(escapeSlashRegExp, "\\$&")
          .replace(escapeBreakReturnRegExp, "\\n");
      }

      if (operate === "@") {
        hasAtRule = true;
        funcSource += `'+($dbgExpr='<%${operate + expr}%>',$refFn($refAlt,${content}))+'`;
      } else if (operate === "=" || operate === ":") {
        // : (binding) is treated the same as = (escaped output) for rendering
        funcSource += `'+($dbgExpr='<%${operate + expr}%>',$encHtml(${content}))+'`;
      } else if (operate === "!") {
        // Check if content is already a $encUri() call — if so, don't wrap with $strSafe()
        if (!content.startsWith("$encUri(") || !content.endsWith(")")) {
          content = `$strSafe(${content})`;
        }
        funcSource += `'+($dbgExpr='<%${operate + expr}%>',${content})+'`;
      } else if (content) {
        if (line > -1) {
          funcSource += `';$dbgLine=${line};$dbgArt='${art}';`;
          content = "";
        } else {
          funcSource += `';`;
        }
        // Clean up trailing +''; → ;
        if (funcSource.endsWith(`+'';`)) {
          funcSource = funcSource.substring(0, funcSource.length - 4) + ";";
        }
        if (expr) {
          funcSource += `$dbgExpr='<%${expr}%>';`;
        }
        funcSource += content + `;$out+='`;
      }
    } else {
      // Production mode: compact output
      if (operate === "@") {
        hasAtRule = true;
        funcSource += `'+$refFn($refAlt,${content})+'`;
      } else if (operate === "=" || operate === ":") {
        // : (binding) is treated the same as = (escaped output) for rendering
        funcSource += `'+$encHtml(${content})+'`;
      } else if (operate === "!") {
        // Check if content is already a $encUri() call
        if (!content.startsWith("$encUri(") || !content.endsWith(")")) {
          content = `$strSafe(${content})`;
        }
        funcSource += `'+${content}+'`;
      } else if (content) {
        funcSource += `';`;
        // Clean up trailing +''; → ;
        if (funcSource.endsWith(`+'';`)) {
          funcSource = funcSource.substring(0, funcSource.length - 4) + ";";
        }
        funcSource += `${content};$out+='`;
      }
    }
    return match;
  });

  funcSource += `';`;

  // ─── Post-processing cleanup ──────────────────────────────────────

  // Remove empty concatenations: $out+=''; → (removed)
  funcSource = funcSource.replace(/\$out\+='';/g, "");
  // Fix empty string concatenation: $out=''+ → $out=
  funcSource = funcSource.replace(/\$out\+=''\+/g, "$out+=");

  // ─── Debug error wrapper ──────────────────────────────────────────

  if (debug) {
    const filePart = file ? `\\r\\n\\tat file:${file}` : "";
    funcSource = `let $dbgExpr,$dbgArt,$dbgLine;try{${funcSource}}catch(ex){let msg='render view error:'+(ex.message||ex);if($dbgArt)msg+='\\r\\n\\tsrc art:{{'+$dbgArt+'}}\\r\\n\\tat line:'+$dbgLine;msg+='\\r\\n\\t'+($dbgArt?'translate to:':'expr:');msg+=$dbgExpr+'${filePart}';throw msg;}`;
  }

  // ─── View ID injection: \x1f → '+$viewId+' ────────────────────────

  // Use String.fromCharCode to safely handle \x1f control character
  const viewIdRegExp = new RegExp(String.fromCharCode(0x1f), "g");
  funcSource = funcSource.replace(viewIdRegExp, `'+$viewId+'`);

  // ─── Build complete function source ───────────────────────────────
  //
  // All `$strSafe / $encHtml / $encUri / $encQuote / $refFn` come in as
  // parameters that the wrapper supplies from `@lark.js/mvc/runtime` — see
  // `compileTemplate()`. So we no longer emit inline `if(!$xxx) {...}` guards.
  // The only remaining setup is the `$refAlt` fallback for templates that
  // are invoked without refData.
  //
  // Touch `hasAtRule` so the "only-when-@-used" flag stays a useful signal
  // for future optimizations, even though we no longer gate any code on it
  // here. (Keeps the existing detection path warm.)
  void hasAtRule;

  const refFallback = "if(!$refAlt)$refAlt=$data;";
  const fullSource = `${refFallback}let $splitter='\\x1e',$tmp,$out=''{{VARS}};${funcSource}return $out`;

  // Wrap in arrow function signature
  return `($data,$viewId,$refAlt,$encHtml,$strSafe,$encUri,$refFn,$encQuote)=>{${fullSource}}`;
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Compile an HTML template string into a JS module string.
 * This is the main entry point for both Vite and Webpack loaders.
 *
 * The output is an ES module that exports a function with the signature:
 *   (data, viewId, refData) => string
 *
 * Internally it calls the compiled template function with the standard
 * signature: ($data,$viewId,$refAlt,$encHtml,$strSafe,$encUri,$refFn,$encQuote)
 *
 * @param source - The raw HTML template content
 * @param options - Compilation options
 * @returns ES module source code exporting the compiled template function
 */
export function compileTemplate(
  source: string,
  options: CompileOptions = {},
): string {
  const { debug = false, globalVars = [], file } = options;

  // Phase 1: Protect comments
  const { protectedSource, comments } = protectComments(source);

  // Phase 2: Convert {{ }} art-template syntax to <% %> internal syntax
  // (Before @event processing, so {{=variable}} inside @event params
  // is already converted to <%=variable%>
  const converted = convertArtSyntax(protectedSource, debug);

  // Phase 3: Process @event attributes after art conversion
  const viewEventProcessed = processViewEvents(converted);

  // Restore comments
  const finalSource = restoreComments(viewEventProcessed, comments);

  // Phase 3: Compile internal syntax to template function
  const funcBody = compileToFunction(finalSource, debug, file);

  // Build the variable declarations string from globalVars
  const varDeclarations = globalVars
    .map((key) => `,${key}=$data.${key}`)
    .join("");

  // Replace {{VARS}} placeholder in the function body
  // Use function replacement to avoid $data being interpreted as $ by String.replace()
  const funcWithVars = funcBody.replace("{{VARS}}", () => varDeclarations);

  // Generate the final ES module.
  //
  // Runtime helpers (`encHtml`, `strSafe`, `encUri`, `encQuote`, `refFn`) are
  // imported from `@lark.js/mvc/runtime` rather than inlined into every
  // compiled template — saves ~400 bytes per `.html` module in the bundle.
  //
  // Internal function signature: ($data,$viewId,$refAlt,$encHtml,$strSafe,$encUri,$refFn,$encQuote)
  return `import { encHtml as __larkEncHtml, strSafe as __larkStrSafe, encUri as __larkEncUri, encQuote as __larkEncQuote, refFn as __larkRefFn } from "@lark.js/mvc/runtime";
export default function(data, viewId, refData) {
  let $data = data || {},
      $viewId = viewId || '';
  return (${funcWithVars})($data, $viewId, refData,
    __larkEncHtml, __larkStrSafe, __larkEncUri, __larkRefFn, __larkEncQuote
  );
}`;
}

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
export function extractGlobalVars(source: string): string[] {
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
        // Wrap content in brackets so it's parseable as an array expression
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

  // Step 3: Parse with @babel/parser
  let ast: t.File;
  try {
    ast = babelParse(fn, {
      sourceType: "script",
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
    });
  } catch {
    // If parsing fails, fall back to regexp extraction
    return fallbackExtractVariables(source);
  }

  // Step 4: Walk the AST to find identifiers and track scopes
  const globalExists: Record<string, number> = {};
  for (const name of BUILTIN_GLOBALS) globalExists[name] = 1;
  const globalVars: Record<string, number> = Object.create(null);

  // Track function ranges for scope analysis
  const fnRange: t.Node[] = [];

  // First pass: collect variable declarations and function scopes
  walkAst(ast, {
    VariableDeclarator(node: t.VariableDeclarator) {
      if (node.id.type === "Identifier") {
        const name = node.id.name;
        // Mark as declared (value 3 = with init, 2 = without init)
        globalExists[name] = node.init ? 3 : 2;
      }
    },
    FunctionDeclaration(node: t.FunctionDeclaration) {
      if (node.id) {
        globalExists[node.id.name] = 3;
      }
      fnRange.push(node);
    },
    FunctionExpression(node: t.FunctionExpression) {
      fnRange.push(node);
    },
    ArrowFunctionExpression(node: t.ArrowFunctionExpression) {
      fnRange.push(node);
    },
    CallExpression(node: t.CallExpression) {
      if (node.callee.type === "Identifier") {
        globalExists[node.callee.name] = 1; // treat as built-in/const
      }
    },
  });

  // Collect function params
  const functionParams: Record<string, number> = Object.create(null);
  for (const fnNode of fnRange) {
    const params =
      "params" in fnNode
        ? (
            fnNode as
              | t.FunctionDeclaration
              | t.FunctionExpression
              | t.ArrowFunctionExpression
          ).params
        : [];
    for (const p of params) {
      if (p.type === "Identifier") {
        functionParams[p.name] = 1;
      } else if (
        p.type === "AssignmentPattern" &&
        p.left.type === "Identifier"
      ) {
        functionParams[p.left.name] = 1;
      } else if (p.type === "RestElement" && p.argument.type === "Identifier") {
        functionParams[p.argument.name] = 1;
      }
    }
  }

  // Second pass: collect all identifiers, determine which are global
  walkAst(ast, {
    Identifier(node: t.Identifier) {
      const name = node.name;
      // Skip if already known (declared, built-in, etc.)
      if (globalExists[name]) return;
      // Skip function parameters
      if (functionParams[name]) return;
      // This is a global variable that needs to be passed in
      globalVars[name] = 1;
    },
    AssignmentExpression(node: t.AssignmentExpression) {
      if (node.left.type === "Identifier") {
        const name = node.left.name;
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
 * Simple AST walker that visits all nodes recursively.
 */
function walkAst(
  ast: t.File,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visitors: Record<string, (node: any) => void>,
): void {
  // Babel node has `.type` as a discriminant; the cleanest narrowing pattern
  // for a generic walker without depending on @babel/types' runtime helpers
  // is to project the node into a typed local once per branch.
  function visit(node: t.Node): void {
    const type = node.type;
    if (visitors[type]) {
      visitors[type](node);
    }
    // Recurse into child nodes. We treat the node as a string-indexable
    // bag for traversal purposes; that's structurally what an AST node is.
    const bag = node as unknown as Record<string, unknown>;
    for (const key of Object.keys(node)) {
      if (
        key === "type" ||
        key === "start" ||
        key === "end" ||
        key === "loc" ||
        key === "range"
      )
        continue;
      // Skip 'property' of non-computed MemberExpression
      // (e.g., obj.prop — 'prop' is not a standalone variable).
      if (type === "MemberExpression" && key === "property") {
        const me = node as t.MemberExpression;
        if (!me.computed) continue;
      }
      // Skip 'key' of non-computed ObjectProperty
      // (e.g., {key: value} — 'key' is not a standalone variable).
      if (type === "ObjectProperty" && key === "key") {
        const op = node as t.ObjectProperty;
        if (!op.computed) continue;
      }
      // Skip 'key' of non-computed ObjectMethod
      if (type === "ObjectMethod" && key === "key") {
        const om = node as t.ObjectMethod;
        if (!om.computed) continue;
      }
      const child = bag[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (isAstNode(item)) visit(item);
        }
      } else if (isAstNode(child)) {
        visit(child);
      }
    }
  }
  visit(ast);
}

/** Type guard: is `v` a Babel-style AST node (has a string `type` field)? */
function isAstNode(v: unknown): v is t.Node {
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

  // Babel helpers
  "arguments",
  "this",
  "require",

  // Lark framework
  "Lark",
]);
