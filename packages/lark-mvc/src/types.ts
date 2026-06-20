/**
 * Lark framework type definitions.
 * All shared types are defined here to eliminate type cheats across modules.
 *
 * Lark is a lightweight MVC frontend framework that provides:
 * - View: base view class with extend/merge inheritance and mixin support
 * - Router: hash-based two-phase route confirmation
 * - State: simple cross-view observable singleton (recommended for simple cases)
 * - Store: zustand-aligned state management with create/getState/setState/subscribe
 *   (recommended for complex cases)
 * - Service: API request management with caching, queuing, and deduplication
 * - Frame: view frame managing view mount/unmount lifecycle
 * - Updater: view data binding and DOM diff (in-memory real DOM diff) renderer
 *
 * Designed for single-page application (SPA) development.
 */

// ============================================================
// Function types
// ============================================================

/** Generic function type for event handlers and callbacks.
 *  Uses any[] to accept callbacks with specific parameter types
 *  (TypeScript function parameters are contravariant).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFunc = (...args: any[]) => unknown;

/** A function that returns void. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type VoidFunc = (...args: any[]) => void;

// ============================================================
// Cache types
// ============================================================

export interface CacheEntry<T> {
  /** Original key without prefix */
  originalKey: string;
  /** Cached value */
  value: T | undefined;
  /** Access frequency count */
  frequency: number;
  /** Last access timestamp */
  lastTimestamp: number;
}

export interface CacheOptions<T> {
  /** Maximum cache size before eviction triggers (default: 20) */
  maxSize?: number;
  /** Buffer size for eviction (default: 5) */
  bufferSize?: number;
  /** Callback when entry is removed */
  onRemove?: (key: string) => void;
  /** Comparator for sorting entries */
  sortComparator?: (a: CacheEntry<T>, b: CacheEntry<T>) => number;
}

/**
 * Cache interface providing LFU (Least Frequently Used) cache management.
 * Cache keys use a special prefix internally for namespace isolation.
 */
export interface CacheInterface<T = unknown> {
  /**
   * Set a cache resource. If the key exists, updates the value and increments frequency.
   * Triggers LFU eviction when cache entries exceed capacity (maxSize + bufferSize).
   * @param key Unique identifier for the cached resource
   * @param resource The resource to cache
   */
  set(key: string, resource: T): void;
  /**
   * Get a cached resource. Access increments frequency count and timestamp for LFU ranking.
   * Returns undefined if the key does not exist.
   * @param key Cache resource key
   */
  get(key: string): T | undefined;
  /**
   * Remove a resource from cache by key. Triggers onRemove callback on deletion.
   * @param key Cache resource key to remove
   */
  del(key: string): void;
  /**
   * Check if cache contains a resource for the given key.
   * @param key Cache resource key
   */
  has(key: string): boolean;
  /**
   * Iterate over all cached resource values.
   * @param callback Iteration callback receiving the cached value (may be undefined)
   */
  forEach(callback: (value: T | undefined) => void): void;
  /**
   * Number of cache entries.
   */
  readonly size: number;
  /**
   * Clear all cache entries. Triggers onRemove callback for each deleted entry.
   */
  clear(): void;
}

// ============================================================
// Event types
// ============================================================

export interface EventListenerEntry {
  /** Handler function */
  handler: AnyFunc;
  /** Whether currently executing (1 = executing, '' = done) */
  executing: number | string;
}

// ============================================================
// URI / Location types
// ============================================================

/**
 * Parsed URL result containing path and parameters.
 * Returned by `Router.parse()`, includes the path string and parsed key-value parameter pairs.
 */
export interface ParsedUri {
  /** Path portion (before ? or #), excluding query parameters */
  path: string;
  /** Key-value params parsed from the URL */
  params: Record<string, string>;
}

/**
 * Current URL parsing result interface.
 * Returned by `Router.parse()`, includes both query (after ?) and hash (after #) sections.
 */
export interface Location {
  /** Full href, original href string */
  href: string;
  /** Query string (before #), raw query string (after ?, before #) */
  srcQuery: string;
  /** Hash string (after #), raw hash string (after #) */
  srcHash: string;
  /** Parsed query object, path and params parsed from srcQuery */
  query: ParsedUri;
  /** Parsed hash object, path and params parsed from srcHash */
  hash: ParsedUri;
  /**
   * Merged params from query and hash,
   * hash values take precedence when keys conflict.
   */
  params: Record<string, string>;
  /**
   * Resolved view path for the current URL.
   * May be undefined before framework boot.
   */
  view?: string;
  /**
   * Resolved path computed from hash path and query path based on routing rules.
   * May be undefined before framework boot.
   */
  path?: string;
  /**
   * Get param by key with optional default value.
   * Returns default value or empty string if key does not exist.
   * @param key Parameter key name
   * @param defaultValue Default value when key is missing, defaults to empty string
   */
  get: (key: string, defaultValue?: string) => string;
}

/**
 * URL parameter change representing a parameter value transition from old to new.
 * Used in `Router.diff()` return value to describe parameter changes.
 */
export interface ParamDiff {
  /** Value before the change */
  from: string;
  /** Value after the change */
  to: string;
}

/**
 * URL route change object interface describing changes between two routing states.
 * Returned by `Router.diff()`, includes changes in path, view, and other parameters.
 */
export interface LocationDiff {
  /**
   * Changed params (key -> {from, to}),
   * diff for all changed parameters
   */
  params: Record<string, ParamDiff>;
  /** Path diff when path has changed */
  path?: ParamDiff;
  /** View diff when rendered view has changed */
  view?: ParamDiff;
  /**
   * Whether this is a first forced change during app initialization.
   */
  force: boolean;
  /** Whether any content has changed */
  changed: boolean;
}

/**
 * Route pre-change event interface (change phase).
 * Provides two-phase confirmation: triggers change (can be rejected), then changed.
 * Can prevent, reject, or accept route changes through this event object.
 */
