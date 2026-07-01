/**
 * Investigation: VDOM mode `v-lark` sub-view compatibility.
 *
 * Verifies whether the `v-lark` attribute (LARK_VIEW = "v-lark") can work
 * across the full VDOM lifecycle: first render, diff update, and dynamic
 * creation of new v-lark elements.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  vdomCreate,
  vdomSetChildNodes,
  createVDomRef,
  vdomCreateNode,
} from "../src/vdom";
import { LARK_VIEW } from "../src/common";
import {
  Frame,
  createFrame,
  registerViewClass,
  invalidateViewClass,
  getViewClassRegistry,
} from "../src/frame";
import { defineView } from "../src/view";
import type { VDomNode, FrameObj } from "../src/types";

function makeFrame(id: string): FrameObj {
  const el = document.createElement("div");
  el.id = id;
  document.body.appendChild(el);
  return createFrame(id);
}

function cleanup(): void {
  for (const [id] of Frame.getAll()) {
    const el = document.getElementById(id);
    if (el) el.remove();
    Frame.getAll().delete(id);
  }
}

describe("VDOM v-lark compatibility investigation", () => {
  beforeEach(() => {
    const reg = getViewClassRegistry();
    for (const key of Object.keys(reg)) invalidateViewClass(key);
  });
  afterEach(() => cleanup());

  it("setAttribute('v-lark', ...) throws InvalidCharacterError in jsdom", () => {
    const el = document.createElement("div");
    let err: unknown;
    try {
      el.setAttribute(LARK_VIEW, "test/child");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(DOMException);
    expect((err as DOMException).name).toBe("InvalidCharacterError");
  });

  it("innerHTML parsing preserves v-lark attribute on the DOM", () => {
    const el = document.createElement("div");
    el.innerHTML = `<div ${LARK_VIEW}="test/child" p-lark-g="hello"></div>`;
    const child = el.firstElementChild as HTMLElement;
    expect(child).not.toBeNull();
    // The v-lark attribute should be accessible via getAttribute
    expect(child.getAttribute(LARK_VIEW)).toBe("test/child");
    expect(child.getAttribute("p-lark-g")).toBe("hello");
  });

  it("vdomCreateNode throws when creating a v-lark element (setAttribute path)", () => {
    const vnode = vdomCreate("div", { [LARK_VIEW]: "test/child" });
    const ref = createVDomRef("test");
    const owner = document.createElement("div");
    let err: unknown;
    try {
      vdomCreateNode(vnode, owner, ref);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(DOMException);
  });

  it("vdomSetChildNodes first-render via innerHTML fast path works (no setAttribute)", () => {
    // First render goes through the fast path: realNode.innerHTML = newVDom.html
    // Browser parses the HTML string, preserving v-lark attribute.
    const childVNode = vdomCreate("div", {
      [LARK_VIEW]: "test/child",
      "p-lark-g": "hello",
    });
    const rootVNode = vdomCreate("root", 0, [childVNode]) as VDomNode;

    const root = document.createElement("div");
    root.id = "root-invest-1";
    document.body.appendChild(root);
    const frame = makeFrame("root-invest-1");

    const ref = createVDomRef("root-invest-1");
    expect(() => {
      vdomSetChildNodes(
        root,
        undefined,
        rootVNode,
        ref,
        frame,
        new Set(),
        undefined as never,
        () => {},
      );
    }).not.toThrow();

    // The v-lark element should be in the DOM
    const viewEl = root.querySelector(
      `[${LARK_VIEW.replace("#", "\\#")}]`,
    ) as HTMLElement;
    expect(viewEl).not.toBeNull();
    expect(viewEl.getAttribute(LARK_VIEW)).toBe("test/child");
    expect(viewEl.getAttribute("p-lark-g")).toBe("hello");
  });

  it("vdomSetChildNodes diff update crashes when v-lark element is newly created", () => {
    // Initial state: no v-lark element
    const root = document.createElement("div");
    root.id = "root-invest-2";
    root.innerHTML = "<span>placeholder</span>";
    document.body.appendChild(root);
    const frame = makeFrame("root-invest-2");

    const childVNode = vdomCreate("div", {
      [LARK_VIEW]: "test/child",
      "p-lark-g": "hello",
    });
    const oldVNode = vdomCreate("root", 0, [
      vdomCreate("span", 0, [vdomCreate(0, "placeholder")]),
    ]) as VDomNode;
    const newVNode = vdomCreate("root", 0, [childVNode]) as VDomNode;

    const ref = createVDomRef("root-invest-2");
    let err: unknown;
    try {
      vdomSetChildNodes(
        root,
        oldVNode,
        newVNode,
        ref,
        frame,
        new Set(),
        undefined as never,
        () => {},
      );
    } catch (e) {
      err = e;
    }
    // This SHOULD crash because vdomCreateNode → vdomSetAttributes → setAttribute('v-lark', ...)
    expect(err).toBeInstanceOf(DOMException);
  });

  // ============================================================
  // End-to-end: VDOM mode with defineView
  // ============================================================
  describe("end-to-end VDOM mode defineView", () => {
    it("first render of v-lark child works (innerHTML fast path)", async () => {
      let childReceived: unknown;
      registerViewClass(
        "test/child",
        defineView((ctx, params) => {
          const p = (params || {}) as Record<string, unknown>;
          childReceived = p["msg"];
          ctx.updater.digest({});
          return { template: () => "<div>child</div>" };
        }),
      );

      registerViewClass(
        "test/parent",
        defineView((ctx) => {
          ctx.updater.digest({ greeting: "hello" });
          return {
            // Return a root VDomNode (like the compiler output):
            //   vdomCreate(viewId, 0, [childDiv])
            // The childDiv carries v-lark + p-lark-attributes.
            template: (data: unknown, viewId: string) => {
              const d = (data || {}) as Record<string, unknown>;
              const childDiv = vdomCreate(
                "div",
                {
                  [LARK_VIEW]: "test/child",
                  "p-lark-g": String(d["greeting"]),
                },
                [],
              );
              return vdomCreate(viewId || "root", 0, [childDiv]) as VDomNode;
            },
          };
        }),
      );

      const frame = makeFrame("e2e-1");
      let err: unknown;
      try {
        frame.mountView("test/parent");
        await new Promise((r) => setTimeout(r, 10));
      } catch (e) {
        err = e;
      }

      // First render via innerHTML fast path should work
      expect(err).toBeUndefined();
      expect(childReceived).toBe("hello");
    });

    it("second render (diff) when v-lark element unchanged works", async () => {
      let childReceived: unknown[] = [];
      registerViewClass(
        "test/child",
        defineView((ctx, params) => {
          const p = (params || {}) as Record<string, unknown>;
          childReceived.push(p["msg"]);
          ctx.updater.digest({ msg: String(p["msg"] ?? "") });
          return {
            template: (data: unknown) => {
              const d = (data || {}) as Record<string, unknown>;
              return `<div data-msg="${d["msg"] ?? ""}">child</div>`;
            },
          };
        }),
      );

      registerViewClass(
        "test/parent",
        defineView((ctx) => {
          ctx.updater.digest({ greeting: "first" });
          return {
            template: (data: unknown, viewId: string) => {
              const d = (data || {}) as Record<string, unknown>;
              const childDiv = vdomCreate(
                "div",
                {
                  [LARK_VIEW]: "test/child",
                  "p-lark-g": String(d["greeting"]),
                },
                [],
              );
              return vdomCreate(viewId || "root", 0, [childDiv]) as VDomNode;
            },
          };
        }),
      );

      const frame = makeFrame("e2e-2");
      frame.mountView("test/parent");
      await new Promise((r) => setTimeout(r, 10));

      // Verify DOM state after first render
      const root2 = document.getElementById("e2e-2")!;
      const viewEl2 = root2.querySelector(`[\\${LARK_VIEW}]`) as HTMLElement;
      expect(viewEl2).not.toBeNull();
      expect(viewEl2.getAttribute(LARK_VIEW)).toBe("test/child");
      expect(viewEl2.getAttribute("p-lark-g")).toBe("first");

      // Second render: change prop value → diff path
      frame.view!.updater.set({ greeting: "second" }).digest();
      await new Promise((r) => setTimeout(r, 10));

      // Verify diff updated the DOM attribute
      const viewEl2b = root2.querySelector(`[\\${LARK_VIEW}]`) as HTMLElement;
      expect(viewEl2b.getAttribute("p-lark-g")).toBe("second");

      // Verify child view's updater received the updated prop
      const childFrame = Array.from(Frame.getAll().values()).find(
        (f) => f.parentId === frame.id && f.getViewPath(),
      );
      expect(childFrame?.view?.updater.get<string>("msg")).toBe("second");

      // Setup runs once with initial "first"; props update via updater.set
      expect(childReceived).toContain("first");
    });

    it("dynamic creation of new v-lark element crashes (vdomCreateNode path)", async () => {
      registerViewClass(
        "test/child",
        defineView((ctx) => {
          ctx.updater.digest({});
          return { template: () => "<div>child</div>" };
        }),
      );

      registerViewClass(
        "test/parent",
        defineView((ctx) => {
          ctx.updater.digest({ show: false });
          return {
            template: (data: unknown, viewId: string) => {
              const d = (data || {}) as Record<string, unknown>;
              const children: VDomNode[] = [];
              if (d["show"]) {
                children.push(
                  vdomCreate("div", { [LARK_VIEW]: "test/child" }, []),
                );
              } else {
                children.push(
                  vdomCreate("span", 0, [vdomCreate(0, "placeholder")]),
                );
              }
              return vdomCreate(viewId || "root", 0, children) as VDomNode;
            },
          };
        }),
      );

      const frame = makeFrame("e2e-3");
      frame.mountView("test/parent");
      await new Promise((r) => setTimeout(r, 10));

      // Toggle show=true → diff needs to create a new v-lark element
      let err: unknown;
      try {
        frame.view!.updater.set({ show: true }).digest();
        await new Promise((r) => setTimeout(r, 10));
      } catch (e) {
        err = e;
      }
      // vdomCreateNode → vdomSetAttributes → setAttribute('v-lark', ...) throws
      expect(err).toBeInstanceOf(DOMException);
    });
  });
});
