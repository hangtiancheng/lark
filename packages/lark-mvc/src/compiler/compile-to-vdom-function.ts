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
        segments.push(`$strSafe(${expr.content})`);
      } else if (expr.op === "!") {
        if (expr.content.startsWith("$encUri(") && expr.content.endsWith(")")) {
          segments.push(expr.content);
        } else {
          segments.push(`$strSafe(${expr.content})`);
        }
      } else if (expr.op === "@") {
        segments.push(`$refFn($refAlt,${expr.content})`);
      } else {
        // Code block in attribute — unusual, emit as expression
        segments.push(`$strSafe(${expr.content})`);
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
 * Returns the JS source string (e.g. `{class:'foo',id:'x'+$strSafe(expr)}`)
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
 * 3. Walk the DOM tree recursively, emitting `$vdomCreate()` calls
 *
 * Output is an arrow function:
 *   `($data,$viewId,$refAlt,$strSafe,$refFn,$encUri,$encQuote)=>{...}`
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
  //
  // Variables are allocated on demand and declared after compilation
  // completes (see Step 6). There is no hard cap — previously a fixed
  // `maxVars = 30` caused variable exhaustion for templates with more
  // than 30 elements, which silently aliased all overflow nodes to the
  // last variable ($v29). That aliasing produced self-referential
  // children arrays (span.children === arr, then arr.push(span)) and
  // lost earlier siblings, leading to duplicated/missing output.
  const rootVar = `$v${varCounter++}`;
  lines.push(`let ${rootVar}=[]`);

  function allocVar(): string {
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
          lines.push(
            `${parentVar}.push($vdomCreate(0,'${vdomEscapeStr(trimmed)}'))`,
          );
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
      lines.push(`${parentVar}.push($vdomCreate(0,$strSafe(${expr.content})))`);
    } else if (expr.op === "!") {
      // Raw HTML output: pass `1` as the children argument so vdomCreate
      // produces a SPLITTER-tagged raw-HTML node (tag=\x1e) instead of a
      // V_TEXT_NODE. This is critical — V_TEXT_NODE children are HTML-encoded
      // (via encodeHTML) when serialized into the parent's innerHTML, which
      // would escape the raw HTML and break {{!}} semantics in VDOM mode.
      //
      // SPLITTER nodes are rendered via vdomCreateNode's <template>-based
      // path (see vdom.ts), which parses the raw HTML namespace-agnostically,
      // matching string-mode innerHTML behavior.
      if (expr.content.startsWith("$encUri(") && expr.content.endsWith(")")) {
        lines.push(`${parentVar}.push($vdomCreate(0,${expr.content},1))`);
      } else {
        lines.push(
          `${parentVar}.push($vdomCreate(0,$strSafe(${expr.content}),1))`,
        );
      }
    } else if (expr.op === "@") {
      lines.push(
        `${parentVar}.push($vdomCreate(0,$refFn($refAlt,${expr.content})))`,
      );
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
    const props = vdomBuildPropsFromAttribs(node.attribs, exprStore);

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
      `${parentVar}.push($vdomCreate('${tagName}',${propsKey},${childrenArg}))`,
    );
  }

  // Walk root-level children
  for (const child of doc.children) {
    emitNode(child, rootVar);
  }

  // ── Step 5: Emit return ──

  lines.push(`return $vdomCreate($viewId,0,${rootVar})`);

  // ── Step 6: Build function body ──

  // Declare every allocated child variable ($v1 .. $v{varCounter-1}).
  // rootVar ($v0) is already declared in lines[0]. Placing the
  // declaration here (instead of a fixed upfront block) is what lets
  // us support arbitrarily deep templates without exhausting vars.
  const varDeclStmts: string[] = [];
  for (let i = 1; i < varCounter; i++) varDeclStmts.push(`$v${i}`);
  const varDecl = varDeclStmts.length ? `let ${varDeclStmts.join(",")};` : "";
  const body = varDecl + lines.join(";");

  let funcBody = body;
  if (debug) {
    const filePart = file ? `\\r\\n\\tat file:${file}` : "";
    funcBody = `let $dbgExpr,$dbgArt,$dbgLine;try{${body}}catch(e){let msg='render error:'+(e.message||e);msg+='${filePart}';throw msg;}`;
  }

  // View ID injection: any remaining \x1f in code blocks → '+$viewId+'
  const viewIdRegExp = new RegExp(String.fromCharCode(0x1f), "g");
  funcBody = funcBody.replace(viewIdRegExp, `'+$viewId+'`);

  // Build complete function source
  const refFallback = "if(!$refAlt)$refAlt=$data;";
  const fullSource = `${refFallback}let $splitter='\\x1e'{{VARS}};${funcBody}`;

  // VDOM arrow function signature: 7 params (no $encHtml)
  return `($data,$viewId,$refAlt,$strSafe,$refFn,$encUri,$encQuote)=>{${fullSource}}`;
}
