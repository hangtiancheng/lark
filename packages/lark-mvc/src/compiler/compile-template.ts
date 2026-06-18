import {
  convertArtSyntax,
  processViewEvents,
  protectComments,
  restoreComments,
} from "./template-syntax.js";
import type { CompileOptions } from "@/types.js";
import { compileToVDomFunction } from "./compile-to-vdom-function.js";


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
  const { debug = false, globalVars = [], file, virtualDom = false } = options;

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

  // Build the variable declarations string from globalVars
  const varDeclarations = globalVars
    .map((key) => `,${key}=$data.${key}`)
    .join("");

  if (virtualDom) {
    // ── VDOM mode ──
    const funcBody = compileToVDomFunction(finalSource, debug, file);
    const funcWithVars = funcBody.replace("{{VARS}}", () => varDeclarations);

    // VDOM module wrapper:
    // - Imports vdomCreate from @lark.js/mvc (not just runtime helpers)
    // - Does NOT import encHtml (not needed — VDOM text uses createTextNode)
    // - Inner function: 7 params ($data,$viewId,$refAlt,$n,$refFn,$encUri,$encQuote)
    // - $n is $strSafe (null-safe toString) for text content and attribute values
    return `import { vdomCreate as __larkC } from "@lark.js/mvc";
import { strSafe as __larkStrSafe, encUri as __larkEncUri, encQuote as __larkEncQuote, refFn as __larkRefFn } from "@lark.js/mvc/runtime";
export default function(data, viewId, refData) {
  let $data = data || {},
      $viewId = viewId || '',
      $c = __larkC,
      $n = __larkStrSafe;
  return (${funcWithVars})($data, $viewId, refData,
    $n, __larkRefFn, __larkEncUri, __larkEncQuote
  );
}`;
  }

  // ── String mode (existing, unchanged) ──
  const funcBody = compileToFunction(finalSource, debug, file);
  const funcWithVars = funcBody.replace("{{VARS}}", () => varDeclarations);

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