export interface RouteChangeEvent extends ChangeEvent {
  /**
   * Reject the URL change, revert to previous URL.
   */
  reject: () => void;
  /**
   * Accept the URL change, continue navigation.
   */
  resolve: () => void;
  /**
   * Prevent the URL change, pause subsequent route processing.
   */
  prevent: () => void;
}

/**
 * Route post-change event interface (changed phase).
 * Carries route diff information. Triggered after route change is confirmed and URL is updated.
 */
export type RouteChangedEvent = LocationDiff & ChangeEvent;

// ============================================================
// DOM types
// ============================================================

export interface DomRef {
  /** ID update list: [element, newId][] */
  idUpdates: [Element, string][];
  /** Views that need post-processing */
  views: ViewInterface[];
  /** DOM operation list: [opCode, parent, newChild?, oldChild?][] */
  domOps: DomOp[];
  /** Whether anything changed */
  hasChanged: number;
}

/**
 * Encoded DOM mutation. The op code matches `Node.appendChild` family at the
 * DOM level — parents are always Elements (you can't appendChild onto text)
 * but the moving / replaced child can be any ChildNode (Element / Text /
 * Comment), so the child slots are typed as ChildNode.
 */
export type DomOp =
  | [1, Element, ChildNode] // appendChild(parent, newChild)
  | [2, Element, ChildNode] // removeChild(parent, oldChild)
  | [4, Element, ChildNode, ChildNode] // replaceChild(parent, newChild, oldChild)
  | [8, Element, ChildNode, ChildNode]; // insertBefore(parent, newChild, refChild)

// ============================== VDOM ==============================

// ============================================================
// VDOM types
// ============================================================

/**
 * Virtual DOM node. Produced by `vdomCreate`, consumed by the VDOM diff engine.
 *
 * Property semantics:
 * - Text nodes: tag = 0 (V_TEXT_NODE), html = text content
 * - Element nodes: tag = string, attrs = serialized opening tag, children = child VDomNodes
 * - Raw HTML nodes: tag = SPLITTER (\x1e), html = raw HTML string
 * - Self-closing: selfClose = true (children param was 1)
 */
export interface VDomNode {
  /** Tag name for elements, 0 (V_TEXT_NODE) for text, SPLITTER for raw HTML */
  tag: string | number;
  /** Inner HTML (serialized children for elements, text content for text nodes) */
  html: string;
  /** Serialized opening tag with attributes, e.g. '<div class="row"' */
  attrs?: string;
  /** Attribute key-value map */
  attrsMap?: Record<string, unknown>;
  /** Attribute names that are set as DOM properties (not attributes) */
  attrsSpecials?: Record<string, string>;
  /** Original specials argument before defaulting (for change detection) */
  hasSpecials?: Record<string, string> | undefined;
  /** Child VDomNode array (undefined for text/raw/self-closing) */
  children?: VDomNode[] | undefined;
  /** Diff key: from id, #, or v-lark path */
  compareKey?: string | undefined;
  /** Keyed children count map (compareKey -> count) */
  reused?: Record<string, number> | undefined;
  /** Total count of keyed children */
  reusedTotal?: number;
  /** Sub-view references: [viewPath, owner, uri, params] tuples */
  views?: [string, string, string, Record<string, string>][] | undefined;
  /** Whether self-closing (children param was literal 1) */
  selfClose?: boolean;
  /** Sub-view path if this node hosts a v-lark view, otherwise falsy */
  isLarkView?: string | undefined;
}

/**
 * VDOM diff operation tracker. Parallel to DomRef but for the VDOM pipeline.
 */
export interface VDomRef {
  /** View ID (for placeholder replacement) */
  viewId: string;
  /** Sub-views that need re-rendering after diff */
  viewRenders: ViewInterface[];
  /** Deferred DOM property assignments: [element, propName, value][] */
  nodeProps: [Element, string, unknown][];
  /** Pending async operation count */
  asyncCount: number;
  /** Whether the DOM actually changed */
  changed: number;
  /** DOM mutation operations (same format as DomOp) */
  domOps: DomOp[];
}

/** VDOM node creation function signature (vdomCreate) */
export type VDomCreateFn = (
  tag: string | number,
  props?: Record<string, unknown> | number | null,
  children?: VDomNode[] | number | null,
  specials?: Record<string, string>,
) => VDomNode;

/**
 * VDOM template function signature.
 * The compiled template imports vdomCreate via ES module import and
 * takes only (data, viewId, refData). Extra arguments are ignored.
 */
export type VDomTemplate = (
  data: unknown,
  viewId: string,
  refData: unknown,
) => VDomNode;

// ============================== VDOM ==============================

// ============================================================
// Frame internal types (replaces as-unknown-as-Record cheats)
// ============================================================

export interface FrameInvokeEntry {
  /** Method name */
  name: string;
  /** Method arguments */
  args: unknown[];
  /** Internal key */
  key: string;
  /** Whether removed (args match) */
  removed?: boolean;
}

// ============================================================
// Mixin function types
// ============================================================

/** Mixin event handler with internal merge marker and handler list */
export interface MixinEventHandler extends AnyFunc {
  /** Merged handler list */
  handlerList?: AnyFunc[];
  /** Mixin marker: 1 = this is a mixin function */
  marker?: number;
}

/** View event selector map entry: handler name list with selector presence tracking */
export interface ViewEventSelectorEntry {
  /** Selector name list */
  selectors: string[];
  /** Index signature for checking if selector is already registered */
  [selector: string]: unknown;
}

// ============================================================
// View instance types
// ============================================================

/**
 * Compiled template function signature.
 * `data`/`viewId`/`refData` are required; subsequent encoder args are
 * injected by the Updater (encodeHTML/encodeSafe/encodeURIExtra/refFn/encodeQ).
 */
export type ViewTemplate = (
  data: unknown,
  viewId: string,
  refData: unknown,
  ...encoders: unknown[]
) => string;

export interface ViewLocationObserved {
  /** Whether observing location */
  flag: number;
  /** Keys to observe */
  keys: string[];
  /** Whether observing path */
  observePath: boolean;
}

export interface ViewResourceEntry {
  /** The resource entity */
  entity: unknown;
  /** Whether to destroy when render() is called */
  destroyOnRender: boolean;
}

