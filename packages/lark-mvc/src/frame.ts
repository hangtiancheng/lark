/**
 * Frame (Frame) tree for view lifecycle management.
 *
 * Manages a tree of frames, each owning a view instance.
 * Handles mount/unmount, invoke, created/alter notifications.
 */
import { SPLITTER, LARK_VIEW } from "./common";
import {
  hasOwnProperty,
  parseUri,
  getAttribute,
  funcWithTry,
  noop,
  assign,
  translateData,
  ensureElementId,
} from "./utils";
import { EventEmitter } from "./event-emitter";
import { unmark } from "./mark";
import { View } from "./view";
import { EventDelegator } from "./event-delegator";
import { use, config as frameworkConfig } from "./module-loader";
import { getViewClass, registerViewClass } from "./view-registry";
import type {
  AnyFunc,
  FrameInterface,
  FrameInvokeEntry,
  ViewInterface,
} from "./types";

// ============================================================
// Internal state
// ============================================================

/** All frames registry */
const frameRegistry = new Map<string, Frame>();

/** Root frame instance */
let rootFrame: Frame | undefined;

/** Global alter data */
let globalAlter: { id: string } | undefined;

/** Maximum number of destroyed Frame instances kept around for reuse. */
const MAX_FRAME_POOL = 64;

/** Frame object cache for reuse (bounded by MAX_FRAME_POOL) */
const frameCache: Frame[] = [];

/** Static event emitter for Frame-level events (add/remove) */
const staticEmitter = new EventEmitter();

// ============================================================
// Frame class
// ============================================================

/**
 * Frame (View Frame) class for view lifecycle management.
 * Each frame owns a view and manages child frames.
 *
 */
export class Frame extends EventEmitter implements FrameInterface {
  /** Frame ID (same as owner DOM element ID) */
  readonly id: string;

  /** Parent Frame ID */
  private _parentId: string | undefined = undefined;

  get parentId(): string | undefined {
    return this._parentId;
  }

  /** Children map: id -> id */
  childrenMap: Record<string, string> = {};

  /** Children count */
  childrenCount = 0;

  /** Ready count (children that have fired 'created') */
  readyCount = 0;

  /** Set of child frame IDs that have fired 'created' */
  readyMap: Set<string> = new Set();

  /** View instance */
  viewInstance?: ViewInterface;

  /** Get view instance (read-only) */
  get view(): ViewInterface | undefined {
    return this.viewInstance;
  }

  /** Invoke list for deferred method calls */
  invokeList: FrameInvokeEntry[] = [];

  /** Signature for async operation tracking */
  signature = 1;

  /** Whether view has altered */
  hasAltered = 0;

  /** Whether view is destroyed */
  destroyed = 0;

  /** View path (v-lark attribute value) */
  viewPath?: string;

  /** Original template before mount */
  originalTemplate?: string;

  /** Hold fire created flag */
  holdFireCreated = 0;

  /** Children created flag */
  childrenCreated = 0;

  /** Children alter flag */
  childrenAlter = 0;

  constructor(id: string, parentId?: string) {
    super();
    this.id = id;
    if (parentId) {
      this._parentId = parentId;
    }

    // Register frame
    frameRegistry.set(id, this);

    // Attach frame to DOM element
    const element = document.getElementById(id);
    if (element) {
      // Bind frame to DOM element
      element.frame = this;
      element.frameBound = 1;
    }

    // Fire add event
    Frame.fire("add", { frame: this });
  }

  // ============================================================
  // Instance methods
  // ============================================================

