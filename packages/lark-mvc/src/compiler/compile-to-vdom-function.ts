
// ─── VDOM compilation (htmlparser2-based) ──────────────────────────────────

import { parseDocument } from "htmlparser2";

/** Stored template expression extracted from a `<% %>` block. */
interface VDomExprEntry {
  /** Operator: "=", "!", "@", ":", or "" (code block) */
  op: string;
  /** JS expression or statement content */
  content: string;
}

/** HTML void elements — self-closing, no children allowed. */
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/**
 * Escape a string for embedding in a JS single-quoted string literal.
 */
function vdomEscapeStr(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\x1e/g, "\\x1e");
}

/**
 * Resolve an attribute value that may contain `\x00N\x00` placeholders
 * (template expressions) or `\x1f` (viewId placeholder).
 *
 * Returns a JS expression string.
 */
function vdomResolveAttrValue(
  rawValue: string,
  exprStore: VDomExprEntry[],
): string {
  const hasPlaceholders = rawValue.includes("\x00");
  const hasViewId = rawValue.includes("\x1f");

  if (!hasPlaceholders && !hasViewId) {
    return `'${vdomEscapeStr(rawValue)}'`;
  }

  const segments: string[] = [];
  let remaining = rawValue;

  while (remaining.length > 0) {
    const phIdx = remaining.indexOf("\x00");
    const viIdx = remaining.indexOf("\x1f");

    let nextSpecial = -1;
    let specialType: "ph" | "vi" | null = null;

    if (phIdx >= 0 && (viIdx < 0 || phIdx <= viIdx)) {
      nextSpecial = phIdx;
      specialType = "ph";
    } else if (viIdx >= 0) {
      nextSpecial = viIdx;
      specialType = "vi";
    }

    if (nextSpecial === -1) {
      if (remaining) segments.push(`'${vdomEscapeStr(remaining)}'`);
      break;
    }

    if (nextSpecial > 0) {
      segments.push(`'${vdomEscapeStr(remaining.substring(0, nextSpecial))}'`);
    }

    if (specialType === "vi") {
      segments.push("$viewId");
      remaining = remaining.substring(nextSpecial + 1);
    } else {
      // Placeholder: \x00N\x00
      const closeIdx = remaining.indexOf("\x00", nextSpecial + 1);
      if (closeIdx === -1) {
        segments.push(`'${vdomEscapeStr(remaining.substring(nextSpecial))}'`);
        break;
      }

      const idx = parseInt(remaining.substring(nextSpecial + 1, closeIdx));
      const expr = exprStore[idx];

      if (expr.op === "=" || expr.op === ":") {
        segments.push(`$n(${expr.content})`);
      } else if (expr.op === "!") {
        if (expr.content.startsWith("$encUri(") && expr.content.endsWith(")")) {
          segments.push(expr.content);
        } else {
          segments.push(`$n(${expr.content})`);
        }
      } else if (expr.op === "@") {
        segments.push(`$refFn($refAlt,${expr.content})`);
      } else {
        // Code block in attribute — unusual, emit as expression
        segments.push(`$n(${expr.content})`);
      }

      remaining = remaining.substring(closeIdx + 1);
    }
  }

  if (segments.length === 0) return "''";
  if (segments.length === 1) return segments[0];
  return segments.join("+");
}

/**
 * Build a JS props object literal from htmlparser2's parsed `attribs` map.
 *
 * Returns the JS source string (e.g. `{class:'foo',id:'x'+$n(expr)}`)
 * or `"null"` if there are no attributes.
 */
function vdomBuildPropsFromAttribs(
  attribs: Record<string, string> | undefined,
  exprStore: VDomExprEntry[],
): string {
  if (!attribs) return "null";

  const keys = Object.keys(attribs);
  if (keys.length === 0) return "null";

  const entries: string[] = [];
  for (const name of keys) {
    const value = attribs[name];
    const valueExpr = vdomResolveAttrValue(value, exprStore);
    entries.push(`'${vdomEscapeStr(name)}':${valueExpr}`);
  }

  return `{${entries.join(",")}}`;
}

/**
 * Compile the internal `<% %>` syntax to a VDOM template function string.
 *
 * Uses htmlparser2 for robust HTML parsing:
 * 1. Extract `<% %>` blocks into a store, replace with `\x00N\x00` placeholders
 * 2. Parse the protected source with `parseDocument`
 * 3. Walk the DOM tree recursively, emitting `$c()` (vdomCreate) calls
 *
 * Output is an arrow function:
 *   `($data,$viewId,$refAlt,$n,$refFn,$encUri,$encQuote)=>{...}`
 * that returns the root VDomNode.
 */
