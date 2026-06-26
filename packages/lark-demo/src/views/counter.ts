/**
 * Counter View
 * Demonstrates v-lark nested sub-components
 */
import { defineView, Router } from "@lark.js/mvc";
import { withBaseView } from "../view";
import template from "./counter.html";
import styles from "./counter.module.css";

export default defineView(
  withBaseView((ctx) => {
    // CSS Module class names are available to the template via updater data.
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
