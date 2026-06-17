/**
 * View class with extend/merge inheritance and event method parsing.
 *
 * - View.prepare: scans prototype for `name<click>` methods, builds event maps
 * - View.wrapMethod: wraps render() to manage signature and resource cleanup
 * - View.delegateEvents: binds/unbinds event delegation on mount/destroy
 * - View.mergeMixins: merges mixin objects with event method conflict resolution
 * - beginUpdate/endUpdate: manage DOM update zones and child frame mounting
 * - Resource management (capture/release)
 * - Location/State observation
 */
import { SPLITTER, VIEW_EVENT_METHOD_REGEXP, RouterEvents } from "./common";
import { hasOwnProperty, funcWithTry, noop } from "./utils";
import { EventEmitter } from "./event-emitter";
import { EventDelegator } from "./event-delegator";
import { Updater } from "./updater";
import { Router } from "./router";
import type {
  AnyFunc,
  ViewInterface,
  ViewTemplate,
  FrameInterface,
  UpdaterInterface,
  ViewLocationObserved,
  ViewGlobalEventEntry,
  MixinEventHandler,
  ViewEventSelectorEntry,
  ViewResourceEntry,
} from "./types";

// ============================================================
// View globals map: maps 'window'/'document' to window/document
// ============================================================

const VIEW_GLOBALS: Record<string, EventTarget> = {};
if (typeof window !== "undefined") {
  VIEW_GLOBALS["window"] = window;
}
if (typeof document !== "undefined") {
  VIEW_GLOBALS["document"] = document;
}

// ============================================================
// View class
// ============================================================

/**
 * Base View class.
 * Views are created via View.extend() and mounted by Frame.
 */
export class View implements ViewInterface {
  /** View ID (same as owner frame ID) */
  id = "";

  /** Owner frame */
  owner: FrameInterface | number = 0;

  /** Updater instance */
  updater!: UpdaterInterface;

  /** Signature: > 0 means active, incremented on render, 0 = destroyed */
  signature = 0;

  /** Whether rendered at least once */
  rendered?: boolean;

  /** Whether view has template */
  template?: ViewTemplate;

  /** Location observation config */
  locationObserved: ViewLocationObserved = {
    flag: 0,
    keys: [],
    observePath: false,
  };

  /** Observed state keys */
  observedStateKeys?: string[];

  /** Resource map */
  resources: Record<string, ViewResourceEntry> = {};

  /** Assign method reference */
  assignMethod?: AnyFunc;

  /** Whether endUpdate pending */
  endUpdatePending?: number;

  /** Internal event storage */
  private _events = new EventEmitter();

  // ============================================================
  // Getters for prototype-stored event maps
  // ============================================================

  /** Prototype-stored event maps shape (set by View.prepare). */
  private get protoEventState(): {
    $evtObjMap?: Record<string, number>;
    $selMap?: Record<string, ViewEventSelectorEntry>;
    $globalEvtList?: ViewGlobalEventEntry[];
  } {
    return Object.getPrototypeOf(this) as {
      $evtObjMap?: Record<string, number>;
      $selMap?: Record<string, ViewEventSelectorEntry>;
      $globalEvtList?: ViewGlobalEventEntry[];
    };
  }

  /**
   * Event bitmask map: eventType -> bitmask (1=root, 2=selector).
   * Read from prototype ($evtObjMap) set by View.prepare.
   * Using a getter avoids ES6 class field shadowing the prototype value.
   */
  get eventObjectMap(): Record<string, number> {
    return this.protoEventState.$evtObjMap ?? {};
  }

  /**
   * Selector event map: eventType -> selector list.
   * Read from prototype ($selMap) set by View.prepare.
   */
  get eventSelectorMap(): Record<string, ViewEventSelectorEntry> {
    return this.protoEventState.$selMap ?? {};
  }

  /**
   * Global event list: [{handler, element, eventName, modifiers}].
   * Read from prototype ($globalEvtList) set by View.prepare.
   */
  get globalEventList(): ViewGlobalEventEntry[] {
    return this.protoEventState.$globalEvtList ?? [];
  }

  // ============================================================
  // Instance lifecycle methods
  // ============================================================

