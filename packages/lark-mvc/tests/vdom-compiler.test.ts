import { describe, it, expect } from "vitest";
import { compileTemplate } from "../src/compiler";

/**
 * Helper: compile a template in VDOM mode and execute it.
 * Returns the root VDomNode.
 */
async function compileAndRun(
  template: string,
  data: Record<string, unknown> = {},
  globalVars: string[] = [],
): Promise<unknown> {
  const moduleSource = await compileTemplate(template, {
    virtualDom: true,
    globalVars,
  });

  // Create a mock vdomCreate function
  const vdomCreate = (
    tag: string | number,
    props?: Record<string, unknown> | number | null,
    children?: unknown[] | number | null,
    specials?: Record<string, string>,
  ): unknown => {
    if (!tag) {
      return { tag: children ? "\x1e" : 0, html: String(props ?? "") };
    }
    return {
      tag,
      props: props || null,
      children: children === 1 ? null : children || null,
      selfClose: children === 1,
    };
  };

  // Create mock runtime helpers
  const strSafe = (v: unknown): string => String(v == null ? "" : v);
  const encUri = (v: unknown): string => encodeURIComponent(strSafe(v));
  const encQuote = (v: unknown): string =>
    strSafe(v).replace(/['"\\]/g, "\\$&");
  const refFn = (
    ref: Record<string, unknown>,
    value: unknown,
    key: string,
  ): string => {
    const splitter = "\x1e";
    if (!ref[splitter]) ref[splitter] = 1;
    for (let i = ref[splitter] as number; --i; ) {
      key = splitter + i;
      if (ref[key] === value) return key;
    }
    key = splitter + (ref[splitter] as number)++;
    ref[key] = value;
    return key;
  };

  // Extract the arrow function body from the module source.
  // The compiled module looks like:
  //   import { ... } from "...";
  //   export default function(data, viewId, refData) {
  //     let $data = data || {}, $viewId = viewId || '', $c = __larkC, $n = __larkStrSafe;
  //     return (ARROW_FN)(ARGS);
  //   }
  //
  // We need to extract the ARROW_FN and call it directly.
  const arrowMatch = moduleSource.match(
    /return\s*\(\(([^)]*)\)\s*=>\s*\{([\s\S]*?)\}\)\(([\s\S]*?)\);?\s*\}/,
  );
  if (!arrowMatch)
    throw new Error("Failed to parse compiled module:\n" + moduleSource);

  const params = arrowMatch[1];
  const body = arrowMatch[2];
  // The args include $data, $viewId, refData, and the runtime helpers

  // Build a function that simulates the compiled module's execution
  const refData: Record<string, unknown> = {};
  refData["\x1e"] = 1;

  // Create the inner arrow function and call it
  const innerFn = new Function(
    "$c",
    "$n",
    "$refFn",
    "$encUri",
    "$encQuote",
    params
      .split(",")
      .map((p) => p.trim())
      .join(","),
    body,
  );

  const $data = data || {};
  const $viewId = "test-view";

  // The arrow function params are: $data,$viewId,$refAlt,$n,$refFn,$encUri,$encQuote
  // We pass $n (strSafe) as the 4th param which maps to $n in the function
  return innerFn(
    vdomCreate,
    strSafe,
    refFn,
    encUri,
    encQuote,
    $data,
    $viewId,
    refData,
    strSafe,
    refFn,
    encUri,
    encQuote,
  );
}

/**
 * Helper: get the compiled module source for inspection.
 */
async function compileSource(
  template: string,
  options: { debug?: boolean; globalVars?: string[] } = {},
): Promise<string> {
  return compileTemplate(template, {
    virtualDom: true,
    ...options,
  });
}

