/**
 * Sidebar View - navigation tree.
 *
 * Renders the sidebar navigation groups and items.
 * Reads sidebar data from State or passed via init params.
 */

import { State, Router, View as ViewClass } from "@lark.js/mvc";
import type { DocsConfig, SidebarItem } from "../types";

export function createSidebarView(View: typeof ViewClass, template: unknown) {
  return View.extend({
    template,

    init() {
      this.observeLocation([], true);
      this.assign?.();
    },

    assign() {
      this.updater.snapshot();

      const docsConfig: DocsConfig = (State.get("docsConfig") ||
        {}) as DocsConfig;
      const sidebar = docsConfig.sidebar || {};
      const currentPath = Router.parse().path || "";

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

      this.updater.set({ sidebarGroups });
      return this.updater.altered();
    },

    render() {
      this.updater.digest();
    },

    "navigateTo<click>"(e: Event) {
      const target = e.target as HTMLElement;
      const href = target.dataset["href"];
      if (href) {
        Router.to(href);
      }
    },
  });
}

/**
 * Recursively mark the sidebar item whose link matches the current path.
 * Returns a new array with isActive flags set on matching items.
 */
function markActive(items: SidebarItem[], currentPath: string): SidebarItem[] {
  return items.map((item) => {
    const result: SidebarItem = {
      text: item.text,
      link: item.link,
      isActive: item.link === currentPath,
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