  /**
   * Initialize view (called by Frame when mounting).
   */
  init(): void {
    // Override in subclass
  }

  /**
   * Render view template (called by Frame after init).
   * Wrapped by View.wrapMethod to manage signature + resources.
   */
  render(): void {
    this.updater.digest();
  }

  // ============================================================
  // Event methods (delegate to internal EventEmitter)
  // ============================================================

  on(event: string, handler: AnyFunc): this {
    this._events.on(event, handler);
    return this;
  }

  off(event: string, handler?: AnyFunc): this {
    this._events.off(event, handler);
    return this;
  }

  fire(
    event: string,
    data?: Record<string, unknown>,
    remove?: boolean,
    lastToFirst?: boolean,
  ): this {
    this._events.fire(event, data, remove, lastToFirst);
    return this;
  }

  // ============================================================
  // Update methods
  // ============================================================

  /** Get the owning frame, asserting it has been bound. */
  private get ownerFrame(): FrameInterface {
    return this.owner as FrameInterface;
  }

  /**
   * Notify view that HTML update is about to begin.
   * Unmounts child frames in the update zone.
   */
  beginUpdate(id?: string): void {
    if (this.signature > 0 && this.endUpdatePending !== undefined) {
      this.ownerFrame.unmountZone(id, true);
    }
  }

  /**
   * Notify view that HTML update has ended.
   * Mounts child frames in the update zone and runs deferred invokes.
   */
  endUpdate(id?: string, inner?: boolean): void {
    if (this.signature > 0) {
      const updateId = id || this.id;
      let flag: number | boolean | undefined;

      if (inner) {
        flag = inner;
      } else {
        flag = this.endUpdatePending;
        this.endUpdatePending = 1;
        this.rendered = true;
      }

      const ownerFrame = this.ownerFrame;
      ownerFrame.mountZone(updateId, inner);

      if (!flag) {
        setTimeout(
          this.wrapAsync(() => {
            View.runInvokes(ownerFrame);
          }),
          0,
        );
      }
    }
  }

  // ============================================================
  // Async wrapper
  // ============================================================

  /**
   * Wrap an async callback to check view signature before executing.
   * If the view has been re-rendered or destroyed, the callback is skipped.
   */
  wrapAsync<Fn extends AnyFunc>(
    fn: Fn,
    context?: unknown,
  ): (...args: Parameters<Fn>) => ReturnType<Fn> | undefined {
    const currentSignature = this.signature;
    return (...args: Parameters<Fn>) => {
      if (currentSignature > 0 && currentSignature === this.signature) {
        return fn.apply(context || this, args) as ReturnType<Fn>;
      }
      return undefined;
    };
  }

  // ============================================================
  // Location observation
  // ============================================================

  /**
   * Observe location parameters or path changes.
   * When observed keys change, render() is called automatically.
   */
  observeLocation(
    params: string | string[] | Record<string, unknown>,
    observePath = false,
  ): void {
    const loc = this.locationObserved;
    loc.flag = 1;

    if (typeof params === "object" && !Array.isArray(params)) {
      const opts = params;
      if (opts["path"]) {
        observePath = true;
      }
      const paramKeys = opts["params"];
      if (typeof paramKeys === "string" || Array.isArray(paramKeys)) {
        params = paramKeys;
      }
    }

    loc.observePath = observePath;

    if (params) {
      if (typeof params === "string") {
        loc.keys = params.split(",");
      } else if (Array.isArray(params)) {
        loc.keys = params;
      }
    }
  }

  // ============================================================
  // State observation
  // ============================================================

  /**
   * Observe State data keys for changes.
   * When observed keys change via State.digest(), render() is called.
   */
  observeState(observedKeys: string | string[]): void {
    if (typeof observedKeys === "string") {
      this.observedStateKeys = observedKeys.split(",");
    } else {
      this.observedStateKeys = observedKeys;
    }
  }

  // ============================================================
  // Resource management
  // ============================================================