export interface ViewGlobalEventEntry {
  /** Handler function */
  handler: AnyFunc;
  /** Bound handler wrapper (for removeEventListener) */
  boundHandler?: AnyFunc;
  /** DOM element (window/document) */
  element: EventTarget;
  /** Event name */
  eventName: string;
  /** Modifiers */
  modifiers: Record<string, boolean>;
}
/**
 * View configuration for listening to URL changes.
 * Used as object parameter for `observeLocation()` method.
 */
export interface ViewObserveLocation {
  /**
   * Whether to listen for path changes.
   */
  observePath?: boolean;
  /**
   * Parameter keys to observe, supports comma-separated string or string array.
   */
  params?: string | string[];
}

/**
 * Router interface providing URL parsing, navigation, diff, and event listening capabilities.
 * Supports two-phase route confirmation mechanism: change (can reject) → changed.
 * Hash-based implementation using #! as default hash prefix.
 */
export interface RouterInterface extends EventEmitterInterface<RouterInterface> {
  /**
   * Parse href into Location object.
   * Parses query and hash sections of href, returns structured routing information.
   * Defaults to parsing current page `location.href`.
   * @param href URL to parse, uses `location.href` if not specified
   */
  parse(href?: string): Location;
  /**
   * Compute diff between current and previous location.
   * Returns undefined if no routing changes have occurred yet.
   */
  diff(): LocationDiff | undefined;
  /**
   * Navigate to new URL.
   * Supports two calling modes:
   * - `Router.to("/list", { page: 2 })` specify path and params
   * - `Router.to({ page: 2 })` update params only, keep current path
   * @param pathOrParams Path string or params object
   * @param params Query params object (only used when first arg is path string)
   * @param replace Whether to replace current history entry instead of adding new one
   * @param silent Whether to silently update without triggering change event
   */
  to(
    pathOrParams: string | Record<string, unknown>,
    params?: Record<string, unknown>,
    replace?: boolean,
    silent?: boolean,
  ): void;
  /** Join path segments */
  join(...paths: string[]): string;
  /**
   * Register an async-friendly navigation guard.
   *
   * Each guard is invoked with the parsed `(to, from)` Locations. Guards
   * may return a Promise; the router awaits all guards in registration
   * order. If any guard:
   *
   * - returns / resolves to `false`,
   * - throws or rejects,
   *
   * the navigation is aborted and the URL is reverted. Returning `true`,
   * `undefined`, or any non-false value permits the navigation.
   *
   * Returns an unsubscribe function so the guard can be torn down (e.g.
   * inside a view's `destroy` handler).
   */
  beforeEach(
    guard: (to: Location, from: Location) => boolean | Promise<boolean>,
  ): () => void;
  /** Internal: bind hashchange (called by Framework.boot) */
  _bind(): void;
  /** Internal: set framework config */
  _setConfig(cfg: FrameworkConfig): void;
  /** Internal: notify hash change (for programmatic trigger) */
  notify?(e?: Event): void;
  /**
   * Triggered when URL is about to change (change phase), can reject or prevent navigation via event object.
   */
  onChange?: (e?: RouteChangeEvent) => void;
  /**
   * Triggered after URL has changed (changed phase), carries route diff information.
   */
  onChanged?: (e?: RouteChangedEvent) => void;
}

/**
 * Service event interface, triggered when request starts or ends.
 * Includes begin/done/fail/end event types.
 */
export interface ServiceEvent extends ChangeEvent {
  /**
   * Data payload object carrying this request's data.
   */
  readonly payload: PayloadInterface;
  /**
   * Error object, present if request throws an error, otherwise null.
   */
  readonly error: object | string | null;
}
/**
 * View event interface carrying the ID of the node that triggered the event.
 * Carried in DOM events bound via @event attribute.
 */
export interface ViewEvent extends ChangeEvent {
  /**
   * DOM node ID that triggered the event.
   */
  readonly id: string;
}
/**
 * Frame static event interface carrying associated Frame instance.
 * Carried in Frame's add/remove static events.
 */
export interface FrameStaticEvent extends ChangeEvent {
  /**
   * Associated Frame instance object.
   */
  readonly frame: FrameInterface;
}

