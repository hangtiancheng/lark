---
name: lark-mvc
description: Authoritative reference for the @lark.js/mvc TypeScript MVC frontend framework located at packages/lark-mvc. Use this skill whenever the user reads, writes, debugs, reviews, or extends code that imports from @lark.js/mvc, references the packages/lark-mvc source tree, or works with Lark MVC views, templates, routing, state management, or bundler plugins. Trigger on any of these symbols and concepts—Framework, FrameworkConfig, defineView, ViewCtx, ViewSetup, Frame, FrameObj, Router, RouterApi, State, StateApi, createStore, StoreApi, computed, bindStore, createService, ServiceApi, ServiceInstance, PayloadApi, createPayload, useState, useEffect, useStore, useInterval, useTimeout, useResource, useEvent, useUrlState, createUpdater, UpdaterApi, createEmitter, EmitterApi, createCache, CacheApi, vdomCreate, createVDomRef, VDomNode, VDomRef, EventDelegator, hotSwapByView, hotSwapByTemplate, hotSwapFrames, reloadViews, acceptView, disposeView, compileTemplate, extractGlobalVars, larkMvcPlugin, larkMvcLoader, SPLITTER, LARK_VIEW, ROUTER_EVENTS, mark, unmark, and file paths under packages/lark-mvc/src/**. Also trigger on conceptual phrases like "TypeScript MVC framework", "functional view system", "real-DOM diff", "VDOM with LIS reconciliation", "two-phase route confirmation", "template compilation", "HMR hot-swap", "micro-frontend support", "Module Federation", and "zustand-aligned state management".
---

# @lark.js/mvc — TypeScript MVC Frontend Framework

@lark.js/mvc is a lightweight TypeScript MVC frontend framework for single-page applications and micro-frontend scenarios. It provides a complete application architecture with zero runtime dependencies, featuring a functional-first API (no class, no this, no prototype), real-DOM diff engine (with optional VDOM mode), compile-time template transformation, two-phase route confirmation, zustand-aligned state management, and built-in HMR support across Vite, Webpack, and Rspack.

The package is published as ESM with CJS compatibility (`"type": "module"`, dual exports). The browser bundle has no external dependencies; Babel parser is used only at build time for template compilation.

## When to consult this skill (and when to skip)

Trigger this skill whenever you encounter:

- imports from `@lark.js/mvc` or any of its entry points (`@lark.js/mvc/vite`, `@lark.js/mvc/webpack`, `@lark.js/mvc/rspack`, `@lark.js/mvc/runtime`, `@lark.js/mvc/compiler`, `@lark.js/mvc/devtool`, `@lark.js/mvc/client`);
- relative imports inside `packages/lark-mvc/src/**`;
- any of the symbols listed in the YAML description;
- requests to create new views, modify routing logic, add state management, integrate API services, configure bundler plugins, implement HMR, or debug rendering issues;
- bug reports about view lifecycle, route navigation, state synchronization, template compilation errors, DOM diff mismatches, or HMR failures;
- discussions about template syntax (`{{=expr}}`, `{{if}}`, `{{forOf}}`, `@event` bindings), rendering modes (string vs VDOM), or micro-frontend architecture.

Do not trigger for: generic React/Vue/Angular questions (unless comparing to Lark MVC), unrelated frontend frameworks, backend-only TypeScript code, or the sibling package `@lark.js/cache` (route to the lark-cache skill instead).

## Mental model

A Lark MVC application follows this request flow:

```
User action (click, navigation, state change)
       |
   Router/State detects change
       |
   dispatcherNotifyChange()
       |
   dispatcherUpdate() walks Frame tree
       |
   For each affected ViewCtx:
       |
   ctx.render() → updater.digest()
       |
   +---+---+
   |       |
string   VDOM
mode     mode
   |       |
dom.ts   vdom.ts
(real-DOM  (three-phase
 diff)     LIS diff)
   |       |
   +---+---+
       |
   DOM mutations applied
       |
   endUpdate() remounts child frames
```

Key architectural decisions:

1. **Functional over OOP**: All APIs use factory functions and closures. No class instantiation, no prototype chains, no mixin composition anywhere in the framework.

2. **Real-DOM diff as default**: String mode parses HTML into a temporary DOM tree via `document.implementation.createHTMLDocument` and performs keyed comparison. This avoids VDOM overhead for most use cases.

3. **VDOM as opt-in**: When enabled via `vdom: true`, templates compile to `vdomCreate` calls and the engine uses a three-phase diff with LIS (Longest Increasing Subsequence) reconciliation to minimize DOM moves.

4. **Compile-time templates**: Templates are `.html` files compiled at build time into JavaScript render functions. The compiler uses `@babel/parser` for AST-based variable extraction, providing zero-config template variable detection.

5. **Two-phase routing**: The Router fires a `change` event before navigation (allowing rejection) and a `changed` event after (triggering view updates). Navigation guards run asynchronously between the two phases.

6. **Reference-counted events**: The EventDelegator uses reference counting per event type on `document.body`, ensuring a single capture-phase listener per event type regardless of how many views register handlers.

7. **LFU cache with frequency eviction**: The bounded cache uses single-pass partial selection (O(n\*k)) instead of full sorting, making eviction efficient for the typical buffer size of 5.

8. **Async callback validity**: The `mark`/`unmark` system and `wrapAsync` prevent stale callbacks from executing after a view is re-rendered or destroyed.

9. **Cooperative time-slicing**: The task scheduler processes tasks in 9ms batches, yielding to the browser via `scheduler.yield()` (Chrome 115+) or `setTimeout(0)` fallback.

## Public API surface

All exports come through `packages/lark-mvc/src/index.ts`. Treat that file as the contract: anything not re-exported is internal and must not be relied on by callers.

### Framework (framework.ts)

The main entry point for booting the application.

- `Framework.boot(cfg: FrameworkConfig): void` — merge config, bind route events, create root Frame, mount default view
- `Framework.getConfig(): FrameworkConfig` or `Framework.getConfig<T>(key: string): T | undefined` — read framework configuration
- `Framework.setConfig<T>(patch: Partial<FrameworkConfig>): FrameworkConfig & T` — merge a patch into framework configuration
- `Framework.isBooted(): boolean` — whether framework has booted
- `Framework.toUri(path: string, params?: Record<string, unknown>, keepEmpty?: Set<string>): string` — convert path + params to URL string
- `Framework.parseUri(url: string): ParsedUri` — parse URL string to path and params
- `Framework.assign<T>(target: T, ...sources: Record<string, unknown>[]): T` — merge source objects into target
- `Framework.keys<T>(src: T): string[]` — get enumerable property keys
- `Framework.nodeInside(node: HTMLElement | string, container: HTMLElement | string): boolean` — check if DOM node is contained within another
- `Framework.ensureNodeId(node: HTMLElement): string` — ensure DOM element has an ID, auto-generate if missing
- `Framework.use(names: string | string[], callback?: (...modules: unknown[]) => void): void` — load modules via configured require
- `Framework.generateId(prefix?: string): string` — generate globally unique identifier
- `Framework.mark(host: object, key: string): () => boolean` — create async callback validity marker
- `Framework.unmark(host: object): void` — invalidate async callback markers
- `Framework.delay(time: number): Promise<void>` — Promise-based setTimeout
- `Framework.dispatchEvent(target: EventTarget, eventType: string, eventInit?: CustomEventInit): void` — fire custom DOM event
- `Framework.task(fn: AnyFunc, args?: unknown[], context?: unknown): void` — execute function in try-catch with chunked scheduling
- `Framework.waitZoneViewsRendered(viewId: string, timeout?: number): Promise<number>` — wait for all views in a zone to be rendered
- `Framework.WAIT_OK: number` — wait result: views rendered successfully
- `Framework.WAIT_TIMEOUT_OR_NOT_FOUND: number` — wait result: timeout or view not found
- `Framework.createEmitter` — emitter factory function
- `Framework.defineView` — view factory function
- `Framework.createCache` — cache factory function
- `Framework.State` — global state singleton
- `Framework.Router` — router singleton
- `Framework.Frame` — frame singleton

### View (view.ts)

Functional view system via `defineView()` + `ViewCtx` + Hooks.

- `defineView(setup: ViewSetup): ViewSetup` — define a view via a setup function (hooks style)
- `createCtx(frame: FrameObj): ViewCtx` — create a ViewCtx for a frame (internal, called by Frame system)
- `mountCtx(frame: FrameObj, setup: ViewSetup, params?: unknown): ViewCtx` — mount a view: create ctx, run setup, register events, render
- `unmountCtx(ctx: ViewCtx): void` — unmount a view: run useEffect cleanups, unregister events, destroy resources, fire destroy, set signature = 0
- `registerEvents(ctx: ViewCtx): void` — parse event method names and register with EventDelegator
- `unregisterEvents(ctx: ViewCtx): void` — unregister all events for a ctx
- `destroyAllResources(ctx: ViewCtx, lastly: boolean): void` — destroy all resources managed by a ctx
- `runInvokes(frame: FrameObj): void` — process deferred invoke calls on a frame

**ViewCtx interface** — passed as the first argument to every view setup function:

```typescript
interface ViewCtx {
  id: string; // View ID (same as owner frame ID)
  owner: FrameObj; // Owner frame reference
  updater: UpdaterApi; // Updater API for data binding
  signature: Ref<number>; // >0 means active, incremented on render, 0 = destroyed
  rendered: Ref<boolean>; // Whether rendered at least once

  // Template access
  getTemplate(): ViewTemplate | VDomTemplate | undefined;
  setTemplate(v: ViewTemplate | VDomTemplate | undefined): void;

  // Location observation
  locationObserved: ViewLocationObserved;
  observeLocation(
    params: string | string[] | Record<string, unknown>,
    observePath?: boolean,
  ): void;

  // State observation
  getObservedStateKeys(): string[] | undefined;
  setObservedStateKeys(v: string[] | undefined): void;
  observeState(keys: string | string[]): void;

  // Resource management
  resources: Record<string, ViewResourceEntry>;
  capture(key: string, resource?: unknown, destroyOnRender?: boolean): unknown;
  release(key: string, destroy?: boolean): unknown;

  // Events
  emitter: EmitterApi;
  getEvents(): Record<string, AnyFunc> | undefined;
  setEvents(v: Record<string, AnyFunc> | undefined): void;
  on(event: string, handler: AnyFunc): () => void;
  off(event: string, handler?: AnyFunc): void;
  fire(
    event: string,
    data?: Record<string, unknown>,
    remove?: boolean,
    lastToFirst?: boolean,
  ): void;

  // Lifecycle
  render(): void;
  init(params?: unknown): void;
  beginUpdate(id?: string): void;
  endUpdate(id?: string, inner?: boolean): void;

  // Async safety
  wrapAsync<Fn extends AnyFunc>(
    fn: Fn,
    context?: unknown,
  ): (...args: Parameters<Fn>) => ReturnType<Fn> | undefined;

  // Navigation guard
  leaveTip(message: string, condition: () => boolean): void;

  // Cleanup functions registered by useEffect
  cleanups: Array<() => void>;

  // Assign function returned by setup
  getAssign(): ((options?: unknown) => boolean | undefined) | undefined;
  setAssign(v: ((options?: unknown) => boolean | undefined) | undefined): void;

  // EndUpdate pending flag
  getEndUpdatePending(): number | undefined;
  setEndUpdatePending(v: number | undefined): void;

  // VDOM (only used when vdom is enabled)
  vdom?: VDomNode;

  // Wrapped render method
  renderMethod?: AnyFunc;
}
```

**ViewSetup type** — the functional API for defining views:

```typescript
type ViewSetup = (
  ctx: ViewCtx,
  params?: unknown,
) => {
  template?: ViewTemplate | VDomTemplate;
  events?: Record<string, AnyFunc>;
  assign?: (options?: unknown) => boolean | undefined;
};
```

### Frame (frame.ts)

View lifecycle management — functional factory + singleton.

- `Frame.get(id: string): FrameObj | undefined` — get frame by ID
- `Frame.getAll(): Map<string, FrameObj>` — get all frames
- `Frame.getRoot(): FrameObj | undefined` — get the root frame
- `Frame.createRoot(rootId?: string): FrameObj` — create (or return) the singleton root frame
- `Frame.on(event: string, handler: AnyFunc): FrameApi` — bind static event listener
- `Frame.off(event: string, handler?: AnyFunc): FrameApi` — unbind static event listener
- `Frame.fire(event: string, data?: Record<string, unknown>): void` — fire static event
- `createFrame(id: string, parentId?: string): FrameObj` — create a frame object (internal, called by mountFrame/createRoot)
- `registerViewClass(viewPath: string, setup: ViewSetup): void` — register a View setup function for a given view path
- `invalidateViewClass(viewPath: string): void` — invalidate a View setup from the registry (used by HMR)

**FrameObj interface** — created by `createFrame()`:

```typescript
interface FrameObj {
  id: string;
  getViewPath(): string | undefined;
  readonly parentId: string | undefined;
  view: ViewCtx | undefined;
  invokeList: FrameInvokeEntry[];
  signature: number;
  destroyed: number;
  hasAltered: number;
  originalTemplate?: string;
  holdFireCreated: number;
  childrenCreated: number;
  childrenAlter: number;
  childrenMap: Record<string, string>;
  childrenCount: number;
  readyCount: number;
  readyMap: Set<string>;
  emitter: EmitterApi;

  mountView(viewPath: string, viewInitParams?: Record<string, unknown>): void;
  unmountView(): void;
  mountFrame(
    frameId: string,
    viewPath: string,
    viewInitParams?: Record<string, unknown>,
  ): FrameObj;
  unmountFrame(id?: string): void;
  mountZone(zoneId?: string): void;
  unmountZone(zoneId?: string): void;
  parent(level?: number): FrameObj | undefined;
  invoke(name: string, args?: unknown[]): unknown;
  children(): string[];
  on(event: string, handler: AnyFunc): FrameObj;
  off(event: string, handler?: AnyFunc): FrameObj;
  fire(event: string, data?: Record<string, unknown>): FrameObj;
}
```

### Router (router.ts)

History/hash routing with two-phase change confirmation.

- `Router.on(event: string, handler: (e?: ChangeEvent) => void): RouterApi` — bind event listener
- `Router.off(event: string, handler?: AnyFunc): RouterApi` — unbind event listener
- `Router.fire(event: string, data?: Record<string, unknown>, remove?: boolean, lastToFirst?: boolean): RouterApi` — fire event
- `Router.parse(href?: string): Location` — parse href into Location object (defaults to window.location.href)
- `Router.diff(): LocationDiff | undefined` — compute diff between current and previous location
- `Router.to(pathOrParams: string | Record<string, unknown>, params?: Record<string, unknown>, replace?: boolean, silent?: boolean): void` — navigate to new URL
- `Router.join(...paths: string[]): string` — join path segments
- `Router.beforeEach(guard: (to: Location, from: Location) => boolean | Promise<boolean>): () => void` — register async-friendly navigation guard
- `Router._bind(): void` — internal: bind hashchange (called by Framework.boot)
- `Router._setConfig(cfg: FrameworkConfig): void` — internal: set framework config
- `Router.notify?(e?: Event): void` — internal: notify hash change (for programmatic trigger)
- `Router.onChange?: (e?: RouteChangeEvent) => void` — triggered when URL is about to change (change phase)
- `Router.onChanged?: (e?: RouteChangedEvent) => void` — triggered after URL has changed (changed phase)
- `markRouterBooted(): void` — mark the Router as booted (called by Framework.boot)
- `getRouteMode(): "history" | "hash"` — get the current routing mode

**Two-phase change protocol**:

1. **change phase** — fires before the URL updates. Listeners can call `e.prevent()` (suspend), `e.reject()` (rollback URL), or `e.resolve()` (commit). If none is called, resolve is the default.
2. **changed phase** — fires after the URL is updated. The framework re-mounts views here.

**Async route guards**:

`Router.beforeEach(async (to, from) => boolean)` registers guards that run in registration order. Any guard returning false, throwing, or rejecting aborts the navigation and reverts the URL.

### State (state.ts)

Observable in-memory data object for cross-view data sharing.

- `State.on(event: string, handler: (e?: ChangeEvent) => void): StateApi` — bind event listener
- `State.off(event: string, handler?: AnyFunc): StateApi` — unbind event listener
- `State.fire(event: string, data?: Record<string, unknown>, remove?: boolean, lastToFirst?: boolean): StateApi` — fire event
- `State.get<T = unknown>(key?: string): T` — get data from state (entire object if key omitted)
- `State.set(data: Record<string, unknown>, excludes?: ReadonlySet<string>): StateApi` — set global state data (must call digest() to notify views)
- `State.digest(data?: Record<string, unknown>, excludes?: ReadonlySet<string>): void` — detect data changes and dispatch changed event
- `State.diff(): ReadonlySet<string>` — get the set of keys changed in the most recent digest
- `State.clean(keys: string): (ctx: { on: (event: string, handler: () => void) => void }) => void` — create a cleanup function for state keys on view destroy
- `State.onChanged?: (e?: ChangeEvent) => void` — lifecycle callback
- `markBooted(): void` — mark framework as booted (called from Framework.boot)

**Usage pattern**: Use State for SIMPLE cross-view data (lightweight shared values: counters, toggles, page title, session info). For COMPLEX reactive state — handlers, derived data, or fine-grained subscriptions — use `createStore` instead.

### Store (store.ts)

Zustand-aligned state management.

- `createStore<T extends object>(name: string, creator: StateCreator<T>): StoreApi<T>` — create a zustand-aligned store
- `computed<T>(deps: readonly string[], fn: () => T): T` — declare a derived (computed) store property
- `bindStore<T>(view: unknown, store: StoreApi<T>, selector?: (state: T) => Record<string, unknown>): () => void` — bind a store to a Lark View (auto-unsubscribes on destroy)

**StoreApi interface**:

```typescript
interface StoreApi<T = object> {
  getState(): T;
  setState(partial: Partial<T> | ((prev: T) => Partial<T>)): void;
  subscribe(listener: (state: T, prevState: T) => void): () => void;
  destroy(): void;
}
```

**Computed properties**: auto-recompute when deps change via setState. Writes to a computed key via setState are silently ignored.

### Service (service.ts)

API request management with caching, deduplication, and queue.

- `createService(syncFn: (payload: PayloadApi, callback: () => void) => void, cacheMax?: number, cacheBuffer?: number): ServiceApi` — create a Service type with a custom request function
- `createPayload(data?: Record<string, unknown>): PayloadApi` — create a Payload (response wrapper)

**ServiceApi interface** (type-level):

```typescript
interface ServiceApi {
  add(attrs: ServiceMetaEntry | ServiceMetaEntry[]): void;
  meta(attrs: string | Record<string, unknown>): ServiceMetaEntry;
  create(attrs: Record<string, unknown>): PayloadApi;
  get(
    attrs: Record<string, unknown>,
    createNew?: boolean,
  ): { entity: PayloadApi; needsUpdate: boolean };
  cached(attrs: Record<string, unknown>): PayloadApi | undefined;
  clear(names: string | string[]): void;
  on(event: string, handler: AnyFunc): void;
  off(event: string, handler?: AnyFunc): void;
  fire(event: string, data?: Record<string, unknown>): void;
  instance(): ServiceInstance;
}
```

**ServiceInstance interface** (instance-level):

```typescript
interface ServiceInstance {
  id: string;
  busy: number;
  destroyed: number;
  emitter: EmitterApi;
  all(
    attrs:
      | string
      | Record<string, unknown>
      | (string | Record<string, unknown>)[],
    done: AnyFunc,
  ): ServiceInstance;
  one(
    attrs:
      | string
      | Record<string, unknown>
      | (string | Record<string, unknown>)[],
    done: AnyFunc,
  ): ServiceInstance;
  save(
    attrs:
      | string
      | Record<string, unknown>
      | (string | Record<string, unknown>)[],
    done: AnyFunc,
  ): ServiceInstance;
  enqueue(callback: AnyFunc): ServiceInstance;
  dequeue(...args: unknown[]): void;
  destroy(): void;
  on(event: string, handler: AnyFunc): ServiceInstance;
  off(event: string, handler?: AnyFunc): ServiceInstance;
  fire(event: string, data?: Record<string, unknown>): ServiceInstance;
}
```

**PayloadApi interface**:

```typescript
interface PayloadApi {
  get<T = unknown>(key: string): T;
  set(
    keyOrData: string | Record<string, unknown> | ServiceMetaEntry,
    value?: unknown,
  ): PayloadApi;
  data: Record<string, unknown>;
  cacheInfo?: ServiceCacheInfo;
}
```

**Service features**: LFU caching with configurable TTL, request deduplication (in-flight requests are shared), serial queuing (enqueue/dequeue for sequential async operations), lifecycle events (begin/done/fail/end), endpoint metadata (name, url, cache, before/after hooks, cleanKeys).

### Hooks (hooks.ts)

Hooks runtime for the functional view system.

- `useState<T>(key: string, initial: T): [() => T, (v: T) => void]` — declare view-local state backed by ctx.updater.data
- `useEffect(fn: () => (() => void) | void, deps?: unknown[]): void` — register a side effect with optional cleanup
- `useStore<T extends Record<string, unknown>>(store: StoreApi<T>, selector?: (s: T) => Partial<T>): () => Partial<T>` — bind a store to the view's updater
- `useInterval(fn: () => void, delay: number): void` — set up an interval that is automatically cleared on view destroy
- `useTimeout(fn: () => void, delay: number): void` — set up a timeout that is automatically cleared on view destroy
- `useResource(key: string, resource: unknown, destroyOnRender?: boolean): void` — capture a resource with automatic cleanup
- `useEvent(event: string, handler: AnyFunc): void` — register an event handler on the view's internal emitter
- `setCurrentCtx(ctx: ViewCtx | null): void` — set the current ctx (internal, called by mountCtx)

**Key difference from React hooks**: Lark's setup runs ONCE (not on every render). `useState` returns a `[getter, setter]` pair where the getter always reads from `ctx.updater.data` — avoiding stale closures.

### Updater (updater.ts)

Per-view data binding with change detection and DOM diff.

- `createUpdater(viewId: string): UpdaterApi` — create an Updater for per-view data binding

**UpdaterApi interface**:

```typescript
interface UpdaterApi {
  get<T = unknown>(key?: string): T;
  set(
    data: Record<string, unknown>,
    excludes?: ReadonlySet<string>,
  ): UpdaterApi;
  digest(
    data?: Record<string, unknown>,
    excludes?: ReadonlySet<string>,
    callback?: () => void,
  ): void;
  forceDigest(): void;
  snapshot(): UpdaterApi;
  altered(): boolean | undefined;
  refData: Record<string, unknown>;
  translate(data: unknown): unknown;
  parse(expr: string): unknown;
  getChangedKeys(): ReadonlySet<string>;
}
```

**Digest cycle**: set data → track changed keys → call template function → diff DOM (string or VDOM mode) → apply mutations → endUpdate (remount child frames).

### VDOM (vdom.ts)

Virtual DOM engine for VDOM-mode rendering pipeline.

- `vdomCreate(tag: string | number, props?: Record<string, unknown> | string | number | null, children?: VDomNode[] | string | number | null, specials?: Record<string, string>): VDomNode` — create a virtual DOM node
- `createVDomRef(viewId: string): VDomRef` — create an empty VDomRef for tracking diff operations
- `vdomSetChildNodes(realNode: Element, lastVDom: VDomNode | undefined, newVDom: VDomNode, ref: VDomRef, frame: FrameObj, keys: ReadonlySet<string>, view: ViewCtx, ready: () => void): void` — diff children of a real DOM parent against old and new VDOM trees

**Three-phase diff algorithm**:

1. **Head fast-path** — match identical nodes from the start (no DOM moves)
2. **Tail fast-path** — match identical nodes from the end (no DOM moves)
3. **KeyMap reconciliation** — build a compareKey → node index, compute the Longest Increasing Subsequence (LIS) to minimize DOM moves, then insert/move/remove remaining nodes

**VDomNode interface**:

```typescript
interface VDomNode {
  tag: string | number; // tag name for elements, 0 (V_TEXT_NODE) for text, SPLITTER for raw HTML
  html: string; // inner HTML (serialized children for elements, text content for text nodes)
  attrs?: string; // serialized opening tag with attributes
  attrsMap?: Record<string, unknown>; // attribute key-value map
  attrsSpecials?: Record<string, string>; // attribute names that are set as DOM properties
  hasSpecials?: Record<string, string> | undefined; // original specials argument
  children?: VDomNode[] | undefined; // child VDomNode array
  compareKey?: string | undefined; // diff key: from id, #, or v-lark path
  reused?: Record<string, number> | undefined; // keyed children count map
  reusedTotal?: number; // total count of keyed children
  views?: [string, string, string, Record<string, string>][] | undefined; // sub-view references
  selfClose?: boolean; // whether self-closing
  isLarkView?: string | undefined; // sub-view path if this node hosts a v-lark view
}
```

### DOM (dom.ts)

Real-DOM diff engine for string-mode rendering pipeline.

- `domGetNode(html: string, refNode: Element): Element` — parse HTML string into a DOM element (handles special elements like table, SVG, MathML)
- `domSetChildNodes(oldParent: Element, newParent: Element, ref: DomRef, frame: FrameObj, keys?: ReadonlySet<string>): void` — set child nodes from new parent onto old parent using keyed diff algorithm
- `domSetNode(oldNode: ChildNode, newNode: ChildNode, oldParent: Element, ref: DomRef, frame: FrameObj, keys?: ReadonlySet<string>): void` — diff two DOM nodes and apply changes
- `domSetAttributes(oldNode: Element, newNode: Element, ref: DomRef, keepId?: boolean): void` — set attributes from new element onto old element
- `domGetCompareKey(node: ChildNode): string | undefined` — get compare key for a DOM node (for keyed diff)
- `domSpecialDiff(oldNode: ChildNode, newNode: ChildNode): number` — special diff for form elements (value, checked, selected)
- `domUnmountFrames(frame: FrameObj, node: ChildNode): void` — unmount child Frames contained within a DOM node before it's removed
- `createDomRef(): DomRef` — create an empty DomRef for tracking diff operations
- `applyDomOps(ops: DomOp[]): void` — apply a batch of DOM mutation operations
- `applyIdUpdates(updates: [Element, string][]): void` — apply element ID changes deferred during the diff

**Keyed diff algorithm**: builds a keyedNodes map from old children (bucketed by compareKey), then walks new children trying to reuse old nodes by key. Unmatched old nodes are removed; unmatched new nodes are appended.

### Event Emitter (event-emitter.ts)

Multi-cast event emitter (functional factory).

- `createEmitter<T = unknown>(): EmitterApi<T>` — create a multi-cast event emitter

**EmitterApi interface**:

```typescript
interface EmitterApi<T = unknown> {
  on(name: string, fn: (e?: ChangeEvent) => void): EmitterApi<T>;
  off(name: string, fn?: AnyFunc): EmitterApi<T>;
  fire(
    name: string,
    data?: Record<string, unknown>,
    remove?: boolean,
    lastToFirst?: boolean,
  ): EmitterApi<T>;
}
```

**Features**: re-entrant safety (handlers can detach themselves without breaking iteration), onEventName convention (if the emitter object has a method named on{EventName}, fire() will automatically call it).

### Event Delegator (event-delegator.ts)

DOM event delegation system.

- `EventDelegator.bind(eventType: string, hasSelector?: boolean): void` — register interest in an event type on document.body (reference counting)
- `EventDelegator.unbind(eventType: string, hasSelector?: boolean): void` — deregister interest in an event type from document.body
- `EventDelegator.clearRangeEvents(viewId: string): void` — remove all range-event registrations for a destroyed view
- `EventDelegator.setFrameGetter(getter: (id: string) => FrameObj | undefined): void` — inject the Frame lookup function (called by Framework.boot)
- `EventDelegator.nextElementGuid(): number` — allocate the next element GUID for range-event tagging

**Handler naming convention**:

| Syntax                     | Meaning                                           |
| -------------------------- | ------------------------------------------------- |
| `handler<click>`           | Event on the view's root element                  |
| `$selector<click>`         | Delegated to child elements matching .selector    |
| `$<click>`                 | Empty selector — fires only at the Frame boundary |
| `$window<resize>`          | Delegated to window                               |
| `$document<keydown>`       | Delegated to document                             |
| `handler<click,mousedown>` | Multi-event binding                               |
| `name<click><ctrl>`        | Fires only when the Ctrl modifier is held         |

### Cache (cache.ts)

LFU-style bounded cache with frequency-based eviction (functional factory).

- `createCache<T = unknown>(options?: CacheOptions<T>): CacheApi<T>` — create an LFU-style bounded cache

**CacheApi interface**:

```typescript
interface CacheApi<T = unknown> {
  set(key: string, resource: T): void;
  get(key: string): T | undefined;
  del(key: string): void;
  has(key: string): boolean;
  clear(): void;
  forEach(callback: (value: T | undefined) => void): void;
  getSize(): number;
}
```

**CacheOptions interface**:

```typescript
interface CacheOptions<T> {
  maxSize?: number; // Maximum cache size before eviction triggers (default: 20)
  bufferSize?: number; // Buffer size for eviction (default: 5)
  onRemove?: (key: string) => void; // Callback when entry is removed
  sortComparator?: (a: CacheEntry<T>, b: CacheEntry<T>) => number; // Comparator for sorting entries
}
```

**Eviction strategy**: single-pass partial selection (O(n\*k)) instead of sorting the entire array (O(n log n)). For the typical bufferSize = 5, this is effectively a linear scan with at most 5 in-bucket comparisons per iteration.

### HMR (hmr.ts)

Hot Module Replacement for Lark MVC views.

- `reloadViews(viewPath: string): void` — legacy full-remount HMR: unmounts and re-mounts every frame matching the given view path (destroys ViewCtx and all view-local state)
- `hotSwapView(frame: FrameObj, newSetup: ViewSetup): void` — hot-swap a single frame's view setup in place, preserving the ViewCtx
- `hotSwapFrames(viewPath: string, newSetup: ViewSetup): void` — batch hot-swap every frame matching viewPath with newSetup
- `hotSwapByTemplate(oldTemplate: ViewTemplate, newTemplate: ViewTemplate): void` — template-only HMR: find every mounted view whose template function matches oldTemplate, replace it with newTemplate, and force-render
- `hotSwapByView(oldSetup: ViewSetup, newSetup: ViewSetup): void` — view setup HMR: update the view-registry and hot-swap every frame using oldSetup with newSetup
- `acceptView(hot: HotContext, viewPath: string): void` — manual HMR accept handler for a view module
- `disposeView(hot: HotContext, viewPath: string): void` — manual HMR dispose handler for a view module

**State preservation strategy**: hotSwapView preserves the entire ViewCtx — updater.data, resources, emitter, signature, id, and owner all stay the same. It runs old useEffect cleanups, unregisters old events, destroys destroyOnRender resources, re-runs newSetup(ctx) against the same ctx, updates template/events/assign, registers new events, increments signature, fires render, destroys transient resources, and calls updater.forceDigest().

**Two HMR layers**:

1. **Template layer** (.html changes): hotSwapByTemplate(old, new) finds every mounted view whose template function matches the old reference, replaces it, and force-renders.
2. **View setup layer** (.ts changes): hotSwapByView(old, new) updates the view-registry and calls hotSwapFrames(viewPath, newSetup) which runs hotSwapView on every matching frame.

### HMR Inject (hmr-inject.ts)

HMR injection code generator — shared across Vite, Webpack, and Rspack.

- `injectTemplateHmrSnippet(source: string, bundler: Bundler): string` — append HMR code to a compiled template module source
- `injectViewHmr(source: string, bundler: Bundler): string` — transform a .ts view file source to add view class HMR
- `importsHtmlTemplate(source: string): boolean` — quick check: does this .ts source import a .html template?

**Bundler type**: `"vite" | "webpack" | "rspack"`

**Auto-injection**: The bundler plugins auto-inject HMR boilerplate at compile time. Users never need to write import.meta.hot or module.hot themselves.

### Compiler (compiler.ts, compiler/\*.ts)

Build-time template compilation.

- `compileTemplate(source: string, options?: CompileOptions): Promise<string>` — compile an HTML template string into a JS module string (main entry point for Vite and Webpack loaders)
- `extractGlobalVars(source: string): Promise<string[]>` — extract global variable names from a template source using AST analysis

**CompileOptions interface**:

```typescript
interface CompileOptions {
  debug?: boolean; // Enable debug mode with line tracking (default: false)
  globalVars?: string[]; // Global variable names to destructure from $$ (refData)
  file?: string; // File path for debug error messages (default: undefined)
  vdom?: boolean; // Generate VDOM output instead of HTML string (default: false)
}
```

**Compilation pipeline**:

1. `protectComments()` — preserve HTML comments
2. `convertArtSyntax()` — {{}} to <% %> internal syntax
3. `processViewEvents()` — @event attribute encoding
4. `restoreComments()` — restore HTML comments
5. `extractGlobalVars()` — AST-based variable auto-detection
6. `compileToFunction()` or `compileToVDomFunction()` — <% %> to JS template function
7. ES module output — exports default \_\_larkTemplate

**Template syntax**:

| Syntax                                         | Description                                 |
| ---------------------------------------------- | ------------------------------------------- |
| `{{=variable}}`                                | escaped output                              |
| `{{:variable}}`                                | two-way binding (same as = for rendering)   |
| `{{!variable}}`                                | raw output (no HTML escaping)               |
| `{{@variable}}`                                | reference lookup for component data passing |
| `{{forOf list as item}}`                       | loop                                        |
| `{{forOf list as item idx}}`                   | loop with index                             |
| `{{forIn obj as val key}}`                     | object iteration                            |
| `{{for(let i=0;i<n;i++)}}`                     | generic for loop                            |
| `{{if condition}}`                             | conditional                                 |
| `{{else if condition}}`                        | else-if                                     |
| `{{else}}`                                     | else                                        |
| `{{/if}} / {{/forOf}} / {{/forIn}} / {{/for}}` | close blocks                                |
| `{{set a = b}}`                                | variable declaration                        |

### Runtime (runtime.ts)

Template runtime helpers.

- `strSafe` — null-safe String(value) — null/undefined become ""
- `encHtml` — HTML-escape a value for safe embedding in markup
- `encUri` — percent-encode a value, with extra characters escaped for stricter URIs
- `encQuote` — backslash-escape quotes and backslashes for attribute string contents
- `refFn` — look up (or assign) a stable refData token for an object value

These helpers are imported by compiled templates from `@lark.js/mvc/runtime` instead of inlining the implementations, keeping each compiled .html module small.

### Vite Plugin (vite.ts)

Vite plugin for template compilation.

- `larkMvcPlugin(options?: LarkMvcVitePluginOptions): Plugin` — create a Vite plugin that compiles .html template files
- `larkMvcPluginLegacy(options?: { debug?: boolean; vdom?: boolean }): Plugin` — legacy Vite plugin (no HMR injection)
- `larkMvcPlugin7(options?: { debug?: boolean; vdom?: boolean }): Plugin7` — Vite 7 compatibility
- `larkMvcPluginLegacy7(options?: { debug?: boolean; vdom?: boolean }): Plugin7` — legacy Vite 7 compatibility

**LarkMvcVitePluginOptions interface**:

```typescript
interface LarkMvcVitePluginOptions {
  debug?: boolean; // Enable debug mode with line tracking (default: false)
  vdom?: boolean; // Enable virtual DOM output (default: false)
}
```

### Webpack Loader (webpack.ts)

Webpack loader for template compilation.

- `larkMvcLoader(options?: { debug?: boolean; vdom?: boolean }): LoaderDefinitionFunction` — create a Webpack loader that compiles .html template files

### Rspack Loader (rspack.ts)

Rspack loader for template compilation.

- `larkMvcLoader(options?: { debug?: boolean; vdom?: boolean }): LoaderDefinitionFunction` — create an Rspack loader that compiles .html template files

### Devtool (devtool.ts)

Frame Devtool Bridge for browser extension support.

- `installFrameDevtoolBridge(): void` — install a postMessage listener so the Lark DevTool browser extension can inspect the frame tree

### Mark (mark.ts)

Async callback validity tracking.

- `mark(host: object, key: string): () => boolean` — create an async callback validity marker (returns a check function; if host object is unmarked, check function returns false)
- `unmark(host: object): void` — invalidate async callback markers for a host object

### URL State (url-state.ts)

URL state hook for syncing view state with URL params.

- `useUrlState<S extends Record<string, string>>(view: ViewCtx, initialState?: S): [Readonly<S>, (patch: Partial<S> | ((prev: S) => Partial<S>)) => void]` — sync view state with URL query parameters

### Module Loader (module-loader.ts)

Async view loading via FrameworkConfig.require or dynamic import.

- `config: FrameworkConfig` — framework configuration (shared mutable state)
- `use(names: string | string[], callback?: (...modules: unknown[]) => void): Promise<unknown[]>` — load modules via the configured require function or dynamic import fallback

### View Registry (view-registry.ts)

View setup registry: viewPath -> ViewSetup function.

- `getViewClass(path: string): ViewSetup | undefined` — look up a previously registered View setup function by path
- `registerViewClass(viewPath: string, setup: ViewSetup): void` — register a View setup function for a given view path
- `invalidateViewClass(viewPath: string): void` — invalidate a View setup from the registry (used by HMR)
- `getViewClassRegistry(): Record<string, ViewSetup>` — get the full view setup registry (for HMR / debugging)

### Constants (common.ts)

Framework shared constants and encoding helpers.

- `SPLITTER: string` — internal splitter character (U+001E Record Separator)
- `RouterEvents: { CHANGE: string; CHANGED: string; PAGE_UNLOAD: string }` — router event name constants
- `LARK_VIEW: string` — attribute name: "v-lark"
- `EVENT_METHOD_REGEXP: RegExp` — view event method regex
- `VIEW_EVENT_METHOD_REGEXP: RegExp` — view event method name regex
- `URL_TRIM_HASH_REGEXP: RegExp` — URL query/hash trim regexp
- `URL_TRIM_QUERY_REGEXP: RegExp` — URL trim query regexp (before hash)
- `URL_PARAM_REGEXP: RegExp` — URL param key-value regexp
- `IS_URL_PARAMS: RegExp` — URL params test regexp
- `URL_QUERY_HASH_REGEXP: RegExp` — URL query/hash trim regexp for path extraction
- `SVG_NS: string` — SVG namespace
- `MATH_NS: string` — MathML namespace
- `TAG_NAME_REGEXP: RegExp` — tag name regexp for I_GetNode
- `CALL_BREAK_TIME: number` — async task break time (ms)
- `V_TEXT_NODE: number` — VDOM text node tag value (number 0, falsy)
- `VDOM_NS_MAP: Record<string, string>` — namespace map for SVG/MathML element creation in VDOM mode
- `nextCounter(): number` — increment global counter and return new value
- `strSafe(v: unknown): string` — null-safe String(v)
- `encodeHTML(v: unknown): string` — HTML-escape a value for safe embedding in markup
- `encodeURIExtra(v: unknown): string` — URI-encode a value with extra character escaping
- `encodeQuote(v: unknown): string` — backslash-escape quotes and backslashes for attribute string contents
- `refFn(ref: Record<string, unknown>, value: unknown, key: string): string` — template reference function for creating stable keys for objects
- `isRefToken(s: string): boolean` — check if a string is a refData reference token

### Utilities (utils.ts)

Framework utility functions.

- `callFunction<T extends unknown[]>(fn: (...args: T) => void, args: T): void` — schedule a task for deferred execution (time-sliced batches)
- `isPlainObject(value: unknown): value is Record<string, unknown>` — check if value is a plain object
- `isRecord(value: unknown): value is Record<string, unknown>` — check if value is a record
- `asRecord(value: unknown): Record<string, unknown>` — convert value to record
- `isPrimitiveOrFunc(value: unknown): boolean` — check if value is primitive or function
- `isPrimitive(value: unknown): boolean` — check if value is primitive
- `generateId(prefix?: string): string` — generate a unique ID with optional prefix
- `noop(): void` — no-operation function
- `hasOwnProperty<T extends object>(owner: T | undefined | null, prop: PropertyKey): boolean` — safe hasOwnProperty check
- `keys<T extends object>(obj: T): string[]` — get object keys (own enumerable)
- `assign<T extends object>(target: T, ...sources: Partial<T>[]): T` — assign properties from sources to target
- `funcWithTry(fns: AnyFunc | AnyFunc[], args: unknown[], context: unknown, configError?: (e: unknown) => void): unknown` — execute functions in try-catch, ignoring errors
- `EMPTY_STRING_SET: ReadonlySet<string>` — shared empty Set used as default value
- `setData(newData: Record<string, unknown>, oldData: Record<string, unknown>, changedKeys: Set<string>, excludes: ReadonlySet<string>): boolean` — set newData into oldData, tracking changed keys
- `translateData(data: object, value: unknown): unknown` — translate compiled refData references back to their original values
- `getById(id: string | Element | null): Element | null` — get element by ID, or return the element itself if already an element
- `getAttribute(element: Element, attr: string): string` — get attribute from element safely
- `ensureElementId(element: HTMLElement, prefix?: string): string` — ensure element has an ID, generating one if missing
- `nodeInside(a: string | HTMLElement, b: string | HTMLElement): boolean` — check if node A is inside node B (or is the same node)
- `parseUri(uri: string): ParsedUri` — parse URI string into path and params object
- `toUri(path: string, params: Record<string, unknown>, keepEmpty?: ReadonlySet<string>): string` — convert path and params to URI string
- `toMap<T>(list: T[] | null | undefined, key?: keyof T): Record<string, T | number>` — convert array to map/hash object

## Framework configuration

**FrameworkConfig interface**:

```typescript
interface FrameworkConfig {
  rootId: string; // Root element ID (default: "root")
  routeMode?: "history" | "hash"; // Routing mode (default: "history")
  defaultView?: string; // Default view path when URL doesn't match any route
  defaultPath?: string; // Default path when URL hash is empty (default: "/")
  routes?: Record<string, string | RouteViewConfig>; // Route mapping: path -> view
  hashbang?: string; // Hashbang prefix (only used in hash mode, default: "#!")
  error?: (error: Error) => void; // Global error handler
  extensions?: string[]; // Extension view paths to load during app startup
  initModule?: string; // Init module to load
  rewrite?: (
    path: string,
    params: Record<string, string>,
    routes: Record<string, string>,
  ) => string; // Rewrite function for routes
  unmatchedView?: string; // View path to use when no matching view is found in routes (404)
  require?: (
    names: string[],
    params?: Record<string, unknown>,
  ) => Promise<unknown[]> | undefined; // Module require function for asynchronous view loading
  skipViewRendered?: boolean; // Skip view rendered check
  projectName?: string; // Project name of the current application (for micro-frontend bridge)
  vdom?: boolean; // Enable VDOM rendering mode (default: false)
  devtool?: boolean; // Enable Frame Devtool Bridge (default: true)
}
```

**RouteViewConfig interface**:

```typescript
interface RouteViewConfig {
  view: string; // View path
  [k: string]: unknown; // Additional properties merged into location
}
```

## View lifecycle flow

```
mountView(viewPath)
       |
   createCtx(frame)
       |
   setCurrentCtx(ctx)
       |
   setup(ctx, params)
       |
   +-- hooks: useState, useEffect, useStore, ...
       |
   setCurrentCtx(null)
       |
   wire template / events / assign
       |
   signature.value = 1
       |
   frame.view = ctx
       |
   registerEvents(ctx)
       |
   ctx.render() --> updater.digest() --> DOM diff --> endUpdate()
```

**On unmount**:

```
unmountView()
       |
   run useEffect cleanups (reverse order)
       |
   unregisterEvents(ctx)
       |
   destroyAllResources(ctx, true)
       |
   fire("destroy")
       |
   EventDelegator.clearRangeEvents(ctx.id)
       |
   signature.value = 0
```

## Template syntax reference

**Output operators**:

| Syntax      | Description                                            |
| ----------- | ------------------------------------------------------ |
| `{{=expr}}` | HTML-escaped output (safe for embedding in markup)     |
| `{{:expr}}` | Two-way binding (same as = for rendering)              |
| `{{!expr}}` | Raw output (no HTML escaping, use with caution)        |
| `{{@expr}}` | Reference lookup for passing JS objects to child views |

**Control flow**:

```html
{{if user.isAdmin}}
<div class="admin-panel">Welcome, admin</div>
{{else if user.isEditor}}
<div class="editor-panel">Welcome, editor</div>
{{else}}
<div class="user-panel">Welcome, user</div>
{{/if}}
```

**Loops**:

```html
<!-- forOf: array iteration -->
{{forOf items as item index}}
<div class="item" id="item-{{=index}}">{{=index}}: {{=item.name}}</div>
{{/forOf}}

<!-- forOf with first/last helpers -->
{{forOf items as item index last first}}
<div class="{{if first}}first{{/if}}{{if last}}last{{/if}}">{{=item.name}}</div>
{{/forOf}}

<!-- forOf with destructuring -->
{{forOf entries as {key, value} index}}
<div>{{=key}}: {{=value}}</div>
{{/forOf}}

<!-- forIn: object iteration -->
{{forIn config as val key}}
<div>{{=key}} = {{=val}}</div>
{{/forIn}}

<!-- for: generic loop -->
{{for(let i = 0; i < count; i++)}}
<span>{{=i}}</span>
{{/for}}
```

**Variable declaration**:

```html
{{set formattedDate = new Date(date).toLocaleDateString()}}
<p>Date: {{=formattedDate}}</p>
```

**Event binding**:

```html
<!-- Direct handler -->
<button @click="handleClick()">Click me</button>

<!-- With parameters -->
<button @click="deleteItem({id: item.id})">Delete</button>

<!-- Multiple events -->
<input @input,change="validate()" />

<!-- With modifiers -->
<button @click<ctrl>="specialAction()">Ctrl+Click</button>
```

## Build pipeline

```
.html source
    |
protectComments()      -- preserve HTML comments
    |
convertArtSyntax()     -- {{}} to <% %> internal syntax
    |
processViewEvents()    -- @event attribute encoding
    |
restoreComments()      -- restore HTML comments
    |
extractGlobalVars()    -- AST-based variable auto-detection (@babel/parser)
    |
compileToFunction()    -- <% %> to JS template function (string mode)
    or
compileToVDomFunction() -- <% %> to VDomNode tree builder (VDOM mode, htmlparser2)
    |
ES module output       -- exports default __larkTemplate
    |
injectTemplateHmrSnippet() -- append HMR code (auto-injected by bundler plugin)
```

**String mode output**:

```javascript
import {
  encHtml as __larkEncHtml,
  strSafe as __larkStrSafe,
  encUri as __larkEncUri,
  encQuote as __larkEncQuote,
  refFn as __larkRefFn,
} from "@lark.js/mvc/runtime";
function __larkTemplate(data, viewId, refData) {
  let $data = data || {},
    $viewId = viewId || "";
  return ((
    $data,
    $viewId,
    $refAlt,
    $encHtml,
    $strSafe,
    $encUri,
    $refFn,
    $encQuote,
  ) => {
    // ... compiled template logic ...
  })(
    $data,
    $viewId,
    refData,
    __larkEncHtml,
    __larkStrSafe,
    __larkEncUri,
    __larkRefFn,
    __larkEncQuote,
  );
}
export default __larkTemplate;
```

**VDOM mode output**:

```javascript
import { vdomCreate as __larkVdomCreate } from "@lark.js/mvc";
import {
  strSafe as __larkStrSafe,
  encUri as __larkEncUri,
  encQuote as __larkEncQuote,
  refFn as __larkRefFn,
} from "@lark.js/mvc/runtime";
function __larkTemplate(data, viewId, refData) {
  let $data = data || {},
    $viewId = viewId || "",
    $vdomCreate = __larkVdomCreate,
    $strSafe = __larkStrSafe;
  return (($data, $viewId, $refAlt, $strSafe, $refFn, $encUri, $encQuote) => {
    // ... compiled VDOM template logic ...
  })(
    $data,
    $viewId,
    refData,
    $strSafe,
    __larkRefFn,
    __larkEncUri,
    __larkEncQuote,
  );
}
export default __larkTemplate;
```

## Operational guidance

### Bundler configuration

**Vite** (recommended):

```typescript
import { defineConfig } from "vite";
import { larkMvcPlugin } from "@lark.js/mvc/vite";

export default defineConfig({
  plugins: [larkMvcPlugin({ debug: false, vdom: false })],
});
```

**Webpack**:

```javascript
const { larkMvcLoader } = require("@lark.js/mvc/webpack");

module.exports = {
  module: {
    rules: [
      {
        test: /\.html$/,
        use: larkMvcLoader({ debug: false, vdom: false }),
      },
    ],
  },
};
```

**Rspack**:

```javascript
const { larkMvcLoader } = require("@lark.js/mvc/rspack");

module.exports = {
  module: {
    rules: [
      {
        test: /\.html$/,
        use: larkMvcLoader({ debug: false, vdom: false }),
      },
    ],
  },
};
```

### Rendering mode selection

**String mode** (default, `vdom: false`):

- Real-DOM diff via innerHTML + keyed comparison
- Faster for most use cases
- Simpler mental model
- Recommended for new projects

**VDOM mode** (`vdom: true`):

- Three-phase diff with LIS reconciliation
- Better for complex, deeply nested component trees
- Minimizes DOM moves via Longest Increasing Subsequence
- Use when you need fine-grained control over DOM mutations

### State management strategy

**Use State for**:

- Simple cross-view data (counters, toggles, page title, session info)
- Lightweight shared values
- Global application state that doesn't require handlers or derived data

**Use createStore for**:

- Complex reactive state
- Handlers and actions
- Derived (computed) data
- Fine-grained subscriptions
- Store-internal reactions
- Multi-instance isolation

### Routing configuration

**History mode** (default):

```typescript
Framework.boot({
  routeMode: "history",
  routes: {
    "/": "views/home",
    "/users": "views/users",
    "/users/:id": "views/user-detail",
  },
});
```

**Hash mode**:

```typescript
Framework.boot({
  routeMode: "hash",
  hashbang: "#!",
  routes: {
    "/": "views/home",
    "/users": "views/users",
  },
});
```

**Navigation guards**:

```typescript
const unGuard = Router.beforeEach(async (to, from) => {
  if (to.path === "/admin") {
    const isAuthenticated = await checkAuth();
    return isAuthenticated; // false aborts navigation
  }
  return true;
});

// Later: unGuard() to remove the guard
```

### Micro-frontend support

**Module Federation integration**:

```typescript
Framework.boot({
  rootId: "root",
  projectName: "host-app",
  require(names, params) {
    return Promise.all(
      names.map((name) => {
        if (name.startsWith("remote-app/")) {
          return import("remote_app/" + name.slice("remote-app/".length));
        }
        return import("./src/" + name);
      }),
    );
  },
  routes: {
    "/": "host-app/views/home",
    "/remote": "remote-app/views/detail",
  },
});
```

### HMR configuration

**Auto-injection** (recommended):

The bundler plugins auto-inject HMR boilerplate at compile time. Users never need to write import.meta.hot or module.hot themselves.

**Manual HMR** (if needed):

```typescript
import { acceptView, disposeView } from "@lark.js/mvc";

// In a view .ts file:
const viewPath = "src/views/home";
disposeView(import.meta.hot, viewPath);
acceptView(import.meta.hot, viewPath);
```

## Common pitfalls and how to handle them

1. **Stale closures in event handlers**: Unlike React, Lark's setup runs ONCE. Use `useState` getter/setter pairs to avoid stale closures. The getter always reads from `ctx.updater.data`.

2. **Forgetting to call digest()**: After calling `ctx.updater.set()`, you must call `ctx.updater.digest()` to trigger a re-render. Or use `useState` setter which calls digest automatically.

3. **Template compilation errors**: The compiler uses @babel/parser for AST-based variable extraction. If you see "Cannot find variable X", check that the variable is passed to the template via `ctx.updater.set()` or is a global (like `Math`, `Date`, etc.).

4. **Route navigation not working**: Ensure you've called `Router._bind()` (done automatically by `Framework.boot()`). Check that your routes are configured correctly and that the view path exists in the registry.

5. **HMR not preserving state**: HMR preserves ViewCtx (updater.data, resources, emitter, signature) but not the setup function's local variables. Move state to `useState` or a store to preserve it across HMR.

6. **Memory leaks from event listeners**: Always use `ctx.on()` instead of direct `addEventListener`. The framework automatically cleans up listeners registered via `ctx.on()` when the view is destroyed.

7. **Async callbacks executing after view destroy**: Use `ctx.wrapAsync(fn)` to wrap async callbacks. The wrapped function only executes if the view is still alive (signature > 0 and hasn't changed).

8. **DOM diff mismatches**: If you see unexpected DOM mutations, check that your template produces consistent HTML structure. The keyed diff algorithm relies on stable `id` attributes or `v-lark` paths.

9. **VDOM mode performance**: VDOM mode is opt-in for a reason. For most use cases, string mode (real-DOM diff) is faster. Only enable VDOM mode if you have complex, deeply nested component trees that benefit from LIS reconciliation.

10. **Template variable extraction**: The compiler uses AST analysis to extract variables. If a variable is not detected, you can manually specify it via the `globalVars` option in `CompileOptions`.

## Quick recipes

### Basic view with state

```typescript
import { defineView, useState } from "@lark.js/mvc";
import template from "./counter.html";

export default defineView((ctx, params) => {
  const [getCount, setCount] = useState("count", 0);

  return {
    template,
    events: {
      "increment<click>"() {
        setCount(getCount() + 1);
      },
      "decrement<click>"() {
        setCount(getCount() - 1);
      },
    },
  };
});
```

```html
<!-- counter.html -->
<div class="counter">
  <p>Count: {{=count}}</p>
  <button @click="decrement()">-</button>
  <button @click="increment()">+</button>
</div>
```

### View with store

```typescript
import { defineView, useStore } from "@lark.js/mvc";
import { counterStore } from "../stores/counter";
import template from "./counter.html";

export default defineView((ctx, params) => {
  const getState = useStore(counterStore, (s) => ({
    count: s.count,
    doubled: s.doubled,
  }));

  return {
    template,
    events: {
      "increment<click>"() {
        counterStore.getState().increment();
      },
    },
  };
});
```

### View with URL state

```typescript
import { defineView, useUrlState } from "@lark.js/mvc";
import template from "./list.html";

export default defineView((ctx, params) => {
  const [state, setState] = useUrlState(ctx, { page: "1", size: "20" });

  ctx.updater.set({ page: state.page, size: state.size }).digest();

  return {
    template,
    events: {
      "nextPage<click>"() {
        setState((prev) => ({ page: String(Number(prev.page) + 1) }));
      },
    },
  };
});
```

### View with API service

```typescript
import { defineView, createService } from "@lark.js/mvc";
import template from "./user.html";

const userService = createService(
  (payload, callback) => {
    const url = payload.get("url");
    fetch(url)
      .then((res) => res.json())
      .then((result) => {
        payload.set("result", result);
        callback();
      })
      .catch((err) => {
        payload.set("error", err);
        callback();
      });
  },
  20,
  5,
);

userService.add({
  name: "getUser",
  url: "/api/user",
  cache: 30000,
  before(payload) {
    const id = payload.get("id");
    payload.set("url", `/api/user/${id}`);
  },
});

export default defineView((ctx, params) => {
  const service = userService.instance();
  ctx.capture("userService", service);

  return {
    template,
    events: {
      "loadUser<click>"() {
        service.all([{ name: "getUser", id: "123" }], (errors, payload) => {
          ctx.updater.set({ user: payload.get("result") }).digest();
        });
      },
    },
  };
});
```

### View with navigation guard

```typescript
import { defineView, Router } from "@lark.js/mvc";
import template from "./admin.html";

export default defineView((ctx, params) => {
  useEffect(() => {
    const unGuard = Router.beforeEach(async (to, from) => {
      if (to.path === "/admin") {
        return await checkAuth();
      }
      return true;
    });

    return () => unGuard();
  });

  return { template };
});
```

### View with cross-view state

```typescript
import { defineView, State } from "@lark.js/mvc";
import template from "./header.html";

export default defineView((ctx, params) => {
  ctx.observeState("user,title");
  State.clean("user,title")(ctx);

  ctx.updater
    .set({
      user: State.get("user"),
      title: State.get("title"),
    })
    .digest();

  return { template };
});
```

### Embedded child views

```html
<!-- parent.html -->
<div class="parent">
  <h1>Parent View</h1>
  <div v-lark="views/child?id={{=itemId}}"></div>
</div>
```

```typescript
// parent.ts
import { defineView, useState } from "@lark.js/mvc";
import template from "./parent.html";

export default defineView((ctx, params) => {
  const [getItemId, setItemId] = useState("itemId", "123");

  return {
    template,
    events: {
      "changeItem<click>"() {
        setItemId("456");
      },
    },
  };
});
```

The child view is automatically mounted when the parent renders. When `itemId` changes, the child view is re-mounted with the new params.
