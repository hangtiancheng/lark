import { describe, it, expect, vi } from "vitest";
import { View, defineView } from "../src/view";
import { Frame } from "../src/frame";
import type { AnyFunc, FrameInterface } from "../src/types";

// View constructor type for instantiation
type ViewConstructor = new (
  nodeId: string,
  ownerFrame: FrameInterface,
  initParams?: Record<string, unknown>,
  node?: Element,
) => View;

/**
 * Creates Frame with DOM for testing
 */
function createTestFrame(id: string): Frame {
  const el = document.createElement("div");
  el.id = id;
  document.body.appendChild(el);
  return new Frame(id);
}

/**
 * Cleans up test Frame
 */
function cleanupFrame(frame: Frame): void {
  const el = document.getElementById(frame.id);
  if (el) el.remove();
  (Frame as { getAll(): Map<string, Frame> }).getAll().delete(frame.id);
}

describe("View", () => {
  describe("extend", () => {
    it("creates View subclass", () => {
      const ChildView = View.extend({
        make() {
          /** noop */
        },
      });

      expect(typeof ChildView).toBe("function");
      expect(ChildView.extend).toBe(View.extend);
      expect(typeof ChildView.merge).toBe("function");
    });

    it("subclass can be instantiated and sets basic properties", () => {
      const frame = createTestFrame("test-frame-1");
      const ChildView = View.extend({
        make() {
          /** noop */
        },
      });

      const instance = new (ChildView as ViewConstructor)(
        "test-frame-1",
        frame,
        {},
        document.getElementById("test-frame-1") ?? undefined,
      );

      expect(instance.id).toBe("test-frame-1");
      expect(instance.owner).toBe(frame);
      expect(instance.updater).toBeDefined();
      expect(typeof instance.init).toBe("function");
      expect(typeof instance.render).toBe("function");

      cleanupFrame(frame);
    });

    it("properties passed to extend are available on instance", () => {
      const frame = createTestFrame("test-frame-2");
      const customMethod = vi.fn();
      const templateFn = () => "hello";

      const ChildView = View.extend({
        customMethod,
        template: templateFn,
        make() {
          /** noop */
        },
      });

      const instance: View & {
        customMethod?: AnyFunc;
      } = new (ChildView as ViewConstructor)(
        "test-frame-2",
        frame,
        {},
        document.getElementById("test-frame-2") ?? undefined,
      );

      expect(instance.customMethod).toBe(customMethod);
      expect(instance.template).toBe(templateFn);

      cleanupFrame(frame);
    });

    it("statics passed to extend are mounted on class", () => {
      const staticMethod = vi.fn();
      const ChildView: typeof View & {
        staticMethod?: AnyFunc;
      } = View.extend(
        {
          make() {
            /** noop */
          },
        },
        { staticMethod },
      );

      expect(ChildView.staticMethod).toBe(staticMethod);
    });
  });

  describe("merge", () => {
    it("merges mixin into View prototype", () => {
      const mixinObj = {
        mergedMethod() {
          return "merged";
        },
      };

      View.merge(mixinObj);

      const instance: View & {
        mergedMethod?: AnyFunc;
      } = new View();
      expect(instance.mergedMethod?.()).toBe("merged");
    });
  });

  describe("on / off / fire", () => {
    it("binds and triggers events", () => {
      const view = new View();
      const handler = vi.fn();

      view.on("testEvent", handler);
      view.fire("testEvent", { data: 1 });

      expect(handler).toHaveBeenCalledTimes(1);

      view.off("testEvent", handler);
      view.fire("testEvent", { data: 2 });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("fire returns this", () => {
      const view = new View();
      const result = view.fire("testEvent");
      expect(result).toBe(view);
    });
  });

  describe("wrapAsync", () => {
    it("executes callback when current signature is valid", () => {
      const view = new View();
      view.signature = 1;

      const callback = vi.fn();
      const wrapped = view.wrapAsync(callback);

      wrapped();
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("does not execute callback after signature change", () => {
      const view = new View();
      view.signature = 1;

      const callback = vi.fn();
      const wrapped = view.wrapAsync(callback);

      view.signature = 2;
      wrapped();
      expect(callback).not.toHaveBeenCalled();
    });

    it("does not execute callback when signature is 0", () => {
      const view = new View();
      view.signature = 1;

      const callback = vi.fn();
      const wrapped = view.wrapAsync(callback);

      view.signature = 0;
      wrapped();
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("observeLocation", () => {
    it("string parameter + observePath=true", () => {
      const view = new View();
      view.observeLocation("a,b,c", true);

      expect(view.locationObserved.flag).toBe(1);
      expect(view.locationObserved.observePath).toBe(true);
      expect(view.locationObserved.keys).toEqual(["a", "b", "c"]);
    });

    it("string parameter + observePath=false", () => {
      const view = new View();
      view.observeLocation("d,e,f", false);

      expect(view.locationObserved.flag).toBe(1);
      expect(view.locationObserved.observePath).toBe(false);
      expect(view.locationObserved.keys).toEqual(["d", "e", "f"]);
    });

    it("object parameter with path", () => {
      const view = new View();
      view.observeLocation({ params: "g,h,i", path: true });

      expect(view.locationObserved.observePath).toBe(true);
      expect(view.locationObserved.keys).toEqual(["g", "h", "i"]);
    });

    it("object parameter without path", () => {
      const view = new View();
      view.observeLocation({ params: "j,k,l" });

      expect(view.locationObserved.observePath).toBe(false);
      expect(view.locationObserved.keys).toEqual(["j", "k", "l"]);
    });
  });

  describe("observeState", () => {
    it("string parameter", () => {
      const view = new View();
      view.observeState("a,b,c");

      expect(view.observedStateKeys).toEqual(["a", "b", "c"]);
    });

    it("array parameter", () => {
      const view = new View();
      view.observeState(["x", "y"]);

      expect(view.observedStateKeys).toEqual(["x", "y"]);
    });
  });

  describe("capture / release", () => {
    it("capture registers resource", () => {
      const view = new View();
      const resource = { destroy: vi.fn() };

      view.capture("test1", resource, true);

      expect(view.resources["test1"]).toEqual({
        entity: resource,
        destroyOnRender: true,
      });
    });

    it("capture returns existing entity when no resource provided", () => {
      const view = new View();
      const resource = { id: 1 };

      view.capture("test1", resource, true);
      const result = view.capture("test1");

      expect(result).toBe(resource);
    });

    it("release destroys resource", () => {
      const view = new View();
      const resource = { destroy: vi.fn() };

      view.capture("test1", resource, true);
      view.release("test1", true);

      expect(resource.destroy).toHaveBeenCalled();
      expect(view.resources["test1"]).toBeUndefined();
    });

    it("release does not call destroy", () => {
      const view = new View();
      const resource = { destroy: vi.fn() };

      view.capture("test1", resource, true);
      view.release("test1", false);

      expect(resource.destroy).not.toHaveBeenCalled();
    });
  });

  describe("defineView (D1)", () => {
    it("returns a constructable View subclass", () => {
      const TypedView = defineView({
        $title: "Hello",
        greet() {
          // `this.$title` is typed via ThisType — accessing it should compile.
          return (this as { $title: string }).$title;
        },
      });
      expect(typeof TypedView).toBe("function");
      expect(typeof TypedView.extend).toBe("function");
      expect(typeof TypedView.merge).toBe("function");
    });

    it("instantiates with a frame and exposes prototype methods", () => {
      const frame = createTestFrame("define-view-1");
      const Typed = defineView({
        $count: 5,
        getCount() {
          return (this as { $count: number }).$count;
        },
      });
      const Ctor = Typed as ViewConstructor;
      const inst = new Ctor("define-view-1", frame);
      expect(
        typeof (inst as unknown as { getCount: () => number }).getCount,
      ).toBe("function");
      expect((inst as unknown as { getCount: () => number }).getCount()).toBe(
        5,
      );
      cleanupFrame(frame);
    });
  });
});
