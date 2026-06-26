/**
 * Home View
 * Demonstrates basic Lark View + zustand-style store
 */
import { defineView, Router, bindStore } from "@lark.js/mvc";
import { withBaseView, showAlert } from "../view";
import template from "./home.html";
import styles from "./home.module.css";
import useCountStore from "../store/count";

export default defineView(
  withBaseView((ctx, params) => {
    // CSS Module class names are available to the template via updater data.
    ctx.updater.set({ styles });

    // ── init: bind store + assign initial data ──
    bindStore(ctx, useCountStore, (s) => ({ count: s.count, step: s.step }));

    // ── assign: incremental DOM update ──
    const assign = (_options?: unknown): boolean | undefined => {
      ctx.updater.snapshot();

      const { count, step } = useCountStore.getState();

      ctx.updater.set({
        title: "Welcome to Lark Framework",
        description: "This is a minimal @lark.js/mvc example",
        appName: "Lark MVC Demo",
        currentTime: new Date().toLocaleString(),
        count,
        step,
      });

      return ctx.updater.altered();
    };

    // Call assign for initial render (replaces old init's this.assign?.(options))
    assign(params);

    return {
      template,
      assign,
      events: {
        "navigateTo<click>": (e: Record<string, unknown>) => {
          const p = e["params"] as Record<string, string> | undefined;
          const path = p?.path;
          if (path) {
            Router.to(path);
          }
        },
        "showInfo<click>": (e: Record<string, unknown>) => {
          const p = e["params"] as Record<string, string> | undefined;
          if (p) {
            showAlert(p.title ?? "", p.message ?? "");
          }
        },
      },
    };
  }),
);
