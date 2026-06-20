import { describe, it, expect } from "vitest";
import { compileTemplate } from "../src/compiler";
import { vdomCreate } from "../src/vdom";
import { V_TEXT_NODE, SPLITTER } from "../src/common";
import * as runtime from "../src/runtime";
import type { VDomNode } from "../src/types";

// ===== Helpers =====

/**
 * Compile a template in VDOM mode and execute it with the real vdomCreate
 * and real runtime helpers. Returns the root VDomNode.
 *
 * The compiled module uses ES module imports that cannot run directly in
 * Node, so we transform them to local references before evaluation via
 * new Function.
 */
async function compileAndRun(
  template: string,
  data: Record<string, unknown> = {},
  globalVars: string[] = [],
): Promise<VDomNode> {
  const moduleSource = await compileTemplate(template, {
    virtualDom: true,
    globalVars,
  });

  const transformed = moduleSource
    .replace(
      /import\s*\{[^}]*\}\s*from\s*["']@lark\.js\/mvc["'];?\n?/,
      "const __larkC = __mvc.vdomCreate;\n",
    )
    .replace(
      /import\s*\{[^}]*\}\s*from\s*["']@lark\.js\/mvc\/runtime["'];?\n?/,
      "const { strSafe: __larkStrSafe, encUri: __larkEncUri, encQuote: __larkEncQuote, refFn: __larkRefFn } = __runtime;\n",
    )
    .replace("export default function", "return function");

  const factory = new Function("__mvc", "__runtime", transformed);
  const templateFn = factory({ vdomCreate }, runtime);
  return templateFn(data, "test-view", null) as VDomNode;
}

/**
 * Get the compiled module source for string-level inspection.
 */
async function compileSource(
  template: string,
  options: { debug?: boolean; globalVars?: string[] } = {},
): Promise<string> {
  return compileTemplate(template, { virtualDom: true, ...options });
}

// ===== Tests =====

