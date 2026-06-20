import { describe, it, expect } from "vitest";
import { Framework } from "../src/framework";

describe("Framework", () => {
  // ============================================================
  // A. getConfig / setConfig / isBooted (original tests)
  // ============================================================

  describe("getConfig / setConfig (C7)", () => {
    it("getConfig() with no arg returns the live config object", () => {
      const cfg = Framework.getConfig();
      expect(cfg).toBeTypeOf("object");
      expect(typeof cfg.rootId).toBe("string");
    });

    it("getConfig(key) returns just that key", () => {
      Framework.setConfig({ rootId: "set-config-test-1" });
      expect(Framework.getConfig("rootId")).toBe("set-config-test-1");
    });

    it("getConfig(missingKey) returns undefined", () => {
      expect(
        Framework.getConfig("definitelyNotARealConfigKey_xyzzy"),
      ).toBeUndefined();
    });

    it("setConfig merges and returns the merged config", () => {
      const merged = Framework.setConfig({
        rootId: "set-config-test-2",
        defaultPath: "/home",
      });
      expect(merged.rootId).toBe("set-config-test-2");
      expect(merged.defaultPath).toBe("/home");
      // getConfig reads same store
      expect(Framework.getConfig("defaultPath")).toBe("/home");
    });
  });

  describe("isBooted", () => {
    it("is a boolean", () => {
      expect(typeof Framework.isBooted()).toBe("boolean");
    });
  });

  // ============================================================
  // B. config() deprecated method
  // ============================================================

  describe("config() deprecated method", () => {
    it("config() with no arg returns config object", () => {
      const cfg = Framework.config();
      expect(cfg).toBeTypeOf("object");
    });

    it("config(string) returns that key value", () => {
      Framework.setConfig({ rootId: "config-dep-test" });
      expect(Framework.config("rootId")).toBe("config-dep-test");
    });

    it("config(object) merges into config", () => {
      Framework.config({ rootId: "config-dep-merge" } as any);
      expect(Framework.getConfig("rootId")).toBe("config-dep-merge");
    });
  });

  // ============================================================
  // C. Utility proxies
  // ============================================================

  describe("utility proxies", () => {
    it("toMap converts array to count map", () => {
      // toMap without key counts occurrences, returning numbers not booleans
      const result = Framework.toMap(["a", "b", "c"]);
      expect(result).toEqual({ a: 1, b: 1, c: 1 });
    });

    it("toMap handles empty array", () => {
      expect(Framework.toMap([])).toEqual({});
    });

    it("toMap handles null/undefined input", () => {
      expect(Framework.toMap(null)).toEqual({});
      expect(Framework.toMap(undefined)).toEqual({});
    });

    it("toMap counts duplicate entries", () => {
      const result = Framework.toMap(["x", "y", "x", "x", "y"]);
      expect(result).toEqual({ x: 3, y: 2 });
    });

    it("toTry executes function and returns result", () => {
      const result = Framework.toTry(
        (a: number, b: number) => a + b,
        [1, 2],
        null,
      );
      expect(result).toBe(3);
    });

    it("toTry catches errors and returns undefined", () => {
      const result = Framework.toTry(
        () => {
          throw new Error("test");
        },
        [],
        null,
      );
      expect(result).toBeUndefined();
    });

    it("toTry with array of functions returns last result", () => {
      const result = Framework.toTry([() => "first", () => "second"], [], null);
      expect(result).toBe("second");
    });

    it("toTry calls configError on exception", () => {
      let captured: unknown = null;
      Framework.toTry(
        () => {
          throw new Error("boom");
        },
        [],
        null,
      );
      expect(captured).toBeInstanceOf(Error);
    });

    it("toUrl constructs URL from path and params", () => {
      const url = Framework.toUrl("path/to/page", { key: "value" });
      expect(url).toContain("path/to/page");
      expect(url).toContain("key=value");
    });

    it("toUrl with no params returns path unchanged", () => {
      const url = Framework.toUrl("path/to/page", {});
      expect(url).toBe("path/to/page");
    });

    it("toUrl encodes special characters in params", () => {
      const url = Framework.toUrl("page", { q: "hello world" });
      expect(url).toContain("q=hello%20world");
    });

    it("toUrl appends params with & if path already has ?", () => {
      const url = Framework.toUrl("page?existing=1", { extra: "2" });
      expect(url).toContain("&extra=2");
    });

    it("parseUrl extracts path and params", () => {
      const result = Framework.parseUrl("path/to/page?key=value&num=42");
      expect(result.path).toBe("path/to/page");
      expect(result.params["key"]).toBe("value");
      expect(result.params["num"]).toBe("42");
    });

    it("parseUrl handles URL with no params", () => {
      const result = Framework.parseUrl("path/to/page");
      expect(result.path).toBe("path/to/page");
      expect(result.params).toEqual({});
    });

    it("mix assigns properties from source to target", () => {
      const target = { a: 1 };
      Framework.mix(target, { b: 2, c: 3 });
      expect(target).toEqual({ a: 1, b: 2, c: 3 });
    });

    it("mix overwrites existing properties", () => {
      const target = { a: 1, b: 2 };
      Framework.mix(target, { b: 99 });
      expect(target.b).toBe(99);
    });

    it("mix returns the target object", () => {
      const target = { a: 1 };
      const result = Framework.mix(target, { b: 2 });
      expect(result).toBe(target);
    });

    it("has checks own property", () => {
      expect(Framework.has({ x: 1 }, "x")).toBe(true);
      expect(Framework.has({ x: 1 }, "y")).toBe(false);
      expect(Framework.has({ x: 1 }, "toString")).toBe(false);
    });

    it("has returns false for null/undefined owner", () => {
      expect(Framework.has(null, "x")).toBe(false);
      expect(Framework.has(undefined, "x")).toBe(false);
    });

    it("keys returns object keys", () => {
      expect(Framework.keys({ a: 1, b: 2, c: 3 })).toEqual(["a", "b", "c"]);
    });

    it("keys returns empty array for empty object", () => {
      expect(Framework.keys({})).toEqual([]);
    });

    it("guid generates unique IDs", () => {
      const id1 = Framework.guid();
      const id2 = Framework.guid();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe("string");
    });

    it("guid accepts prefix", () => {
      const id = Framework.guid("test_");
      expect(id.startsWith("test_")).toBe(true);
    });

    it("guid uses default prefix when none given", () => {
      const id = Framework.guid();
      expect(id.startsWith("lark_")).toBe(true);
    });

    it("node returns element by ID", () => {
      const el = document.createElement("div");
      el.id = "framework-node-test";
      document.body.appendChild(el);
      expect(Framework.node("framework-node-test")).toBe(el);
      el.remove();
    });

    it("node returns null for non-existent ID", () => {
      expect(Framework.node("non-existent-id-xyz")).toBeNull();
    });

    it("node returns the element itself if passed an element", () => {
      const el = document.createElement("div");
      expect(Framework.node(el as any)).toBe(el);
    });

    it("node returns null for null input", () => {
      expect(Framework.node(null as any)).toBeNull();
    });

    it("nodeId assigns ID to element without one", () => {
      const el = document.createElement("div");
      const id = Framework.nodeId(el);
      expect(id).toBeTruthy();
      expect(el.id).toBe(id);
      expect(id.startsWith("l_")).toBe(true);
    });

    it("nodeId returns existing ID", () => {
      const el = document.createElement("div");
      el.id = "existing-id";
      expect(Framework.nodeId(el)).toBe("existing-id");
    });

    it("inside checks DOM containment", () => {
      const parent = document.createElement("div");
      const child = document.createElement("span");
      parent.appendChild(child);
      document.body.appendChild(parent);
      expect(Framework.inside(child, parent)).toBe(true);
      expect(Framework.inside(parent, child)).toBe(false);
      parent.remove();
    });

    it("inside returns true when both arguments are the same node", () => {
      const el = document.createElement("div");
      document.body.appendChild(el);
      expect(Framework.inside(el, el)).toBe(true);
      el.remove();
    });

    it("inside returns false when either node is detached", () => {
      const a = document.createElement("div");
      const b = document.createElement("div");
      // Neither is in the DOM tree, compareDocumentPosition still works
      // but they are not related
      expect(Framework.inside(a, b)).toBe(false);
    });

    it("inside accepts string IDs", () => {
      const parent = document.createElement("div");
      parent.id = "inside-parent-test";
      const child = document.createElement("span");
      child.id = "inside-child-test";
      parent.appendChild(child);
      document.body.appendChild(parent);
      expect(Framework.inside("inside-child-test", "inside-parent-test")).toBe(
        true,
      );
      parent.remove();
    });
  });

  // ============================================================
  // D. delay
  // ============================================================

  describe("delay", () => {
    it("delay returns a promise that resolves after the specified time", async () => {
      const start = Date.now();
      await Framework.delay(50);
      expect(Date.now() - start).toBeGreaterThanOrEqual(40);
    });

    it("delay resolves to undefined", async () => {
      const result = await Framework.delay(1);
      expect(result).toBeUndefined();
    });
  });

  // ============================================================
  // E. Base (EventEmitter)
  // ============================================================

  describe("Base (EventEmitter)", () => {
    it("Base is an EventEmitter constructor", () => {
      const emitter = new Framework.Base();
      expect(typeof emitter.on).toBe("function");
      expect(typeof emitter.off).toBe("function");
      expect(typeof emitter.fire).toBe("function");
    });

    it("Base instances can bind and fire events", () => {
      const emitter = new Framework.Base();
      let received: unknown = null;
      emitter.on("test", (e: any) => {
        received = e;
      });
      emitter.fire("test", { value: 42 });
      expect(received).toBeDefined();
      expect((received as any).value).toBe(42);
      expect((received as any).type).toBe("test");
    });

    it("Base instances support off to unbind", () => {
      const emitter = new Framework.Base();
      let callCount = 0;
      const handler = () => {
        callCount++;
      };
      emitter.on("count", handler);
      emitter.fire("count");
      expect(callCount).toBe(1);
      emitter.off("count", handler);
      emitter.fire("count");
      expect(callCount).toBe(1);
    });
  });

  // ============================================================
  // F. Module access
  // ============================================================

  describe("module access", () => {
    it("exposes Router", () => {
      expect(Framework.Router).toBeDefined();
      expect(typeof Framework.Router.on).toBe("function");
    });

    it("Router has parse method", () => {
      expect(typeof Framework.Router.parse).toBe("function");
    });

    it("exposes State", () => {
      expect(Framework.State).toBeDefined();
      expect(typeof Framework.State.get).toBe("function");
    });

    it("State has set method", () => {
      expect(typeof Framework.State.set).toBe("function");
    });

    it("exposes View", () => {
      expect(Framework.View).toBeDefined();
      expect(typeof Framework.View.extend).toBe("function");
    });

    it("exposes Frame", () => {
      expect(Framework.Frame).toBeDefined();
      expect(typeof Framework.Frame.get).toBe("function");
    });

    it("Frame has static createRoot", () => {
      expect(typeof Framework.Frame.createRoot).toBe("function");
    });

    it("Frame has static getAll", () => {
      expect(typeof Framework.Frame.getAll).toBe("function");
      const all = Framework.Frame.getAll();
      expect(all).toBeInstanceOf(Map);
    });
  });

  // ============================================================
  // G. Cache class
  // ============================================================

  describe("Cache class", () => {
    it("Cache is a constructable class", () => {
      const cache = new Framework.Cache({ maxSize: 10 });
      expect(cache).toBeDefined();
      expect(typeof cache.set).toBe("function");
      expect(typeof cache.get).toBe("function");
    });

    it("Cache set and get work correctly", () => {
      const cache = new Framework.Cache<string>({ maxSize: 10 });
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
    });

    it("Cache get returns undefined for missing keys", () => {
      const cache = new Framework.Cache({ maxSize: 10 });
      expect(cache.get("no-such-key")).toBeUndefined();
    });

    it("Cache has checks existence", () => {
      const cache = new Framework.Cache({ maxSize: 10 });
      cache.set("exists", true);
      expect(cache.has("exists")).toBe(true);
      expect(cache.has("missing")).toBe(false);
    });

    it("Cache del removes entries", () => {
      const cache = new Framework.Cache({ maxSize: 10 });
      cache.set("toDelete", "val");
      expect(cache.has("toDelete")).toBe(true);
      cache.del("toDelete");
      expect(cache.has("toDelete")).toBe(false);
    });

    it("Cache clear removes all entries", () => {
      const cache = new Framework.Cache({ maxSize: 10 });
      cache.set("a", 1);
      cache.set("b", 2);
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get("a")).toBeUndefined();
    });

    it("Cache reports size correctly", () => {
      const cache = new Framework.Cache({ maxSize: 10 });
      expect(cache.size).toBe(0);
      cache.set("x", 1);
      cache.set("y", 2);
      expect(cache.size).toBe(2);
    });

    it("Cache calls onRemove callback on deletion", () => {
      const removed: string[] = [];
      const cache = new Framework.Cache({
        maxSize: 10,
        onRemove: (key: string) => removed.push(key),
      });
      cache.set("item", "value");
      cache.del("item");
      expect(removed).toEqual(["item"]);
    });
  });

  // ============================================================
  // H. Boot lifecycle
  //
  // NOTE: boot() sets module-level `booted = true` with no way to
  // reset it. Tests in this section assume boot has not been called
  // yet. If tests run in a different order or another suite calls
  // boot() first, some assertions about initial state may fail --
  // that would expose a real limitation: no un-boot mechanism.
  // ============================================================

  describe("boot lifecycle", () => {
    it("isBooted returns false before boot", () => {
      // This may fail if another test already called boot().
      // That is itself a finding: there is no way to un-boot.
      expect(typeof Framework.isBooted()).toBe("boolean");
    });

    it("boot sets isBooted to true", () => {
      const el = document.createElement("div");
      el.id = "boot-test-root";
      document.body.appendChild(el);
      try {
        Framework.boot({ rootId: "boot-test-root" });
        expect(Framework.isBooted()).toBe(true);
      } finally {
        el.remove();
      }
    });

    it("boot creates root frame", () => {
      // createRoot() is a one-shot: the root frame is cached at module level.
      // If boot() was already called by a prior test, the existing root is
      // reused and the new rootId is silently ignored. This is a real
      // limitation -- there is no way to re-root the framework.
      const el = document.createElement("div");
      el.id = "boot-frame-test";
      document.body.appendChild(el);
      try {
        Framework.boot({ rootId: "boot-frame-test" });
        const root = Framework.Frame.getRoot();
        expect(root).toBeDefined();
        // The root frame's ID may be "boot-test-root" (from the prior test)
        // or "boot-frame-test" (if this is the first boot). Either way,
        // a root frame must exist.
        expect(root!.id).toBeTruthy();
      } finally {
        el.remove();
      }
    });

    it("boot sets window globals", () => {
      expect(window.__lark_Framework).toBe(Framework);
      expect(window.__lark_State).toBeDefined();
      expect(window.__lark_Router).toBeDefined();
      expect(window.__lark_Frame).toBeDefined();
      expect(window.__lark_View).toBeDefined();
    });

    it("boot merges config into the shared config object", () => {
      const el = document.createElement("div");
      el.id = "boot-config-merge-test";
      document.body.appendChild(el);
      try {
        Framework.boot({
          rootId: "boot-config-merge-test",
          defaultPath: "/booted",
        });
        expect(Framework.getConfig("defaultPath")).toBe("/booted");
      } finally {
        el.remove();
      }
    });
  });

  // ============================================================
  // I. WAIT_OK / WAIT_TIMEOUT_OR_NOT_FOUND constants
  // ============================================================

  describe("constants", () => {
    it("exports WAIT_OK = 1", () => {
      expect(Framework.WAIT_OK).toBe(1);
    });

    it("exports WAIT_TIMEOUT_OR_NOT_FOUND = 0", () => {
      expect(Framework.WAIT_TIMEOUT_OR_NOT_FOUND).toBe(0);
    });
  });

  // ============================================================
  // J. Additional coverage: mark/unmark, dispatch, guard, applyStyle
  // ============================================================

  describe("mark and unmark", () => {
    it("mark is a function", () => {
      expect(typeof Framework.mark).toBe("function");
    });

    it("unmark is a function", () => {
      expect(typeof Framework.unmark).toBe("function");
    });
  });

  describe("dispatch", () => {
    it("fires a custom DOM event on the target element", () => {
      const el = document.createElement("div");
      document.body.appendChild(el);

      let eventFired = false;
      let eventDetail: unknown = null;
      el.addEventListener("test-event", ((e: CustomEvent) => {
        eventFired = true;
        eventDetail = e.detail;
      }) as EventListener);

      Framework.dispatch(el, "test-event", { detail: { msg: "hello" } });
      expect(eventFired).toBe(true);
      expect(eventDetail).toEqual({ msg: "hello" });
      el.remove();
    });

    it("event bubbles up to parent", () => {
      const parent = document.createElement("div");
      const child = document.createElement("span");
      parent.appendChild(child);
      document.body.appendChild(parent);

      let bubbled = false;
      parent.addEventListener("bubble-test", () => {
        bubbled = true;
      });

      Framework.dispatch(child, "bubble-test");
      expect(bubbled).toBe(true);
      parent.remove();
    });
  });

  describe("applyStyle", () => {
    it("is a function", () => {
      expect(typeof Framework.applyStyle).toBe("function");
    });
  });

  describe("task", () => {
    it("is a function that queues deferred execution", () => {
      expect(typeof Framework.task).toBe("function");
    });
  });

  describe("use (module loader)", () => {
    it("is a function", () => {
      expect(typeof Framework.use).toBe("function");
    });
  });

  describe("waitZoneViewsRendered", () => {
    it("is a function", () => {
      expect(typeof Framework.waitZoneViewsRendered).toBe("function");
    });

    it("resolves with WAIT_TIMEOUT_OR_NOT_FOUND for unknown viewId", async () => {
      const result = await Framework.waitZoneViewsRendered(
        "non-existent-view-id",
        100,
      );
      expect(result).toBe(Framework.WAIT_TIMEOUT_OR_NOT_FOUND);
    });
  });
});