  /**
   * Mount a view to this frame.
   *
   * Complete flow:
   * 1. Parse viewPath, translate query params from parent
   * 2. Unmount current view
   * 3. Load View class (via require or provided ViewClass)
   * 4. View_Prepare (scan event methods)
   * 5. Create View instance
   * 6. View_DelegateEvents (bind DOM events)
   * 7. Call view.init()
   * 8. If view has template, call render via Updater
   * 9. If no template, call endUpdate directly
   */
  mountView(viewPath: string, viewInitParams?: Record<string, unknown>): void {
    const node = document.getElementById(this.id);
    const pId = this.parentId;

    // Store original template before alter
    if (!this.hasAltered && node) {
      this.hasAltered = 1;
      this.originalTemplate = node.innerHTML;
    }

    // Unmount current view
    this.unmountView();
    this.destroyed = 0;

    // Parse view path and params
    const parsed = parseUri(viewPath || "");
    const viewClassName = parsed.path;
    if (!node || !viewClassName) return;

    this.viewPath = viewPath;

    // Translate query params from parent view's refData
    const params = parsed["params"];
    translateQuery(pId || this.id, viewPath, params);

    // Merge init params
    const initParams: Record<string, unknown> = { ...params };
    if (viewInitParams) {
      assign(initParams, viewInitParams);
    }

    const sign = this.signature;

    // Use the require function from Framework config to load the View class
    // Synchronous path: View class already registered
    // Asynchronous path: load via Framework.use(), then register + doMountView
    const registered = getViewClass(viewClassName);
    if (registered) {
      // Synchronous path: View class already loaded
      this.doMountView(registered, initParams, node, sign);
      return;
    }

    // Asynchronous path: load View class from remote module
    use(viewClassName, (ViewClass: unknown) => {
      // Guard: Frame may have been unmounted or re-mounted during async load
      if (sign !== this.signature) return;

      if (typeof ViewClass === "function") {
        const ViewClassTyped = ViewClass as typeof View;
        // Register for future synchronous access
        registerViewClass(viewClassName, ViewClassTyped);
        this.doMountView(ViewClassTyped, initParams, node, sign);
      } else {
        // Loading failed or returned non-class
        const error = new Error(`Cannot load view: ${viewClassName}`);
        const errorHandler = frameworkConfig.error;
        if (errorHandler) {
          errorHandler(error);
        }
      }
    });
  }

  /**
   * Internal: actually mount the view after class is loaded.
   */
  doMountView(
    ViewClass: typeof View,
    params: Record<string, unknown>,
    node: HTMLElement,
    sign: number,
  ): void {
    if (sign !== this.signature) return; // Frame may have been unmounted

    // Prepare the View class (scan event methods)
    const mixinCtors = View.prepare(ViewClass);

    // Create View instance (via extend's constructor which takes nodeId, ownerFrame, params, node, mixinCtors)
    type ViewConstructor = new (
      nodeId: string,
      ownerFrame: FrameInterface,
      initParams?: Record<string, unknown>,
      node?: Element,
      mixinCtors?: AnyFunc[],
    ) => ViewInterface;
    const Ctor = ViewClass as unknown as ViewConstructor;
    const view = new Ctor(this.id, this, params, node, mixinCtors);

    // Store view reference
    this.viewInstance = view;

    // Activate view: signature must be > 0 for render ($renderWrap) to execute.
    view.signature = 1;

    // Delegate events
    View.delegateEvents(view);

    // Call init
    const initResult = funcWithTry(
      view.init,
      [params, { node, deep: !view.template }],
      view,
      noop,
    ) as Promise<unknown> | undefined;

    // Handle init returning a promise (async init)
    const nextSign = ++this.signature;
    Promise.resolve(initResult).then(() => {
      if (nextSign !== this.signature) return; // Frame was unmounted during init

      // If view has template, call render (wrapped via View.wrapMethod)
      if (view.template) {
        view.render();
      } else {
        // No template: don't modify DOM, don't restore on unmount
        this.hasAltered = 0;
        if (!view.endUpdatePendingFlag) {
          view.endUpdate();
        }
      }
    });
  }

  /**
   * Unmount current view.
   */
  unmountView(): void {
    const view = this.view;

    // Clear invoke list
    this.invokeList = [];

    if (!view) return;

    // Set global alter if not set
    if (!globalAlter) {
      globalAlter = { id: this.id };
    }

    // Mark as destroying
    this.destroyed = 1;

    // Unmount zone
    this.unmountZone();

    // Notify alter
    notifyAlter(this, globalAlter);

    // Fire destroy event on view
    if (view.signature > 0) {
      view.fire("destroy", undefined, true, true);
    }

    // Clear range events
    EventDelegator.clearRangeEvents(this.id);

    // Clear view reference
    delete this["viewInstance"];

    // Restore original template (using innerHTML directly, no jQuery)
    const node = document.getElementById(this.id);
    if (node && this.originalTemplate) {
      node.innerHTML = this.originalTemplate;
    }

    // Reset global alter
    globalAlter = undefined;

    // Increment signature to cancel async operations
    unmark(view);
  }

