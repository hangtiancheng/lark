/**
 * Framework: main entry point for booting the application.
 *
 * Features:
 * - boot() with config
 * - Router + State change notification to views
 * - Module loading (require/use)
 * - Global utility proxies: toMap, toTry, toUrl, parseUrl, mix, has, keys, inside, node, guid, guard
 * - dispatch, task, delay, Base
 * - waitZoneViewsRendered
 * - beforeunload support
 */
import { CALL_BREAK_TIME, RouterEvents } from "./common";
import {
  assign,
  hasOwnProperty,
  funcWithTry,
  noop,
  parseUri,
  toUri,
  toMap,
  generateId,
  now,
  getById,
  nodeInside,
  keys,
} from "./utils";
import { mark, unmark } from "./mark";
import { safeguard } from "./safeguard";
import { applyStyle } from "./apply-style";
import { Cache } from "./cache";
import { EventEmitter } from "./event-emitter";
import { Router, markRouterBooted } from "./router";
import { State, markBooted as markStateBooted } from "./state";
import {
  Frame,
  registerViewClass,
  invalidateViewClass,
  getViewClassRegistry,
} from "./frame";
import { EventDelegator } from "./event-delegator";
import { View } from "./view";
import { installFrameVisualizerBridge } from "./frame-visual";
import type {
  AnyFunc,
  FrameworkConfig,
  FrameInterface,
  ViewInterface,
  ChangeEvent,
  RouteChangedEvent,
  FrameworkInterface,
} from "./types";

// ============================================================
// Internal state
// ============================================================

// config and use are imported from module-loader.ts to avoid circular dependency with frame.ts
import { config, use } from "./module-loader";

/** Whether framework has booted */
let booted = false;

// ============================================================
// Task: modern chunked function execution
//
// Scheduling priority (best available):
// 1. scheduler.postTask('background') — Chrome 94+
// 2. requestIdleCallback — Chrome 47+, Firefox
// 3. setTimeout(0) — universal fallback
//
// Time-slicing strategy:
// - When requestIdleCallback is available, uses deadline.timeRemaining()
//   for adaptive chunk sizing (browser decides time budget per frame)
// - Falls back to fixed 48ms slices (CALL_BREAK_TIME) otherwise
// - Tasks are queued in a flat array [fn, ctx, args, ...] and
//   consumed in batches to minimize scheduling overhead
// ============================================================

/** Flat task queue: [fn, context, args, fn, context, args, ...] */
const taskList: unknown[] = [];
/** Current read position in taskList */
let taskIndex = 0;
/** Whether a chunk execution is already scheduled */
let taskScheduled = false;

/**
 * Execute a chunk of queued tasks, yielding when time budget runs out.
 * When called from requestIdleCallback, uses deadline for adaptive slicing.
 * When called from setTimeout/scheduler.postTask, uses fixed 48ms budget.
 */
function executeTaskChunk(deadline?: IdleDeadline): void {
  const hasDeadline = !!deadline;
  const startTime = now();

  while (true) {
    const fn = taskList[taskIndex] as AnyFunc | undefined;
    if (!fn) {
      // All tasks consumed — reset queue
      taskList.length = 0;
      taskIndex = 0;
      taskScheduled = false;
      return;
    }

    // Check time budget before executing next task
    if (hasDeadline && deadline) {
      // Adaptive: use browser-provided deadline
      if (deadline.timeRemaining() <= 0) {
        scheduleTaskChunk();
        return;
      }
    } else if (
      now() - startTime > CALL_BREAK_TIME &&
      taskList.length > taskIndex + 3
    ) {
      // Fixed: 48ms budget, and there are more tasks remaining
      scheduleTaskChunk();
      return;
    }

    // Execute one task
    const context = taskList[taskIndex + 1];
    const args = taskList[taskIndex + 2] as unknown[];
    funcWithTry(fn, args, context, noop);
    taskIndex += 3;
  }
}

/**
 * Schedule the next chunk using the best available browser API.
 * Priority: scheduler.postTask > requestIdleCallback > setTimeout
 */
function scheduleTaskChunk(): void {
  const scheduler = window.scheduler;
  if (scheduler && typeof scheduler.postTask === "function") {
    scheduler.postTask(() => executeTaskChunk(), { priority: "background" });
  } else if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(executeTaskChunk);
  } else {
    setTimeout(executeTaskChunk, 0);
  }
}