export interface ViewInterface extends EventEmitterInterface<ViewInterface> {
  /**
   * View ID (same as owner frame ID),
   * DOM node ID where current view resides.
   */
  id: string;
  /**
   * Owner frame,
   * Frame instance holding current view.
   * May be numeric placeholder 0 before view initialization completes.
   * TODO: Migrate numeric placeholder 0 to undefined or null
   */
  owner: FrameInterface | number;
  /**
   * Updater instance managing view data binding and DOM rendering.
   */
  updater: UpdaterInterface;
  /**
   * Signature: > 0 means active, incremented on render, 0 = destroyed */
  signature: number;
  /** Whether rendered at least once */
  rendered?: boolean;
  /**
   * View template function. Receives data + viewId + refData and a set of
   * encoder helpers wired in by the Updater, and returns the rendered HTML.
   */
  template?: ViewTemplate | VDomTemplate;
  /**
   * Mixin object array for extending view functionality.
   * Framework merges properties and methods from mixins into view prototype.
   * Event method conflicts are automatically merged into sequential calls.
   */
  mixins?: Record<string, unknown>[];
  /** Location observation config */
  locationObserved: ViewLocationObserved;
  /** Observed state keys */
  observedStateKeys?: string[];
  /** Resource map */
  resources: Record<string, ViewResourceEntry>;
  /** Selector event map: eventType -> selector list */
  eventSelectorMap: Record<string, ViewEventSelectorEntry>;
  /** Event object map: eventType -> bitmask */
  eventObjectMap: Record<string, number>;
  /** Global event list */
  globalEventList: ViewGlobalEventEntry[];
  /** Whether endUpdate has been called (1 = pending) */
  endUpdatePending?: number;
  /** Last rendered VDOM tree (only used when virtualDom is enabled) */
  vdom?: VDomNode;
  /** Render method (wrapped) */
  render(): void;
  /**
   * Init method called after view is mounted.
   * Used for initialization logic.
   * Framework passes two arguments during actual invocation:
   * - initParams: initialization parameter object
   * - options: contains `node: Element` and `deep: boolean`
   */
  init(): void;
  /** Wrapped render method */
  renderMethod?: AnyFunc;
  /** endUpdate pending flag */
  endUpdatePendingFlag?: number;
  // View lifecycle methods
  /**
   * Notify view that HTML update is about to begin for a specific region.
   * Framework unmounts child Frames in that region to prevent DOM diff from operating on unmounted nodes.
   * @param id Region node ID to update, defaults to current view
   */
  beginUpdate: (id?: string) => void;
  /**
   * Notify view that HTML update has completed for a specific region.
   * Framework mounts child Frames in that region and executes deferred invoke queue.
   * @param id Region node ID that finished updating, defaults to current view
   * @param inner Whether this is an internal framework call
   */
  endUpdate: (id?: string, inner?: boolean) => void;
  /**
   * Wrap async callback to ensure it only executes if view is not destroyed.
   * In SPAs, async callbacks (e.g., setTimeout, AJAX) may execute after view is destroyed,
   * causing errors when manipulating DOM.
   * After wrapping with `wrapAsync`, framework automatically checks view state and only executes callback if view is alive.
   * @param fn Callback function to wrap
   * @param context `this` binding for callback execution, defaults to view itself
   */
  wrapAsync: <Fn extends AnyFunc>(
    fn: Fn,
    context?: unknown,
  ) => (...args: Parameters<Fn>) => ReturnType<Fn> | undefined;
  /**
   * Listen for URL bar changes, supports two calling modes:
   * - `observeLocation("page,size", true)` pass parameter keys (comma-separated) and whether to observe path
   * - `observeLocation({ params: ["page", "size"], path: true })` pass config object
   * View automatically re-renders when observed parameters or path change.
   * @param params Parameter keys to observe, supports comma-separated string, string array, or config object
   * @param observePath Whether to observe path changes
   */
  observeLocation: (
    params: string | string[] | Record<string, unknown>,
    observePath?: boolean,
  ) => void;
  /**
   * Observe data changes for specified keys in State.
   * View automatically re-renders when observed keys are updated via `State.digest()`.
   * @param keys Comma-separated key string or string array
   */
  observeState: (keys: string | string[]) => void;
  /**
   * Hand over resource to current view for lifecycle management.
   * Framework automatically calls resource's destroy method at appropriate time when view unmounts or re-renders.
   * @param key Unique key for managed resource; if key already manages different resource, old resource is auto-destroyed
   * @param resource Resource object to manage
   * @param destroyOnRender Whether to auto-destroy resource when render method is called; Service instances typically need auto-destroy on render
   */
  capture: (
    key: string,
    resource?: unknown,
    destroyOnRender?: boolean,
  ) => unknown;
  /**
   * Release managed resource, returns the resource object regardless of destruction state.
   * @param key Managed resource key
   * @param destroy Whether to destroy resource (call its destroy method), defaults to true
   */
  release: (key: string, destroy?: boolean) => unknown;
  /**
   * Set leave prompt, e.g., when form has unsaved changes.
   * Can prompt user to choose between leaving directly or saving before leaving.
   * Framework calls condition function during route changes (change phase) and page unloads (beforeunload).
   * Navigation is prevented if condition returns true.
   * @param message Leave prompt message
   * @param condition Function to determine whether to show leave prompt; returns true to prevent navigation
   */
  leaveTip: (message: string, condition: () => boolean) => void;
  /**
   * Assign method for incremental DOM updates.
   * Framework uses DOM diff (in-memory real DOM diff) to update only changed portions,
   * automatically handling child view mounting and unmounting.
   * Returns true if DOM changed, undefined if no change.
   * @param options Incremental update config, used internally by framework
   */
  assign?: (options?: unknown) => boolean | undefined;
  /**
   * Triggered when view is destroyed.
   */
  onDestroy?: (e?: ChangeEvent) => void;
  /**
   * Triggered when render method is called.
   */
  onRender?: (e?: ChangeEvent) => void;
  /**
   * Inherit View to create new view subclass.
   * Supports props.make constructor, props.mixins, and event methods (e.g., `'name<click>'`).
   * @param props Prototype object containing init, render, and other methods
   * @param statics Object of static methods or properties
   */
  extend?<TProps = object, TStatics = object>(
    props?: ExtendThisType<TProps & ViewInterface>,
    statics?: TStatics,
  ): ViewInterface & TStatics;
  /**
   * Merge multiple mixin objects into View prototype.
   * Existing properties are not overwritten; event method conflicts are automatically merged into sequential calls.
   * @param args Mixin object list
   */
  merge?(...args: ExtendThisType<ViewInterface>[]): ViewInterface;

  navigate?: (path: string, params?: Record<string, unknown>) => void;
}

type ExtendThisType<T> = Record<string, unknown> & ThisType<T>;

/**
 * Minimal Frame interface needed by View.
 * Frame (View Frame) is a view container managing view mount, unmount, and parent-child hierarchy.
 * Each Frame corresponds to one DOM node, associated with view via v-lark attribute.
 */
