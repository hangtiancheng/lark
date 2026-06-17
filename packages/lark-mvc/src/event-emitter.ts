/**
 * Multi-cast event emitter.
 *
 * Supports: on/off/fire with re-entrant safety. While `fire()` is iterating
 * a listener list, `off()` calls schedule a deferred removal that is applied
 * once the outermost `fire()` completes — so handlers can detach themselves
 * (or each other) without skipping siblings or breaking iteration.
 */
import { SPLITTER } from "./common";
import { noop, funcWithTry } from "./utils";
import type {
  AnyFunc,
  ChangeEvent,
  EventEmitterInterface,
  EventListenerEntry,
} from "./types";

/**
 * Multi-cast event emitter class.
 *
 * @example
 * const emitter = new EventEmitter();
 * emitter.on('change', (data) => console.log(data));
 * emitter.fire('change', { key: 'value' });
 */
export class EventEmitter<T = unknown> implements EventEmitterInterface<T> {
  /** Event listeners: prefixed key -> listener array */
  listeners = new Map<string, EventListenerEntry[]>();

  /** Number of `fire()` calls currently on the stack (re-entrancy depth). */
  private firingDepth = 0;

  /** Keys whose listener list needs compaction after firing settles. */
  private pendingCompaction: Set<string> | undefined;

  /**
   * Bind event listener.
   */
  on(event: string, handler: (this: T, e: ChangeEvent) => void): this {
    const key = SPLITTER + event;
    let list = this.listeners.get(key);
    if (!list) {
      list = [];
      this.listeners.set(key, list);
    }
    list.push({ handler, executing: 0 });
    return this;
  }

  /**
   * Unbind event listener.
   * If handler is provided, removes only that handler.
   * If no handler, removes all handlers for the event.
   */
  off(event: string, handler?: AnyFunc): this {
    const key = SPLITTER + event;
    if (handler) {
      const list = this.listeners.get(key);
      if (!list) return this;
      if (this.firingDepth > 0) {
        // Re-entrant remove during fire(): mark with noop and defer compaction.
        for (const listener of list) {
          if (listener.handler === handler) {
            listener.handler = noop;
            (this.pendingCompaction ??= new Set()).add(key);
            break;
          }
        }
      } else {
        for (let i = 0; i < list.length; i++) {
          if (list[i].handler === handler) {
            list.splice(i, 1);
            break;
          }
        }
        if (list.length === 0) this.listeners.delete(key);
      }
    } else {
      // Remove all handlers for this event.
      this.listeners.delete(key);
      Reflect.deleteProperty(
        this,
        `on${event[0].toUpperCase() + event.slice(1)}`,
      );
    }
    return this;
  }

  /**
   * Fire event, execute all bound handlers. Safe for re-entrant `off()` calls
   * during dispatch: removed handlers are replaced with noop and compacted
   * after the outermost fire returns.
   *
   * @param event - Event name
   * @param data - Event data (type property added automatically)
   * @param remove - Whether to remove all handlers after firing
   * @param lastToFirst - Whether to execute handlers in reverse order
   */
  fire(
    event: string,
    data?: Record<string, unknown>,
    remove?: boolean,
    lastToFirst?: boolean,
  ): this {
    const key = SPLITTER + event;
    const list = this.listeners.get(key);

    if (!data) {
      data = {};
    }
    data["type"] = event;

    this.firingDepth++;
    try {
      if (list) {
        const len = list.length;
        for (let i = 0; i < len; i++) {
          const idx = lastToFirst ? len - 1 - i : i;
          const listener = list[idx];
          if (!listener) continue;
          if (listener.handler === noop) continue;
          listener.executing = 1;
          funcWithTry([listener.handler], [data], this, noop);
          listener.executing = "";
        }
      }

      // Call onEventName method if exists
      const onMethodName =
        `on${event[0].toUpperCase() + event.slice(1)}` as keyof this;
      const onMethod = this[onMethodName] as AnyFunc;
      if (typeof onMethod === "function") {
        funcWithTry([onMethod], [data], this, noop);
      }

      if (remove) {
        this.off(event);
      }
    } finally {
      this.firingDepth--;
      if (this.firingDepth === 0 && this.pendingCompaction) {
        for (const k of this.pendingCompaction) {
          const l = this.listeners.get(k);
          if (!l) continue;
          for (let i = l.length - 1; i >= 0; i--) {
            if (l[i].handler === noop) l.splice(i, 1);
          }
          if (l.length === 0) this.listeners.delete(k);
        }
        this.pendingCompaction = undefined;
      }
    }

    return this;
  }
}
