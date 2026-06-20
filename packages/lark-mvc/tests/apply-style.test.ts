import { describe, it, expect, afterEach } from "vitest";
import { applyStyle } from "../src/apply-style";

describe("applyStyle", () => {
  // Track injected styles for cleanup
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.length = 0;
    // Also clean up any style elements with from="lark"
    document
      .querySelectorAll('style[from="lark"]')
      .forEach((el) => el.remove());
  });

  describe("single style injection", () => {
    it("injects a style element into head", () => {
      const cleanup = applyStyle("test-style-1", ".test { color: red; }");
      cleanups.push(cleanup);
      const el = document.getElementById("test-style-1");
      expect(el).not.toBeNull();
      expect(el!.tagName).toBe("STYLE");
      expect(el!.textContent).toBe(".test { color: red; }");
    });

    it("sets from='lark' attribute", () => {
      const cleanup = applyStyle("test-style-attr", ".x{}");
      cleanups.push(cleanup);
      const el = document.getElementById("test-style-attr");
      expect(el!.getAttribute("from")).toBe("lark");
    });

    it("cleanup function removes the style element", () => {
      const cleanup = applyStyle("test-style-cleanup", ".x{}");
      expect(document.getElementById("test-style-cleanup")).not.toBeNull();
      cleanup();
      expect(document.getElementById("test-style-cleanup")).toBeNull();
    });

    it("is idempotent -- same ID does not inject twice", () => {
      const cleanup1 = applyStyle("test-style-dup", ".first{}");
      const cleanup2 = applyStyle("test-style-dup", ".second{}");
      cleanups.push(cleanup1);
      const elements = document.querySelectorAll("#test-style-dup");
      expect(elements.length).toBe(1);
      // Second call should return noop (not a new cleanup)
      expect(elements[0].textContent).toBe(".first{}");
    });

    it("returns noop when CSS is empty", () => {
      const cleanup = applyStyle("test-style-empty", "");
      // Empty CSS should not inject anything
      expect(document.getElementById("test-style-empty")).toBeNull();
    });

    it("returns noop when CSS is undefined", () => {
      const cleanup = applyStyle("test-style-nocss");
      expect(document.getElementById("test-style-nocss")).toBeNull();
    });
  });

  describe("batch style injection", () => {
    it("injects multiple styles from flat array", () => {
      const cleanup = applyStyle([
        "batch-1",
        ".batch1{}",
        "batch-2",
        ".batch2{}",
      ]);
      cleanups.push(cleanup);
      expect(document.getElementById("batch-1")).not.toBeNull();
      expect(document.getElementById("batch-2")).not.toBeNull();
    });

    it("cleanup removes all batch styles", () => {
      const cleanup = applyStyle(["batch-c1", ".c1{}", "batch-c2", ".c2{}"]);
      cleanup();
      expect(document.getElementById("batch-c1")).toBeNull();
      expect(document.getElementById("batch-c2")).toBeNull();
    });

    it("throws on odd-length array", () => {
      expect(() => {
        applyStyle(["id1", "css1", "id2"]);
      }).toThrow(/Invalid array/);
    });

    it("handles empty array", () => {
      const cleanup = applyStyle([]);
      expect(typeof cleanup).toBe("function");
      cleanup(); // Should not throw
    });
  });
});
