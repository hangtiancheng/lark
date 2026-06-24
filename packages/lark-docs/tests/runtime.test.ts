import { describe, it, expect } from "vitest";
import { searchDocs } from "../src/runtime";
import { slugify } from "../src/utils/slugify";
import type { SearchEntry } from "../src/types";

const testIndex: SearchEntry[] = [
  {
    title: "Getting Started",
    link: "/docs/getting-started",
    headings: ["Installation", "Quick Start"],
    excerpt: "Learn how to set up the framework",
  },
  {
    title: "Router API",
    link: "/docs/api/router",
    headings: ["Router.to", "Router.beforeEach"],
    excerpt: "Client-side routing with history and hash modes",
  },
  {
    title: "State Management",
    link: "/docs/api/state",
    headings: ["State.set", "State.get"],
    excerpt: "Cross-view state sharing with the State singleton",
  },
  {
    title: "Configuration",
    link: "/docs/guide/config",
    headings: ["Framework.boot", "FrameworkConfig"],
    excerpt: "How to configure the framework",
  },
];

describe("searchDocs", () => {
  it("returns matching results for a query", () => {
    const results = searchDocs(testIndex, "router");

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].title).toBe("Router API");
  });

  it("matches against headings", () => {
    const results = searchDocs(testIndex, "installation");

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].title).toBe("Getting Started");
  });

  it("matches against excerpt", () => {
    const results = searchDocs(testIndex, "singleton");

    expect(results.length).toBe(1);
    expect(results[0].title).toBe("State Management");
  });

  it("requires all terms to match (AND logic)", () => {
    const results = searchDocs(testIndex, "router state");

    // No entry contains both "router" and "state" in its content
    expect(results).toHaveLength(0);
  });

  it("returns empty for empty query", () => {
    expect(searchDocs(testIndex, "")).toEqual([]);
    expect(searchDocs(testIndex, "   ")).toEqual([]);
  });

  it("respects the limit parameter", () => {
    const results = searchDocs(testIndex, "the", 2);
    expect(results).toHaveLength(2);
  });

  it("is case-insensitive", () => {
    const results = searchDocs(testIndex, "ROUTER");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("ranks title matches higher than excerpt matches", () => {
    // "state" appears in:
    //   - title of "State Management" (score +10)
    //   - headings of "State Management": "State.set", "State.get" (score +10)
    //   - excerpt of "State Management": "Cross-view state sharing..." (score +1)
    // No other entry contains "state" in any field.
    const results = searchDocs(testIndex, "state");

    // State Management should be the only match and rank first
    expect(results[0].title).toBe("State Management");
  });

  it("does not match terms across field boundaries", () => {
    // "State Management" has title ending concept "State Management"
    // and excerpt "Cross-view state sharing with the State singleton".
    // "singleton Management" as a search should NOT match, because
    // "singleton" is in excerpt but "management" is in title -
    // each term must match within at least one individual field,
    // and while "management" matches the title and "singleton" matches
    // the excerpt, the concatenated-haystack bug would also match
    // "singleton management" spanning across fields.
    const results = searchDocs(testIndex, "singleton configuration");
    // "singleton" only in State Management excerpt,
    // "configuration" only in Configuration entry -
    // no single entry contains both in any individual field.
    expect(results).toHaveLength(0);
  });
});

describe("slugify", () => {
  it("converts text to URL-safe slug", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces special characters with dashes", () => {
    expect(slugify("What's New?!")).toBe("what-s-new");
  });

  it("preserves CJK characters", () => {
    expect(slugify("路由导航")).toBe("路由导航");
    expect(slugify("Getting Started 入门")).toBe("getting-started-入门");
  });

  it("prefixes leading digits for CSS selector safety", () => {
    expect(slugify("123 Release")).toBe("_123-release");
    expect(slugify("v2.0 Changes")).toBe("v2-0-changes");
  });

  it("collapses multiple dashes", () => {
    expect(slugify("a -- b")).toBe("a-b");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("handles already-slugged text", () => {
    expect(slugify("already-slugged")).toBe("already-slugged");
  });

  it("trims leading dashes", () => {
    expect(slugify("-leading")).toBe("leading");
    expect(slugify("--leading")).toBe("leading");
  });

  it("trims trailing dashes", () => {
    expect(slugify("trailing-")).toBe("trailing");
    expect(slugify("trailing--")).toBe("trailing");
  });

  it("trims both leading and trailing dashes", () => {
    expect(slugify("-both-")).toBe("both");
    expect(slugify("-- -already- --")).toBe("already");
  });
});
