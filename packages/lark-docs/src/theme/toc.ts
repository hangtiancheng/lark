import { State, defineView } from "@lark.js/mvc";
import type { VDomTemplate, ViewSetup, ViewTemplate } from "@lark.js/mvc";

/**
 * TocView - right-side heading outline.
 *
 * Renders h2/h3 headings extracted from the current page.
 * Supports scroll-spy to highlight the currently visible heading.
 */

export function createTocView(
  template: ViewTemplate | VDomTemplate,
): ViewSetup {
  return defineView((ctx) => {
    // Re-render when the layout publishes new headings for the current page.
    ctx.observeState("currentPageHeadings");

    const assign = (): boolean | undefined => {
      ctx.updater.snapshot();
      const rawHeadings = (State.get("currentPageHeadings") || []) as Array<{
        level: number;
        slug: string;
        text: string;
        isActive?: boolean;
      }>;
      const headings = rawHeadings.map((h) => ({
        ...h,
        liClass: h.level === 3 ? "pl-2" : "",
        itemClass: h.isActive
          ? "menu-active text-primary font-medium rounded-field text-base-content/60 text-xs"
          : "rounded-field text-base-content/60 text-xs",
      }));
      ctx.updater.set({ headings });
      return ctx.updater.altered();
    };

    // Initial assign
    assign();

    return {
      template,
      assign,
      events: {
        "scrollToHeading<click>": (e: Event) => {
          const target = e.target as HTMLElement;
          const slug = target.dataset["slug"];
          if (slug) {
            const el = document.getElementById(slug);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }
        },
      },
    };
  });
}