  /**
   * Capture (register) a resource under a key.
   * If a resource already exists at that key, it's destroyed first.
   * When destroyOnRender=true, the resource is destroyed on next render call.
   */
  capture(key: string, resource?: unknown, destroyOnRender = false): unknown {
    const cache = this.resources;
    if (resource) {
      View.destroyResource(cache, key, true, resource);
      cache[key] = {
        entity: resource,
        destroyOnRender,
      };
    } else {
      const entry = cache[key];
      return entry ? entry.entity : undefined;
    }
    return resource;
  }

  /**
   * Release a captured resource.
   * If destroy=true, calls the resource's destroy() method.
   */
  release(key: string, destroy = true): unknown {
    return View.destroyResource(this.resources, key, destroy);
  }

  // ============================================================
  // Leave tip
  // ============================================================

  /**
   * Set up a leave confirmation for route changes and page unload.
   */
  leaveTip(message: string, condition: () => boolean): void {
    interface LeaveEvent {
      type?: string;
      prevent?: () => void;
      reject?: () => void;
      resolve?: () => void;
    }
    interface LeaveListener {
      a?: number;
      b?: number;
      (e: LeaveEvent): void;
    }

    const changeListener: LeaveListener = function (e: LeaveEvent): void {
      const isRouterChange = e.type === RouterEvents.CHANGE;
      const aKey: "a" | "b" = isRouterChange ? "a" : "b";
      const bKey: "a" | "b" = isRouterChange ? "b" : "a";

      if (changeListener[aKey]) {
        e.prevent?.();
        e.reject?.();
      } else if (condition()) {
        e.prevent?.();
        changeListener[bKey] = 1;
        e.resolve?.();
      }
    };

    const unloadListener = (e: Record<string, unknown>): void => {
      if (condition()) {
        e["msg"] = message;
      }
    };

    Router.on(RouterEvents.CHANGE, changeListener as AnyFunc);
    Router.on(RouterEvents.PAGE_UNLOAD, unloadListener as AnyFunc);

    this.on("unload", changeListener as AnyFunc);
    this.on("destroy", () => {
      Router.off(RouterEvents.CHANGE, changeListener as AnyFunc);
      Router.off(RouterEvents.PAGE_UNLOAD, unloadListener as AnyFunc);
    });
  }

  // ============================================================
  // Static public methods
  // ============================================================

  /** Collected makes from mixins */
  static makes?: AnyFunc[];

  /**
   * Prepare a View subclass by scanning its prototype for event method patterns.
   * Pattern: `$?name<eventType1,eventType2>(&modifiers)`
   *
   * Only runs once per View subclass (guarded by makes marker).
   * Called from Frame.mountView before creating the view instance.
   */
  static prepare(oView: typeof View): AnyFunc[] {
    if (oView.makes) {
      return oView.makes;
    }

    const makes: AnyFunc[] = [];
    oView.makes = makes;

    const proto = oView.prototype as unknown as Record<string, unknown>;
    const eventsObject: Record<string, number> = {};
    const eventsList: ViewGlobalEventEntry[] = [];
    const selectorObject: Record<string, ViewEventSelectorEntry> = {};

    // Process mixins first
    const mixins = proto["mixins"];
    if (mixins && Array.isArray(mixins)) {
      View.mergeMixins(mixins, oView, makes);
    }

    // Scan prototype for event method patterns
    for (const p in proto) {
      if (!hasOwnProperty(proto, p)) continue;
      const currentFn = proto[p];
      if (typeof currentFn !== "function") continue;

      const matches = p.match(VIEW_EVENT_METHOD_REGEXP);
      if (!matches) continue;

      const isSelector = matches[1];
      const selectorOrCallback = matches[2];
      const events = matches[3];
      const modifiers = matches[4];

      const mod: Record<string, boolean> = {};
      if (modifiers) {
        for (const item of modifiers.split(",")) {
          mod[item] = true;
        }
      }

      const eventTypes = events.split(",");
      for (const item of eventTypes) {
        const globalNode: EventTarget | undefined =
          VIEW_GLOBALS[selectorOrCallback];
        let mask = 1;

        if (isSelector) {
          if (globalNode) {
            eventsList.push({
              handler: currentFn as AnyFunc,
              element: globalNode,
              eventName: item,
              modifiers: mod,
            });
            continue;
          }
          mask = 2;
          let selectorEntry = selectorObject[item];
          if (!selectorEntry) {
            selectorEntry = selectorObject[item] = {
              selectors: [],
            };
          }
          if (!selectorEntry[selectorOrCallback]) {
            selectorEntry[selectorOrCallback] = 1;
            selectorEntry.selectors.push(selectorOrCallback);
          }
        }

        eventsObject[item] = (eventsObject[item] || 0) | mask;

        const combinedKey = selectorOrCallback + SPLITTER + item;
        const existingFn = proto[combinedKey];
        if (!existingFn) {
          proto[combinedKey] = currentFn;
        } else if (typeof existingFn === "function") {
          const mixinFn = currentFn as MixinEventHandler;
          const existingMixin = existingFn as MixinEventHandler;
          if (existingMixin.marker) {
            if (mixinFn.marker) {
              proto[combinedKey] = View.processMixinsSameEvent(
                mixinFn,
                existingMixin,
              );
            } else if (hasOwnProperty(proto, p)) {
              proto[combinedKey] = currentFn;
            }
          }
        }
      }
    }

    // Wrap render method
    View.wrapMethod(proto, "render", "$renderWrap");

    // Store event maps on prototype
    proto["$evtObjMap"] = eventsObject;
    proto["$globalEvtList"] = eventsList;
    proto["$selMap"] = selectorObject;
    proto["$assignFn"] = proto["assign"];

    return makes;
  }