describe("VDOM Compiler", () => {
  // ===== A. Module output format =====
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
      expect(src).toContain("encQuote as __larkEncQuote");
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

  // ===== B. Basic element compilation =====
  describe("basic elements", () => {
    it("compiles a simple div with text", async () => {
      const root = await compileAndRun("<div>hello</div>");
      expect(root.tag).toBe("test-view");
    });

    it("compiles nested elements", async () => {
      const root = await compileAndRun("<div><span>text</span></div>");
      expect(root.tag).toBe("test-view");
    });

    it("compiles element with static attributes", async () => {
      const root = await compileAndRun(
        '<div class="container" id="main">content</div>',
      );
      expect(root).toBeDefined();
    });

    it("compiles self-closing elements", async () => {
      const src = await compileSource("<div><br/><hr/></div>");
      expect(src).toMatch(/\$c\('br',\w+,1\)/);
      expect(src).toMatch(/\$c\('hr',\w+,1\)/);
    });

    it("compiles multiple sibling elements", async () => {
      const root = await compileAndRun("<p>first</p><p>second</p>");
      expect(root.tag).toBe("test-view");
    });
  });

  // ===== C. Expression handling =====
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
      expect(src).toContain("item");
    });

    it("compiles expression as full attribute value", async () => {
      const src = await compileSource('<span class="{{=cls}}"></span>', {
        globalVars: ["cls"],
      });
      expect(src).toContain("$n(cls)");
    });
  });

  // ===== D. Control flow =====
  describe("control flow", () => {
    it("compiles {{if}}...{{/if}}", async () => {
      const src = await compileSource(
        "<div>{{if show}}<span>visible</span>{{/if}}</div>",
        { globalVars: ["show"] },
      );
      expect(src).toContain("if(show)");
      expect(src).toContain("visible");
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

  // ===== E. Execution tests (compile + run with real vdomCreate) =====
  describe("execution", () => {
    it("renders static HTML to VDomNode tree", async () => {
      const root = await compileAndRun("<div>hello</div>");
      expect(root.tag).toBe("test-view");
      expect(root.html).toBe("<div>hello</div>");
      expect(root.children).toHaveLength(1);
      const divChild = root.children![0] as VDomNode;
      expect(divChild.tag).toBe("div");
      expect(divChild.html).toBe("hello");
    });

    it("renders dynamic text from data", async () => {
      const root = await compileAndRun(
        "<p>{{=message}}</p>",
        { message: "Hello World" },
        ["message"],
      );
      expect(root.tag).toBe("test-view");
      expect(root.html).toContain("Hello World");
      const pChild = root.children![0] as VDomNode;
      expect(pChild.tag).toBe("p");
      const textNode = pChild.children![0] as VDomNode;
      expect(textNode.tag).toBe(V_TEXT_NODE);
      expect(textNode.html).toBe("Hello World");
    });

    it("escapes HTML entities in {{=}} text output", async () => {
      const root = await compileAndRun(
        "<div>{{=content}}</div>",
        { content: "<script>alert(1)</script>" },
        ["content"],
      );
      // The text node stores the raw string value; encoding happens when
      // the parent element serializes its innerHTML (via encodeHTML).
      const textNode = root.children![0]!.children![0] as VDomNode;
      expect(textNode.tag).toBe(V_TEXT_NODE);
      expect(textNode.html).toBe("<script>alert(1)</script>");
      // The parent div's serialized html must contain the encoded form.
      const div = root.children![0] as VDomNode;
      expect(div.html).toContain("&lt;script&gt;");
      expect(div.html).not.toContain("<script>");
    });

    it("renders forOf loop with correct children count", async () => {
      const root = await compileAndRun(
        "<ul>{{forOf items as item}}<li>{{=item}}</li>{{/forOf}}</ul>",
        { items: ["a", "b", "c"] },
        ["items"],
      );
      expect(root.tag).toBe("test-view");
      const ul = root.children![0] as VDomNode;
      expect(ul.tag).toBe("ul");
      expect(ul.children).toHaveLength(3);
      for (const li of ul.children!) {
        expect((li as VDomNode).tag).toBe("li");
      }
      expect((ul.children![0] as VDomNode).html).toContain("a");
      expect((ul.children![2] as VDomNode).html).toContain("c");
    });

    it("renders if/else -- true branch", async () => {
      const root = await compileAndRun(
        "<div>{{if show}}<span class='yes'>visible</span>{{else}}<span class='no'>hidden</span>{{/if}}</div>",
        { show: true },
        ["show"],
      );
      expect(root.html).toContain("visible");
      expect(root.html).not.toContain("hidden");
      expect(root.html).toContain('class="yes"');
    });

    it("renders if/else -- false branch", async () => {
      const root = await compileAndRun(
        "<div>{{if show}}<span class='yes'>visible</span>{{else}}<span class='no'>hidden</span>{{/if}}</div>",
        { show: false },
        ["show"],
      );
      expect(root.html).toContain("hidden");
      expect(root.html).not.toContain("visible");
      expect(root.html).toContain('class="no"');
    });

    it("handles empty template", async () => {
      const root = await compileAndRun("");
      expect(root.tag).toBe("test-view");
      expect(root.html).toBe("");
    });

    it("handles template with only text", async () => {
      const root = await compileAndRun("just text");
      expect(root.tag).toBe("test-view");
      expect(root.html).toBe("just text");
      expect(root.children).toHaveLength(1);
      expect((root.children![0] as VDomNode).tag).toBe(V_TEXT_NODE);
      expect((root.children![0] as VDomNode).html).toBe("just text");
    });

    it("renders null/undefined as empty string in {{=}}", async () => {
      const root = await compileAndRun("<p>{{=val}}</p>", { val: null }, [
        "val",
      ]);
      const p = root.children![0] as VDomNode;
      const textNode = p.children![0] as VDomNode;
      expect(textNode.html).toBe("");
    });

    it("renders nested loops correctly", async () => {
      const root = await compileAndRun(
        "<div>{{forOf rows as row}}{{forOf row as cell}}<span>{{=cell}}</span>{{/forOf}}{{/forOf}}</div>",
        {
          rows: [
            [1, 2],
            [3, 4],
          ],
        },
        ["rows"],
      );
      expect(root.html).toContain("1");
      expect(root.html).toContain("4");
      const div = root.children![0] as VDomNode;
      expect(div.children!.length).toBe(4);
    });
  });

  // ===== F. String mode regression =====
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

  // ===== G. Edge cases =====
  describe("edge cases", () => {
    it("handles whitespace-only text nodes", async () => {
      const root = await compileAndRun("<div>   </div>");
      // Whitespace may or may not be trimmed by the compiler.
      // If it produces a text node, verify the structure is valid.
      expect(root.tag).toBe("test-view");
      const div = root.children![0] as VDomNode;
      expect(div.tag).toBe("div");
    });

    it("renders {{set}} and uses the declared variable", async () => {
      const root = await compileAndRun(
        "<div>{{set x = 42}}<span>{{=x}}</span></div>",
        {},
        [],
      );
      expect(root.html).toContain("42");
    });

    it("renders forOf with index variable", async () => {
      const root = await compileAndRun(
        "<ul>{{forOf items as item idx}}<li>{{=idx}}:{{=item}}</li>{{/forOf}}</ul>",
        { items: ["x", "y"] },
        ["items"],
      );
      expect(root.html).toContain("0");
      expect(root.html).toContain("x");
      expect(root.html).toContain("1");
      expect(root.html).toContain("y");
      const ul = root.children![0] as VDomNode;
      expect(ul.children).toHaveLength(2);
    });

    it("renders multiple root-level siblings", async () => {
      const root = await compileAndRun("<p>first</p><p>second</p>");
      expect(root.children).toHaveLength(2);
      expect((root.children![0] as VDomNode).tag).toBe("p");
      expect((root.children![1] as VDomNode).tag).toBe("p");
      expect(root.html).toContain("first");
      expect(root.html).toContain("second");
    });

    it("renders void elements (input) as self-closing", async () => {
      const root = await compileAndRun('<div><input type="text"/></div>');
      const div = root.children![0] as VDomNode;
      expect(div.children).toHaveLength(1);
      const input = div.children![0] as VDomNode;
      expect(input.tag).toBe("input");
      expect(input.selfClose).toBe(true);
    });
  });
});