  /**
   * Mount a child frame.
   */
  mountFrame(
    frameId: string,
    viewPath: string,
    viewInitParams?: Record<string, unknown>,
  ): FrameInterface {
    // Notify alter
    notifyAlter(this, { id: frameId });

    let childFrame = frameRegistry.get(frameId);

    if (!childFrame) {
      // Add to children map
      if (!this.childrenMap[frameId]) {
        this.childrenCount++;
      }
      this.childrenMap[frameId] = frameId;

      // Reuse from cache or create new
      childFrame = frameCache.pop();
      if (childFrame) {
        reInitFrame(childFrame, frameId, this.id);
      } else {
        childFrame = new Frame(frameId, this.id);
      }
    }

    // Mount view
    childFrame.mountView(viewPath, viewInitParams);

    return childFrame;
  }

  /**
   * Unmount a child frame.
   */
  unmountFrame(id?: string, _inner?: boolean): void {
    const targetId = id ? this.childrenMap[id] : this.id;
    const frame = frameRegistry.get(targetId);
    if (!frame) return;

    const wasCreated = frame.readyCount > 0;
    const pId = frame.parentId;

    // Unmount view
    frame.unmountView();

    // Remove from registry
    removeFrame(targetId, wasCreated);

    // Reset to factory state (cache reuse)
    reInitFrameForCache(frame);

    // Return to cache, capped at MAX_FRAME_POOL to bound memory usage
    // under extreme mount/unmount churn.
    if (frameCache.length < MAX_FRAME_POOL) {
      frameCache.push(frame);
    }

    // Remove from parent's children
    const parent = frameRegistry.get(pId || "");
    if (parent && parent.childrenMap[targetId]) {
      Reflect.deleteProperty(parent.childrenMap, targetId);
      parent.childrenCount--;
      notifyCreated(parent);
    }
  }