  /**
   * Bind or unbind event delegation for a view instance.
   * Called from Frame during mount/unmount.
   */
  static delegateEvents(view: ViewInterface, destroy = false): void {
    // Read event maps via getters (which read from prototype $evtObjMap/$selMap/$globalEvtList).
    const eventsObject = view.eventObjectMap;
    const selectorObject = view.eventSelectorMap;
    const eventsList = view.globalEventList;

    // Bind/unbind root events
    for (const e in eventsObject) {
      if (hasOwnProperty(eventsObject, e)) {
        if (destroy) {
          EventDelegator.unbind(e, !!selectorObject[e]);
        } else {
          EventDelegator.bind(e, !!selectorObject[e]);
        }
      }
    }

    // Bind/unbind global events (window/document)
    for (const entry of eventsList) {
      if (destroy) {
        entry.element.removeEventListener(
          entry.eventName,
          entry.boundHandler as EventListener,
        );
      } else {
        const handler = entry.handler;
        const element = entry.element;
        const modifiers = entry.modifiers;
        entry.boundHandler = function (domEvent: Event): void {
          const extendedEvent = domEvent as Event & {
            eventTarget?: EventTarget;
          };
          extendedEvent.eventTarget = element;
          if (modifiers) {
            const kbEvent = domEvent as KeyboardEvent;
            if (
              (modifiers["ctrl"] && !kbEvent.ctrlKey) ||
              (modifiers["shift"] && !kbEvent.shiftKey) ||
              (modifiers["alt"] && !kbEvent.altKey) ||
              (modifiers["meta"] && !kbEvent.metaKey)
            ) {
              return;
            }
          }
          funcWithTry(handler, [domEvent], view, noop);
        };
        entry.element.addEventListener(
          entry.eventName,
          entry.boundHandler as EventListener,
        );
      }
    }
  }

  /**
   * Destroy all resources managed by a view.
   * If lastly=true, destroy ALL resources; otherwise only destroyOnRender ones.
   */
  static destroyAllResources(view: ViewInterface, lastly: boolean): void {
    const cache = view.resources;
    for (const p in cache) {
      if (hasOwnProperty(cache, p)) {
        const entry = cache[p];
        if (lastly || entry.destroyOnRender) {
          View.destroyResource(cache, p, true);
        }
      }
    }
  }

  /**
   * Process deferred invoke calls on a frame.
   */
  static runInvokes(frame: FrameInterface): void {
    const list = frame.invokeList;
    if (!list) return;

    while (list.length) {
      const entry = list.shift();
      if (entry && !entry.removed) {
        frame.invoke(entry.name, entry.args);
      }
    }
  }

  // ============================================================
  // Static private methods
  // ============================================================