export interface FrameInterface extends EventEmitterInterface<FrameInterface> {
  /**
   * DOM node ID where Frame resides.
   */
  id: string;
  /**
   * View module path currently rendered by this Frame, e.g., "app/views/default".
   */
  readonly viewPath?: string;
  /**
   * Parent Frame ID, undefined if this is a top-level Frame.
   */
  readonly parentId: string | undefined;
  /**
   * Mount view to current Frame.
   * Framework loads view class, creates instance, and renders view.
   * @param viewPath View module path, e.g., "app/views/default"
   * @param viewInitParams Parameters passed during view initialization, accessible in view's init method
   */
  mountView(viewPath: string, viewInitParams?: Record<string, unknown>): void;
  /**
   * Unmount view from current Frame, triggers view's destroy event and cleans up resources.
   */
  unmountView(): void;
  /**
   * Mount child Frame on specified DOM node and render view.
   * @param frameId DOM node ID for rendering
   * @param viewPath View path
   * @param viewInitParams Parameters passed during view initialization
   */
  mountFrame: (
    frameId: string,
    viewPath: string,
    viewInitParams?: Record<string, unknown>,
  ) => FrameInterface;
  /**
   * Unmount child Frame from specified DOM node.
   * @param id DOM node ID, defaults to current Frame if omitted
   */
  unmountFrame: (id?: string) => void;
  /**
   * Render all child views under specified node (scans v-lark attributes and mounts).
   * @param zoneId DOM node ID, defaults to current Frame
   */
  mountZone: (zoneId?: string) => void;
  /**
   * Unmount all child views under specified node.
   * @param zoneId DOM node ID, defaults to current Frame
   */
  unmountZone: (zoneId?: string) => void;
  /**
   * Get ancestor Frame, defaults to parent Frame (level=1).
   * @param level Levels to traverse upward, defaults to 1
   */
  parent(level?: number): FrameInterface | undefined;
  /**
   * Invoke specified method on view in current Frame.
   * If view is not rendered yet, invocation is deferred until render completes.
   * @param name Method name
   * @param args Arguments array passed to method
   */
  invoke: (name: string, args?: unknown[]) => unknown;
  /**
   * Triggered when all descendant views have been created.
   */
  onCreated?: (e?: ChangeEvent) => void;
  /**
   * Triggered when descendant views change.
   */
  onAlter?: (e?: ChangeEvent) => void;
  /**
   * Get Frame instance by ID, returns undefined if not exists.
   * @param id Frame's DOM node ID
   */
  get?(id: string): FrameInterface | undefined;
  /**
   * Get all Frame instances map for current page.
   */
  getAll?(): Map<string, FrameInterface>;
  /**
   * Triggered when Frame is created and registered.
   */
  onAdd?: (e?: FrameStaticEvent) => void;
  /**
   * Triggered when Frame is destroyed and unregistered.
   */
  onRemove?: (e?: FrameStaticEvent) => void;
  view: ViewInterface | undefined;
  /**
   * Get ID array of all child Frames for current Frame.
   * Note: ID positions in array are not fixed.
   */
  children: () => string[];
  invokeList: FrameInvokeEntry[];
}

/**
 * Minimal Updater interface needed by View.
 * View updater responsible for view data binding and data/page updates.
 * Each View instance has an Updater, triggering data/page updates via set/digest.
 * Internally executes complete pipeline: template rendering → DOM diff (in-memory real DOM diff) → DOM operations.
 */
export interface UpdaterInterface {
  /**
   * Get data that has been set.
   * Returns complete data object if key is omitted, otherwise returns value for specified key.
   * @param key Data key name, omitted returns complete data object
   */
  get: <T = unknown>(key?: string) => T;
  /**
   * Set data and track changed keys.
   * After set, must explicitly call `digest()` to commit changes to page.
   * Returns this for chaining.
   * @param data Data object, e.g., `{ a: 1, b: 2 }`
   * @param excludes Set of keys to exclude from change tracking
   */
  set: (
    data: Record<string, unknown>,
    excludes?: ReadonlySet<string>,
  ) => UpdaterInterface;
  /**
   * Trigger page re-render.
   * After set, must explicitly call `digest()` to commit changes to page.
   * Internally executes complete pipeline: template rendering → DOM diff (in-memory real DOM diff) → DOM operations.
   * @param data Optional data object, if provided calls `set()` first to set data
   * @param excludes Set of keys to exclude from change tracking
   * @param callback Callback executed after render completes
   */
  digest: (
    data?: Record<string, unknown>,
    excludes?: ReadonlySet<string>,
    callback?: () => void,
  ) => void;
  /**
   * Save a snapshot of current data for altered() detection.
   * Works with `altered()` method to detect whether data has changed.
   */
  snapshot: () => UpdaterInterface;
  /**
   * Check if data has changed since last snapshot.
   * Returns undefined if `snapshot()` has not been called.
   */
  altered: () => boolean | undefined;
  /** Ref data for template rendering */
  refData: Record<string, unknown>;
  /**
   * Translate raw reference data starting with @ symbol in template.
   * Replaces `{{@refData}}` with actual value from refData.
   * @param data Reference data to translate
   */
  translate(data: unknown): unknown;
  /**
   * Parse expression string.
   * @param expr Expression string to parse
   */
  parse(expr: string): unknown;
}

// ============================================================
// Service types
// ============================================================

/**
 * Data payload interface wrapping API request response data, providing read/write methods.
 * Payload instances are created internally by Service, developers access via all/one/save callbacks.
 */
export interface PayloadInterface {
  /**
   * Get data from Payload by key.
   * @param key Data key name
   */
  get<T = unknown>(key: string): T;
  /**
   * Set data to Payload, supports three calling modes:
   * - Key-value pair: `payload.set("name", "value")`
   * - Data object: `payload.set({ name: "value" })`
   * - Endpoint metadata object (for internal framework use)
   * Returns this for chaining.
   * @param keyOrData Key/value string, data object, or endpoint metadata object
   * @param value Value when first parameter is a key
   */
  set(
    keyOrData: string | Record<string, unknown> | ServiceMetaEntry,
    value?: unknown,
  ): PayloadInterface;
  data: Record<string, unknown>;
  cacheInfo?: ServiceCacheInfo;
}

/**
 * Change event object.
 */
export interface ChangeEvent {
  /**
   * Event type.
   */
  readonly type: string;
  // readonly view?: string | ParamDiff;
  /**
   * Set of changed data keys. Use `keys.has(name)` to check membership.
   */
  readonly keys?: ReadonlySet<string>;
}

/**
 * Event emitter interface providing on/off/fire methods for publish-subscribe pattern.
 */
