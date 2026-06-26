/**
 * Counter View
 * Demonstrates v-lark nested sub-components
 */
import { defineView, Router, applyStyle } from "@lark.js/mvc";
import { withBaseView } from "../view";
import template from "./counter.html";
import styles from "./counter.module.css";

export default defineView(
  withBaseView((ctx) => {
    // ── Apply CSS module styles ──
    applyStyle(styles);
    ctx.updater.set({ styles });

    return {
      template,
      events: {
        "navigateTo<click>": (e: Record<string, unknown>) => {
          const p = e["params"] as Record<string, string> | undefined;
          if (p?.["path"]) {
            Router.to(p["path"]);
          }
        },
      },
    };
  }),
);
