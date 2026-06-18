import { describe, it, expect } from "vitest";
import {
  vdomCreate,
  vdomCreateNode,
  vdomSetChildNodes,
  vdomSetAttributes,
  createVDomRef,
} from "../src/vdom";
import { V_TEXT_NODE, TAG_STATIC_KEY, SPLITTER } from "../src/common";
import { Frame } from "../src/frame";
import type { VDomNode, FrameInterface } from "../src/types";

function makeFrame(id: string): FrameInterface {
  const el = document.createElement("div");
  el.id = id;
  document.body.appendChild(el);
  return new Frame(id);
}

function cleanup(id: string): void {
  const el = document.getElementById(id);
  if (el) el.remove();
  (Frame.getAll() as Map<string, Frame>).delete(id);
}

describe("VDOM Engine", () => {
  // ============================================================
  // vdomCreate — Node Creation
  // ============================================================
  describe("vdomCreate", () => {
    it("creates a text node with tag = V_TEXT_NODE", () => {
      const node = vdomCreate(0, "hello");
      expect(node.tag).toBe(V_TEXT_NODE);
      expect(node.html).toBe("hello");
      expect(node.children).toBeUndefined();
      expect(node.attrs).toBeUndefined();
    });

    it("creates a text node with null props → empty string", () => {
      const node = vdomCreate(0, null);
      expect(node.tag).toBe(V_TEXT_NODE);
      expect(node.html).toBe("");
    });

    it("creates a raw HTML node when children is truthy", () => {
      const node = vdomCreate(0, "<b>bold</b>", 1);
      expect(node.tag).toBe(SPLITTER);
      expect(node.html).toBe("<b>bold</b>");
    });

    it("creates an element node with attrs and children", () => {
      const textChild = vdomCreate(0, "world");
      const node = vdomCreate("div", { class: "row" }, [textChild]);
      expect(node.tag).toBe("div");
      expect(node.attrs).toBe('<div class="row"');
      expect(node.attrsMap).toEqual({ class: "row" });
      expect(node.children).toHaveLength(1);
      expect(node.html).toBe("world"); // text child encoded in innerHTML
    });

    it("creates a self-closing element when children = 1", () => {
      const node = vdomCreate("br", null, 1);
      expect(node.tag).toBe("br");
      expect(node.selfClose).toBe(true);
      expect(node.children).toBeUndefined();
    });

    it("extracts static key (_) as compareKey and removes from props", () => {
      const node = vdomCreate("span", {
        [TAG_STATIC_KEY]: "icon-a",
        class: "glyphicon",
      });
      expect(node.compareKey).toBe("icon-a");
      expect(node.attrsMap?.[TAG_STATIC_KEY]).toBeUndefined();
      expect(node.attrsMap?.["class"]).toBe("glyphicon");
    });

    it("uses id as compareKey (keeps id in attrsMap)", () => {
      const node = vdomCreate("div", { id: "main" });
      expect(node.compareKey).toBe("main");
      expect(node.attrsMap?.["id"]).toBe("main");
    });

    it("serializes nested children into innerHTML", () => {
      const text = vdomCreate(0, "click me");
      const btn = vdomCreate("button", { id: "run", class: "btn" }, [text]);
      const wrapper = vdomCreate("div", { class: "container" }, [btn]);
      expect(wrapper.html).toContain("<button");
      expect(wrapper.html).toContain('id="run"');
      expect(wrapper.html).toContain("click me");
      expect(wrapper.html).toContain("</button>");
    });

    it("builds reused map for keyed children", () => {
      const child1 = vdomCreate("li", { id: "a" }, [vdomCreate(0, "A")]);
      const child2 = vdomCreate("li", { id: "b" }, [vdomCreate(0, "B")]);
      const parent = vdomCreate("ul", null, [child1, child2]);
      expect(parent.reused).toEqual({ a: 1, b: 1 });
      expect(parent.reusedTotal).toBe(2);
    });

    it("detects v-lark sub-views", () => {
      const node = vdomCreate("div", { "v-lark": "components/child" });
      expect(node.isLarkView).toBe("components/child");
      expect(node.views).toHaveLength(1);
      expect(node.views![0][0]).toBe("components/child");
      expect(node.compareKey).toBe("div" + SPLITTER + "components/child");
    });

    it("deletes false/null props from attrsMap", () => {
      const node = vdomCreate("input", {
        disabled: false,
        readonly: null,
        type: "text",
      });
      expect(node.attrsMap?.["disabled"]).toBeUndefined();
      expect(node.attrsMap?.["readonly"]).toBeUndefined();
      expect(node.attrsMap?.["type"]).toBe("text");
    });

    it("sets true boolean props to empty string", () => {
      const node = vdomCreate("input", { checked: true });
      expect(node.attrsMap?.["checked"]).toBe("");
    });
  });

  // ============================================================
  // vdomCreateNode — VDOM to DOM conversion
  // ============================================================
  describe("vdomCreateNode", () => {
    it("creates a text node from VDomNode", () => {
      const ref = createVDomRef("test");
      const owner = document.createElement("div");
      const vnode = vdomCreate(0, "hello world");
      const dom = vdomCreateNode(vnode, owner, ref);
      expect(dom.nodeType).toBe(Node.TEXT_NODE);
      expect(dom.nodeValue).toBe("hello world");
    });

    it("creates an element node with attributes and innerHTML", () => {
      const ref = createVDomRef("test");
      const owner = document.createElement("div");
      const text = vdomCreate(0, "content");
      const vnode = vdomCreate("p", { class: "para", id: "p1" }, [text]);
      const dom = vdomCreateNode(vnode, owner, ref) as Element;
      expect(dom.tagName).toBe("P");
      expect(dom.getAttribute("class")).toBe("para");
      expect(dom.getAttribute("id")).toBe("p1");
      expect(dom.innerHTML).toBe("content");
    });

    it("handles SVG namespace", () => {
      const ref = createVDomRef("test");
      const owner = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      const vnode = vdomCreate("circle", { r: "10" });
      const dom = vdomCreateNode(vnode, owner, ref) as Element;
      expect(dom.namespaceURI).toBe("http://www.w3.org/2000/svg");
      expect(dom.tagName).toBe("circle");
    });
  });

  // ============================================================
  // vdomSetAttributes — Attribute diffing
  // ============================================================
  describe("vdomSetAttributes", () => {
    it("adds new attributes when no lastVDom", () => {
      const ref = createVDomRef("test");
      const el = document.createElement("div");
      const vnode = vdomCreate("div", { class: "foo", id: "bar" });
      const changed = vdomSetAttributes(el, vnode, ref);
      expect(changed).toBe(1);
      expect(el.getAttribute("class")).toBe("foo");
      expect(el.getAttribute("id")).toBe("bar");
    });

    it("removes old attributes not in new", () => {
      const ref = createVDomRef("test");
      const el = document.createElement("div");
      el.setAttribute("class", "old");
      el.setAttribute("data-x", "gone");
      const oldVDom = vdomCreate("div", { class: "old", "data-x": "gone" });
      const newVDom = vdomCreate("div", { class: "new" });
      const changed = vdomSetAttributes(el, newVDom, ref, oldVDom);
      expect(changed).toBe(1);
      expect(el.getAttribute("class")).toBe("new");
      expect(el.hasAttribute("data-x")).toBe(false);
    });

    it("returns 0 when attributes unchanged", () => {
      const ref = createVDomRef("test");
      const el = document.createElement("div");
      el.setAttribute("class", "same");
      const oldVDom = vdomCreate("div", { class: "same" });
      const newVDom = vdomCreate("div", { class: "same" });
      const changed = vdomSetAttributes(el, newVDom, ref, oldVDom);
      expect(changed).toBe(0);
    });

    it("sets special attributes as DOM properties via ref.nodeProps", () => {
      const ref = createVDomRef("test");
      const el = document.createElement("input");
      const newVDom = vdomCreate("input", { value: "new" }, null, {
        value: "value",
      });
      vdomSetAttributes(el, newVDom, ref);
      // The property assignment is deferred in ref.nodeProps
      expect(ref.nodeProps).toHaveLength(1);
      expect(ref.nodeProps[0][1]).toBe("value");
      expect(ref.nodeProps[0][2]).toBe("new");
    });
  });

  // ============================================================
  // vdomSetChildNodes — Double-pointer diff
  // ============================================================
  describe("vdomSetChildNodes", () => {
    it("fast path: sets innerHTML on first render (no lastVDom)", () => {
      const ref = createVDomRef("test");
      const el = document.createElement("div");
      const frame = makeFrame("vdom-test-1");
      const view = { rendered: false, endUpdate: () => {} } as any;
      const newVDom = vdomCreate("div", null, [
        vdomCreate("p", null, [vdomCreate(0, "hello")]),
      ]);
      vdomSetChildNodes(
        el,
        undefined,
        newVDom,
        ref,
        frame,
        new Set(),
        view,
        () => {},
      );
      expect(ref.changed).toBe(1);
      expect(el.innerHTML).toContain("<p>hello</p>");
      cleanup("vdom-test-1");
    });

    it("no-op when both old and new have no children", () => {
      const ref = createVDomRef("test");
      const el = document.createElement("div");
      const frame = makeFrame("vdom-test-2");
      const view = { rendered: true, endUpdate: () => {} } as any;
      const oldVDom = vdomCreate("div", null, null);
      const newVDom = vdomCreate("div", null, null);
      vdomSetChildNodes(
        el,
        oldVDom,
        newVDom,
        ref,
        frame,
        new Set(),
        view,
        () => {},
      );
      expect(ref.changed).toBe(0);
      cleanup("vdom-test-2");
    });

    it("appends new children when old is empty", () => {
      const ref = createVDomRef("test");
      const el = document.createElement("ul");
      const frame = makeFrame("vdom-test-3");
      const view = { rendered: true, endUpdate: () => {} } as any;
      const oldVDom = vdomCreate("ul", null, []);
      const newVDom = vdomCreate("ul", null, [
        vdomCreate("li", { id: "a" }, [vdomCreate(0, "A")]),
        vdomCreate("li", { id: "b" }, [vdomCreate(0, "B")]),
      ]);

      vdomSetChildNodes(
        el,
        oldVDom,
        newVDom,
        ref,
        frame,
        new Set(),
        view,
        () => {},
      );
      expect(ref.changed).toBe(1);
      expect(el.children.length).toBe(2);
      expect(el.children[0].tagName).toBe("LI");
      expect(el.children[0].textContent).toBe("A");
      cleanup("vdom-test-3");
    });

    it("removes extra old children", () => {
      const ref = createVDomRef("test");
      const el = document.createElement("ul");
      el.innerHTML = "<li>A</li><li>B</li><li>C</li>";
      const frame = makeFrame("vdom-test-4");
      const view = { rendered: true, endUpdate: () => {} } as any;

      const oldVDom = vdomCreate("ul", null, [
        vdomCreate("li", null, [vdomCreate(0, "A")]),
        vdomCreate("li", null, [vdomCreate(0, "B")]),
        vdomCreate("li", null, [vdomCreate(0, "C")]),
      ]);
      const newVDom = vdomCreate("ul", null, [
        vdomCreate("li", null, [vdomCreate(0, "A")]),
      ]);

      vdomSetChildNodes(
        el,
        oldVDom,
        newVDom,
        ref,
        frame,
        new Set(),
        view,
        () => {},
      );
      expect(ref.changed).toBe(1);
      expect(el.children.length).toBe(1);
      expect(el.children[0].textContent).toBe("A");
      cleanup("vdom-test-4");
    });

    it("preserves node identity on keyed reorder", () => {
      const ref = createVDomRef("test");
      const el = document.createElement("ul");
      el.innerHTML = '<li id="a">A</li><li id="b">B</li><li id="c">C</li>';

      const nodeA = el.children[0];
      const nodeB = el.children[1];
      const nodeC = el.children[2];

      const frame = makeFrame("vdom-test-5");
      const view = { rendered: true, endUpdate: () => {} } as any;

      // Old: a, b, c → New: c, a, b
      const oldVDom = vdomCreate("ul", null, [
        vdomCreate("li", { id: "a" }, [vdomCreate(0, "A")]),
        vdomCreate("li", { id: "b" }, [vdomCreate(0, "B")]),
        vdomCreate("li", { id: "c" }, [vdomCreate(0, "C")]),
      ]);
      const newVDom = vdomCreate("ul", null, [
        vdomCreate("li", { id: "c" }, [vdomCreate(0, "C")]),
        vdomCreate("li", { id: "a" }, [vdomCreate(0, "A")]),
        vdomCreate("li", { id: "b" }, [vdomCreate(0, "B")]),
      ]);

      vdomSetChildNodes(
        el,
        oldVDom,
        newVDom,
        ref,
        frame,
        new Set(),
        view,
        () => {},
      );

      // Nodes should be reordered, not re-created
      expect(el.children[0]).toBe(nodeC);
      expect(el.children[1]).toBe(nodeA);
      expect(el.children[2]).toBe(nodeB);
      cleanup("vdom-test-5");
    });

    it("updates text node value in place", () => {
      const ref = createVDomRef("test");
      const el = document.createElement("div");
      el.innerHTML = "<span>old</span>";
      const frame = makeFrame("vdom-test-6");
      const view = { rendered: true, endUpdate: () => {} } as any;

      const oldVDom = vdomCreate("div", null, [
        vdomCreate("span", null, [vdomCreate(0, "old")]),
      ]);
      const newVDom = vdomCreate("div", null, [
        vdomCreate("span", null, [vdomCreate(0, "new")]),
      ]);

      vdomSetChildNodes(
        el,
        oldVDom,
        newVDom,
        ref,
        frame,
        new Set(),
        view,
        () => {},
      );

      expect(ref.changed).toBe(1);
      expect(el.querySelector("span")?.textContent).toBe("new");
      cleanup("vdom-test-6");
    });

    it("static key short-circuit: skips subtree with matching _ key", () => {
      const ref = createVDomRef("test");
      const el = document.createElement("div");
      el.innerHTML = '<span class="icon">x</span>';
      const spanNode = el.children[0];
      const frame = makeFrame("vdom-test-7");
      const view = { rendered: true, endUpdate: () => {} } as any;

      const oldVDom = vdomCreate("div", null, [
        vdomCreate("span", {
          [TAG_STATIC_KEY]: "icon",
          class: "icon",
        }),
      ]);
      const newVDom = vdomCreate("div", null, [
        vdomCreate("span", {
          [TAG_STATIC_KEY]: "icon",
          class: "icon-updated",
        }),
      ]);

      vdomSetChildNodes(
        el,
        oldVDom,
        newVDom,
        ref,
        frame,
        new Set(),
        view,
        () => {},
      );

      // Node should be preserved without attribute update
      expect(el.children[0]).toBe(spanNode);
      // class should NOT have been updated (static key short-circuits)
      expect(el.children[0].getAttribute("class")).toBe("icon");
      cleanup("vdom-test-7");
    });

    it("replaces node on tag mismatch", () => {
      const ref = createVDomRef("test");
      const el = document.createElement("div");
      el.innerHTML = "<span>old</span>";
      const frame = makeFrame("vdom-test-8");
      const view = { rendered: true, endUpdate: () => {} } as any;

      const oldVDom = vdomCreate("div", null, [
        vdomCreate("span", null, [vdomCreate(0, "old")]),
      ]);
      const newVDom = vdomCreate("div", null, [
        vdomCreate("p", null, [vdomCreate(0, "new")]),
      ]);

      vdomSetChildNodes(
        el,
        oldVDom,
        newVDom,
        ref,
        frame,
        new Set(),
        view,
        () => {},
      );

      expect(ref.changed).toBe(1);
      expect(el.children[0].tagName).toBe("P");
      expect(el.children[0].textContent).toBe("new");
      cleanup("vdom-test-8");
    });
  });

  // ============================================================
  // createVDomRef
  // ============================================================
  describe("createVDomRef", () => {
    it("creates a ref with correct defaults", () => {
      const ref = createVDomRef("view-123");
      expect(ref.viewId).toBe("view-123");
      expect(ref.viewRenders).toEqual([]);
      expect(ref.nodeProps).toEqual([]);
      expect(ref.asyncCount).toBe(0);
      expect(ref.changed).toBe(0);
      expect(ref.domOps).toEqual([]);
    });
  });
});