  /**
   * Mount all views in a zone.
   */
  mountZone(zoneId?: string, _inner?: boolean): void {
    const targetZone = zoneId || this.id;

    // Hold fire created event
    this.holdFireCreated = 1;

    // Find all v-lark elements in zone (native DOM, no jQuery)
    const rootEl = document.getElementById(targetZone);
    if (!rootEl) return;

    const viewElements = rootEl.querySelectorAll(`[${LARK_VIEW}]`);
    const frames: [string, string][] = [];

    viewElements.forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      if (htmlElIsBound(el)) return;
      const elId = ensureElementId(el, "frame_");
      el.frameBound = 1;
      const viewPath = getAttribute(el, LARK_VIEW);
      frames.push([elId, viewPath]);
    });

    // Mount each frame
    for (const [frameId, viewPath] of frames) {
      this.mountFrame(frameId, viewPath);
    }

    // Release hold
    this.holdFireCreated = 0;

    // Notify created
    notifyCreated(this);
  }

  /**
   * Unmount all views in a zone.
   */
  unmountZone(zoneId?: string, _inner?: boolean): void {
    for (const childId in this.childrenMap) {
      if (hasOwnProperty(this.childrenMap, childId)) {
        if (!zoneId || childId !== zoneId) {
          this.unmountFrame(childId);
        }
      }
    }
    notifyCreated(this);
  }

  /**
   * Get all child frame IDs.
   */
  children(): string[] {
    const result: string[] = [];
    for (const id in this.childrenMap) {
      if (hasOwnProperty(this.childrenMap, id)) {
        result.push(id);
      }
    }
    return result;
  }

  /**
   * Get parent frame at given level.
   * @param level - How many levels up (default 1)
   */
  parent(level = 1): Frame | undefined {
    let frame: Frame | undefined = undefined;
    let currentPid: string | undefined = this.parentId;
    let n = level >>> 0 || 1;
    while (currentPid && n--) {
      frame = frameRegistry.get(currentPid);
      currentPid = frame?.parentId;
    }
    return frame;
  }

  /**
   * Invoke a method on the view.
   */
  invoke(name: string, args?: unknown[]): unknown {
    let result;
    const view = this.view;

    if (view && view.rendered) {
      // View is rendered, invoke directly
      const lookup = view as unknown as Record<string, unknown>;
      const fn = lookup[name];
      if (typeof fn === "function") {
        result = funcWithTry(fn as AnyFunc, args || [], view, noop);
      }
    } else {
      // View not rendered, add to invoke list
      const key = SPLITTER + name;
      let existingEntry: FrameInvokeEntry | undefined;

      for (const entry of this.invokeList) {
        if (entry.key === key) {
          existingEntry = entry;
          break;
        }
      }

      if (existingEntry) {
        existingEntry.removed = args === existingEntry.args;
      }

      const newEntry: FrameInvokeEntry = {
        name,
        args: args || [],
        key,
      };
      this.invokeList.push(newEntry);
    }

    return result;
  }

  /**
   * Type-safe variant of `invoke`.
   *
   * `invoke()` accepts any string and any args, which silently hides
   * mismatched call sites when a method gets renamed. `invokeTyped` carries
   * the view's method signature through TypeScript so the compiler catches
   * those mistakes:
   *
   * ```ts
   * type Home = View & { loadData(id: string): Promise<void> };
   * frame.invokeTyped<Home, "loadData">("loadData", ["user-1"]);
   * ```
   *
   * Behavior is identical to `invoke` at runtime — same defer / direct-call
   * paths — so it's a drop-in safer overload.
   */
  invokeTyped<V extends Record<string, unknown>, K extends keyof V & string>(
    name: K,
    args: V[K] extends (...a: infer A) => unknown ? A : never[],
  ): V[K] extends (...a: never[]) => infer R ? R | undefined : unknown {
    return this.invoke(name, args as unknown[]) as V[K] extends (
      ...a: never[]
    ) => infer R
      ? R | undefined
      : unknown;
  }

  // ============================================================
  // Static methods
  // ============================================================

  /** Get frame by ID */
  static get(id: string): Frame | undefined {
    return frameRegistry.get(id);
  }

  /** Get all frames */
  static getAll(): Map<string, Frame> {
    return frameRegistry;
  }

  /**
   * Returns the existing root frame, or `undefined` if none has been created.
   * Pure getter — never creates a Frame, never touches the DOM.
   *
   * Use `Frame.createRoot(id)` to create the root explicitly during framework
   * boot. For Micro-Frontend hosts that own multiple independent containers,
   * use `new Frame(containerId)` directly so each MF mount has its own root.
   */
  static getRoot(): Frame | undefined {
    return rootFrame;
  }

  /**
   * Create (or return) the singleton root frame for this app.
   *
   * Idempotent: subsequent calls always return the original root regardless
   * of `rootId` — so passing a different id later is silently ignored.
   * `Framework.boot()` is the canonical caller; user code rarely needs this.
   */
  static createRoot(rootId?: string): Frame {
    if (!rootFrame) {
      rootId = rootId || "root";

      let rootElement = document.getElementById(rootId);
      if (!rootElement) {
        rootElement = document.body;
        rootElement.id = rootId;
      }

      rootFrame = new Frame(rootId);
    }
    return rootFrame;
  }

  /** Bind event listener (static) */
  static on(event: string, handler: AnyFunc): typeof Frame {
    staticEmitter.on(event, handler);
    return Frame;
  }

  /** Unbind event listener (static) */
  static off(event: string, handler?: AnyFunc): typeof Frame {
    staticEmitter.off(event, handler);
    return Frame;
  }

  /** Fire event (static) */
  static fire(event: string, data?: Record<string, unknown>): void {
    staticEmitter.fire(event, data);
  }
}

// ============================================================
// Internal helper functions
// ============================================================

