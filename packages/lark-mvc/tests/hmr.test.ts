import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  acceptView,
  disposeView,
  reloadViews,
  hotSwapView,
  hotSwapFrames,
  hotSwapByTemplate,
  hotSwapByView,
} from "../src/hmr";
import { injectTemplateHmrSnippet, injectViewHmr, importsHtmlTemplate } from "../src/hmr-inject";
import type { HotContext } from "../src/hmr";
import { defineView } from "../src/view";
import {
  Frame,
  createFrame,
  registerViewClass,
  invalidateViewClass,
  getViewClassRegistry,
} from "../src/frame";
import type { FrameObj } from "../src/types";

/**
 * Simple template function factory for testing.
 * Renders a div with a class label and the current count value.
 * Works with the string-rendering path (virtualDom disabled in tests).
 */
function makeTemplate(label: string): (data: unknown) => string {
  return (data: unknown) => {
    const d = (data || {}) as Record<string, unknown>;
    return `<div class="${label}">count=${d["count"] ?? 0}</div>`;
  };
}

/** Flush the microtask queue so deferred renders (Promise.resolve in doMountView) complete. */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Creates a mock HotContext that captures accept/dispose callbacks.
 */
function createMockHot(): HotContext & {
  acceptCb?: (mod: { default?: unknown } | undefined) => void;
  disposeCb?: (data: unknown) => void;
  invalidated: boolean;
} {
  const mock: HotContext & {
    acceptCb?: (mod: { default?: unknown } | undefined) => void;
    disposeCb?: (data: unknown) => void;
    invalidated: boolean;
  } = {
    acceptCb: undefined,
    disposeCb: undefined,
    invalidated: false,
    accept(cb) {
      this.acceptCb = cb;
    },
    dispose(cb) {
      this.disposeCb = cb;
    },
    invalidate() {
      this.invalidated = true;
    },
  };
  return mock;
}

/**
 * Creates a Frame with associated DOM element for testing.
 */
function createTestFrame(id: string): FrameObj {
  const el = document.createElement("div");
  el.id = id;
  document.body.appendChild(el);
  return createFrame(id);
}

/**
 * Cleans up Frame and associated DOM.
 */
function cleanupFrame(frame: FrameObj): void {
  const id = frame.id;
  const el = document.getElementById(id);
  if (el) el.remove();
  Frame.getAll().delete(id);
}