/**
 * Queue a function for deferred, chunked execution.
 *
 * @param fn - Function to execute (wrapped in try-catch automatically)
 * @param args - Arguments array to pass to the function
 * @param context - `this` context for the function call
 */
function task(fn: AnyFunc, args?: unknown[], context?: unknown): void {
  taskList.push(fn, context, args || []);
  if (!taskScheduled) {
    taskScheduled = true;
    scheduleTaskChunk();
  }
}

// ============================================================
// Dispatcher: notify views of changes
// ============================================================

/** Update tag */
let dispatcherUpdateTag = 0;

/** Narrow an unknown value to a then-able. */
function isThenable(value: unknown): value is PromiseLike<void> {
  return (
    !!value &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

// ============================================================
// View_IsObserveChanged / State_IsObserveChanged
// ============================================================

/**
 * Check if a view's observed location keys have changed.
 */
function viewIsObserveChanged(view: ViewInterface): boolean {
  const loc = view.locationObserved;
  let result = false;

  if (loc.flag) {
    if (loc.observePath) {
      const lastChanged = Router.diff();
      result = !!lastChanged?.path;
    }
    if (!result && loc.keys.length) {
      const lastChanged = Router.diff();
      const changedParams = lastChanged?.params;
      if (changedParams) {
        for (const key of loc.keys) {
          result = hasOwnProperty(changedParams, key);
          if (result) break;
        }
      }
    }
  }
  return result;
}

/**
 * Check if a view's observed state keys have changed.
 */
function stateIsObserveChanged(
  view: ViewInterface,
  stateKeys: ReadonlySet<string>,
): boolean {
  const observedKeys = view.observedStateKeys;
  if (!observedKeys) return false;
  for (const key of observedKeys) {
    if (stateKeys.has(key)) return true;
  }
  return false;
}

/**
 * Notify a frame's view of location/state changes.
 *
 * Key features:
 * - $a tag
 * - View_IsObserveChanged for location changes
 * - State_IsObserveChanged for state changes
 * - Async render Promise support
 */
/** A frame may carry a per-cycle visit tag set by the dispatcher. */
interface FrameWithDispatcherTag extends FrameInterface {
  dispatcherUpdateTag?: number;
}

/**
 * Walk the Frame tree iteratively, rendering any view whose observed keys
 * have changed. Uses an explicit LIFO stack so deeply nested Frame trees
 * cannot blow the JS call stack (V8 does no tail-call optimization here).
 *
 * Async branch: if `render()` returns a thenable, the subtree under that
 * frame is processed after the promise resolves; sibling subtrees keep
 * draining the stack synchronously meanwhile.
 */
function dispatcherUpdate(
  frame: FrameInterface,
  stateKeys?: ReadonlySet<string>,
): void {
  const stack: FrameInterface[] = [frame];

  const drain = (s: FrameInterface[]): void => {
    while (s.length > 0) {
      const current = s.pop() as FrameInterface;
      const tagged = current as FrameWithDispatcherTag;
      const view = current.view;

      if (
        !view ||
        tagged.dispatcherUpdateTag === dispatcherUpdateTag ||
        view.signature <= 1
      ) {
        continue;
      }
      tagged.dispatcherUpdateTag = dispatcherUpdateTag;

      const isChanged = stateKeys
        ? stateIsObserveChanged(view, stateKeys)
        : viewIsObserveChanged(view);

      let renderPromise: PromiseLike<void> | undefined;
      if (isChanged) {
        const renderResult = funcWithTry(
          view.renderMethod ?? view.render,
          [],
          view,
          noop,
        );
        if (isThenable(renderResult)) {
          renderPromise = renderResult;
        }
      }

      const children = current.children();
      if (renderPromise) {
        // Defer this subtree until render settles; keep draining siblings now.
        renderPromise.then(() => {
          const subStack: FrameInterface[] = [];
          for (let i = children.length - 1; i >= 0; i--) {
            const child = Frame.get(children[i]);
            if (child) subStack.push(child);
          }
          drain(subStack);
        });
      } else {
        // Push children in reverse so pop() visits them in original order.
        for (let i = children.length - 1; i >= 0; i--) {
          const child = Frame.get(children[i]);
          if (child) s.push(child);
        }
      }
    }
  };

  drain(stack);
}

/**
 * Notify views when router or state changes.
 */
function dispatcherNotifyChange(e: ChangeEvent): void {
  // The dispatcher only runs after boot, so the root frame is guaranteed
  // to exist. If a caller somehow fires a change event before boot, we
  // silently no-op rather than auto-creating a root.
  const rootFrame = Frame.getRoot();
  if (!rootFrame) return;

  const routeEvent = e as RouteChangedEvent;
  const view = routeEvent.view;
  if (view) {
    // View changed, mount new view
    const viewPath =
      typeof view === "object" && view !== null
        ? String(view.to || "")
        : String(view);
    rootFrame.mountView(viewPath);
  } else {
    // Parameter/state change, notify views
    dispatcherUpdateTag++;
    dispatcherUpdate(rootFrame, e.keys);
  }
}

// ============================================================
// DispatchEvent: fire a custom DOM event on an element
// ============================================================

/**
 * Fire a custom DOM event on a target element.
 */
function dispatchEvent(
  target: EventTarget,
  eventType: string,
  eventInit?: CustomEventInit,
): void {
  const event = new CustomEvent(eventType, {
    bubbles: true,
    cancelable: true,
    ...eventInit,
  });
  target.dispatchEvent(event);
}

// use is re-exported from module-loader.ts (see top of file)

// ============================================================
// waitZoneViewsRendered
// ============================================================

/** Wait result: OK = rendered, TIMEOUT_OR_NOT_FOUND = not rendered */
export const WAIT_OK = 1;
export const WAIT_TIMEOUT_OR_NOT_FOUND = 0;

/**
 * Wait for all views in a zone to be rendered.
 */
function waitZoneViewsRendered(
  viewId: string,
  timeout?: number,
): Promise<number> {
  if (timeout == null) {
    timeout = 30 * 1000;
  }
  const checkFrame = Frame.get(viewId);
  const endTime = now() + timeout;
  return new Promise((resolve) => {
    const check = (): void => {
      const currentTime = now();
      if (currentTime > endTime || !checkFrame) {
        resolve(WAIT_TIMEOUT_OR_NOT_FOUND);
      } else if (checkFrame.childrenCount === checkFrame.readyCount) {
        resolve(WAIT_OK);
      } else {
        setTimeout(check, 9);
      }
    };
    setTimeout(check, 9);
  });
}

// ============================================================
// Framework object
// ============================================================

/**
 * Public `Framework.getConfig` overload set (see `FrameworkInterface.getConfig`).
 * Declared as a free function with explicit overloads so it can satisfy the
 * interface's two-overload shape from inside an object literal.
 */
function getConfigImpl(): FrameworkConfig;
function getConfigImpl<T = unknown>(key: string): T | undefined;
function getConfigImpl<T = unknown>(
  key?: string,
): FrameworkConfig | T | undefined {
  if (key === undefined) return config;
  return config[key] as T | undefined;
}

/**
 * Main framework object.
 * Provides boot, config, and all global utility methods.
 */
export const Framework: FrameworkInterface = {
  // ============================================================
  // Lifecycle
  // ============================================================

  /** Read framework configuration. See `FrameworkInterface.getConfig`. */
  getConfig: getConfigImpl,

  /**
   * Merge a patch into framework configuration. See `FrameworkInterface.setConfig`.
   */
  setConfig<T extends object = Partial<FrameworkConfig>>(
    patch: Partial<FrameworkConfig> & T,
  ): FrameworkConfig & T {
    if (patch && typeof patch === "object") {
      assign(config, patch);
    }
    return config as FrameworkConfig & T;
  },

  /**
   * @deprecated Use `getConfig()` / `setConfig()`. Behavior unchanged.
   */
  config(cfg?: FrameworkConfig | string): FrameworkConfig | unknown {
    if (!cfg) {
      return config;
    }

    if (typeof cfg === "string") {
      return config[cfg];
    }

    assign(config, cfg);
    return config;
  },

  /**
   * Boot the framework.
   */
  boot(cfg?: FrameworkConfig): void {
    // Merge configuration
    if (cfg && typeof cfg === "object") {
      assign(config, cfg);
    }

    // Set config in Router
    Router._setConfig(config);

    // Set frame getter in EventDelegator
    EventDelegator.setFrameGetter((id: string) => Frame.get(id));

    // Bind router events
    Router.on(RouterEvents.CHANGED, (data?: ChangeEvent) => {
      if (data) dispatcherNotifyChange(data);
    });

    // Bind state events
    State.on(RouterEvents.CHANGED, (data?: ChangeEvent) => {
      if (data) dispatcherNotifyChange(data);
    });

    // Mark as booted
    booted = true;
    markStateBooted();
    markRouterBooted();

    // Install the Frame Visualizer Bridge for devtools support.
    // This adds a lightweight postMessage listener so that the
    // lark-visualizer devtools panel can inspect the frame tree.
    installFrameVisualizerBridge();

    // Create root frame BEFORE Router._bind(), so that when Router.diff()
    // fires CHANGED → dispatcherNotifyChange → Frame.getRoot(), the rootFrame
    // already exists with the correct rootId (e.g. "app").
    // Without this, Frame.createRoot() would default to "root" and the view
    // would render into document.body instead of the intended container.
    const rootFrame = Frame.createRoot(config.rootId);

    // Bind hashchange event
    Router._bind();

    // Mount root view: only if the router didn't already mount one
    // (e.g., after a page reload with #!/counter, Router.diff() inside
    // _bind() fires CHANGED → mountView("counter"). Without this guard,
    // the default view would override the router-determined view, leaving
    // the URL and displayed view out of sync.)
    const defaultView = config.defaultView || "";
    if (defaultView && !rootFrame.view) {
      rootFrame.mountView(defaultView);
    }
  },

  /** Whether framework has booted */
  isBooted(): boolean {
    return booted;
  },

  // ============================================================
  // Utility proxies
  // ============================================================

  /** Mark async callback validity tracker */
  mark,

  /** Unmark (invalidate) async callbacks */
  unmark,

  /** Fire a custom DOM event on a target */
  dispatch: dispatchEvent,

  /** Execute function in try-catch, ignoring errors */
  task,

  /** Promise-based setTimeout */
  delay(time: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, time));
  },

  /** Load modules via configured require */
  use,

  /** Wait for zone views to be rendered */
  waitZoneViewsRendered,

  WAIT_OK,
  WAIT_TIMEOUT_OR_NOT_FOUND,

  /**
   * Convert array to hash map.
   */
  toMap,

  /**
   * Execute function in try-catch.
   */
  toTry: funcWithTry,

  /**
   * Convert path + params to URL string.
   */
  toUrl: toUri,

  /**
   * Parse URI string into path and params.
   */
  parseUrl: parseUri,

  /**
   * Mix properties from source to target.
   */
  mix: assign,

  /**
   * Check if object has own property.
   */
  has: hasOwnProperty,

  /**
   * Get object keys.
   */
  keys,

  /**
   * Check if node A is inside node B.
   */
  inside: nodeInside,

  /**
   * Get element by ID (shorthand for document.getElementById).
   */
  node: getById,

  /**
   * Apply CSS style.
   */
  applyStyle,

  /**
   * Generate globally unique ID.
   */
  guid: generateId,

  /**
   * Proxy-based debug guard.
   */
  guard: safeguard,

  /**
   * Cache class.
   */
  Cache,

  /**
   * Ensure element has an ID.
   */
  nodeId(element: HTMLElement): string {
    if (!element.id) {
      element.id = generateId("l_");
    }
    return element.id;
  },

  /**
   * Base class with EventEmitter.
   */
  Base: EventEmitter,

  // ============================================================
  // Module access
  // ============================================================

  /** Router module */
  Router,

  /** State module */
  State,

  /** View class */
  View,

  /** Frame class */
  Frame,
};

// Attach to window for global access
if (typeof window !== "undefined") {
  window.__lark_Framework = Framework;
  window.__lark_State = State;
  window.__lark_Router = Router;
  window.__lark_Frame = Frame;
  window.__lark_View = View;
  window.__lark_invalidateViewClass = invalidateViewClass;
  window.__lark_getViewClassRegistry = getViewClassRegistry;
  window.__lark_registerViewClass = registerViewClass;
}