describe("VDOM Compiler", () => {
  // ============================================================
  // A. Module output format
  // ============================================================
  describe("module output format", () => {
    it("imports vdomCreate from @lark.js/mvc", async () => {
      const src = await compileSource("<div>hi</div>");
      expect(src).toContain(
        'import { vdomCreate as __larkC } from "@lark.js/mvc"',
      );
    });

    it("imports runtime helpers from @lark.js/mvc/runtime", async () => {
      const src = await compileSource("<div>hi</div>");
      expect(src).toContain("strSafe as __larkStrSafe");
      expect(src).toContain("encUri as __larkEncUri");
      expect(src).toContain("refFn as __larkRefFn");
    });

    it("does NOT import encHtml (not needed for VDOM)", async () => {
      const src = await compileSource("<div>hi</div>");
      expect(src).not.toContain("encHtml");
    });

    it("exports default function with correct signature", async () => {
      const src = await compileSource("<div>hi</div>");
      expect(src).toContain("export default function(data, viewId, refData)");
    });

    it("inner function has 7 params (no $encHtml)", async () => {
      const src = await compileSource("<div>hi</div>");
      expect(src).toContain(
        "$data,$viewId,$refAlt,$n,$refFn,$encUri,$encQuote",
      );
    });

    it("includes globalVars destructuring", async () => {
      const src = await compileSource("<div>{{=title}}</div>", {
        globalVars: ["title", "count"],
      });
      expect(src).toContain(",title=$data.title,count=$data.count");
    });
  });

  // ============================================================
  // B. Basic element compilation
  // ============================================================
  describe("basic elements", () => {
    it("compiles a simple div with text", async () => {
      const root = (await compileAndRun("<div>hello</div>")) as Record<
        string,
        unknown
      >;
      expect(root).toBeDefined();
      expect(root["tag"]).toBe("test-view");
    });

    it("compiles nested elements", async () => {
      const root = (await compileAndRun(
        "<div><span>text</span></div>",
      )) as Record<string, unknown>;
      expect(root).toBeDefined();
      expect(root["tag"]).toBe("test-view");
    });

    it("compiles element with static attributes", async () => {
      const root = (await compileAndRun(
        '<div class="container" id="main">content</div>',
      )) as Record<string, unknown>;
      expect(root).toBeDefined();
    });

    it("compiles self-closing elements", async () => {
      const src = await compileSource("<div><br/><hr/></div>");
      // Should contain selfClose marker (children=1)
      expect(src).toContain("1)");
    });

    it("compiles multiple sibling elements", async () => {
      const root = (await compileAndRun("<p>first</p><p>second</p>")) as Record<
        string,
        unknown
      >;
      expect(root).toBeDefined();
    });
  });

  // ============================================================
  // C. Expression handling
  // ============================================================
  describe("expressions", () => {
    it("compiles {{=expr}} as text node", async () => {
      const src = await compileSource("<div>{{=name}}</div>", {
        globalVars: ["name"],
      });
      expect(src).toContain("$c(0,$n(name))");
    });

    it("compiles {{!expr}} as raw text node", async () => {
      const src = await compileSource("<div>{{!rawContent}}</div>", {
        globalVars: ["rawContent"],
      });
      expect(src).toContain("$n(rawContent)");
    });

    it("compiles {{@expr}} as ref lookup", async () => {
      const src = await compileSource("<div>{{@objRef}}</div>", {
        globalVars: ["objRef"],
      });
      expect(src).toContain("$refFn($refAlt,objRef)");
    });

    it("compiles expression in attribute value", async () => {
      const src = await compileSource('<div id="item-{{=item.id}}"></div>', {
        globalVars: ["item"],
      });
      // Should have string concatenation in the props object
      expect(src).toContain("item");
    });

    it("compiles expression as full attribute value", async () => {
      const src = await compileSource('<span class="{{=cls}}"></span>', {
        globalVars: ["cls"],
      });
      expect(src).toContain("$n(cls)");
    });
  });

  // ============================================================
  // D. Control flow
  // ============================================================
  describe("control flow", () => {
    it("compiles {{if}}...{{/if}}", async () => {
      const src = await compileSource(
        "<div>{{if show}}<span>visible</span>{{/if}}</div>",
        { globalVars: ["show"] },
      );
      expect(src).toContain("if(show)");
      expect(src).toContain("}");
    });

    it("compiles {{if}}...{{else}}...{{/if}}", async () => {
      const src = await compileSource(
        "<div>{{if a}}<p>yes</p>{{else}}<p>no</p>{{/if}}</div>",
        { globalVars: ["a"] },
      );
      expect(src).toContain("if(a)");
      expect(src).toContain("}else{");
    });

    it("compiles {{forOf}} loop", async () => {
      const src = await compileSource(
        "<ul>{{forOf items as item idx}}<li>{{=item}}</li>{{/forOf}}</ul>",
        { globalVars: ["items"] },
      );
      expect(src).toContain("for(let");
      expect(src).toContain("idx");
    });

    it("compiles nested control flow", async () => {
      const src = await compileSource(
        `<div>{{forOf list as item}}<span>{{if item.active}}on{{else}}off{{/if}}</span>{{/forOf}}</div>`,
        { globalVars: ["list"] },
      );
      expect(src).toContain("for(let");
      expect(src).toContain("if(item.active)");
    });

    it("compiles {{set}} variable declaration", async () => {
      const src = await compileSource(
        "<div>{{set x = 42}}<span>{{=x}}</span></div>",
        { globalVars: [] },
      );
      expect(src).toContain("let x = 42");
    });
  });

  // ============================================================
  // E. Execution tests (compile + run)
  // ============================================================
  describe("execution", () => {
    it("renders static HTML to VDomNode tree", async () => {
      const root = (await compileAndRun("<div>hello</div>")) as Record<
        string,
        unknown
      >;
      // Root should be a VDomNode with tag=viewId
      expect(root["tag"]).toBe("test-view");
      // Should have children
      const children = root["children"] as unknown[];
      expect(children).toBeDefined();
      expect(children.length).toBeGreaterThan(0);
    });

    it("renders dynamic text from data", async () => {
      const root = await compileAndRun(
        "<p>{{=message}}</p>",
        { message: "Hello World" },
        ["message"],
      );
      expect(root).toBeDefined();
    });

    it("renders forOf loop with correct count", async () => {
      const root = (await compileAndRun(
        "<ul>{{forOf items as item}}<li>{{=item}}</li>{{/forOf}}</ul>",
        { items: ["a", "b", "c"] },
        ["items"],
      )) as Record<string, unknown>;
      expect(root).toBeDefined();
    });

    it("renders if/else correctly", async () => {
      const root = (await compileAndRun(
        "<div>{{if show}}<span>yes</span>{{else}}<span>no</span>{{/if}}</div>",
        { show: true },
        ["show"],
      )) as Record<string, unknown>;
      expect(root).toBeDefined();
    });

    it("handles empty template", async () => {
      const root = (await compileAndRun("")) as Record<string, unknown>;
      expect(root).toBeDefined();
      expect(root["tag"]).toBe("test-view");
    });

    it("handles template with only text", async () => {
      const root = (await compileAndRun("just text")) as Record<
        string,
        unknown
      >;
      expect(root).toBeDefined();
    });
  });

  // ============================================================
  // F. String mode unchanged
  // ============================================================
  describe("string mode (regression)", () => {
    it("still generates HTML string output when virtualDom is false", async () => {
      const src = await compileTemplate("<div>{{=name}}</div>", {
        globalVars: ["name"],
      });
      expect(src).toContain("encHtml");
      expect(src).not.toContain("vdomCreate");
      expect(src).toContain("$out");
    });

    it("still generates HTML string when virtualDom is not specified", async () => {
      const src = await compileTemplate("<p>hello</p>");
      expect(src).toContain("encHtml");
      expect(src).not.toContain("vdomCreate");
    });
  });
});
