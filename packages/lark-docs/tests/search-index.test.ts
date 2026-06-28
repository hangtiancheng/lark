import { describe, it, expect } from "vitest";
import { buildSearchIndex, emitSearchIndexModule } from "../src/search-index";
import type { DocsRoute } from "../src/types";

describe("buildSearchIndex", () => {
  it("builds search entries from routes", () => {
    const routes: DocsRoute[] = [
      {
        path: "/docs/guide",
        viewId: "guide-index",
        filePath: "/docs/guide/index.md",
        pageData: {
          title: "Guide",
          description: "Getting started guide",
          excerpt: "Guide body excerpt",
          headings: [
            { level: 2, text: "Installation", slug: "installation" },
            { level: 2, text: "Quick Start", slug: "quick-start" },
          ],
          relativePath: "guide/index.md",
        },
      },
      {
        path: "/docs/api/router",
        viewId: "api-router",
        filePath: "/docs/api/router.md",
        pageData: {
          title: "Router API",
          excerpt: "Router body excerpt",
          headings: [{ level: 2, text: "Router.to", slug: "router-to" }],
          relativePath: "api/router.md",
        },
      },
    ];

    const index = buildSearchIndex(routes);

    expect(index).toHaveLength(2);
    expect(index[0].title).toBe("Guide");
    expect(index[0].link).toBe("/docs/guide");
    expect(index[0].headings).toEqual(["Installation", "Quick Start"]);
    // excerpt comes from pageData.excerpt (page body), not description
    expect(index[0].excerpt).toBe("Guide body excerpt");
    expect(index[1].title).toBe("Router API");
  });

  it("excludes draft pages", () => {
    const routes: DocsRoute[] = [
      {
        path: "/docs/draft-page",
        viewId: "draft",
        filePath: "/docs/draft.md",
        pageData: {
          title: "Draft",
          excerpt: "Draft excerpt",
          draft: true,
          headings: [],
          relativePath: "draft.md",
        },
      },
    ];

    const index = buildSearchIndex(routes);
    expect(index).toHaveLength(0);
  });

  it("uses empty excerpt when excerpt is empty and no description", () => {
    const routes: DocsRoute[] = [
      {
        path: "/docs/test",
        viewId: "test",
        filePath: "/docs/test.md",
        pageData: {
          title: "Test",
          excerpt: "",
          headings: [],
          relativePath: "test.md",
        },
      },
    ];

    const index = buildSearchIndex(routes);
    expect(index[0].excerpt).toBe("");
  });
});

describe("emitSearchIndexModule", () => {
  it("emits a valid JS module", () => {
    const index = [
      {
        title: "Guide",
        link: "/docs/guide",
        headings: ["Installation"],
        excerpt: "Getting started",
      },
    ];

    const source = emitSearchIndexModule(index);
    expect(source).toContain("export default");
    expect(source).toContain('"Guide"');
    expect(source).toContain('"/docs/guide"');
  });
});
import { describe, it, expect } from "vitest";
import { buildSearchIndex, emitSearchIndexModule } from "../src/search-index";
import type { DocsRoute } from "../src/types";

describe("buildSearchIndex", () => {
  it("builds search entries from routes", () => {
    const routes: DocsRoute[] = [
      {
        path: "/docs/guide/",
        viewId: "guide-index",
        filePath: "/docs/guide/index.md",
        pageData: {
          title: "Guide",
          description: "Getting started guide",
          headings: [
            { level: 2, text: "Installation", slug: "installation" },
            { level: 2, text: "Quick Start", slug: "quick-start" },
          ],
          relativePath: "guide/index.md",
        },
      },
      {
        path: "/docs/api/router",
        viewId: "api-router",
        filePath: "/docs/api/router.md",
        pageData: {
          title: "Router API",
          headings: [{ level: 2, text: "Router.to", slug: "router-to" }],
          relativePath: "api/router.md",
        },
      },
    ];

    const index = buildSearchIndex(routes);

    expect(index).toHaveLength(2);
    expect(index[0].title).toBe("Guide");
    expect(index[0].link).toBe("/docs/guide/");
    expect(index[0].headings).toEqual(["Installation", "Quick Start"]);
    expect(index[0].excerpt).toBe("Getting started guide");
    expect(index[1].title).toBe("Router API");
  });

  it("excludes draft pages", () => {
    const routes: DocsRoute[] = [
      {
        path: "/docs/draft-page",
        viewId: "draft",
        filePath: "/docs/draft.md",
        pageData: {
          title: "Draft",
          draft: true,
          headings: [],
          relativePath: "draft.md",
        },
      },
    ];

    const index = buildSearchIndex(routes);
    expect(index).toHaveLength(0);
  });

  it("uses empty excerpt when no description", () => {
    const routes: DocsRoute[] = [
      {
        path: "/docs/test",
        viewId: "test",
        filePath: "/docs/test.md",
        pageData: {
          title: "Test",
          headings: [],
          relativePath: "test.md",
        },
      },
    ];

    const index = buildSearchIndex(routes);
    expect(index[0].excerpt).toBe("");
  });
});

describe("emitSearchIndexModule", () => {
  it("emits a valid JS module", () => {
    const index = [
      {
        title: "Guide",
        link: "/docs/guide/",
        headings: ["Installation"],
        excerpt: "Getting started",
      },
    ];

    const source = emitSearchIndexModule(index);
    expect(source).toContain("export default");
    expect(source).toContain('"Guide"');
    expect(source).toContain('"/docs/guide/"');
  });
});
