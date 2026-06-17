/**
 * Updater: per-view data binding with change detection and DOM diff.
 *
 * Each View has an Updater instance that tracks data changes,
 * digests them, and triggers DOM re-rendering when needed.
 *
 * - refData ($data): data object + ref counter for template rendering
 * - changedKeys ($changedKeys): keys changed since last digest
 * - hasChangedFlag ($hasChanged): whether any data changed
 * - digesting queue ($digestQueue): supports re-digest during digest
 * - snapshot ($snapshot): JSON string for altered() detection
 */
import {
  setData,
  hasOwnProperty,
  noop,
  getById,
  funcWithTry,
  EMPTY_STRING_SET,
} from "./utils";
import { safeguard } from "./safeguard";
import {
  SPLITTER,
  isRefToken,
  refFn,
  encodeHTML,
  encodeSafe,
  encodeURIExtra,
  encodeQ,
} from "./common";
import { Frame } from "./frame";
import {
  domGetNode,
  domSetChildNodes,
  applyDomOps,
  applyIdUpdates,
  createDomRef,
} from "./dom";
import type { UpdaterInterface } from "./types";

// ============================================================
// Updater class
// ============================================================

/** Callback queued via `digest()` to run after the digest cycle completes. */
type DigestCallback = () => void;

/**
 * Updater class for view data binding.
 * Manages view-local data with change detection and DOM diff triggering.
 *
 */
export class Updater implements UpdaterInterface {
  /** View ID (same as owner frame ID) */
  private viewId: string;

  /** Current data object */
  private data: Record<string, unknown>;

  /** Ref data for template rendering */
  refData: Record<string, unknown>;

  /** Changed keys in current digest cycle */
  private changedKeys = new Set<string>();

  /** Whether data has changed since last digest */
  private hasChangedFlag = 0;

  /**
   * Digesting queue: supports re-digest during digest.
   * Holds pending callbacks; `null` is used as a sentinel marking the start
   * of an active digest cycle, so `runDigest` can detect re-entrant calls.
   */
  private digestingQueue: (DigestCallback | null)[] = [];

  /** Monotonically increasing version, bumped each time data actually changes. */
  private version = 0;

  /** Snapshot of `version` taken by `snapshot()`, used by `altered()`. */
  private snapshotVersion: number | undefined;

  constructor(viewId: string) {
    this.viewId = viewId;
    this.data = { vId: viewId };
    const refCounter: Record<string, unknown> = {};
    refCounter[SPLITTER] = 1;
    this.refData = refCounter;
    this.hasChangedFlag = 1; // Initial digest always triggers
  }

  /**
   * Get data by key.
   * Returns entire data object if key is omitted.
   */
  get<T = unknown>(key?: string): T {
    let result: unknown = this.data;
    if (key) {
      result = this.data[key];
    }
    if (typeof window !== "undefined" && window.__lark_Debug) {
      return safeguard(result) as T;
    }
    return result as T;
  }

  /**
   * Set data, tracking changed keys.
   * Returns this for chaining.
   */
  set(data: Record<string, unknown>, excludes?: ReadonlySet<string>): this {
    const changed = setData(
      data,
      this.data,
      this.changedKeys,
      excludes || EMPTY_STRING_SET,
    );
    if (changed) {
      this.version++;
      this.hasChangedFlag = 1;
    }
    return this;
  }

  /**
   * Detect changes and trigger DOM re-render.
   *
   * The core rendering pipeline:
   * 1. Set data if provided
   * 2. If changed, run DOM diff (template → new DOM → diff against old DOM)
   * 3. Apply DOM operations
   * 4. Apply ID updates
   * 5. Call endUpdate on views that need re-rendering
   * 6. Support re-digest during digest via queue
   */
  digest(
    data?: Record<string, unknown>,
    excludes?: ReadonlySet<string>,
    callback?: () => void,
  ): void {
    if (data) {
      this.set(data, excludes);
    }

    const digesting = this.digestingQueue;
    if (callback) {
      digesting.push(callback);
    }

    // If already digesting, queue for later
    if (digesting.length > 0 && digesting[0] === null) {
      // Already in digest cycle, just queue
      return;
    }

    this.runDigest(digesting);
  }