export interface EventEmitterInterface<T = unknown> {
  /**
   * Bind event listener, calls handler when event is triggered.
   * @param name Event name
   * @param fn Event handler function
   */
  on(
    name: string,
    fn: (this: T, e?: ChangeEvent) => void,
  ): EventEmitterInterface<T>;
  /**
   * Unbind event listener, removes all handlers for event if no handler function is provided.
   * @param name Event name
   * @param fn Optional event handler function, if omitted removes all handlers
   */
  off(name: string, fn?: AnyFunc): EventEmitterInterface<T>;
  /**
   * Fire event, executes all bound handlers, automatically adds type property to event data.
   * Supports removing all handlers after firing.
   * Supports executing handler list in reverse order.
   * @param name Event name
   * @param data Event data object
   * @param remove Whether to remove all handlers after firing
   * @param lastToFirst Whether to execute handler list in reverse order
   */
  fire(
    name: string,
    data?: Record<string, unknown>,
    remove?: boolean,
    lastToFirst?: boolean,
  ): EventEmitterInterface<T>;
}

/**
 * Global state interface providing cross-view data sharing and data change notification capabilities.
 * State is a singleton object managing app-level state data via get/set/digest.
 * Supports `clean()` method to create a mixin for automatic cleanup on view destruction.
 *
 * Use State for SIMPLE cross-view data (lightweight shared values: counters,
 * toggles, page title, session info, etc.). For COMPLEX reactive state —
 * handlers, derived data, or fine-grained subscriptions — use `create` instead.
 */
export interface StateInterface extends EventEmitterInterface<StateInterface> {
  /**
   * Get data from global state, returns complete state object if key is omitted.
   * @param key Data key name, omitted returns complete state object
   */
  get<T = unknown>(key?: string): T;
  /**
   * Set global state data.
   * After set, must explicitly call `digest()` to dispatch changed event and notify views to update.
   * @param data Data object, e.g., `{ a: 1, b: 2 }`
   * @param excludes Set of keys to exclude from change tracking
   */
  set(data: Record<string, unknown>, excludes?: ReadonlySet<string>): this;
  /**
   * Clean data for specified keys in State, can only be used in view's mixins.
   * For example `mixins: [State.clean("a,b")]`.
   * Keys registered via this method are automatically cleaned when view is destroyed,
   * and corresponding key reference counts are decremented; data is auto-deleted when count reaches zero.
   * @param keys Comma-separated key string
   * @returns Object with make method, called by mixins mechanism
   */
  clean(keys: string): { make: AnyFunc };
  /**
   * Detect data changes and dispatch changed event.
   * After set, must explicitly call `digest()` to dispatch changed event and notify views to update.
   * @param data Optional data object, if provided calls `set()` first to set data
   * @param excludes Set of keys to exclude from change tracking
   */
  digest(data?: Record<string, unknown>, excludes?: ReadonlySet<string>): void;
  /**
   * Get the set of keys changed in the most recent digest.
   */
  diff: () => ReadonlySet<string>;
  onChanged?: (e?: ChangeEvent) => void;
}

export interface ServiceOptions {
  /** Request URL */
  url: string;
  /** Request params */
  params?: Record<string, unknown>;
  /** HTTP method */
  method?: "GET" | "POST" | "PUT" | "DELETE" | string;
  /** Cache: true for default, number for TTL */
  cache?: boolean | number;
  /** POST data */
  data?: unknown;
}

/** Pending cache entry for deduplication (internal to Service) */
export interface PendingCacheEntry extends Array<unknown> {
  /** Reference to the pending Payload entity */
  entity?: unknown;
}

/**
 * Endpoint metadata configuration for registering an API endpoint with Service.
 * Each meta describes endpoint's URL, cache strategy, before/after interceptors, etc.
 */
export interface ServiceMetaEntry {
  /**
   * Endpoint name,
   * Unique name for endpoint metadata, must be unique within same Service.
   */
  name: string;
  /** Request URL, required. */
  url: string;
  /**
   * Cache TTL in ms, 0 = no cache.
   * Cache validity time in milliseconds.
   * 0 means no caching.
   * Greater than 0 means cache TTL, reuse cached data within this time range.
   */
  cache?: number;
  /**
   * Before-fetch hook,
   * Hook function called before request is sent, can process request data.
   * `this` points to current Payload instance.
   * @param payload Data carrier for current request
   */
  before?: (this: PayloadInterface, payload: PayloadInterface) => void;
  /**
   * After-fetch hook.
   * Hook function called after request succeeds, before data is passed to view.
   * Can process response data in this method.
   * `this` points to current Payload instance.
   * @param payload Data carrier for current request
   */
  after?: (this: PayloadInterface, payload: PayloadInterface) => void;
  /** Clean keys on destroy,
   * Comma-separated endpoint name string for clearing other endpoints' cache.
   * For example, if an endpoint creates new data,
   * after successful call, should clear all data-fetching endpoints' cache,
   * otherwise new data cannot be retrieved.
   */
  cleanKeys?: string;
  /** Additional properties */
  [key: string]: unknown;
}

/** Cache info attached to Payload entity */
export interface ServiceCacheInfo {
  /** Endpoint name */
  name: string;
  /** After-fetch hook */
  after?: AnyFunc | undefined;
  /** Clean keys */
  cleans?: string | undefined;
  /** Cache key */
  key: string;
  /** Timestamp when cached */
  time: number;
}

export interface FrameworkInterface {
  /**
   * Read framework configuration.
   * - Without arguments: returns the complete config object.
   * - With a key: returns just `config[key]` (untyped — use a generic to
   *   constrain the return type if you know the key's shape).
   *
   * `getConfig` is a pure read — call `setConfig(patch)` to mutate.
   */
  getConfig(): FrameworkConfig;
  getConfig<T = unknown>(key: string): T | undefined;

  /**
   * Merge a patch into the framework configuration and return the merged
   * config object. Replaces the dual-purpose overload of `config()`.
   */
  setConfig<T extends object = Partial<FrameworkConfig>>(
    patch: Partial<FrameworkConfig> & T,
  ): FrameworkConfig & T;