  /**
   * Wrap a method on the prototype to add signature checking and resource cleanup.
   */
  private static wrapMethod(
    proto: Record<string, unknown>,
    fnName: string,
    shortKey: string,
  ): void {
    const originalFn = proto[fnName];
    if (typeof originalFn !== "function") return;
    const originalAsFn = originalFn as AnyFunc;

    const wrapped: AnyFunc = function (
      this: ViewInterface,
      ...args: unknown[]
    ): unknown {
      if (this.signature > 0) {
        this.signature++;
        this.fire("render");
        View.destroyAllResources(this, false);
        const lookup = this as unknown as Record<string, unknown>;
        const candidate = lookup[fnName];
        const instanceFn =
          typeof candidate === "function"
            ? (candidate as AnyFunc)
            : originalAsFn;
        const fnToCall = instanceFn === wrapped ? originalAsFn : instanceFn;
        return funcWithTry(fnToCall, args, this, noop);
      }
      return undefined;
    };

    proto[fnName] = wrapped;
    proto[shortKey] = wrapped;
  }

  /**
   * When two mixins define the same event method, merge them into
   * a single function that calls both in sequence.
   */
  private static processMixinsSameEvent(
    additional: MixinEventHandler,
    exist: MixinEventHandler,
  ): MixinEventHandler {
    let temp: MixinEventHandler;

    if (exist.handlerList) {
      temp = exist;
    } else {
      const merged: MixinEventHandler = function (
        this: unknown,
        ...e: unknown[]
      ): void {
        funcWithTry(merged.handlerList ?? [], e, this, noop);
      };
      merged.handlerList = [exist];
      merged.marker = 1;
      temp = merged;
    }

    temp.handlerList = (temp.handlerList ?? []).concat(
      additional.handlerList ?? [additional],
    );
    return temp;
  }

  /**
   * Merge an array of mixin objects into the view prototype.
   */
  private static mergeMixins(
    mixins: Record<string, unknown>[],
    viewClass: typeof View,
    makes: AnyFunc[],
  ): void {
    const proto = viewClass.prototype as unknown as Record<string, unknown>;
    const temp: Record<string, MixinEventHandler> = {};

    for (const node of mixins) {
      for (const p in node) {
        if (!hasOwnProperty(node, p)) continue;
        const fn = node[p];
        if (typeof fn !== "function") continue;
        const mixinFn = fn as MixinEventHandler;
        const exist = temp[p];

        if (p === "make") {
          makes.push(mixinFn);
          continue;
        }

        if (VIEW_EVENT_METHOD_REGEXP.test(p)) {
          if (exist) {
            temp[p] = View.processMixinsSameEvent(mixinFn, exist);
          } else {
            mixinFn.marker = 1;
            temp[p] = mixinFn;
          }
        } else if (!exist) {
          temp[p] = mixinFn;
        }
      }
    }

    for (const p in temp) {
      if (!hasOwnProperty(proto, p)) {
        proto[p] = temp[p];
      }
    }
  }

  /**
   * Destroy a single resource entry.
   */
  private static destroyResource(
    cache: Record<string, ViewResourceEntry>,
    key: string,
    callDestroy: boolean,
    oldEntity?: unknown,
  ): unknown {
    const entry = cache[key];
    if (!entry || entry.entity === oldEntity) return undefined;

    const entity = entry.entity;
    if (entity && typeof entity === "object") {
      const destroyFn = (entity as Record<string, unknown>)["destroy"];
      if (typeof destroyFn === "function" && callDestroy) {
        funcWithTry(destroyFn as AnyFunc, [], entity, noop);
      }
    }

    Reflect.deleteProperty(cache, key);
    return entity;
  }

  // ============================================================
  // Static: extend and merge
  // ============================================================

