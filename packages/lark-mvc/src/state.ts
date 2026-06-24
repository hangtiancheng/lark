/**
 * Observable in-memory data object for cross-view data sharing.
 *
 * State is the recommended choice for SIMPLE cross-view data:
 * lightweight shared values (counters, toggles, page title, session info, etc.)
 * For COMPLEX reactive state — handlers, derived data, multi-instance
 * isolation, or store-internal reactions — prefer `create` from `./store`.
 */
import { RouterEvents } from "./common";
import { hasOwnProperty, setData, EMPTY_STRING_SET } from "./utils";
import { EventEmitter } from "./event-emitter";
import type { AnyFunc, ChangeEvent, StateInterface } from "./types";

/** Application state data */
const appData: Record<string, unknown> = {};

/** Key reference counts: how many views observe each key */
const keyRefCounts: Record<string, number> = {};

/** Changed keys in current digest cycle */
let changedKeys = new Set<string>();

/** Stashed changed keys from last digest */
let stashedChangedKeys: ReadonlySet<string> = EMPTY_STRING_SET;

/** Whether data has changed since last digest */
let dataIsChanged = false;

/** Where each key was set (for debug) */
const dataWhereSet: Record<string, string> = {};

/** Event emitter for state events */
const emitter = new EventEmitter();

/** Whether framework has booted */
let booted = false;

/** Mark framework as booted (called from Framework.boot) */
export function markBooted(): void {
  booted = true;
}

/** Increment reference count for keys */
function setupKeysRef(keys: string): string[] {
  const keyList = keys.split(",");
  for (const key of keyList) {
    if (hasOwnProperty(keyRefCounts, key)) {
      keyRefCounts[key]++;
    } else {
      keyRefCounts[key] = 1;
    }
  }
  return keyList;
}

/** Decrement reference count for keys, delete data if count reaches 0 */
function teardownKeysRef(keyList: string[]): void {
  for (const key of keyList) {
    if (hasOwnProperty(keyRefCounts, key)) {
      const count = --keyRefCounts[key];
      if (count <= 0) {
        Reflect.deleteProperty(keyRefCounts, key);
        Reflect.deleteProperty(appData, key);
      }
    }
  }
}

/**
 * DEBUG: deduplicate direct-mutation warnings.
 *
 * Previously this was delayed by 500ms so multiple writes to the same key
 * would coalesce — but users complained the warning didn't show up at the
 * point of the mutation. We now warn synchronously and dedupe by key, so
 * the first hit shows up immediately at the right place in the stack trace.
 * `clearNotify(key)` resets the dedup flag once the legitimate
 * `State.set` + `State.digest` actually runs.
 */
const warnedKeys = new Set<string>();

function clearNotify(key: string): void {
  warnedKeys.delete(key);
}

function delayNotify(key: string, message: string): void {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(message);
}

/**
 * Observable in-memory data object.
 * Provides get/set/digest/diff/clean methods for cross-view data sharing.
 */
export const State: StateInterface = {
  /**
   * Get data from state.
   */
  get<T = unknown>(key?: string): T {
    const result = key ? appData[key] : appData;
    return result as T;
  },

  /**
   * Set data to state.
   */
  set(
    data: Record<string, unknown>,
    excludes?: ReadonlySet<string>,
  ): typeof State {
    dataIsChanged =
      setData(data, appData, changedKeys, excludes || EMPTY_STRING_SET) ||
      dataIsChanged;
    return State;
  },

  /**
   * Detect data changes and fire changed event if any.
   */
  digest(data?: Record<string, unknown>, excludes?: ReadonlySet<string>): void {
    if (data) {
      State.set(data, excludes);
    }
    if (dataIsChanged) {
      dataIsChanged = false;
      // Snapshot changed keys and stash for diff()
      const keys = changedKeys;
      stashedChangedKeys = keys;
      changedKeys = new Set();
      emitter.fire(RouterEvents.CHANGED, { keys });
    }
  },

  /**
   * Get the set of keys changed in the most recent digest.
   */
  diff(): ReadonlySet<string> {
    return stashedChangedKeys;
  },

  /**
   * Create mixin to clean up state keys on view destroy.
   * Must be used in view.mixins array.
   */
  clean(keys: string): { ctor: AnyFunc } {
    return {
      ctor: function (this: { on: (event: string, handler: AnyFunc) => void }) {
        const keyList = setupKeysRef(keys);
        this.on("destroy", () => {
          teardownKeysRef(keyList);
        });
      },
    };
  },

  /**
   * Bind event listener.
   */
  on(event: string, handler: (e: ChangeEvent) => void): typeof State {
    emitter.on(event, handler);
    return State;
  },

  /**
   * Unbind event listener.
   */
  off(event: string, handler?: AnyFunc): typeof State {
    emitter.off(event, handler);
    return State;
  },

  /**
   * Fire event.
   */
  fire(
    event: string,
    data?: Record<string, unknown>,
    remove?: boolean,
  ): typeof State {
    emitter.fire(event, data, remove);
    return State;
  },

  // onChanged: noop,
};