  /**
   * @deprecated Use `getConfig()` / `getConfig(key)` for reads and
   * `setConfig(patch)` for writes. The overloaded `config()` blurred the
   * two and confused TypeScript inference; the split is a drop-in upgrade.
   */
  config<T extends object = Partial<FrameworkConfig>>(
    cfg?: Partial<FrameworkConfig> & T,
  ): FrameworkConfig & T;
  /** @deprecated See above. */
  config(key: string): unknown;
  /**
   * App initialization entry point, starts framework and renders root view.
   * After invocation: merge config → bind route events → create root Frame → mount default view.
   * @param cfg Config object
   */
  boot(cfg: FrameworkConfig): void;
  /**
   * Convert array to hash map object.
   * - Simple array: `Framework.toMap([1,2,3])` => `{1:1, 2:1, 3:1}`
   * - Object array: `Framework.toMap([{id:20},{id:30}], 'id')` => `{20:{id:20}, 30:{id:30}}`
   * @param list Source array
   * @param key Use object's key value from array as map key
   */
  toMap<T>(
    list: T[] | null | undefined,
    key?: keyof T,
  ): Record<string, T | number>;
  /**
   * Execute methods in try-catch manner, catches exceptions.
   * Returns return value of last successfully executed method.
   * @param fns Function or function array
   * @param args Arguments array passed to functions
   * @param context `this` binding during function execution
   */
  toTry(fns: AnyFunc | AnyFunc[], args?: unknown[], context?: unknown): unknown;
  /**
   * Convert path and params to URL string.
   * Example: `Framework.toUrl('/xxx/', {a:'b',c:'d'})` => `/xxx/?a=b&c=d`
   * @param path Path string
   * @param params Params object
   * @param keepEmpty Set of keys whose empty values should be preserved
   */
  toUrl(
    path: string,
    params?: Record<string, unknown>,
    keepEmpty?: Set<string>,
  ): string;
  /**
   * Parse URL string to path and params object.
   * Example: `Framework.parseUrl('/xxx/?a=b&c=d')` => `{path:'/xxx/', params:{a:'b',c:'d'}}`
   * @param url URL string
   */
  parseUrl(url: string): ParsedUri;
  /**
   * Merge source object properties into target object.
   * @param target Target object
   * @param sources One or more source objects
   */
  mix<T extends object>(target: T, ...sources: Record<string, unknown>[]): T;
  /**
   * Check if object has specified own property (safe hasOwnProperty).
   * @param owner Object to check, supports undefined/null
   * @param prop Property key name
   */
  has<T extends object>(
    owner: T | undefined | null,
    prop: PropertyKey,
  ): boolean;
  /**
   * Get enumerable property keys of object as array.
   * @param src Source object
   */
  keys<T extends object>(src: T): string[];
  /**
   * Check if one DOM node is contained within another.
   * Returns true if both nodes are the same.
   * @param node Node or node ID
   * @param container Container node or node ID
   */
  inside(node: HTMLElement | string, container: HTMLElement | string): boolean;
  /**
   * Shorthand for document.getElementById.
   * Returns directly if Element is passed.
   * @param id Node ID or Element object
   */
  node(id: string | Element | null): Element | null;
  /**
   * Ensure DOM element has an ID, auto-generates one if missing.
   * Returns element's ID.
   * @param node DOM element object
   */
  nodeId(node: HTMLElement): string;
  /**
   * Load modules using configured module loader.
   * @param names Module names, supports string or string array
   * @param callback Callback after modules are loaded
   */
  use(
    names: string | string[],
    callback?: (...modules: unknown[]) => void,
  ): void;
  /**
   * Dynamically inject CSS styles into page. Returns cleanup function to remove injected styles.
   * Supports single and batch injection.
   * - `Framework.applyStyle("my-style", "body { color: red; }")` single injection
   * - `Framework.applyStyle(["style1", "css1", "style2", "css2"])` batch injection
   * @param styleIdOrPairs Style unique key or [id1, css1, id2, css2, ...] batch array
   * @param cssText CSS style string (only used when first param is string)
   */
  applyStyle(styleIdOrPairs: string | string[], cssText?: string): () => void;
  /**
   * Generate globally unique identifier (GUID).
   * @param prefix GUID prefix, defaults to "lark-"
   */
  guid(prefix?: string): string;
  /**
   * Create async callback validity marker.
   * Returns a check function; if host object is unmarked (e.g., view re-rendered), check function returns false, preventing expired async callbacks from executing.
   * Typical usage: `const check = Framework.mark(this, 'render'); setTimeout(() => { if (check()) ... })`
   * @param host Host object (usually view instance)
   * @param key Marker key name (usually "render" or specific async operation identifier)
   */
  mark(host: object, key: string): () => boolean;
  /**
   * Delay wait, Promise-based setTimeout wrapper.
   * @param time Delay time in milliseconds
   */
  delay(time: number): Promise<void>;
  /**
   * Whether framework has booted
   */
  isBooted(): boolean;
  /**
   * Invalidate (unmark) async callback markers for a host object.
   * Typically called when a view is re-rendered or destroyed.
   * @param host The host object whose markers should be invalidated
   */
  unmark(host: object): void;
  /**
   * Fire a custom DOM event on a target element.
   * @param target Target element or EventTarget
   * @param eventType Event type string
   * @param eventInit CustomEvent init options
   */
  dispatch(
    target: EventTarget,
    eventType: string,
    eventInit?: CustomEventInit,
  ): void;
  /**
   * Execute a function in try-catch with chunked scheduling.
   * @param fn Function to execute
   * @param args Arguments to pass
   * @param context `this` context
   */
  task(fn: AnyFunc, args?: unknown[], context?: unknown): void;
  /**
   * Wait for all views in a zone to be rendered.
   * Returns WAIT_OK if rendered, WAIT_TIMEOUT_OR_NOT_FOUND if timeout or not found.
   * @param viewId Zone view ID
   * @param timeout Timeout in milliseconds (default: 30000)
   */
  waitZoneViewsRendered(viewId: string, timeout?: number): Promise<number>;
  /** Wait result: views rendered successfully */
  WAIT_OK: number;
  /** Wait result: timeout or view not found */
  WAIT_TIMEOUT_OR_NOT_FOUND: number;
  /**
   * Base class with EventEmitter.
   * Inherits EventEmitter for use as a base class in the framework.
   */
  Base: typeof import("./event-emitter").EventEmitter;
  /**
   * View class.
   * Use `View.extend()` to create subclasses.
   */
  View: typeof import("./view").View;
  /**
   * Cache class.
   * Use `new Cache()` to create cache instances.
   */
  Cache: typeof import("./cache").Cache;
  /**
   * Global state object.
   */
  State: StateInterface;
  /**
   * Router object.
   */
  Router: RouterInterface;
  /**
   * Frame class.
   * Frame tree for view lifecycle management. Do not extend or instantiate directly.
   */
  Frame: typeof import("./frame").Frame;
}