  /**
   * Core digest execution.
   */
  private runDigest(digesting: (DigestCallback | null)[]): void {
    // Mark digesting state
    const startIndex = digesting.length;
    digesting.push(null); // Sentinel for re-digest detection

    const keys = this.changedKeys;
    const changed = this.hasChangedFlag;
    this.hasChangedFlag = 0;
    this.changedKeys = new Set();

    const frame = Frame.get(this.viewId);
    const view = frame?.view;
    const node = getById(this.viewId);

    if (changed && view && node && view.signature > 0 && frame) {
      const template = view.template;
      if (typeof template === "function") {
        // Template rendering: generate HTML from template function
        const html = template(
          this.data,
          this.viewId,
          this.refData,
          encodeHTML,
          encodeSafe,
          encodeURIExtra,
          refFn,
          encodeQ,
        );

        // Parse new DOM from HTML
        const newDom = domGetNode(html, node);

        // Create DOM ref for tracking operations
        const ref = createDomRef();

        // Run DOM diff (in-memory real DOM diff)
        domSetChildNodes(node, newDom, ref, frame, keys);

        // Apply ID updates
        applyIdUpdates(ref.idUpdates);

        // Apply DOM operations
        applyDomOps(ref.domOps);

        // Trigger endUpdate for views that need re-rendering
        for (const v of ref.views) {
          if (v.render) {
            funcWithTry(v.render, [], v, noop);
          }
        }

        // Check if view needs endUpdate
        if (ref.hasChanged || !view.rendered) {
          view.endUpdate(this.viewId);
        }
      }
    }

    // Process re-digest queue
    if (digesting.length > startIndex + 1) {
      this.runDigest(digesting);
    } else {
      // Digest complete, execute pending callbacks
      const callbacks = digesting.slice();
      digesting.length = 0;
      for (const cb of callbacks) {
        if (cb) cb();
      }
    }
  }

  /**
   * Save a snapshot of the current data version for `altered()` detection.
   * Cheap O(1) — records the current monotonic version, no serialization.
   */
  snapshot(): this {
    this.snapshotVersion = this.version;
    return this;
  }

  /**
   * Check whether data has changed since the last snapshot.
   * Returns undefined when no snapshot has been taken yet.
   */
  altered(): boolean | undefined {
    if (this.snapshotVersion === undefined) return undefined;
    return this.version !== this.snapshotVersion;
  }

  /**
   * Translate a refData reference back to its original value.
   *
   * The ref protocol is `SPLITTER` + ascii decimal digits — the exact format
   * emitted by `refFn`. We require that exact shape so a user-supplied
   * string that merely begins with SPLITTER is never accidentally resolved
   * (or mishandled as a "missing ref").
   */
  translate(data: unknown): unknown {
    if (typeof data !== "string" || !isRefToken(data)) return data;
    return hasOwnProperty(this.refData, data) ? this.refData[data] : data;
  }

  /**
   * Resolve a dotted property path against refData.
   *
   * Only safe property-path syntax is supported: `a`, `a.b`, `a.b.c`.
   * Numeric literals (e.g. `1`, `1.5`) are returned as numbers. Anything else
   * returns `undefined` — we no longer evaluate arbitrary JavaScript via
   * `new Function`, so the method is CSP-safe and cannot be used as an
   * injection vector.
   */
  parse(expr: string): unknown {
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

    let cur: unknown = this.refData;
    for (const segment of trimmed.split(".")) {
      if (cur == null || typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[segment];
    }
    return cur;
  }

  /**
   * Get the set of keys changed since the last digest (for external inspection).
   */
  getChangedKeys(): ReadonlySet<string> {
    return this.changedKeys;
  }
}