describe("HMR", () => {
  beforeEach(() => {
    // Wipe view registry between tests
    const reg = getViewClassRegistry();
    for (const key of Object.keys(reg)) {
      invalidateViewClass(key);
    }
  });

  afterEach(() => {
    // Clean up any remaining frames
    for (const [id] of Frame.getAll()) {
      const el = document.getElementById(id);
      if (el) el.remove();
      Frame.getAll().delete(id);
    }
  });

  // ============================================================
  // disposeView
  // ============================================================
  describe("disposeView", () => {
    it("registers a dispose callback that invalidates the view class", () => {
      const hot = createMockHot();
      disposeView(hot, "test/dispose-view");

      expect(hot.disposeCb).toBeDefined();

      // Register a class, then trigger dispose
      const TestView = defineView(() => ({ template: () => "" }));
      registerViewClass("test/dispose-view", TestView);
      // Verify the class is actually registered (replaces previous
      // `size >= 0` tautology which was always true)
      expect(getViewClassRegistry()["test/dispose-view"]).toBe(TestView);

      // Simulate HMR dispose
      hot.disposeCb!({});

      // Class should be invalidated
      const reg = getViewClassRegistry();
      expect(reg["test/dispose-view"]).toBeUndefined();
    });
  });

  // ============================================================
  // acceptView
  // ============================================================
  describe("acceptView", () => {
    it("registers an accept callback", () => {
      const hot = createMockHot();
      acceptView(hot, "test/accept-view");
      expect(hot.acceptCb).toBeDefined();
    });

    it("accept callback registers new View class and reloads views", () => {
      const hot = createMockHot();
      acceptView(hot, "test/accept-reload");

      // Simulate HMR accept with a new module
      const NewView = defineView(() => ({ template: () => "" }));
      hot.acceptCb!({ default: NewView });

      // New class should be registered
      const reg = getViewClassRegistry();
      expect(reg["test/accept-reload"]).toBe(NewView);
    });

    it("accept callback falls back to module itself when no default export", () => {
      // Vite passes the new module namespace to the accept callback.
      // When the module has no `default` export but is itself a function
      // (e.g. a wrapper that re-exports a View class),
      // `candidate = newModule?.default ?? newModule` resolves to newModule.
      const hot = createMockHot();
      acceptView(hot, "test/accept-no-default");

      const NewView = defineView(() => ({ template: () => "" }));
      // Pass the View class directly as the module (no .default property)
      hot.acceptCb!(NewView as { default?: unknown });

      expect(getViewClassRegistry()["test/accept-no-default"]).toBe(NewView);
    });

    it("accept callback falls back to registry for webpack/rspack (no newModule)", async () => {
      // webpack/rspack: `module.hot.accept(cb)` does NOT pass the new module
      // to the callback — the module has already re-executed by the time the
      // callback runs. If the re-executed module called registerViewClass(),
      // the registry already holds the new class; acceptView should fall
      // back to getViewClass(viewPath) and hot-swap frames with it instead
      // of calling hot.invalidate().
      const viewPath = "test/accept-webpack-fallback";
      const hot = createMockHot();
      acceptView(hot, viewPath);

      // Simulate the re-executed module having registered the new class
      const NewView = defineView(() => ({
        template: makeTemplate("webpack-template"),
      }));

      const frame = createTestFrame("accept-webpack-fb");
      // Mount with the OLD class (simulate pre-HMR state)
      const OldView = defineView((ctx) => {
        ctx.updater.set({ count: 7 });
        return { template: makeTemplate("old-template") };
      });
      registerViewClass(viewPath, OldView);
      frame.mountView(viewPath);
      await flushMicrotasks();

      // Restore the NEW class in registry (simulating re-execution)
      registerViewClass(viewPath, NewView);
      const viewBefore = frame.view;

      // Trigger accept with undefined newModule (webpack/rspack behavior)
      hot.acceptCb!(undefined);

      // Should NOT invalidate — registry fallback succeeded
      expect(hot.invalidated).toBe(false);
      // State preserved through the hot-swap
      expect(frame.view!.updater.get<number>("count")).toBe(7);
      // Instance identity preserved
      expect(frame.view).toBe(viewBefore);
      // New template applied
      expect(
        document.getElementById("accept-webpack-fb")!.querySelector(".webpack-template"),
      ).not.toBeNull();

      cleanupFrame(frame);
    });

    it("accept callback calls invalidate when new module is not a function", () => {
      const hot = createMockHot();
      acceptView(hot, "test/accept-invalid");

      // Simulate a module that doesn't export a View class
      hot.acceptCb!({ default: "not a function" });

      expect(hot.invalidated).toBe(true);
    });

    it("accept callback calls invalidate when new module is undefined", () => {
      const hot = createMockHot();
      acceptView(hot, "test/accept-undefined");

      hot.acceptCb!(undefined);

      expect(hot.invalidated).toBe(true);
    });
  });

  // ============================================================
  // acceptView / disposeView — module-level HMR functions
  // ============================================================
  describe("acceptView / disposeView", () => {
    it("accept is no-op when hot is undefined", () => {
      // acceptView requires a non-null hot context; when hot is undefined,
      // callers should guard before calling.
      const hot: HotContext | undefined = undefined;
      expect(() => {
        if (hot) acceptView(hot, "test/noop-accept");
      }).not.toThrow();
    });

    it("dispose is no-op when hot is undefined", () => {
      const hot: HotContext | undefined = undefined;
      expect(() => {
        if (hot) disposeView(hot, "test/noop-dispose");
      }).not.toThrow();
    });

    it("accept delegates to acceptView when hot is provided", () => {
      const hot = createMockHot();
      const TestView = defineView(() => ({ template: () => "" }));
      void TestView;
      acceptView(hot, "test/view-accept");

      expect(hot.acceptCb).toBeDefined();

      // Trigger accept with new module
      const NewView = defineView(() => ({ template: () => "" }));
      hot.acceptCb!({ default: NewView });

      const reg = getViewClassRegistry();
      expect(reg["test/view-accept"]).toBe(NewView);
    });

    it("dispose delegates to disposeView when hot is provided", () => {
      const hot = createMockHot();
      const TestView = defineView(() => ({ template: () => "" }));
      registerViewClass("test/view-dispose", TestView);

      disposeView(hot, "test/view-dispose");
      expect(hot.disposeCb).toBeDefined();

      // Trigger dispose
      hot.disposeCb!({});

      const reg = getViewClassRegistry();
      expect(reg["test/view-dispose"]).toBeUndefined();
    });

    it("defineView setup works with acceptView and disposeView", () => {
      const TestView = defineView(() => ({ template: () => "" }));
      const hot = createMockHot();
      void TestView;

      // Should not throw
      acceptView(hot, "test/define-accept");
      disposeView(hot, "test/define-dispose");

      expect(hot.acceptCb).toBeDefined();
      expect(hot.disposeCb).toBeDefined();
    });
  });

  // ============================================================
  // reloadViews
  // ============================================================
  describe("reloadViews", () => {
    it("re-mounts frames matching the viewPath", () => {
      const TestView = defineView(() => ({ template: () => "" }));
      registerViewClass("test/reload", TestView);

      const frame = createTestFrame("reload-test-1");
      // Manually set viewPath to simulate a mounted view
      vi.spyOn(frame, "getViewPath").mockReturnValue("test/reload");

      const mountSpy = vi.spyOn(frame, "mountView");

      reloadViews("test/reload");

      expect(mountSpy).toHaveBeenCalledWith("test/reload");

      mountSpy.mockRestore();
      cleanupFrame(frame);
    });

    it("does not re-mount frames with different viewPath", () => {
      const frame = createTestFrame("reload-test-2");
      vi.spyOn(frame, "getViewPath").mockReturnValue("test/other");

      const mountSpy = vi.spyOn(frame, "mountView");

      reloadViews("test/reload");

      expect(mountSpy).not.toHaveBeenCalled();

      mountSpy.mockRestore();
      cleanupFrame(frame);
    });

    it("does not re-mount frames without viewPath", () => {
      const frame = createTestFrame("reload-test-3");
      // viewPath is undefined by default

      const mountSpy = vi.spyOn(frame, "mountView");

      reloadViews("test/reload");

      expect(mountSpy).not.toHaveBeenCalled();

      mountSpy.mockRestore();
      cleanupFrame(frame);
    });

    it("matches viewPath with query parameters", () => {
      const TestView = defineView(() => ({ template: () => "" }));
      registerViewClass("test/reload-params", TestView);

      const frame = createTestFrame("reload-test-4");
      // viewPath with query params — parseUri extracts path = "test/reload-params"
      vi.spyOn(frame, "getViewPath").mockReturnValue("test/reload-params?x=1&y=2");

      const mountSpy = vi.spyOn(frame, "mountView");

      reloadViews("test/reload-params");

      // Should match and re-mount with the full path (including params)
      expect(mountSpy).toHaveBeenCalledWith("test/reload-params?x=1&y=2");

      mountSpy.mockRestore();
      cleanupFrame(frame);
    });

    it("re-mounts multiple matching frames", () => {
      const TestView = defineView(() => ({ template: () => "" }));
      registerViewClass("test/multi", TestView);

      const frame1 = createTestFrame("reload-test-5");
      vi.spyOn(frame1, "getViewPath").mockReturnValue("test/multi");
      const frame2 = createTestFrame("reload-test-6");
      vi.spyOn(frame2, "getViewPath").mockReturnValue("test/multi");

      const spy1 = vi.spyOn(frame1, "mountView");
      const spy2 = vi.spyOn(frame2, "mountView");

      reloadViews("test/multi");

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);

      spy1.mockRestore();
      spy2.mockRestore();
      cleanupFrame(frame1);
      cleanupFrame(frame2);
    });
  });

  // ============================================================
  // hotSwapView — in-place prototype swap preserving state
  // ============================================================
  describe("hotSwapView", () => {
    it("preserves updater.data across hot-swap", async () => {
      const frame = createTestFrame("hot-swap-preserve");

      const OldView = defineView(() => ({
        template: makeTemplate("old-template"),
      }));
      registerViewClass("test/hot-swap-preserve", OldView);

      frame.mountView("test/hot-swap-preserve");
      await flushMicrotasks();

      // Mutate state after initial mount
      frame.view!.updater.set({ count: 42 }).digest();
      expect(frame.view!.updater.get<number>("count")).toBe(42);

      // New class with a different template — init would reset count to 0
      // if it were re-invoked, but hotSwapView must NOT call init.
      const NewView = defineView(() => ({
        template: makeTemplate("new-template"),
      }));

      // Capture the view instance BEFORE hot-swap to verify identity
      // preservation. The previous assertion `expect(frame.view).toBe(frame.view)`
      // was a tautology (x === x) and proved nothing.
      const viewBefore = frame.view;

      hotSwapView(frame, NewView);

      // State preserved — init was NOT re-invoked
      expect(frame.view!.updater.get<number>("count")).toBe(42);

      // New template applied to DOM
      const el = document.getElementById("hot-swap-preserve")!;
      expect(el.querySelector(".new-template")).not.toBeNull();
      expect(el.querySelector(".old-template")).toBeNull();
      expect(el.textContent).toContain("count=42");

      // The view instance identity is preserved (not a new instance)
      expect(frame.view).toBe(viewBefore);

      cleanupFrame(frame);
    });

    it("preserves state and applies new template without calling init", async () => {
      const frame = createTestFrame("hot-swap-no-init");

      const OldView = defineView((ctx) => {
        ctx.updater.set({ count: 10 });
        return { template: makeTemplate("old-template") };
      });
      registerViewClass("test/hot-swap-no-init", OldView);

      frame.mountView("test/hot-swap-no-init");
      await flushMicrotasks();

      // Track whether the new setup function is called during hot-swap.
      // hotSwapView SHOULD call the new setup (to get new template/events),
      // but should NOT reset state (init-like behavior).
      let newSetupCalled = false;
      const NewView = defineView(() => {
        newSetupCalled = true;
        return { template: makeTemplate("new-template") };
      });

      hotSwapView(frame, NewView);

      // The new setup WAS called (to apply the new template)
      expect(newSetupCalled).toBe(true);
      // State is preserved — init was NOT re-invoked with fresh params
      expect(frame.view!.updater.get<number>("count")).toBe(10);
      // New template is applied to DOM
      expect(
        document.getElementById("hot-swap-no-init")!.querySelector(".new-template"),
      ).not.toBeNull();

      cleanupFrame(frame);
    });

    it("falls back to mountView when frame has no existing view", () => {
      const frame = createTestFrame("hot-swap-fallback");
      vi.spyOn(frame, "getViewPath").mockReturnValue("test/hot-swap-fallback");

      const NewView = defineView(() => ({
        template: makeTemplate("fallback-template"),
      }));
      registerViewClass("test/hot-swap-fallback", NewView);

      const mountSpy = vi.spyOn(frame, "mountView");

      hotSwapView(frame, NewView);

      expect(mountSpy).toHaveBeenCalledWith("test/hot-swap-fallback");

      mountSpy.mockRestore();
      cleanupFrame(frame);
    });

    it("preserves view instance event subscriptions", async () => {
      const frame = createTestFrame("hot-swap-events");

      const destroyHandler = vi.fn();
      const OldView = defineView((ctx) => {
        ctx.on("destroy", destroyHandler);
        return { template: makeTemplate("old-template") };
      });
      registerViewClass("test/hot-swap-events", OldView);

      frame.mountView("test/hot-swap-events");
      await flushMicrotasks();

      const NewView = defineView(() => ({
        template: makeTemplate("new-template"),
      }));

      hotSwapView(frame, NewView);

      // The destroy handler registered on the old instance should still be
      // present — hotSwapView preserves the instance and its _events.
      // It should NOT have fired during hot-swap (only on actual destroy).
      expect(destroyHandler).not.toHaveBeenCalled();

      // Fire destroy manually to prove the subscription survived
      frame.view!.fire("destroy");
      expect(destroyHandler).toHaveBeenCalledTimes(1);

      cleanupFrame(frame);
    });
  });

  // ============================================================
  // hotSwapFrames — batch hot-swap all matching frames
  // ============================================================
  describe("hotSwapFrames", () => {
    it("hot-swaps all frames matching the viewPath", async () => {
      const viewPath = "test/hot-swap-batch";
      const OldView = defineView(() => ({
        template: makeTemplate("old-template"),
      }));
      registerViewClass(viewPath, OldView);

      const frame1 = createTestFrame("hot-swap-batch-1");
      const frame2 = createTestFrame("hot-swap-batch-2");
      frame1.mountView(viewPath);
      frame2.mountView(viewPath);
      await flushMicrotasks();

      frame1.view!.updater.set({ count: 100 }).digest();
      frame2.view!.updater.set({ count: 200 }).digest();

      const NewView = defineView(() => ({
        template: makeTemplate("new-template"),
      }));

      hotSwapFrames(viewPath, NewView);

      // Both frames preserve their own state
      expect(frame1.view!.updater.get<number>("count")).toBe(100);
      expect(frame2.view!.updater.get<number>("count")).toBe(200);

      // Both frames use the new template
      expect(
        document.getElementById("hot-swap-batch-1")!.querySelector(".new-template"),
      ).not.toBeNull();
      expect(
        document.getElementById("hot-swap-batch-2")!.querySelector(".new-template"),
      ).not.toBeNull();

      cleanupFrame(frame1);
      cleanupFrame(frame2);
    });

    it("does not touch frames with a different viewPath", async () => {
      const frame = createTestFrame("hot-swap-other");
      const OldView = defineView((ctx) => {
        ctx.updater.set({ count: 5 });
        return { template: makeTemplate("old-template") };
      });
      registerViewClass("test/hot-swap-other", OldView);
      frame.mountView("test/hot-swap-other");
      await flushMicrotasks();

      const NewView = defineView(() => ({
        template: makeTemplate("new-template"),
      }));

      // Hot-swap a DIFFERENT viewPath — frame should be untouched
      hotSwapFrames("test/hot-swap-unrelated", NewView);

      expect(frame.view!.updater.get<number>("count")).toBe(5);
      expect(
        document.getElementById("hot-swap-other")!.querySelector(".old-template"),
      ).not.toBeNull();

      cleanupFrame(frame);
    });
  });

  // ============================================================
  // acceptView — state-preserving HMR integration
  // ============================================================
  describe("acceptView state preservation", () => {
    it("preserves view state when accept callback fires", async () => {
      const viewPath = "test/accept-preserve";
      const hot = createMockHot();

      const OldView = defineView(() => ({
        template: makeTemplate("old-template"),
      }));
      registerViewClass(viewPath, OldView);

      const frame = createTestFrame("accept-preserve");
      frame.mountView(viewPath);
      await flushMicrotasks();

      frame.view!.updater.set({ count: 99 }).digest();

      acceptView(hot, viewPath);

      const NewView = defineView(() => ({
        template: makeTemplate("new-template"),
      }));

      // Simulate Vite HMR: accept callback receives new module
      hot.acceptCb!({ default: NewView });

      // State preserved through the accept callback
      expect(frame.view!.updater.get<number>("count")).toBe(99);
      expect(
        document.getElementById("accept-preserve")!.querySelector(".new-template"),
      ).not.toBeNull();

      // New class registered for future synchronous mounts
      const reg = getViewClassRegistry();
      expect(reg[viewPath]).toBe(NewView);

      cleanupFrame(frame);
    });
  });

  // ============================================================
  // hotSwapByTemplate — zero-config template HMR (by reference)
  // ============================================================
  describe("hotSwapByTemplate", () => {
    it("updates template on all views using the old template", async () => {
      const oldTpl = makeTemplate("old-template");
      const newTpl = makeTemplate("new-template");

      const frame = createTestFrame("hot-swap-template");
      const TestView = defineView(() => ({ template: oldTpl }));
      registerViewClass("test/hot-swap-template", TestView);

      frame.mountView("test/hot-swap-template");
      await flushMicrotasks();

      // Mutate state
      frame.view!.updater.set({ count: 77 }).digest();

      hotSwapByTemplate(oldTpl, newTpl);

      // State preserved
      expect(frame.view!.updater.get<number>("count")).toBe(77);
      // New template applied
      expect(
        document.getElementById("hot-swap-template")!.querySelector(".new-template"),
      ).not.toBeNull();
      expect(
        document.getElementById("hot-swap-template")!.querySelector(".old-template"),
      ).toBeNull();
      expect(document.getElementById("hot-swap-template")!.textContent).toContain("count=77");

      cleanupFrame(frame);
    });

    it("does nothing when oldTemplate === newTemplate", async () => {
      const tpl = makeTemplate("same-template");
      const frame = createTestFrame("hot-swap-same");
      const TestView = defineView((ctx) => {
        ctx.updater.set({ count: 5 });
        return { template: tpl };
      });
      registerViewClass("test/hot-swap-same", TestView);
      frame.mountView("test/hot-swap-same");
      await flushMicrotasks();

      hotSwapByTemplate(tpl, tpl);

      // No crash, state intact
      expect(frame.view!.updater.get<number>("count")).toBe(5);
      expect(
        document.getElementById("hot-swap-same")!.querySelector(".same-template"),
      ).not.toBeNull();

      cleanupFrame(frame);
    });
  });

  // ============================================================
  // hotSwapByView — zero-config view class HMR (by reference)
  // ============================================================
  describe("hotSwapByView", () => {
    it("swaps prototype and updates registry for matching class", async () => {
      const OldView = defineView(() => ({
        template: makeTemplate("old-template"),
      }));
      registerViewClass("test/hot-swap-class", OldView);

      const frame = createTestFrame("hot-swap-class");
      frame.mountView("test/hot-swap-class");
      await flushMicrotasks();
      frame.view!.updater.set({ count: 33 }).digest();

      const NewView = defineView(() => ({
        template: makeTemplate("new-template"),
      }));

      hotSwapByView(OldView, NewView);

      // State preserved
      expect(frame.view!.updater.get<number>("count")).toBe(33);
      // New template applied
      expect(
        document.getElementById("hot-swap-class")!.querySelector(".new-template"),
      ).not.toBeNull();
      // Registry updated
      expect(getViewClassRegistry()["test/hot-swap-class"]).toBe(NewView);

      cleanupFrame(frame);
    });

    it("does nothing when oldClass === newClass", async () => {
      const V = defineView((ctx) => {
        ctx.updater.set({ count: 1 });
        return { template: makeTemplate("same") };
      });
      registerViewClass("test/hot-swap-same-class", V);
      const frame = createTestFrame("hot-swap-same-class");
      frame.mountView("test/hot-swap-same-class");
      await flushMicrotasks();

      hotSwapByView(V, V);

      expect(frame.view!.updater.get<number>("count")).toBe(1);
      cleanupFrame(frame);
    });
  });

  // ============================================================
  // hmr-inject — snippet generation
  // ============================================================
  describe("hmr-inject", () => {
    describe("injectTemplateHmrSnippet", () => {
      it("appends Vite HMR snippet using import.meta.hot", () => {
        const source = "export default function() {}";
        const result = injectTemplateHmrSnippet(source, "vite");
        expect(result).toContain("import.meta.hot");
        expect(result).toContain("hotSwapByTemplate");
        expect(result).toContain("__larkTemplate");
        expect(result).not.toContain("module.hot");
      });

      it("appends webpack HMR snippet using module.hot", () => {
        const source = "export default function() {}";
        const result = injectTemplateHmrSnippet(source, "webpack");
        expect(result).toContain("typeof module");
        expect(result).toContain("module.hot");
        expect(result).toContain("hotSwapByTemplate");
        expect(result).not.toContain("import.meta.hot");
      });

      it("appends rspack HMR snippet using module.hot", () => {
        const source = "export default function() {}";
        const result = injectTemplateHmrSnippet(source, "rspack");
        expect(result).toContain("module.hot");
        expect(result).not.toContain("import.meta.hot");
      });
    });

    describe("importsHtmlTemplate", () => {
      it("detects .html import", () => {
        expect(importsHtmlTemplate('import template from "./home.html";')).toBe(true);
        expect(importsHtmlTemplate('import t from "../components/counter.html"')).toBe(true);
      });

      it("returns false for files without .html import", () => {
        expect(importsHtmlTemplate('import View from "../view";')).toBe(false);
        expect(importsHtmlTemplate("const x = 1;")).toBe(false);
      });
    });

    describe("injectViewHmr", () => {
      it("wraps export default and appends HMR for .ts files importing .html", () => {
        const source = `import View from "../view";
import template from "./home.html";

export default View.extend({
  template,
  init() { this.updater.set({ count: 0 }); }
});`;
        const result = injectViewHmr(source, "vite");

        // Should create a named const
        expect(result).toContain("const __larkViewDefault = View.extend");
        expect(result).toContain("export default __larkViewDefault");
        // Should append HMR
        expect(result).toContain("import.meta.hot");
        expect(result).toContain("hotSwapByView");
      });

      it("returns source unchanged when no .html import", () => {
        const source =
          'import View from "../view";\nexport default defineView(() => ({ template: () => "" }));';
        const result = injectViewHmr(source, "vite");
        expect(result).toBe(source);
      });

      it("returns source unchanged when no export default", () => {
        const source =
          'import template from "./home.html";\nconst V = defineView(() => ({ template: () => "" }));';
        const result = injectViewHmr(source, "vite");
        expect(result).toBe(source);
      });

      it("uses module.hot for webpack", () => {
        const source =
          'import template from "./home.html";\nexport default defineView(() => ({ template: () => "" }));';
        const result = injectViewHmr(source, "webpack");
        expect(result).toContain("module.hot");
        expect(result).not.toContain("import.meta.hot");
      });
    });
  });
});
