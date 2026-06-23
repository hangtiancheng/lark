import { describe, it, expect } from "vitest";
import { generateRouteMap, generateBootModule } from "../src/route-map";
import type { DocsRoute } from "../src/types";

const mockRoutes: DocsRoute[] = [
  {
    path: "/docs",
    viewId: "docs-index",
    filePath: "/project/docs/index.md",
    pageData: {
      title: "Home",
      headings: [],
      relativePath: "index.md",
    },
  },
  {
    path: "/docs/guide",
    viewId: "docs-guide-index",
    filePath: "/project/docs/guide/index.md",
    pageData: {
      title: "Guide",
      headings: [],
      relativePath: "guide/index.md",
    },
  },
  {
    path: "/docs/guide/config",
    viewId: "docs-guide-config",
    filePath: "/project/docs/guide/config.md",
    pageData: {
      title: "Configuration",
      headings: [{ level: 2, text: "Options", slug: "options" }],
      relativePath: "guide/config.md",
    },
  },
];

describe("generateRouteMap", () => {
  it("generates a path-to-viewId mapping", () => {
    const map = generateRouteMap(mockRoutes);

    expect(map).toEqual({
      "/docs": "docs-index",
      "/docs/guide": "docs-guide-index",
      "/docs/guide/config": "docs-guide-config",
    });
  });

  it("handles empty routes", () => {
    const map = generateRouteMap([]);
    expect(map).toEqual({});
  });
});

describe("generateBootModule", () => {
  it("generates import and registration statements", () => {
    const source = generateBootModule(mockRoutes);

    expect(source).toContain(
      'import { registerViewClass } from "@lark.js/mvc"',
    );
    expect(source).toContain('import view0 from "/project/docs/index.md"');
    expect(source).toContain(
      'import view1 from "/project/docs/guide/index.md"',
    );
    expect(source).toContain(
      'import view2 from "/project/docs/guide/config.md"',
    );
    expect(source).toContain('registerViewClass("docs-index", view0)');
    expect(source).toContain('registerViewClass("docs-guide-index", view1)');
    expect(source).toContain('registerViewClass("docs-guide-config", view2)');
  });

  it("handles empty routes", () => {
    const source = generateBootModule([]);
    expect(source).toContain("import { registerViewClass }");
    // No imports or registrations
    expect(source).not.toContain("import view");
  });
});
