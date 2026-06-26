/**
 * SearchView - client-side full-text search dialog (local provider).
 *
 * Uses MiniSearch (same engine as VitePress) for prefix matching, fuzzy
 * matching, and field-weighted scoring. The search index is built at
 * compile time (buildSearchIndex) and embedded in docsConfig.searchIndex;
 * this view lazily constructs a MiniSearch instance on first query.
 *
 * Open/close state is driven by State.searchOpen so the layout's navbar
 * button can toggle this sub-view without a direct reference.
 */
import MiniSearch, { type SearchResult } from "minisearch";
import { State, Router, defineView } from "@lark.js/mvc";
import type { VDomTemplate, ViewSetup, ViewTemplate } from "@lark.js/mvc";
import { icons as defaultIcons } from "./icons";
import type { SearchEntry } from "../types";

export function createSearchView(
  template: ViewTemplate | VDomTemplate,
): ViewSetup {
  return defineView((ctx) => {
    // Closure state (replaces former this._mini)
    let mini: MiniSearch | null = null;

    ctx.updater.set({
      icons: defaultIcons,
      results: [],
      hasSearched: false,
      query: "",
    });
    // Re-render when the layout toggles searchOpen via State.
    ctx.observeState("searchOpen");

    const assign = (): boolean | undefined => {
      ctx.updater.snapshot();
      const isOpen = !!State.get("searchOpen");
      ctx.updater.set({
        isOpen,
        modalClass: isOpen ? "modal modal-open" : "modal",
      });
      return ctx.updater.altered();
    };

    // Initial assign
    assign();

    // Use renderMethod to hook into the framework's render cycle.
    // observeState triggers render; we re-read State and focus input here.
    ctx.renderMethod = () => {
      assign();
      ctx.updater.digest();
      if (ctx.updater.get("isOpen")) {
        requestAnimationFrame(() => {
          const input = document.getElementById(
            "docs-search-input",
          ) as HTMLInputElement | null;
          input?.focus();
        });
      }
    };

    /**
     * Lazily build the MiniSearch instance. The search index is built on
     * first query by loading all .md modules (via getSearchIndex from State)
     * and extracting pageData — no build-time searchIndex serialization.
     * MiniSearch requires a unique `id` field, synthesized from array index.
     */
    async function ensureMiniSearch(): Promise<MiniSearch | null> {
      if (mini) return mini;
      const getSearchIndex = State.get("getSearchIndex") as
        | (() => Promise<
            {
              title: string;
              link: string;
              headings: string[];
              excerpt: string;
            }[]
          >)
        | undefined;
      if (!getSearchIndex) return null;
      const index = await getSearchIndex();
      if (!index.length) return null;

      const docs = index.map((entry, i) => ({
        ...entry,
        id: i,
      }));
      mini = new MiniSearch({
        fields: ["title", "headings", "excerpt"],
        storeFields: ["title", "link", "headings", "excerpt"],
        searchOptions: {
          prefix: true,
          fuzzy: 0.2,
          boost: { title: 2, headings: 1.5 },
        },
      });
      mini.addAll(docs);
      return mini;
    }

    return {
      template,
      assign,
      events: {
        "onModalClick<click>": (e: { eventTarget?: HTMLElement }) => {
          // Only close when the click lands on the modal backdrop itself,
          // not on content inside the modal-box (input, results, etc.).
          if (e.eventTarget?.id === "docs-search-modal") {
            State.set({ searchOpen: false }).digest();
          }
        },
        "noop<click>": () => {
          // Prevent click propagation from modal-box to modal overlay.
        },
        "onSearchInput<input>": async (e: Event) => {
          const input = e.target as HTMLInputElement;
          const query = input?.value || "";

          if (!query.trim()) {
            ctx.updater
              .set({ results: [], hasSearched: false, query: "" })
              .digest();
            return;
          }

          const m = await ensureMiniSearch();

          let raw: (SearchResult & Partial<SearchEntry>)[] = [];
          if (m) {
            try {
              raw = m.search(query);
            } catch {
              raw = [];
            }
          }

          const results = raw.map((r) => ({
            title: r.title || "",
            link: r.link || "",
            excerpt: r.excerpt || "",
            highlightedTitle: highlightMatch(r.title || "", query),
            highlightedExcerpt: highlightMatch(r.excerpt || "", query),
          }));

          ctx.updater.set({ results, hasSearched: true, query }).digest();
        },
        "goToResult<click>": (e: Event) => {
          // The click may land on a child element (<p>, <mark>) inside the <a>,
          // so walk up to find the element carrying data-href.
          let target = e.target as HTMLElement | null;
          while (target && !target.dataset["href"]) {
            target = target.parentElement;
          }
          const href = target?.dataset["href"];
          if (href) {
            Router.to(href);
            State.set({ searchOpen: false }).digest();
          }
        },
      },
    };
  });
}

/**
 * Wrap each query term occurrence in <mark> for highlighting.
 * Used with the raw {{!}} output operator in the template.
 */
function highlightMatch(text: string, query: string): string {
  if (!text) return "";
  if (!query) return text;
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  let result = text;
  for (const term of terms) {
    const regex = new RegExp(`(${escapeRegExp(term)})`, "gi");
    result = result.replace(regex, "<mark>$1</mark>");
  }
  return result;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