  /**
   * Extend View to create a new View subclass.
   *
   * Supports:
   * - props.make: constructor-like init (called with initParams + {node, deep})
   * - props.mixins: array of mixin objects
   * - Event method patterns: `'name<click>'` etc.
   */
  static extend(
    props?: ThisType<ViewInterface> & Record<string, unknown>,
    statics?: Record<string, unknown>,
  ): typeof View {
    const definedProps: Record<string, unknown> = props ?? {};
    const make = definedProps["make"];
    const makes: AnyFunc[] = [];
    if (typeof make === "function") {
      makes.push(make as AnyFunc);
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias -- Need reference to ParentView in closure for extend()
    const ParentView = this;

    // Use ES6 class extends for proper constructor chaining via super().
    // CRITICAL: extend props (like template) MUST be applied as instance properties
    // in the constructor AFTER super(), because ES6 class field declarations
    // (e.g. `template;` in View) set `this.template = undefined` in the constructor body,
    // which would shadow any prototype property set via `proto.template = ...`.
    type ViewConstructor = new (
      nodeId: string,
      ownerFrame: FrameInterface,
      initParams?: Record<string, unknown>,
      node?: Element,
      mixinCtors?: AnyFunc[],
    ) => View;

    const ChildView = class extends (ParentView as ViewConstructor) {
      constructor(
        nodeId: string,
        ownerFrame: FrameInterface,
        initParams?: Record<string, unknown>,
        node?: Element,
        mixinCtors?: AnyFunc[],
      ) {
        super(nodeId, ownerFrame, initParams, node, []);

        // Apply extend props as INSTANCE properties after super().
        // CRITICAL: Skip "render" — it is wrapped on the prototype by View.wrapMethod.
        // Setting render on the instance would shadow the wrapped version, bypassing
        // signature checking, resource cleanup, and the "render" event.
        const instanceProps = this as unknown as Record<string, unknown>;
        for (const key in definedProps) {
          if (
            hasOwnProperty(definedProps, key) &&
            key !== "make" &&
            key !== "render"
          ) {
            instanceProps[key] = definedProps[key];
          }
        }

        this.id = nodeId;
        this.owner = ownerFrame;
        this.updater = new Updater(nodeId);

        const params: [
          Record<string, unknown> | undefined,
          { node: Element | undefined; deep: boolean },
        ] = [
          initParams,
          {
            node,
            deep: !this.template,
          },
        ];

        const concatCtors = makes.concat(mixinCtors || []);
        if (concatCtors.length) {
          funcWithTry(concatCtors, params, this, noop);
        }
      }
    } as unknown as typeof View;

    // Methods on prototype (for proper method lookup via prototype chain)
    const proto = ChildView.prototype as unknown as Record<string, unknown>;
    for (const key in definedProps) {
      if (hasOwnProperty(definedProps, key) && key !== "make") {
        proto[key] = definedProps[key];
      }
    }

    // Copy statics
    if (statics) {
      const staticTarget = ChildView as unknown as Record<string, unknown>;
      for (const key in statics) {
        if (hasOwnProperty(statics, key)) {
          staticTarget[key] = statics[key];
        }
      }
    }

    // extend and merge are inherited via prototype chain (no manual assignment needed)

    return ChildView;
  }

  /**
   * Merge mixins into View prototype.
   */
  static merge(
    this: typeof View,
    ...mixins: Record<string, unknown>[]
  ): typeof View {
    const existingCtors = this.makes || [];
    View.mergeMixins(mixins, this, existingCtors);
    return this;
  }
}

// ============================================================
// defineView — typed factory wrapping View.extend
// ============================================================

/**
 * Type-safe wrapper around `View.extend()`.
 *
 * `View.extend({...})` accepts any object literal, and inside its methods
 * `this` is typed only as the base `ViewInterface` — so any custom state
 * field or helper method requires a `(this as MyView).foo` strong-cast at
 * every call site.
 *
 * `defineView()` threads the literal's own shape back into `this` via
 * `ThisType<P & ViewInterface>`, so `this.foo` is typed automatically:
 *
 * ```ts
 * const HomeView = defineView({
 *   $title: "Home",
 *   init() {
 *     this.updater.set({ title: this.$title }); // both typed
 *   },
 *   greet() {
 *     return `hello ${this.$title}`;
 *   },
 * });
 * ```
 *
 * Runtime semantics are identical to `View.extend(props, statics)` — this is
 * a zero-cost type-only wrapper.
 */
export function defineView<P extends Record<string, unknown>>(
  props: P & ThisType<P & ViewInterface>,
  statics?: Record<string, unknown>,
): typeof View {
  return View.extend(props as Record<string, unknown>, statics);
}
