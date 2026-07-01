/**
 * VDOM mode `v-lark` sub-view compatibility.
 *
 * Verifies that the `v-lark` attribute (LARK_VIEW = "v-lark") works correctly
 * across the full VDOM lifecycle: first render, diff update, and dynamic
 * creation of new v-lark elements.
 *
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { vdomCreate, vdomSetChildNodes, createVDomRef, vdomCreateNode } from "../src/vdom";
import { LARK_VIEW, LARK_PROP_PREFIX } from "../src/common";
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

function findChild(parentFrame: FrameObj): FrameObj | undefined {
  return Array.from(Frame.getAll().values()).find(
    (f) => f.parentId === parentFrame.id && f.getViewPath(),
  );
}

const PROP_MSG = `${LARK_PROP_PREFIX}msg`;

describe("VDOM v-lark compatibility", () => {
  beforeEach(() => {
    const reg = getViewClassRegistry();
    for (const key of Object.keys(reg)) invalidateViewClass(key);
  });
  afterEach(() => cleanup());

  // ============================================================
  // 1. setAttribute works (v-lark is a valid HTML attribute name)
  // ============================================================
  it("setAttribute('v-lark', ...) works without throwing", () => {
    const el = document.createElement("div");
    expect(() => {
      el.setAttribute(LARK_VIEW, "test/child");
    }).not.toThrow();
    expect(el.getAttribute(LARK_VIEW)).toBe("test/child");
  });

  it("innerHTML parsing preserves v-lark attribute on the DOM", () => {
    const el = document.createElement("div");
    el.innerHTML = `<div ${LARK_VIEW}="test/child" ${PROP_MSG}="hello"></div>`;
    const child = el.firstElementChild as HTMLElement;
    expect(child).not.toBeNull();
    expect(child.getAttribute(LARK_VIEW)).toBe("test/child");
    expect(child.getAttribute(PROP_MSG)).toBe("hello");
  });

  // ============================================================
  // 2. vdomCreateNode works for v-lark elements (no crash)
  // ============================================================
  it("vdomCreateNode creates a v-lark element without throwing", () => {
    const vnode = vdomCreate("div", {
      [LARK_VIEW]: "test/child",
      [PROP_MSG]: "hello",
    });
    const ref = createVDomRef("test");
    const owner = document.createElement("div");

    let node: ChildNode | undefined;
    expect(() => {
      node = vdomCreateNode(vnode, owner, ref);
    }).not.toThrow();

    expect(node).toBeDefined();
    const el = node as Element;
    expect(el.getAttribute(LARK_VIEW)).toBe("test/child");
    expect(el.getAttribute(PROP_MSG)).toBe("hello");
  });

  // ============================================================
  // 3. vdomSetChildNodes — first render (innerHTML fast path)
  // ============================================================
  it("vdomSetChildNodes first-render via innerHTML fast path works", () => {
    const childVNode = vdomCreate("div", {
      [LARK_VIEW]: "test/child",
      [PROP_MSG]: "hello",
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

    const viewEl = root.querySelector(`[${LARK_VIEW}]`) as HTMLElement;
    expect(viewEl).not.toBeNull();
    expect(viewEl.getAttribute(LARK_VIEW)).toBe("test/child");
    expect(viewEl.getAttribute(PROP_MSG)).toBe("hello");
  });

  // ============================================================
  // 4. vdomSetChildNodes — diff creates new v-lark element (NO crash)
  // ============================================================
  it("vdomSetChildNodes diff creates new v-lark element without crashing", () => {
    const root = document.createElement("div");
    root.id = "root-invest-2";
    root.innerHTML = "<span>placeholder</span>";
    document.body.appendChild(root);
    const frame = makeFrame("root-invest-2");

    const childVNode = vdomCreate("div", {
      [LARK_VIEW]: "test/child",
      [PROP_MSG]: "hello",
    });
    const oldVNode = vdomCreate("root", 0, [
      vdomCreate("span", 0, [vdomCreate(0, "placeholder")]),
    ]) as VDomNode;
    const newVNode = vdomCreate("root", 0, [childVNode]) as VDomNode;

    const ref = createVDomRef("root-invest-2");
    expect(() => {
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
    }).not.toThrow();

    // The new v-lark element should be in the DOM
    const viewEl = root.querySelector(`[${LARK_VIEW}]`) as HTMLElement;
    expect(viewEl).not.toBeNull();
    expect(viewEl.getAttribute(LARK_VIEW)).toBe("test/child");
    expect(viewEl.getAttribute(PROP_MSG)).toBe("hello");
  });

  // ============================================================
  // 5. End-to-end: VDOM mode with defineView
  // ============================================================
  describe("end-to-end VDOM mode defineView", () => {
    it("first render of v-lark child works", async () => {
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
            template: (data: unknown, viewId: string) => {
              const d = (data || {}) as Record<string, unknown>;
              const childDiv = vdomCreate(
                "div",
                {
                  [LARK_VIEW]: "test/child",
                  [PROP_MSG]: String(d["greeting"]),
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

      expect(err).toBeUndefined();
      expect(childReceived).toBe("hello");
    });

    it("second render (diff) pushes updated props to child", async () => {
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
                  [PROP_MSG]: String(d["greeting"]),
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
      const viewEl2 = root2.querySelector(`[${LARK_VIEW}]`) as HTMLElement;
      expect(viewEl2).not.toBeNull();
      expect(viewEl2.getAttribute(LARK_VIEW)).toBe("test/child");
      expect(viewEl2.getAttribute(PROP_MSG)).toBe("first");

      // Second render: change prop value → diff path
      frame.view!.updater.set({ greeting: "second" }).digest();
      await new Promise((r) => setTimeout(r, 10));

      // Verify diff updated the DOM attribute
      const viewEl2b = root2.querySelector(`[${LARK_VIEW}]`) as HTMLElement;
      expect(viewEl2b.getAttribute(PROP_MSG)).toBe("second");

      // Verify child view's updater received the updated prop
      const childFrame = findChild(frame);
      expect(childFrame?.view?.updater.get<string>("msg")).toBe("second");

      // Setup runs once with initial "first"; props update via updater.set
      expect(childReceived).toContain("first");
    });

    it("dynamic creation of new v-lark element works (no crash)", async () => {
      let childMounted = false;
      registerViewClass(
        "test/child",
        defineView((ctx) => {
          childMounted = true;
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
                children.push(vdomCreate("div", { [LARK_VIEW]: "test/child" }, []));
              } else {
                children.push(vdomCreate("span", 0, [vdomCreate(0, "placeholder")]));
              }
              return vdomCreate(viewId || "root", 0, children) as VDomNode;
            },
          };
        }),
      );

      const frame = makeFrame("e2e-3");
      frame.mountView("test/parent");
      await new Promise((r) => setTimeout(r, 10));

      // Initially no child view
      expect(findChild(frame)).toBeUndefined();

      // Toggle show=true → diff creates a new v-lark element via vdomCreateNode
      let err: unknown;
      try {
        frame.view!.updater.set({ show: true }).digest();
        await new Promise((r) => setTimeout(r, 10));
      } catch (e) {
        err = e;
      }

      // v-lark is a valid attribute name, so vdomCreateNode no longer throws
      expect(err).toBeUndefined();
      expect(childMounted).toBe(true);
      expect(findChild(frame)).toBeDefined();
    });
  });
});
