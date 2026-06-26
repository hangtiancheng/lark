/**
 * 404 Page View
 * Displayed when route is not matched
 */
import { defineView, Router, applyStyle } from "@lark.js/mvc";
import template from "./404.html";
import styles from "./404.module.css";

export default defineView((ctx, params) => {
  // Apply CSS module styles (bundler handles injection; this call ensures
  // the styles object is registered and available for template rendering)
  applyStyle(styles);

  // Make CSS module class names available to the template via updater data
  ctx.updater.set({ styles });

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
