import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { acceptView, disposeView, reloadViews } from "../src/hmr";
import type { HotContext } from "../src/hmr";
import { View, defineView } from "../src/view";
import { Frame, registerViewClass, invalidateViewClass, getViewClassRegistry } from "../src/frame";

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
function createTestFrame(id: string): Frame {
  const el = document.createElement("div");
  el.id = id;
  document.body.appendChild(el);
  return new Frame(id);
}

/**
 * Cleans up Frame and associated DOM.
 */
function cleanupFrame(frame: Frame): void {
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
      const TestView = View.extend({});
      registerViewClass("test/dispose-view", TestView);
      expect(Frame.getAll().size >= 0).toBe(true); // sanity check

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
      const NewView = View.extend({});
      hot.acceptCb!({ default: NewView });

      // New class should be registered
      const reg = getViewClassRegistry();
      expect(reg["test/accept-reload"]).toBe(NewView);
    });

    it("accept callback falls back to module itself when no default export", () => {
      const hot = createMockHot();
      acceptView(hot, "test/accept-no-default");

      const NewView = View.extend({});
      // Simulate a module that exports the View class directly (not as default)
      hot.acceptCb!(NewView as unknown as { default?: unknown });

      const reg = getViewClassRegistry();
      // When newModule has no .default, it falls through to newModule itself
      // But newModule is the View class (a function), so it should be registered
      // Actually, the logic is: candidate = newModule?.default ?? newModule
      // If newModule is a function (View class), it has no .default property
      // So candidate = newModule itself, which is the View class
      // Wait, but the accept callback receives `mod` which is `{ default?: unknown } | undefined`
      // If we pass a View class directly, it doesn't have a .default property
      // So `newModule?.default` is undefined, and `candidate = newModule`
      // But `newModule` is the View class (a function), so `typeof candidate === 'function'` is true
      // So it should be registered. But the key is "test/accept-no-default"
      // Let me check: the accept callback receives `mod` which is the new module namespace
      // In our test, we're passing the View class directly as `mod`
      // The View class is a function, so `typeof candidate === 'function'` is true
      // So it should be registered with the viewPath "test/accept-no-default"
      expect(reg["test/accept-no-default"]).toBe(NewView);
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
  // View.accept / View.dispose static methods
  // ============================================================
  describe("View.accept / View.dispose", () => {
    it("accept is no-op when hot is undefined", () => {
      const TestView = View.extend({});
      // Should not throw
      TestView.accept(undefined, "test/noop-accept");
    });

    it("dispose is no-op when hot is undefined", () => {
      const TestView = View.extend({});
      // Should not throw
      TestView.dispose(undefined, "test/noop-dispose");
    });

    it("accept delegates to acceptView when hot is provided", () => {
      const hot = createMockHot();
      const TestView = View.extend({});
      TestView.accept(hot, "test/view-accept");

      expect(hot.acceptCb).toBeDefined();

      // Trigger accept with new module
      const NewView = View.extend({});
      hot.acceptCb!({ default: NewView });

      const reg = getViewClassRegistry();
      expect(reg["test/view-accept"]).toBe(NewView);
    });

    it("dispose delegates to disposeView when hot is provided", () => {
      const hot = createMockHot();
      const TestView = View.extend({});
      registerViewClass("test/view-dispose", TestView);

      TestView.dispose(hot, "test/view-dispose");
      expect(hot.disposeCb).toBeDefined();

      // Trigger dispose
      hot.disposeCb!({});

      const reg = getViewClassRegistry();
      expect(reg["test/view-dispose"]).toBeUndefined();
    });

    it("defineView subclass inherits accept and dispose", () => {
      const TestView = defineView({});
      const hot = createMockHot();

      // Should not throw
      TestView.accept(hot, "test/define-accept");
      TestView.dispose(hot, "test/define-dispose");

      expect(hot.acceptCb).toBeDefined();
      expect(hot.disposeCb).toBeDefined();
    });
  });

  // ============================================================
  // reloadViews
  // ============================================================
  describe("reloadViews", () => {
    it("re-mounts frames matching the viewPath", () => {
      const TestView = View.extend({});
      registerViewClass("test/reload", TestView);

      const frame = createTestFrame("reload-test-1");
      // Manually set viewPath to simulate a mounted view
      frame.viewPath = "test/reload";

      const mountSpy = vi.spyOn(frame, "mountView");

      reloadViews("test/reload");

      expect(mountSpy).toHaveBeenCalledWith("test/reload");

      mountSpy.mockRestore();
      cleanupFrame(frame);
    });

    it("does not re-mount frames with different viewPath", () => {
      const frame = createTestFrame("reload-test-2");
      frame.viewPath = "test/other";

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
      const TestView = View.extend({});
      registerViewClass("test/reload-params", TestView);

      const frame = createTestFrame("reload-test-4");
      // viewPath with query params — parseUri extracts path = "test/reload-params"
      frame.viewPath = "test/reload-params?x=1&y=2";

      const mountSpy = vi.spyOn(frame, "mountView");

      reloadViews("test/reload-params");

      // Should match and re-mount with the full path (including params)
      expect(mountSpy).toHaveBeenCalledWith("test/reload-params?x=1&y=2");

      mountSpy.mockRestore();
      cleanupFrame(frame);
    });

    it("re-mounts multiple matching frames", () => {
      const TestView = View.extend({});
      registerViewClass("test/multi", TestView);

      const frame1 = createTestFrame("reload-test-5");
      frame1.viewPath = "test/multi";
      const frame2 = createTestFrame("reload-test-6");
      frame2.viewPath = "test/multi";

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
});