/** Whether the element already has a Frame attached. */
function htmlElIsBound(element: HTMLElement): boolean {
  return !!element.frameBound;
}

/** Remove frame from registry */
function removeFrame(id: string, wasCreated: boolean): void {
  const frameInstance = frameRegistry.get(id);
  if (!frameInstance) return;

  frameRegistry.delete(id);

  // Fire remove event
  Frame.fire("remove", { frame: frameInstance, fcc: wasCreated });

  // Clear DOM reference
  const element = document.getElementById(id);
  if (element) {
    element.frameBound = 0;
    Reflect.deleteProperty(element, "frame");
  }
}

/** Notify created event up the frame tree */
function notifyCreated(frameInstance: Frame): void {
  if (
    !frameInstance["childrenCreated"] &&
    !frameInstance["holdFireCreated"] &&
    frameInstance["childrenCount"] === frameInstance["readyCount"]
  ) {
    if (!frameInstance["childrenCreated"]) {
      frameInstance["childrenCreated"] = 1;
      frameInstance["childrenAlter"] = 0;
      frameInstance.fire("created");
    }

    const pId = frameInstance.parentId;
    if (pId) {
      const parent = frameRegistry.get(pId);
      if (parent && !parent.readyMap.has(frameInstance.id)) {
        parent.readyMap.add(frameInstance.id);
        parent.readyCount++;
        notifyCreated(parent);
      }
    }
  }
}

/** Notify alter event up the frame tree */
function notifyAlter(frameInstance: Frame, data: { id: string }): void {
  if (!frameInstance["childrenAlter"] && frameInstance["childrenCreated"]) {
    frameInstance["childrenCreated"] = 0;
    frameInstance["childrenAlter"] = 1;
    frameInstance.fire("alter", data);

    const pId = frameInstance.parentId;
    if (pId) {
      const parent = frameRegistry.get(pId);
      if (parent && parent.readyMap.has(frameInstance.id)) {
        parent.readyCount--;
        parent.readyMap.delete(frameInstance.id);
        notifyAlter(parent, data);
      }
    }
  }
}

/** Reinitialize a cached frame for reuse */
function reInitFrame(frame: Frame, id: string, parentId: string): void {
  Reflect.set(frame, "id", id);
  frame["_parentId"] = parentId;
  frame["childrenMap"] = {};
  frame["childrenCount"] = 0;
  frame["readyCount"] = 0;
  frame["signature"] = 1;
  frame["readyMap"] = new Set();
  frame["invokeList"] = [];

  frameRegistry.set(id, frame);
}

/** Reset frame for cache reuse */
function reInitFrameForCache(frame: Frame): void {
  Reflect.set(frame, "id", "");
  frame["_parentId"] = undefined;
  frame["childrenMap"] = {};
  frame["readyMap"] = new Set();
}

// ============================================================
// TranslateQuery: translate SPLITTER-prefixed params from parent
// ============================================================

/**
 * Translate query params that contain SPLITTER references.
 * If viewPath contains SPLITTER, translate params using parent view's refData.
 */
function translateQuery(
  pId: string,
  src: string,
  params: Record<string, string>,
): void {
  const parentFrame = frameRegistry.get(pId);
  const parentView = parentFrame?.view;
  if (!parentView) return;

  const parentRefData = parentView.updater.refData;
  if (!parentRefData) return;

  // If viewPath contains SPLITTER, translate params
  if (src.indexOf(SPLITTER) > 0) {
    translateData(parentRefData, params);
    const paramsRec = params as Record<string, unknown>;
    const splitterValue = paramsRec[SPLITTER];
    if (splitterValue && typeof splitterValue === "object") {
      assign(params, splitterValue as Record<string, string>);
      Reflect.deleteProperty(params, SPLITTER);
    }
  }
}

// ============================================================
// View class registration
// ============================================================
//
// `registerViewClass`, `invalidateViewClass`, `getViewClassRegistry` live in
// `./view-registry.ts`. They are re-exported here so existing import sites
// (`import { registerViewClass } from './frame'`) keep working.

export {
  registerViewClass,
  invalidateViewClass,
  getViewClassRegistry,
} from "./view-registry";
