import {
  State,
  Router,
  View as ViewClass,
  type ViewInterface,
} from "@lark.js/mvc";
import { icons as defaultIcons } from "./icons";
import { createLocalSearchClient } from "./docs-search-local";
import type { DocsConfig, PageData } from "../types";

/**
 * Shape of `this` inside DocsLayoutView methods. The custom helper
 * (_initDocSearch) is not on ViewInterface, so it must be declared
 * explicitly via a `this:` parameter annotation.
 */
interface DocsLayoutViewThis extends ViewInterface {
  _initDocSearch(): Promise<void>;
}

/**
 * DocsLayout view definition factory.
 *
 * Call this with the compiled template and lark-mvc View class
 * to produce a registered view.
 *
 * Icons are set once in init() (not in assign()) because they are static
 * data that does not change between renders. The icons object is passed
 * to updater.set() so the template can reference them via {{!icons.name}}.
 *
 * Usage in user's boot.ts:
 * ```ts
 * import { createDocsLayoutView, icons } from "@lark.js/docs";
 * import template from "@lark.js/docs/theme/docs-layout.html";
 * import { View } from "@lark.js/mvc";
 *
 * registerViewClass("theme/docs-layout", createDocsLayoutView(View, template));
 * ```
 */
export function createDocsLayoutView(
  View: typeof ViewClass,
  template: unknown,
) {
  return View.extend({
    template,

    init(this: DocsLayoutViewThis) {
      // Icons are static data -- set once in init(), not in render()
      this.updater.set({ icons: defaultIcons });

      // Observe path changes so layout re-renders on navigation.
      // The layout view stays mounted (all /docs/* routes map to this view),
      // so observeLocation triggers an async render to reload content.
      this.observeLocation([], true);

      // Initialize DocSearch widget if configured.
      const docsConfig = (State.get("docsConfig") || {}) as DocsConfig;
      if (docsConfig.search?.provider === "docsearch") {
        this._initDocSearch();
      }

      // Initial content load happens in render() (async).
    },

    /**
     * Async render: load the content module for the current route path,
     * publish page headings to State (for the TOC sub-view), then digest.
     *
     * Because all /docs/* routes map to this same viewId, lark-mvc does NOT
     * unmount/remount the layout on navigation — it only re-runs render().
     * The signature guard short-circuits stale loads when the user navigates
     * again before the previous import resolves.
     */
    async render() {
      const docsConfig: DocsConfig = State.get("docsConfig") || {};
      const loadContent = State.get("loadContent") as
        | ((
            path: string,
          ) => Promise<{ pageData: PageData; contentHtml: string } | null>)
        | undefined;
      const rawPath = Router.parse().path || docsConfig.baseUrl || "/";
      // Normalize trailing slashes to match route keys (which never have
      // trailing slashes). "/docs/ch1/" → "/docs/ch1".
      const path = rawPath.replace(/\/+$/, "") || "/";

      const sig = this.signature;
      let content: {
        pageData: PageData;
        contentHtml: string;
      } | null = null;
      try {
        content = loadContent ? await loadContent(path) : null;
      } catch (err) {
        console.warn("[@lark.js/docs] Failed to load content for", path, err);
      }
      if (this.signature !== sig) return; // superseded by a newer render

      if (content) {
        // Publish current page headings so the TOC sub-view can render.
        State.set({
          currentPageHeadings: content.pageData.headings || [],
          currentPageTitle: content.pageData.title || "",
        }).digest();
      }

      this.updater.set({
        siteTitle: docsConfig.title || "Documentation",
        navItems: docsConfig.nav || [],
        searchProvider: docsConfig.search?.provider || "local",
        contentHtml: content?.contentHtml || "<p>Page not found.</p>",
        prevPage: null,
        nextPage: null,
      });
      this.updater.digest();
    },

    "navigateTo<click>"(e: Event) {
      const target = e.target as HTMLElement;
      const href = target.dataset["href"];
      if (href) {
        Router.to(href);
      }
    },

    "navigateHome<click>"() {
      const docsConfig = State.get("docsConfig") as DocsConfig | undefined;
      Router.to(docsConfig?.baseUrl || "/docs/");
    },

    "openSearch<click>"() {
      // Toggle searchOpen via State. The SearchView observes this key and
      // re-renders with `class="modal modal-open"` (via {{if isOpen}} in the
      // template), so modal visibility is fully driven by the Updater
      // pipeline — no manual DOM manipulation.
      State.set({ searchOpen: true }).digest();
    },

    /**
     * Initialize the Algolia DocSearch widget with local search index.
     *
     * Dynamically imports @docsearch/js and @docsearch/css, then mounts
     * the widget into #docsearch-container. The widget provides its own
     * styled button and search modal with keyboard shortcut (Ctrl+K).
     *
     * Uses createLocalSearchClient() to query the pre-built search index
     * instead of Algolia's hosted API -- no credentials required.
     */
    async _initDocSearch(this: DocsLayoutViewThis) {
      // searchIndex is lazily built at runtime via getSearchIndex (loading
      // all .md modules on first search) — no build-time serialization.
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
      const searchIndex = getSearchIndex ? await getSearchIndex() : [];
      const localClient = createLocalSearchClient(searchIndex);

      import("@docsearch/css");
      import("@docsearch/js")
        .then(({ default: docsearch }) => {
          const container = document.getElementById("docsearch-container");
          if (!container) return;

          docsearch({
            container,
            // Dummy credentials -- the actual search is handled by our local
            // client injected via transformSearchClient below.
            appId: "local",
            apiKey: "local",
            indexName: "local",
            transformSearchClient: (client) => {
              // Replace the Algolia search method with our local index search
              // client.search = localClient.search;
              Reflect.set(client, "search", localClient.search);
              return client;
            },
          });
        })
        .catch((e: unknown) => {
          console.warn("[@lark.js/docs] Failed to initialize DocSearch:", e);
        });
    },
  });
}