// ============================================================
// Framework config types
// ============================================================

/**
 * Framework configuration interface, global config passed to app during `Framework.boot()`.
 * All config items can be accessed at runtime via `Framework.getConfig('key')`.
 */
export interface FrameworkConfig {
  /**
   * Root element ID.
   * DOM root node ID where root view resides, framework renders root view within this node.
   * This field is required, defaults to "root".
   */
  rootId: string;
  /**
   * Routing mode.
   * - `"history"` (default): uses `history.pushState` / `popstate`, clean URLs like `/home`
   * - `"hash"`: uses URL hash fragment with `#!` prefix, e.g. `#!/home`
   */
  routeMode?: "history" | "hash";
  /**
   * Default view path.
   * Default root view path to load when URL doesn't match any route.
   */
  defaultView?: string;
  /**
   * Default path when no hash present,
   * Path used when URL hash is empty, defaults to "/".
   */
  defaultPath?: string;
  /**
   * Route mapping: path -> view.
   * Mapping relationship between paths and views.
   * - Simple mapping: `{ "/home": "app/views/home" }`
   * - Config mapping: `{ "/detail": { view: "app/views/detail", title: "Detail" } }`
   * Use rewrite config item for path rewriting logic.
   */
  routes?: Record<string, string | RouteViewConfig>;
  /** Hashbang prefix (only used in hash mode) */
  hashbang?: string;
  /**
   * Error handler.
   * Global error handling function, framework uses try-catch to execute some core logic.
   * When errors are thrown, allows developers to catch them via this config item.
   * Note: Do not re-throw any errors in this method.
   */
  error?: (error: Error) => void;
  /**
   * Extensions to load.
   * Array of extension view paths to load during app startup.
   * These extension views are loaded before app initialization.
   */
  extensions?: string[];
  /** Init module to load */
  initModule?: string;
  /** Rewrite function for routes */
  rewrite?: (
    path: string,
    params: Record<string, string>,
    routes: Record<string, string>,
  ) => string;
  /**
   * Unmatched view (404).
   * View path to use when no matching view is found in routes, e.g., 404 page.
   */
  unmatchedView?: string;
  /**
   * Module require function for asynchronous view loading.
   * Called by `Framework.use()` when a view class is not found in the registry.
   * Integrate with Webpack Module Federation or other dynamic loading strategies.
   *
   * @param names - Array of module names to load (e.g., `["remote-app/views/home"]`)
   * @param params - Optional parameters passed to the module initializer
   * @returns Promise resolving to an array of loaded modules, or undefined if not available
   */
  require?: (
    names: string[],
    params?: Record<string, unknown>,
  ) => Promise<unknown[]> | undefined;
  /** Skip view rendered check */
  skipViewRendered?: boolean;
  /**
   * Project name of the current application.
   * Used by the micro-frontend bridge to determine if a view path
   * belongs to the current project or a remote project.
   */
  projectName?: string;
  /**
   * Cross-site (micro-frontend) configuration list.
   * Defines remote projects that can be loaded via Module Federation.
   * Also accessible via `window.crossConfigs` for build-time injection.
   */
  crossConfigs?: CrossSiteConfig[];
  /** Default false. */
  virtualDom?: boolean;
  /** Dynamic config access, custom config items */
  [key: string]: unknown;
}

export interface RouteViewConfig {
  /** View path */
  view: string;
  /** Additional properties merged into location */
  [key: string]: unknown;
}

// ============================================================
// Cross-site (Micro-Frontend) types
// ============================================================

/**
 * Configuration for a remote (cross-site) project in the micro-frontend setup.
 * Each entry defines how to load views from a different project via Module Federation.
 */
export interface CrossSiteConfig {
  /** Project name, used as the prefix in view paths (e.g., "remote-app" in "remote-app/views/home") */
  projectName: string;
  /**
   * Remote source URL or Module Federation remote name.
   * For Webpack MF: the remote entry URL (e.g., "remote_app@//cdn.example.com/remote-app/remoteEntry.js")
   */
  source: string;
  /** Optional API host for the remote project */
  apiHost?: string;
  /** Optional business code for multi-tenant scenarios */
  bizCode?: string;
}

// ============================================================
// Extended HTMLElement types
// ============================================================

/** Element with DOM diff cached compare key */
export interface DomElement extends Element {
  /** Whether compare key is cached */
  compareKeyCached?: number | undefined;
  /** Cached compare key */
  cachedCompareKey?: string | undefined;
  /** Whether auto-generated ID */
  autoId?: number;
}

/** Element with frame binding */
export interface FrameBoundElement extends HTMLElement {
  /** Frame instance bound to this element */
  frame?: FrameInterface;
  /** Whether frame is bound (1 = bound) */
  frameBound?: number;
  /** View rendered flag */
  viewRendered?: number;
  /** Range frame ID */
  rangeFrameId?: string;
  /** Range element guid */
  rangeElementGuid?: number;
}

/** Options for compileTemplate() */
export interface CompileOptions {
  /** Enable debug mode with line tracking (default: false) */
  debug?: boolean;
  /** Global variable names to destructure from $$ (refData) */
  globalVars?: string[];
  /** File path for debug error messages (default: undefined) */
  file?: string;
  /** Generate VDOM output instead of HTML string (default: false) */
  virtualDom?: boolean;
  /** Use SWC instead of Babel for parsing (default: false) */
  useSwc?: boolean;
}
