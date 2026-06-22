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
import {
  State,
  Router,
  View as ViewClass,
  type ViewInterface,
} from "@lark.js/mvc";
import { icons as defaultIcons } from "./icons";
import type { DocsConfig, SearchEntry } from "../types";

/**
 * Shape of `this` inside SearchView methods. Custom state (_mini) and helper
 * (_ensureMiniSearch) are not on ViewInterface, so they must be declared
 * explicitly via a `this:` parameter annotation.
 */
interface SearchViewThis extends ViewInterface {
  _mini: MiniSearch | null;
  _ensureMiniSearch(): MiniSearch | null;
}

export function createSearchView(View: typeof ViewClass, template: unknown) {
  return View.extend({
    template,

    init(this: SearchViewThis) {
      this.updater.set({ icons: defaultIcons });
      this._mini = null;
      // Re-render when the layout toggles searchOpen.
      this.observeState("searchOpen");
      this.assign?.();
    },

    assign() {
      this.updater.snapshot();
      const isOpen = !!State.get("searchOpen");
      this.updater.set({
        isOpen,
        results: [],
        hasSearched: false,
        query: "",
      });
      return this.updater.altered();
    },

    render() {
      this.updater.digest();
      if (this.updater.get("isOpen")) {
        // Focus the input after the modal renders.
        setTimeout(() => {
          const input = document.getElementById(
            "docs-search-input",
          ) as HTMLInputElement;
          input?.focus();
        }, 50);
      }
    },

    "closeSearch<click>"() {
      State.set({ searchOpen: false }).digest();
    },

    "noop<click>"() {
      // Prevent click propagation from modal-box to modal overlay.
    },

    "onSearchInput<input>"(this: SearchViewThis, e: Event) {
      const input = e.target as HTMLInputElement;
      const query = input?.value || "";

      if (!query.trim()) {
        this.updater
          .set({ results: [], hasSearched: false, query: "" })
          .digest();
        return;
      }

      const mini = this._ensureMiniSearch();

      let raw: (SearchResult & Partial<SearchEntry>)[] = [];
      if (mini) {
        try {
          raw = mini.search(query);
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

      this.updater.set({ results, hasSearched: true, query }).digest();
    },

    "goToResult<click>"(e: Event) {
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

    /**
     * Lazily build the MiniSearch instance from the build-time search index.
     * MiniSearch requires a unique `id` field, which we synthesize from the
     * array index since SearchEntry has no natural id.
     */
    _ensureMiniSearch(this: SearchViewThis): MiniSearch | null {
      if (this._mini) return this._mini;
      const index =
        (State.get("docsConfig") as DocsConfig & { searchIndex: SearchEntry[] })
          ?.searchIndex || [];
      if (!index.length) return null;

      const docs = index.map((entry: SearchEntry, i: number) => ({
        ...entry,
        id: i,
      }));
      this._mini = new MiniSearch({
        fields: ["title", "headings", "excerpt"],
        storeFields: ["title", "link", "headings", "excerpt"],
        searchOptions: {
          prefix: true,
          fuzzy: 0.2,
          boost: { title: 2, headings: 1.5 },
        },
      });
      this._mini.addAll(docs);
      return this._mini;
    },
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
