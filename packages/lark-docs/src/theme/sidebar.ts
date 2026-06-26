/**
 * Sidebar View - navigation tree.
 *
 * Renders the sidebar navigation groups and items.
 * Reads sidebar data from State or passed via init params.
 */

import { State, Router, defineView } from "@lark.js/mvc";
import type { VDomTemplate, ViewSetup, ViewTemplate } from "@lark.js/mvc";
import type { DocsConfig, SidebarItem } from "../types";

export function createSidebarView(
  template: ViewTemplate | VDomTemplate,
): ViewSetup {
  return defineView((ctx) => {
    ctx.observeLocation([], true);

    const assign = (): boolean | undefined => {
      ctx.updater.snapshot();

      const docsConfig: DocsConfig = (State.get("docsConfig") ||
        {}) as DocsConfig;
      const sidebar = docsConfig.sidebar || {};
      // Normalize trailing slashes for consistent active-item matching.
      const currentPath =
        (Router.parse().path || "").replace(/\/+$/, "") || "/";

      // Flatten sidebar groups into sidebarGroups array for the template.
      // Each prefix becomes a group; nested SidebarItem trees are preserved
      // so the template can render sub-groups recursively.
      const sidebarGroups: Array<{
        text: string;
        items: SidebarItem[];
      }> = [];

      for (const [prefix, sidebarItems] of Object.entries(sidebar)) {
        if (Array.isArray(sidebarItems)) {
          sidebarGroups.push({
            text: formatPrefix(prefix),
            items: markActive(sidebarItems, currentPath),
          });
        }
      }

      ctx.updater.set({ sidebarGroups });
      return ctx.updater.altered();
    };

    // Initial assign
    assign();

    return {
      template,
      assign,
      events: {
        "navigateTo<click>": (e: Event) => {
          const target = e.target as HTMLElement;
          const href = target.dataset["href"];
          if (href) {
            Router.to(href);
          }
        },
      },
    };
  });
}

/**
 * Recursively mark the sidebar item whose link matches the current path.
 * Returns a new array with isActive flags set on matching items.
 */
function markActive(items: SidebarItem[], currentPath: string): SidebarItem[] {
  return items.map((item) => {
    const isActive = item.link === currentPath;
    const result: SidebarItem = {
      text: item.text,
      link: item.link,
      isActive,
      itemClass: isActive
        ? "menu-active bg-primary/10 text-primary font-medium rounded-field text-xs"
        : "rounded-field text-xs",
    };
    if (Array.isArray(item.items) && item.items.length > 0) {
      result.collapsed = item.collapsed;
      result.items = markActive(item.items, currentPath);
    }
    return result;
  });
}

function formatPrefix(prefix: string): string {
  return prefix
    .replace(/^\//, "")
    .replace(/\/$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
