/**
 * 404 Page View
 * Displayed when route is not matched
 */
import { defineView, Router } from "@lark.js/mvc";
import template from "./404.html";

export default defineView((ctx, params) => {
  // ── assign: incremental DOM update ──
  const assign = (_options?: unknown): boolean | undefined => {
    ctx.updater.snapshot();

    const loc = Router.parse();

    ctx.updater.set({
      path: loc.path || "Unknown path",
    });

    return ctx.updater.altered();
  };

  // Call assign for initial render
  assign(params);

  return {
    template,
    assign,
    events: {
      "goHome<click>": () => {
        Router.to("/home");
      },
    },
  };
});
