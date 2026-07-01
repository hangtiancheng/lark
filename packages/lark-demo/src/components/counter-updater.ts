/**
 * Counter Updater Component
 * Demonstrates updater.set().digest() manual state management
 */
import { defineView } from "@lark.js/mvc";
import { withBaseView } from "../view";
import template from "./counter-updater.html";
import styles from "./counter-updater.module.css";

interface CounterState {
  count: number;
  step: number;
  history: string[];
}

export default defineView(
  withBaseView((ctx, params) => {
    // We can get props from params
    console.log(ctx, params);
    // ── init: set initial data (replaces async render()) ──
    ctx.updater.digest({
      count: 0,
      step: 1,
      history: [],
      styles,
    });

    return {
      template,
      events: {
        "increment<click>": () => {
          const { count, step, history } = ctx.updater.get<CounterState>();
          const newCount = count + step;
          ctx.updater
            .set({
              count: newCount,
              history: [`+${step} → ${newCount}`, ...history],
            })
            .digest();
        },
        "decrement<click>": () => {
          const { count, step, history } = ctx.updater.get<CounterState>();
          const newCount = count - step;
          ctx.updater
            .set({
              count: newCount,
              history: [`-${step} → ${newCount}`, ...history],
            })
            .digest();
        },
        "reset<click>": () => {
          ctx.updater
            .set({
              count: 0,
              history: ["Reset → 0", ...ctx.updater.get<string[]>("history")],
            })
            .digest();
        },
        "stepChange<change>": (e: Event) => {
          const target = e.target as HTMLInputElement;
          const newStep = parseInt(target?.value) || 1;
          ctx.updater.set({ step: newStep }).digest();
        },
        "clearHistory<click>": () => {
          ctx.updater.set({ history: [] }).digest();
        },
      },
    };
  }),
);
