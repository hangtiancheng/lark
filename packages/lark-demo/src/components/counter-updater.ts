/**
 * Counter Updater Component
 * Receives props from parent, fires events on button click.
 */
import { defineView } from "@lark.js/mvc";
import { withBaseView } from "../view";
import template from "./counter-updater.html";
import styles from "./counter-updater.module.css";

interface CounterProps {
  count: string | number;
  step: string | number;
  history: string[];
}

export default defineView(
  withBaseView((ctx, params) => {
    const { count, step, history } = (params || {}) as CounterProps;

    // ── init: sync props to updater data ──
    ctx.updater.digest({
      count: Number(count) || 0,
      step: Number(step) || 1,
      history: Array.isArray(history) ? history : [],
      styles,
    });

    return {
      template,
      events: {
        // Fire events to parent via frame emitter
        "increment<click>": () => {
          ctx.owner.fire("increment");
        },
        "decrement<click>": () => {
          ctx.owner.fire("decrement");
        },
        "reset<click>": () => {
          ctx.owner.fire("reset");
        },
        "stepChange<change>": (e: Event) => {
          const target = e.target as HTMLInputElement;
          ctx.owner.fire("stepChange", { step: parseInt(target?.value) || 1 });
        },
        "clearHistory<click>": () => {
          ctx.owner.fire("clearHistory");
        },
      },
    };
  }),
);
