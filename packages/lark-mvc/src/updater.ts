/**
 * Updater: per-view data binding with change detection and DOM diff
 * (functional factory).
 *
 * Replaces the former `Updater` class with a `createUpdater()` factory.
 * No `class`, no `this`, no `prototype`.
 *
 * Each View has an Updater instance that tracks data changes,
 * digests them, and triggers DOM re-rendering when needed.
 */
import {
  setData,
  hasOwnProperty,
  noop,
  getById,
  funcWithTry,
  EMPTY_STRING_SET,
} from "./utils";
import {
  SPLITTER,
  isRefToken,
  refFn,
  encodeHTML,
  strSafe,
  encodeURIExtra,
  encodeQuote,
} from "./common";
import {
  domGetNode,
  domSetChildNodes,
  applyDomOps,
  applyIdUpdates,
  createDomRef,
} from "./dom";
import { vdomSetChildNodes, createVDomRef } from "./vdom";
import type { UpdaterApi, VDomNode } from "./types";
import { Frame } from "./frame";

/** Callback queued via `digest()` to run after the digest cycle completes. */
type DigestCallback = () => void;

/**
 * Create an Updater for per-view data binding.
 *
 * Manages view-local data with change detection and DOM diff triggering.
 *
 * @param viewId - The view (frame) ID this updater belongs to
 * @returns An updater API object with `get`, `set`, `digest`, `forceDigest`, etc.
 */
export function createUpdater(viewId: string): UpdaterApi {
  /** Current data object */
  let data: Record<string, unknown> = { vId: viewId };

  /** Ref data for template rendering */
  const refData: Record<string, unknown> = {};
  refData[SPLITTER] = 1;

  /** Changed keys in current digest cycle */
  let changedKeys = new Set<string>();

  /** Whether data has changed since last digest */
  let hasChangedFlag = 0;

  /**
   * Digesting queue: supports re-digest during digest.
   * Holds pending callbacks; `null` is used as a sentinel marking the start
   * of an active digest cycle, so `runDigest` can detect re-entrant calls.
   */
  const digestingQueue: (DigestCallback | null)[] = [];

  /** Monotonically increasing version, bumped each time data actually changes. */
  let version = 0;

  /** Snapshot of `version` taken by `snapshot()`, used by `altered()`. */
  let snapshotVersion: number | undefined;

  /** Last rendered VDOM tree (only used when virtualDom is enabled) */
  let vdom: VDomNode | undefined;

  // Initial digest always triggers
  hasChangedFlag = 1;

  function get<T = unknown>(key?: string): T {
    let result: unknown = data;
    if (key) {
      result = data[key];
    }
    return result as T;
  }

  function set(
    newData: Record<string, unknown>,
    excludes?: ReadonlySet<string>,
  ): UpdaterApi {
    const changed = setData(
      newData,
      data,
      changedKeys,
      excludes || EMPTY_STRING_SET,
    );
    if (changed) {
      version++;
      hasChangedFlag = 1;
    }
    return api;
  }

  function digest(
    newData?: Record<string, unknown>,
    excludes?: ReadonlySet<string>,
    callback?: () => void,
  ): void {
    if (newData) {
      set(newData, excludes);
    }

    if (callback) {
      digestingQueue.push(callback);
    }

    // If already digesting, queue for later
    if (digestingQueue.length > 0 && digestingQueue[0] === null) {
      return;
    }

    runDigest(digestingQueue);
  }

  /**
   * Core digest execution.
   */
  function runDigest(digesting: (DigestCallback | null)[]): void {
    // Mark digesting state
    const startIndex = digesting.length;
    digesting.push(null); // Sentinel for re-digest detection

    const keys = changedKeys;
    const changed = hasChangedFlag;
    hasChangedFlag = 0;
    changedKeys = new Set();

    const frame = Frame.get(viewId);
    const view = frame?.view;
    const node = getById(viewId);

    if (changed && view && node && view.signature.value > 0 && frame) {
      const template = view.getTemplate();
      if (typeof template === "function") {
        // Call template with all params — string mode uses all 8, VDOM mode
        // ignores the extra 5. Return type is `string | VDomNode`; we narrow
        // by checking `typeof result === "string"` to avoid type assertions.
        const result = template(
          data,
          viewId,
          refData,
          encodeHTML,
          strSafe,
          encodeURIExtra,
          refFn,
          encodeQuote,
        );

        if (typeof result === "string") {
          // ── String rendering path ──
          const newDom = domGetNode(result, node);
          const ref = createDomRef();
          domSetChildNodes(node, newDom, ref, frame, keys);
          applyIdUpdates(ref.idUpdates);
          applyDomOps(ref.domOps);
          for (const v of ref.views) {
            if (v.render) {
              funcWithTry(v.render, [], v, noop);
            }
          }
          if (ref.hasChanged || !view.rendered.value) {
            view.endUpdate(viewId);
          }
        } else {
          // ── VDOM rendering path ──
          const newVDom = result;
          const ref = createVDomRef(viewId);
          const ready = (): void => {
            vdom = newVDom;
            if (ref.changed || !view.rendered.value) {
              view.endUpdate(viewId);
            }
            for (const [el, prop, val] of ref.nodeProps) {
              Reflect.set(el, prop, val);
            }
            for (const v of ref.viewRenders) {
              if (v.render) {
                funcWithTry(v.render, [], v, noop);
              }
            }
          };
          vdomSetChildNodes(node, vdom, newVDom, ref, frame, keys, view, ready);
        }
      }
    }

    // Process re-digest queue
    if (digesting.length > startIndex + 1) {
      runDigest(digesting);
    } else {
      // Digest complete, execute pending callbacks
      const callbacks = digesting.slice();
      digesting.length = 0;
      for (const cb of callbacks) {
        if (cb) cb();
      }
    }
  }

  function snapshot(): UpdaterApi {
    snapshotVersion = version;
    return api;
  }

  function altered(): boolean | undefined {
    if (snapshotVersion === undefined) return undefined;
    return version !== snapshotVersion;
  }

  function translate(dataVal: unknown): unknown {
    if (typeof dataVal !== "string" || !isRefToken(dataVal)) return dataVal;
    return hasOwnProperty(refData, dataVal) ? refData[dataVal] : dataVal;
  }

  function parse(expr: string): unknown {
    const trimmed = expr.trim();
    if (!trimmed) return undefined;

    // Pure numeric literal — return as number.
    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
      return Number(trimmed);
    }

    // Dotted property path: identifier(.identifier)*
    if (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(trimmed)) {
      return undefined;
    }

    let cur: unknown = refData;
    for (const segment of trimmed.split(".")) {
      if (cur == null || typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[segment];
    }
    return cur;
  }

  function getChangedKeys(): ReadonlySet<string> {
    return changedKeys;
  }

  function forceDigest(): void {
    hasChangedFlag = 1;
    changedKeys = new Set(Object.keys(data));
    digest();
  }

  const api: UpdaterApi = {
    get,
    set,
    digest,
    forceDigest,
    snapshot,
    altered,
    refData,
    translate,
    parse,
    getChangedKeys,
  };
  return api;
}