export function compileToVDomFunction(
  source: string,
  debug: boolean,
  file?: string,
): string {
  const lines: string[] = [];
  let varCounter = 0;
  let propsCounter = 0;

  // ── Step 1: Extract <% %> blocks, replace with \x00N\x00 placeholders ──

  const exprStore: VDomExprEntry[] = [];
  const protectedSource = source.replace(
    /<%([@=!:])?([\s\S]*?)%>/g,
    (_, op: string | undefined, content: string | undefined) => {
      const idx = exprStore.length;
      exprStore.push({ op: op || "", content: (content || "").trim() });
      return `\x00${idx}\x00`;
    },
  );

  // ── Step 2: Parse with htmlparser2 ──

  const doc = parseDocument(protectedSource, {
    recognizeSelfClosing: true,
    lowerCaseTags: false,
    lowerCaseAttributeNames: false,
    decodeEntities: false,
  });

  // ── Step 3: Allocate variables ──

  const rootVar = `$v${varCounter++}`;
  lines.push(`let ${rootVar}=[]`);

  const maxVars = 30;
  const varDecls: string[] = [];
  for (let i = 1; i < maxVars; i++) {
    varDecls.push(`$v${i}`);
  }
  lines.push(`let ${varDecls.join(",")}`);

  function allocVar(): string {
    if (varCounter >= maxVars) return `$v${maxVars - 1}`;
    return `$v${varCounter++}`;
  }

  // ── Step 4: Walk the DOM tree and emit code ──

  /** htmlparser2 node — minimal shape we use */
  interface HPNode {
    type: string;
    data?: string;
    name?: string;
    attribs?: Record<string, string>;
    children?: HPNode[];
  }

  function emitNode(node: HPNode, parentVar: string): void {
    const type: string = node.type;

    if (type === "text") {
      emitText((node.data || "") as string, parentVar);
    } else if (type === "tag" || type === "script" || type === "style") {
      emitElement(node, parentVar);
    }
    // Skip: comment, directive (DOCTYPE), cdata
  }

  function emitText(text: string, parentVar: string): void {
    // Split text at \x00N\x00 boundaries
    const parts = text.split(/\x00(\d+)\x00/);

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        // Regular text segment
        const trimmed = parts[i];
        if (trimmed.trim()) {
          lines.push(`${parentVar}.push($c(0,'${vdomEscapeStr(trimmed)}'))`);
        }
      } else {
        // Placeholder index
        const idx = parseInt(parts[i]);
        const expr = exprStore[idx];
        emitExpr(expr, parentVar);
      }
    }
  }

  function emitExpr(expr: VDomExprEntry, parentVar: string): void {
    if (expr.op === "=" || expr.op === ":") {
      lines.push(`${parentVar}.push($c(0,$n(${expr.content})))`);
    } else if (expr.op === "!") {
      if (expr.content.startsWith("$encUri(") && expr.content.endsWith(")")) {
        lines.push(`${parentVar}.push($c(0,${expr.content}))`);
      } else {
        lines.push(`${parentVar}.push($c(0,$n(${expr.content})))`);
      }
    } else if (expr.op === "@") {
      lines.push(`${parentVar}.push($c(0,$refFn($refAlt,${expr.content})))`);
    } else if (expr.content) {
      // Code block — emit raw JS (if/for/else/etc.)
      lines.push(expr.content);
    }
  }

  function emitElement(node: HPNode, parentVar: string): void {
    const tagName: string = node.name || "";
    const children: HPNode[] = node.children || [];
    const childVar = allocVar();
    const propsKey = `__p${propsCounter++}`;
    const props = vdomBuildPropsFromAttribs(
      node.attribs,
      exprStore,
    );

    lines.push(`let ${propsKey}=${props}`);
    lines.push(`${childVar}=[]`);

    // Recurse into children
    for (const child of children) {
      emitNode(child, childVar);
    }

    // Emit vdomCreate call — use 1 (self-closing) for void elements
    const isVoid = VOID_ELEMENTS.has(tagName) && children.length === 0;
    const childrenArg = isVoid ? "1" : childVar;

    lines.push(
      `${parentVar}.push($c('${tagName}',${propsKey},${childrenArg}))`,
    );
  }

  // Walk root-level children
  for (const child of doc.children) {
    emitNode(child, rootVar);
  }

  // ── Step 5: Emit return ──

  lines.push(`return $c($viewId,0,${rootVar})`);

  // ── Step 6: Build function body ──

  const body = lines.join(";");

  let funcBody = body;
  if (debug) {
    const filePart = file ? `\\r\\n\\tat file:${file}` : "";
    funcBody = `let $dbgExpr,$dbgArt,$dbgLine;try{${body}}catch(ex){let msg='render view error:'+(ex.message||ex);msg+='${filePart}';throw msg;}`;
  }

  // View ID injection: any remaining \x1f in code blocks → '+$viewId+'
  const viewIdRegExp = new RegExp(String.fromCharCode(0x1f), "g");
  funcBody = funcBody.replace(viewIdRegExp, `'+$viewId+'`);

  // Build complete function source
  const refFallback = "if(!$refAlt)$refAlt=$data;";
  const fullSource = `${refFallback}let $splitter='\\x1e'{{VARS}};${funcBody}`;

  // VDOM arrow function signature: 7 params (no $encHtml)
  return `($data,$viewId,$refAlt,$n,$refFn,$encUri,$encQuote)=>{${fullSource}}`;
}
