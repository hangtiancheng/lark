# API reference

Complete type signatures for every public export from `@lark.js/mvc`.

## Table of contents

- [Framework](#framework)
- [defineView](#defineview)
- [ViewCtx](#viewctx)
- [Hooks](#hooks)
- [createStore](#createstore)
- [State](#state)
- [Router](#router)
- [useUrlState](#useurlstate)
- [Frame](#frame)
- [view-registry](#view-registry)
- [createService](#createservice)
- [createEmitter](#createemitter)
- [createCache](#createcache)
- [createUpdater](#createupdater)
- [EventDelegator](#eventdelegator)
- [HMR](#hmr)
- [CrossSite](#crosssite)
- [VDOM](#vdom)
- [mark and unmark](#mark-and-unmark)
- [use (module loader)](#use-module-loader)
- [Devtool bridge](#devtool-bridge)
- [Compiler](#compiler)
- [Template runtime](#template-runtime)
- [Constants](#constants)
- [Build integrations](#build-integrations)
- [Types](#types)

## Framework

The main entry point singleton. Import via `import { Framework } from "@lark.js/mvc"`.

### Framework.boot(config)

Start the application. Steps in order: merge config, inject into Router, set EventDelegator frame getter, bind Router/State CHANGED events, mark booted, install devtool bridge, create root frame, bind Router, mount default view.

```ts
Framework.boot(config: FrameworkConfig): void
```

### Framework.getConfig() / Framework.getConfig(key)

Read framework configuration. Without arguments, returns the full config object. With a key, returns that key's value.

```ts
Framework.getConfig(): FrameworkConfig
Framework.getConfig<T = unknown>(key: string): T | undefined
```

### Framework.setConfig(patch)

Merge a patch into the framework configuration. Returns the merged config.

```ts
Framework.setConfig<T extends object = Partial<FrameworkConfig>>(
  patch: Partial<FrameworkConfig> & T,
): FrameworkConfig & T
```

### Framework.isBooted()

```ts
Framework.isBooted(): boolean
```

### Framework.toUri(path, params?, keepEmpty?)

Build a URL from a path and params object.

```ts
Framework.toUri(
  path: string,
  params?: Record<string, unknown>,
  keepEmpty?: Set<string>,
): string
```

### Framework.parseUri(url)

Parse a URL string into `{ path, params }`.

```ts
Framework.parseUri(url: string): ParsedUri
```

### Framework.assign(target, ...sources)

Merge source object properties into target. Like `Object.assign` but safer.

```ts
Framework.assign<T extends object>(
  target: T,
  ...sources: Record<string, unknown>[]
): T
```

### Framework.keys(src)

Return own enumerable keys as a string array.

```ts
Framework.keys<T extends object>(src: T): string[]
```

### Framework.nodeInside(node, container)

Check if `node` is contained within `container`. Both accept a DOM element or an ID string. Returns `true` when both nodes are the same.

```ts
Framework.nodeInside(
  node: HTMLElement | string,
  container: HTMLElement | string,
): boolean
```

### Framework.ensureNodeId(element)

Ensure a DOM element has an `id` attribute. Generates `l_<n>` if missing. Returns the resulting ID.

```ts
Framework.ensureNodeId(element: HTMLElement): string
```

### Framework.generateId(prefix?)

Generate a globally unique ID. Default prefix is `"lark_"`.

```ts
Framework.generateId(prefix?: string): string
```

### Framework.mark(host, key) / Framework.unmark(host)

Async callback validity tracking. `mark` returns a checker function that returns `true` while the mark is valid. `unmark` invalidates all checkers for the host. State lives in a module-level `WeakMap`, so nothing is written to the host object.

```ts
Framework.mark(host: object, key: string): () => boolean
Framework.unmark(host: object): void
```

### Framework.dispatchEvent(target, type, init?)

Fire a custom DOM event on a target.

```ts
Framework.dispatchEvent(
  target: EventTarget,
  type: string,
  init?: CustomEventInit,
): void
```

### Framework.task(fn, args?, context?)

Queue a function for time-sliced execution. Uses `scheduler.postTask("background")`, then `requestIdleCallback`, then `setTimeout(0)` as fallback. Tasks run in chunks with a 48 ms budget.

```ts
Framework.task(fn: AnyFunc, args?: unknown[], context?: unknown): void
```

### Framework.delay(time)

Promise-wrapped `setTimeout`.

```ts
Framework.delay(time: number): Promise<void>
```

### Framework.use(names, callback?)

Load modules through the configured `FrameworkConfig.require`, or via dynamic `import()` if `require` is not set.

```ts
Framework.use(
  names: string | string[],
  callback?: (...modules: unknown[]) => void,
): void
```

### Framework.waitZoneViewsRendered(viewId, timeout?)

Wait for every view inside `viewId` to finish rendering. Resolves to `WAIT_OK` (1) or `WAIT_TIMEOUT_OR_NOT_FOUND` (0). Timeout defaults to 30 000 ms.

```ts
Framework.waitZoneViewsRendered(viewId: string, timeout?: number): Promise<number>
```

### Framework.WAIT_OK / Framework.WAIT_TIMEOUT_OR_NOT_FOUND

Return constants from `waitZoneViewsRendered`.

| Name                        | Value | Meaning                    |
| --------------------------- | ----- | -------------------------- |
| `WAIT_OK`                   | 1     | All views rendered in time |
| `WAIT_TIMEOUT_OR_NOT_FOUND` | 0     | Timeout or zone not found  |

### Framework module accessors

| Property                  | Description      |
| ------------------------- | ---------------- |
| `Framework.Router`        | Router singleton |
| `Framework.State`         | State singleton  |
| `Framework.Frame`         | Frame singleton  |
| `Framework.defineView`    | View factory     |
| `Framework.createCache`   | Cache factory    |
| `Framework.createEmitter` | Emitter factory  |

## defineView

Define a view via a setup function. The setup function runs once on mount, receives a `ViewCtx`, and returns `{ template, events, assign? }`.

```ts
function defineView(setup: ViewSetup): ViewSetup;

type ViewSetup = (
  ctx: ViewCtx,
  params?: unknown,
) => {
  template?: ViewTemplate | VDomTemplate;
  events?: Record<string, AnyFunc>;
  assign?: (options?: unknown) => boolean | undefined;
};
```

```ts
const HomeView = defineView((ctx, params) => {
  ctx.updater.set({ title: "Home" });
  return {
    template,
    events: { "goHome<click>": () => Router.to("/home") },
  };
});
```

## ViewCtx

The context object passed to every view setup function. No `this` binding. All methods are closures.

### Properties

| Property           | Type                                | Description                                      |
| ------------------ | ----------------------------------- | ------------------------------------------------ |
| `id`               | `string`                            | View ID (same as owner frame ID)                 |
| `owner`            | `FrameObj`                          | Owner frame reference                            |
| `updater`          | `UpdaterApi`                        | Data binding and DOM diff                        |
| `signature`        | `Ref<number>`                       | `>0` active, `0` = destroyed                     |
| `rendered`         | `Ref<boolean>`                      | Whether rendered at least once                   |
| `resources`        | `Record<string, ViewResourceEntry>` | Resource map                                     |
| `cleanups`         | `Array<() => void>`                 | Cleanup functions (useEffect)                    |
| `emitter`          | `EmitterApi`                        | Internal emitter for lifecycle events            |
| `locationObserved` | `ViewLocationObserved`              | Location observation config                      |
| `renderMethod?`    | `AnyFunc`                           | Custom render function (replaces default digest) |
| `vdom?`            | `VDomNode`                          | Last rendered VDOM tree                          |

### Methods

| Method                                                                    | Description                                                                                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `getTemplate()` / `setTemplate(v)`                                        | Access the compiled template function                                                                              |
| `getEvents()` / `setEvents(v)`                                            | Access the events map                                                                                              |
| `getAssign()` / `setAssign(v)`                                            | Access the assign function                                                                                         |
| `getObservedStateKeys()` / `setObservedStateKeys(v)`                      | Access observed State keys                                                                                         |
| `getEndUpdatePending()` / `setEndUpdatePending(v)`                        | Internal update-zone flag                                                                                          |
| `render()`                                                                | Increment signature, fire "render" event, destroy render-once resources, call `renderMethod` or `updater.digest()` |
| `init(params?)`                                                           | No-op hook (params are passed to setup directly)                                                                   |
| `beginUpdate(id?)`                                                        | Notify that HTML for `id` is about to change                                                                       |
| `endUpdate(id?, inner?)`                                                  | Re-mount frames in the zone, flush deferred invokes                                                                |
| `wrapAsync(fn, context?)`                                                 | Wrap an async callback with a signature check                                                                      |
| `observeLocation(params, observePath?)`                                   | Watch URL params and/or path                                                                                       |
| `observeState(keys)`                                                      | Watch State keys                                                                                                   |
| `capture(key, resource?, destroyOnRender?)`                               | Register a resource for automatic cleanup                                                                          |
| `release(key, destroy?)`                                                  | Manually release a captured resource                                                                               |
| `leaveTip(message, condition)`                                            | Prompt the user before navigation when `condition()` returns true                                                  |
| `on(event, handler)` / `off(event, handler?)` / `fire(event, data?, ...)` | Emitter passthrough                                                                                                |

## Hooks

All hooks must be called inside a setup function. They access the current `ViewCtx` via a module-level `currentCtx` set by `mountCtx`.

### useState(key, initial)

Declare view-local state backed by `ctx.updater.data`. Returns a `[getter, setter]` pair. The getter always reads the latest value, avoiding stale closures.

```ts
function useState<T>(key: string, initial: T): [() => T, (v: T) => void];
```

### useEffect(fn, deps?)

Register a side effect with optional cleanup. The effect runs immediately during setup. If it returns a cleanup function, that cleanup runs on view destroy or HMR re-setup.

```ts
function useEffect(fn: () => (() => void) | void, deps?: unknown[]): void;
```

### useStore(store, selector?)

Bind a store to the view's updater. Auto-unsubscribes on view destroy.

```ts
function useStore<T extends Record<string, unknown>>(
  store: StoreApi<T>,
  selector?: (s: T) => Partial<T>,
): () => Partial<T>;
```

### useInterval(fn, delay) / useTimeout(fn, delay)

Lifecycle-managed wrappers for `setInterval` and `setTimeout`.

```ts
function useInterval(fn: () => void, delay: number): void;
function useTimeout(fn: () => void, delay: number): void;
```

### useResource(key, resource, destroyOnRender?)

Capture a resource with automatic cleanup.

```ts
function useResource(
  key: string,
  resource: unknown,
  destroyOnRender?: boolean,
): void;
```

### useEvent(event, handler)

Register an event handler on the view's internal emitter. Auto-unregistered on destroy.

```ts
function useEvent(event: string, handler: AnyFunc): void;
```

## createStore

Zustand-aligned state management. Import via `import { createStore, computed, bindStore } from "@lark.js/mvc"`.

### createStore(name, creator)

Define a store. The creator receives `set` and `get` and returns the initial state object. Functions become actions, `computed(deps, fn)` entries become derived state, everything else becomes plain state.

```ts
function createStore<T extends Record<string, unknown>>(
  name: string,
  creator: (set: SetFn<T>, get: () => T) => T,
): StoreApi<T>;

type SetFn<T> = (partial: Partial<T> | ((prev: T) => Partial<T>)) => void;
```

### StoreApi

| Method         | Description                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `getState()`   | Read the current state snapshot                                                                                           |
| `setState(p)`  | Shallow-merge `p` (or `p(prev)`) into state. Computed and action keys are skipped. Listeners fire only when a key changes |
| `subscribe(l)` | Register a listener `(state, prevState) => void`. Returns an unsubscribe function                                         |
| `destroy()`    | Mark destroyed, clear listeners, remove from the global registry                                                          |

### computed(deps, fn)

Declare a derived property inside a `createStore` creator. `fn` re-evaluates when any dep key changes via `setState`.

```ts
function computed<T>(deps: readonly string[], fn: () => T): T;
```

### bindStore(ctx, store, selector?)

Bind a store to a Lark ViewCtx. Subscribes to state changes and pipes them into `ctx.updater`. Auto-unsubscribes on view destroy.

```ts
function bindStore<T extends Record<string, unknown>>(
  ctx: ViewCtx,
  store: StoreApi<T>,
  selector?: (state: T) => Record<string, unknown>,
): () => void;
```

## State

Global singleton for cross-view observable data. Import via `import { State } from "@lark.js/mvc"`. Use State for lightweight shared values (page title, login state, theme). For complex reactive state with actions and derived data, use `createStore`.

### State.get(key?)

Read state. Without `key`, returns the entire state object.

```ts
State.get<T = unknown>(key?: string): T
```

### State.set(data, excludes?)

Write data and track changed keys. Call `State.digest()` afterwards to fire the `changed` event.

```ts
State.set(
  data: Record<string, unknown>,
  excludes?: ReadonlySet<string>,
): typeof State
```

### State.digest(data?, excludes?)

Trigger change notification. If `data` is supplied, runs `set(data, excludes)` first. Fires `changed` with `{ type: "changed", keys: ReadonlySet<string> }`.

```ts
State.digest(
  data?: Record<string, unknown>,
  excludes?: ReadonlySet<string>,
): void
```

### State.diff()

Return the set of keys changed in the most recent digest.

```ts
State.diff(): ReadonlySet<string>
```

### State.clean(keys)

Create a cleanup function that decrements per-key reference counts on the view's destroy. Keys with zero refs are removed from state.

```ts
State.clean(keys: string): (ctx: { on: (event: string, handler: () => void) => void }) => void
```

```ts
export default defineView((ctx) => {
  State.clean("user,token")(ctx);
  return { template, events: {} };
});
```

### State events

State is an `EventEmitter`. `on`/`off`/`fire` are available.

| Event     | Payload                                          |
| --------- | ------------------------------------------------ |
| `changed` | `{ type: "changed", keys: ReadonlySet<string> }` |

## Router

Hash or history router with two-phase change confirmation. Import via `import { Router } from "@lark.js/mvc"`.

### Router.parse(href?)

Parse a URL into `Location`. Defaults to `window.location.href`. Results are cached.

```ts
Router.parse(href?: string): Location
```

### Router.diff()

Compare last and current Locations. Returns the `LocationDiff` or `undefined` if no navigation has occurred yet.

```ts
Router.diff(): LocationDiff | undefined
```

### Router.to(pathOrParams, params?, replace?, silent?)

Programmatic navigation.

```ts
Router.to(
  pathOrParams: string | Record<string, unknown>,
  params?: Record<string, unknown>,
  replace?: boolean,
  silent?: boolean,
): void
```

- `Router.to("/list", { page: 2 })` — set both path and params
- `Router.to({ page: 2 })` — params only, keep current path
- `replace = true` — replace the history entry instead of pushing
- `silent = true` — update URL without firing the `changed` event

### Router.beforeEach(guard)

Register an async navigation guard. Guards run in registration order. Any guard that returns `false`, throws, or rejects aborts the navigation and reverts the URL. Returns an unsubscribe function.

```ts
Router.beforeEach(
  guard: (to: Location, from: Location) => boolean | Promise<boolean>,
): () => void
```

### Router.join(...paths)

Join path segments, collapsing `./`, `../`, and `//`.

```ts
Router.join(...paths: string[]): string
```

### Router.on / off / fire

Router is an `EventEmitter`.

```ts
Router.on(event: string, handler: (e?: ChangeEvent) => void): typeof Router
Router.off(event: string, handler?: AnyFunc): typeof Router
Router.fire(event: string, data?: Record<string, unknown>, remove?: boolean): typeof Router
```

### Router events

| Event         | Phase             | Payload                                                      |
| ------------- | ----------------- | ------------------------------------------------------------ |
| `change`      | Before navigation | `RouteChangeEvent` with `prevent()`, `reject()`, `resolve()` |
| `changed`     | After navigation  | `RouteChangedEvent` (a `LocationDiff`)                       |
| `page_unload` | Before unload     | Set `data.msg` to surface a browser confirmation prompt      |

The `change` event handler may call `e.prevent()` (pause), `e.reject()` (revert), or `e.resolve()` (commit). If none is called, the Router auto-resolves (or runs `beforeEach` guards first).

### Location

```ts
interface Location {
  href: string;
  srcQuery: string;
  srcHash: string;
  query: ParsedUri;
  hash: ParsedUri;
  params: Record<string, string>;
  view?: string;
  path?: string;
  get(key: string, defaultValue?: string): string;
}

interface ParsedUri {
  path: string;
  params: Record<string, string>;
}
```

### Routing mode

Configured via `FrameworkConfig.routeMode`. `"history"` (default) uses `history.pushState` / `popstate`. `"hash"` uses the URL hash with a `#!` prefix.

## useUrlState

Sync view state with URL query parameters. Import via `import { useUrlState } from "@lark.js/mvc"`.

```ts
function useUrlState<S extends Record<string, string>>(
  ctx: ViewCtx,
  initialState?: S,
): [Readonly<S>, (patch: Partial<S> | ((prev: S) => Partial<S>)) => void];
```

Returns a `[state, setState]` tuple. Reads URL params into a state object and provides a `setState` function that writes back to the URL via `Router.to()`. Automatically calls `ctx.observeLocation(keys)` so the view re-renders when the URL changes.

```ts
const [state, setState] = useUrlState(ctx, { page: "1", size: "20" });
setState({ page: "2" });
setState((prev) => ({ page: String(Number(prev.page) + 1) }));
```

## Frame

Runtime tree of view containers. Each Frame owns one `ViewCtx` and zero or more child Frames. Import via `import { Frame, createFrame } from "@lark.js/mvc"`.

### Frame singleton (static API)

| Method                 | Signature                                                 |
| ---------------------- | --------------------------------------------------------- |
| `get(id)`              | `(id: string) => FrameObj \| undefined`                   |
| `getAll()`             | `() => Map<string, FrameObj>`                             |
| `getRoot()`            | `() => FrameObj \| undefined`                             |
| `createRoot(rootId?)`  | `(rootId?: string) => FrameObj`                           |
| `on(event, handler)`   | `(event: string, handler: AnyFunc) => Frame`              |
| `off(event, handler?)` | `(event: string, handler?: AnyFunc) => Frame`             |
| `fire(event, data?)`   | `(event: string, data?: Record<string, unknown>) => void` |

`Frame.createRoot` is idempotent. `Framework.boot` calls it.

Static events: `add`, `remove`. Payload: `{ frame: FrameObj }`.

### createFrame(id, parentId?)

Create an independent Frame instance. Use for micro-frontend or embedded widget scenarios.

```ts
function createFrame(id: string, parentId?: string): FrameObj;
```

### FrameObj properties

| Property           | Type                     | Description                           |
| ------------------ | ------------------------ | ------------------------------------- |
| `id`               | `string`                 | DOM id this frame is bound to         |
| `parentId`         | `string \| undefined`    | Parent frame id                       |
| `view`             | `ViewCtx \| undefined`   | Current view context                  |
| `signature`        | `number`                 | Async-op tracking counter             |
| `destroyed`        | `number`                 | Destroy flag                          |
| `childrenMap`      | `Record<string, string>` | Child frame ids                       |
| `childrenCount`    | `number`                 | Number of children                    |
| `readyCount`       | `number`                 | Children that have fired `created`    |
| `readyMap`         | `Set<string>`            | Ready child ids                       |
| `invokeList`       | `FrameInvokeEntry[]`     | Deferred invokes pending render       |
| `emitter`          | `EmitterApi`             | Instance emitter                      |
| `holdFireCreated`  | `number`                 | Suppress `created` during batch mount |
| `childrenCreated`  | `number`                 | All children have fired `created`     |
| `childrenAlter`    | `number`                 | Children entered an alter cycle       |
| `hasAltered`       | `number`                 | Original template has been replaced   |
| `originalTemplate` | `string \| undefined`    | Saved innerHTML before alter          |

### FrameObj methods

| Method                                        | Description                                                    |
| --------------------------------------------- | -------------------------------------------------------------- |
| `getViewPath()`                               | Current mounted view path                                      |
| `mountView(viewPath, params?)`                | Mount a view (sync if registered, async via `use()` otherwise) |
| `unmountView()`                               | Destroy the current view, restore original template            |
| `mountFrame(frameId, viewPath, params?)`      | Create or reuse a child Frame, then mount the view             |
| `unmountFrame(id?)`                           | Unmount a child Frame                                          |
| `mountZone(zoneId?)` / `unmountZone(zoneId?)` | Batch mount/unmount all `v-lark` child nodes in a zone         |
| `parent(level?)`                              | Walk `level` ancestors up (default 1)                          |
| `invoke(name, args?)`                         | Call a view method. Queued if view not yet rendered            |
| `children()`                                  | Array of child Frame ids                                       |
| `on(event, handler)` / `off` / `fire`         | Instance emitter                                               |

### Frame instance events

| Event     | Description                    |
| --------- | ------------------------------ |
| `created` | All child frames have rendered |
| `alter`   | A child frame changed content  |

## view-registry

Global registry of `viewPath` to `ViewSetup` functions.

```ts
import {
  registerViewClass,
  invalidateViewClass,
  getViewClassRegistry,
} from "@lark.js/mvc"

registerViewClass(viewPath: string, setup: ViewSetup): void
invalidateViewClass(viewPath: string): void
getViewClassRegistry(): Record<string, ViewSetup>
```

The internal `getViewClass(path)` is not exported. It is used by `Frame.mountView` to look up registered setups.

## createService

API request layer with LFU cache, deduplication, and serial queue. Import via `import { createService, createPayload } from "@lark.js/mvc"`.

### createService(syncFn, cacheMax?, cacheBuffer?)

Create a service with its own per-type closure state (`metaList`, `payloadCache`, `pendingCacheKeys`, `syncFn`, `staticEmitter`). Endpoints registered on one service never leak into another.

```ts
function createService(
  syncFn: (payload: PayloadApi, callback: () => void) => void,
  cacheMax?: number, // default 20
  cacheBuffer?: number, // default 5
): ServiceApi;
```

### ServiceApi

| Method     | Signature                                                             |
| ---------- | --------------------------------------------------------------------- |
| `add`      | `(attrs: ServiceMetaEntry \| ServiceMetaEntry[]) => void`             |
| `meta`     | `(attrs: string \| Record<string, unknown>) => ServiceMetaEntry`      |
| `create`   | `(attrs: Record<string, unknown>) => PayloadApi`                      |
| `get`      | `(attrs, createNew?) => { entity: PayloadApi; needsUpdate: boolean }` |
| `cached`   | `(attrs) => PayloadApi \| undefined`                                  |
| `clear`    | `(names: string \| string[]) => void`                                 |
| `instance` | `() => ServiceInstance`                                               |
| `on`       | `(event, handler) => void`                                            |
| `off`      | `(event, handler?) => void`                                           |
| `fire`     | `(event, data?) => void`                                              |

Static lifecycle events: `begin`, `done`, `fail`, `end`. Payload: `ServiceEvent` with `payload` and `error`.

### ServiceInstance

| Method                | Behavior                                                                              |
| --------------------- | ------------------------------------------------------------------------------------- |
| `all(attrs, done)`    | Fetch all endpoints. Callback receives `(errors, p1, p2, ...)` when all complete      |
| `one(attrs, done)`    | Fetch all endpoints. Callback fires per-endpoint as `(error, payload, isLast, index)` |
| `save(attrs, done)`   | Like `all` but always bypasses cache                                                  |
| `enqueue(callback)`   | Queue a task for serial execution                                                     |
| `dequeue(...args)`    | Run the next queued task                                                              |
| `destroy()`           | Mark destroyed. No further callbacks run                                              |
| `on` / `off` / `fire` | Instance emitter (separate from the static one)                                       |

`attrs` may be a string (endpoint name), a `Record<string, unknown>` (params), or an array combining the two.

### createPayload(data?)

Create a Payload wrapping API response data.

```ts
function createPayload(data?: Record<string, unknown>): PayloadApi;

interface PayloadApi {
  get<T = unknown>(key: string): T;
  set(keyOrData: string | Record<string, unknown>, value?: unknown): PayloadApi;
  data: Record<string, unknown>;
  cacheInfo?: ServiceCacheInfo;
}
```

### ServiceMetaEntry

```ts
interface ServiceMetaEntry {
  name: string;
  url: string;
  cache?: number; // TTL in ms. 0 = no cache
  before?(payload: PayloadApi): void;
  after?(payload: PayloadApi): void;
  cleanKeys?: string; // comma-separated names whose cache is cleared on completion
  [k: string]: unknown;
}
```

## createEmitter

Multi-cast emitter with re-entrant safety. Import via `import { createEmitter } from "@lark.js/mvc"`.

```ts
function createEmitter<T = unknown>(): EmitterApi<T>;

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

Re-entrant guarantees: handlers may `off()` themselves during dispatch without skipping siblings. Removed handlers are replaced with `noop` and compacted once the outermost `fire()` returns.

## createCache

LFU cache with frequency and timestamp eviction. Single-pass partial-selection on overflow.

```ts
function createCache<T = unknown>(options?: CacheOptions<T>): CacheApi<T>;

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

| Option           | Default | Description                          |
| ---------------- | ------- | ------------------------------------ |
| `maxSize`        | 20      | Max entries before eviction triggers |
| `bufferSize`     | 5       | Entries evicted per overflow cycle   |
| `onRemove`       | -       | Callback when an entry is removed    |
| `sortComparator` | -       | Custom sort for eviction selection   |

## createUpdater

Per-view data binder. Each `ViewCtx` has an `updater` property created by `createUpdater`. Import standalone via `import { createUpdater } from "@lark.js/mvc"`.

```ts
function createUpdater(viewId: string): UpdaterApi;

interface UpdaterApi {
  get<T = unknown>(key?: string): T;
  set(
    data: Record<string, unknown>,
    excludes?: ReadonlySet<string>,
  ): UpdaterApi;
  digest(data?, excludes?, callback?): void;
  forceDigest(): void;
  snapshot(): UpdaterApi;
  altered(): boolean | undefined;
  refData: Record<string, unknown>;
  translate(data: unknown): unknown;
  parse(expr: string): unknown;
  getChangedKeys(): ReadonlySet<string>;
}
```

| Method                                | Description                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| `get(key?)`                           | Read data. Without key, returns the entire data object                                       |
| `set(data, excludes?)`                | Shallow-merge data and track changed keys. Returns `this` for chaining                       |
| `digest(data?, excludes?, callback?)` | Run the template function, diff DOM, apply mutations. Supports re-entry via `digestingQueue` |
| `forceDigest()`                       | Mark all data keys as changed and trigger a digest. Used by HMR to apply a new template      |
| `snapshot()`                          | Record the current monotonic version                                                         |
| `altered()`                           | Return whether the version has bumped since `snapshot()`. `undefined` if never snapshotted   |
| `translate(value)`                    | Resolve a refData reference token to its original JS value                                   |
| `parse(expr)`                         | CSP-safe path resolver. Accepts dotted paths (`a.b.c`) or numeric literals. No `eval`        |
| `getChangedKeys()`                    | Set of keys that changed since the last digest                                               |
| `refData`                             | Mutable record storing refData entries                                                       |

## EventDelegator

Module-level singleton. Delegates DOM events to `document.body` using capture-phase listeners.

```ts
EventDelegator.bind(eventType: string, hasSelector?: boolean): void
EventDelegator.unbind(eventType: string, hasSelector?: boolean): void
EventDelegator.clearRangeEvents(viewId: string): void
EventDelegator.setFrameGetter(getter: (id: string) => FrameObj | undefined): void
```

Reference-counted: first binding adds the listener, last unbinding removes it. At dispatch time, the delegator walks from `event.target` up to `document.body`, finds the owning Frame, and looks up handlers via `ctx.getEvents()["handlerName<eventType>"]`.

## HMR

Zero-config hot module replacement for Vite, Webpack, and Rspack. Import via `import { ... } from "@lark.js/mvc"`.

### Runtime functions

| Function                            | Description                                                            |
| ----------------------------------- | ---------------------------------------------------------------------- |
| `hotSwapByTemplate(old, new)`       | Swap template on all matching views. Preserves state                   |
| `hotSwapByView(oldSetup, newSetup)` | Swap setup on all matching views. Updates registry, preserves state    |
| `hotSwapView(frame, newSetup)`      | Re-run setup on a single frame. Preserves `ViewCtx` and `updater.data` |
| `hotSwapFrames(viewPath, newSetup)` | Batch `hotSwapView` by viewPath                                        |
| `reloadViews(viewPath)`             | Legacy full-remount. Destroys ctx, loses state                         |
| `acceptView(hot, viewPath)`         | Set up HMR accept handler                                              |
| `disposeView(hot, viewPath)`        | Set up HMR dispose handler                                             |

```ts
function hotSwapByTemplate(
  oldTemplate: ViewTemplate,
  newTemplate: ViewTemplate,
): void;
function hotSwapByView(oldSetup: ViewSetup, newSetup: ViewSetup): void;
function hotSwapView(frame: FrameObj, newSetup: ViewSetup): void;
function hotSwapFrames(viewPath: string, newSetup: ViewSetup): void;
function reloadViews(viewPath: string): void;
function acceptView(hot: HotContext, viewPath: string): void;
function disposeView(hot: HotContext, viewPath: string): void;
```

### Injection functions

Exported from `@lark.js/mvc` and also available from `@lark.js/mvc/hmr-inject`.

| Function                                    | Description                                          |
| ------------------------------------------- | ---------------------------------------------------- |
| `injectTemplateHmrSnippet(source, bundler)` | Append template HMR snippet to compiled output       |
| `injectViewHmr(source, bundler)`            | Rewrite `export default` and append view HMR snippet |
| `importsHtmlTemplate(source)`               | Check if source imports a `.html` file               |

### HotContext

```ts
interface HotContext {
  accept(cb?: (mod: { default?: unknown } | undefined) => void): void;
  dispose(cb: (data: unknown) => void): void;
  invalidate(): void;
}

type Bundler = "vite" | "webpack" | "rspack";
```

## CrossSite

Micro-frontend bridge view for Module Federation. Default export from `@lark.js/mvc`.

```ts
import { CrossSite, resetProjectsMap, registerViewClass } from "@lark.js/mvc";

registerViewClass("cross-site", CrossSite);
```

In templates: `v-lark="cross-site?view=remote-app/views/home&bizCode=my_biz"`.

Parameters:

- **`view`**: remote view path (required)
- **`bizCode`**: passed to the remote `prepare` function
- **`skeleton`**: optional HTML for the loading state (default `"Loading..."`)

CrossSite renders a skeleton, loads the remote `prepare` module via `use("projectName/prepare")`, then loads and mounts the actual remote view via `ctx.owner.mountFrame()`. Uses a signature counter to abort stale loads if the user navigates away during async loading.

`resetProjectsMap()` clears the per-project config cache.

## VDOM

Virtual DOM types and functions. Used when `FrameworkConfig.virtualDom` is `true`.

```ts
import { vdomCreate, createVDomRef } from "@lark.js/mvc";
```

### vdomCreate(tag, props?, children?, specials?)

Create a `VDomNode`. The compiled VDOM template calls this for every element and text node.

```ts
function vdomCreate(
  tag: string | number,
  props?: Record<string, unknown> | number | null,
  children?: VDomNode[] | number | null,
  specials?: Record<string, string>,
): VDomNode;
```

- **Text node**: `tag=0`, `html=text content`
- **Raw HTML**: `tag=SPLITTER`, `html=raw string`
- **Element**: serializes opening tag, builds `attrsMap`, detects `v-lark` sub-views, extracts `compareKey`
- **Self-closing**: when `children === 1`

### createVDomRef(viewId)

Create a `VDomRef` for tracking VDOM diff operations.

```ts
function createVDomRef(viewId: string): VDomRef;
```

### VDomNode

```ts
interface VDomNode {
  tag: string | number;
  html: string;
  attrs?: string;
  attrsMap?: Record<string, unknown>;
  attrsSpecials?: Record<string, string>;
  hasSpecials?: Record<string, string> | undefined;
  children?: VDomNode[] | undefined;
  compareKey?: string | undefined;
  reused?: Record<string, number> | undefined;
  reusedTotal?: number;
  views?: [string, string, string, Record<string, string>][] | undefined;
  selfClose?: boolean;
  isLarkView?: string | undefined;
}
```

## mark and unmark

Async callback validity tracking. Import via `import { mark, unmark } from "@lark.js/mvc"`.

```ts
function mark(host: object, key: string): () => boolean;
function unmark(host: object): void;
```

`mark` returns a checker that returns `true` while the mark is valid. `unmark` invalidates all checkers for the host. State lives in a module-level `WeakMap`.

## use (module loader)

Load modules through the configured `FrameworkConfig.require`, or via dynamic `import()` if `require` is not set.

```ts
import { use, config as frameworkConfig } from "@lark.js/mvc";

function use(
  names: string | string[],
  callback?: (...modules: unknown[]) => void,
): Promise<unknown[]>;
```

When `FrameworkConfig.require` is configured, `use` delegates to it. This is the bridge to Webpack Module Federation. When `require` is not set, `use` falls back to dynamic `import()` for ESM-based loading.

## Devtool bridge

`postMessage` bridge for the Lark Devtool panel.

```ts
import { installFrameDevtoolBridge } from "@lark.js/mvc/devtool";
```

`installFrameDevtoolBridge()` is called automatically by `Framework.boot`. It installs a `message` listener that responds to:

- `LARK_DEVTOOL_PING` with `LARK_DEVTOOL_PONG`
- `LARK_DEVTOOL_REQUEST_TREE` with `LARK_DEVTOOL_TREE` (a serialized Frame tree snapshot)

Also pushes `LARK_DEVTOOL_TREE_DELTA` to `window.parent` on Frame `add`/`remove` when running in an iframe.

## Compiler

Build-time only. Imported by the Vite plugin and Webpack/Rspack loaders.

```ts
import { compileTemplate, extractGlobalVars } from "@lark.js/mvc/compiler";
```

### compileTemplate(source, options?)

Compile an `.html` template into an ES module string.

```ts
function compileTemplate(
  source: string,
  options?: {
    debug?: boolean;
    globalVars?: string[];
    file?: string;
    virtualDom?: boolean;
  },
): string;
```

The output imports runtime helpers from `@lark.js/mvc/runtime` and exports a default function `(data, viewId, refData) => string` (or `=> VDomNode` when `virtualDom: true`).

### extractGlobalVars(source)

AST-based extraction of variable names referenced by the template. Uses `@babel/parser`. Returns an array of variable names that need to be destructured from `$data`.

```ts
function extractGlobalVars(source: string): Promise<string[]>;
```

## Template runtime

Available at `@lark.js/mvc/runtime`. The compiler emits imports from this module in every compiled template.

```ts
import {
  strSafe,
  encHtml,
  encUri,
  encQuote,
  refFn,
} from "@lark.js/mvc/runtime";
```

| Function            | Description                                                       |
| ------------------- | ----------------------------------------------------------------- |
| `strSafe(v)`        | Null-safe `toString`. `null`/`undefined` become `""`              |
| `encHtml(v)`        | HTML entity encoding. `& < > " ' backtick` become entities        |
| `encUri(v)`         | `encodeURIComponent` plus extra encoding for `! ' ( ) *`          |
| `encQuote(v)`       | Escapes `' " \` for safe embedding in attribute values            |
| `refFn(ref, value)` | Finds or allocates a SPLITTER-prefixed key in refData for a value |

## Constants

Exported from the main entry.

| Name                       | Value                                     |
| -------------------------- | ----------------------------------------- |
| `SPLITTER`                 | `"\x1e"`                                  |
| `LARK_VIEW`                | `"v-lark"`                                |
| `CALL_BREAK_TIME`          | `48`                                      |
| `ROUTER_EVENTS`            | `{ CHANGE, CHANGED, PAGE_UNLOAD }`        |
| `TAG_NAME_REGEXP`          | `/<([a-z][^/\0>\x20\t\r\n\f]+)/i`         |
| `EVENT_METHOD_REGEXP`      | Parse `viewId\x1ehandlerName(params)`     |
| `VIEW_EVENT_METHOD_REGEXP` | `/^(\$?)([\w]*)<(.*?)>(?:<([\w ,]*)>)?$/` |
| `nextCounter()`            | Increment global counter                  |

## Build integrations

### Vite

```ts
import { larkMvcPlugin } from "@lark.js/mvc/vite"

larkMvcPlugin(options?: {
  debug?: boolean
  virtualDom?: boolean
}): Plugin
```

Registers at `enforce: "pre"`. Tags `.html` imports with `?lark-template`, then compiles them in the `load` hook.

### Webpack

```ts
import { larkMvcLoader } from "@lark.js/mvc/webpack";
```

Standard webpack loader signature. Uses `this.callback()` for async delivery.

```js
{
  test: /\.html$/,
  use: [{ loader: larkMvcLoader, options: { debug: true } }],
  exclude: /index\.html$/,
}
```

### Rspack

```ts
import { LarkMvcPlugin } from "@lark.js/mvc/rspack";
```

Rspack plugin that auto-registers the loader rule. The loader returns a Promise directly (Rspack async loader convention).

```js
export default {
  plugins: [new LarkMvcPlugin({ virtualDom: true })],
};
```

## Types

All types are re-exported from the main entry via `export * from "./types"`.

### FrameworkConfig

```ts
interface FrameworkConfig {
  rootId: string;
  routeMode?: "history" | "hash";
  defaultView?: string;
  defaultPath?: string;
  routes?: Record<string, string | RouteViewConfig>;
  hashbang?: string;
  error?: (error: Error) => void;
  extensions?: string[];
  initModule?: string;
  rewrite?: (
    path: string,
    params: Record<string, string>,
    routes: Record<string, string>,
  ) => string;
  unmatchedView?: string;
  require?: (
    names: string[],
    params?: Record<string, unknown>,
  ) => Promise<unknown[]> | undefined;
  skipViewRendered?: boolean;
  projectName?: string;
  crossSites?: CrossSiteConfig[];
  virtualDom?: boolean;
}
```

### ViewSetup

```ts
type ViewSetup = (
  ctx: ViewCtx,
  params?: unknown,
) => {
  template?: ViewTemplate | VDomTemplate;
  events?: Record<string, AnyFunc>;
  assign?: (options?: unknown) => boolean | undefined;
};
```

### Template types

```ts
type ViewTemplate = (
  data: unknown,
  viewId: string,
  refData: unknown,
  ...encoders: unknown[]
) => string;
type VDomTemplate = (
  data: unknown,
  viewId: string,
  refData: unknown,
) => VDomNode;
```

# API Reference

Complete type signatures for all public exports from `@lark.js/mvc`.

## View System (Functional)

### `defineView(setup)`

Define a view via a setup function. Returns the setup function as-is.

```ts
function defineView(setup: ViewSetup): ViewSetup;

type ViewSetup = (
  ctx: ViewCtx,
  params?: unknown,
) => {
  template?: ViewTemplate | VDomTemplate;
  events?: Record<string, AnyFunc>;
  assign?: (options?: unknown) => boolean | undefined;
};
```

### `ViewCtx`

The context object passed to every view setup function. No `this` binding — all methods are closures.

| Property           | Type                                | Description                                      |
| ------------------ | ----------------------------------- | ------------------------------------------------ |
| `id`               | `string`                            | View ID (same as owner frame ID)                 |
| `owner`            | `FrameObj`                          | Owner frame reference                            |
| `updater`          | `UpdaterApi`                        | Data binding and DOM diff                        |
| `signature`        | `Ref<number>`                       | >0 active, 0 = destroyed                         |
| `rendered`         | `Ref<boolean>`                      | Whether rendered at least once                   |
| `resources`        | `Record<string, ViewResourceEntry>` | Resource map                                     |
| `cleanups`         | `Array<() => void>`                 | Cleanup functions (useEffect)                    |
| `emitter`          | `EmitterApi`                        | Internal emitter for lifecycle events            |
| `locationObserved` | `ViewLocationObserved`              | Location observation config                      |
| `renderMethod?`    | `AnyFunc`                           | Custom render function (replaces default digest) |
| `vdom?`            | `VDomNode`                          | Last rendered VDOM tree                          |

**Methods**: `getTemplate()`, `setTemplate(v)`, `getEvents()`, `setEvents(v)`, `getAssign()`, `setAssign(v)`, `getObservedStateKeys()`, `setObservedStateKeys(v)`, `getEndUpdatePending()`, `setEndUpdatePending(v)`, `render()`, `init(params?)`, `beginUpdate(id?)`, `endUpdate(id?, inner?)`, `wrapAsync(fn, context?)`, `observeLocation(params, path?)`, `observeState(keys)`, `capture(key, resource?, destroyOnRender?)`, `release(key, destroy?)`, `leaveTip(message, condition)`, `on(event, handler)`, `off(event, handler?)`, `fire(event, data?, remove?, lastToFirst?)`

### `mountCtx(frame, setup, params?)`

Mount a view: create ctx, run setup, register events, render. Called by `frame.mountView` after the setup function is loaded.

### `unmountCtx(ctx)`

Unmount a view: run cleanups, unregister events, destroy resources, fire "destroy" event.

### `registerEvents(ctx)` / `unregisterEvents(ctx)`

Register/unregister DOM event delegations based on `ctx.getEvents()` map.

## Hooks

All hooks must be called inside a setup function.

### `useState<T>(key, initial)`

```ts
function useState<T>(key: string, initial: T): [() => T, (v: T) => void];
```

### `useEffect(fn, deps?)`

```ts
function useEffect(fn: () => (() => void) | void, deps?: unknown[]): void;
```

### `useStore(store, selector?)`

```ts
function useStore<T>(
  store: StoreApi<T>,
  selector?: (s: T) => Record<string, unknown>,
): void;
```

### `useInterval(callback, delay)` / `useTimeout(callback, delay)` / `useResource(key, factory)` / `useEvent(name, handler)`

Lifecycle-managed wrappers for `setInterval`, `setTimeout`, resource capture, and event subscription.

## Store (zustand-aligned)

### `createStore<T>(name, creator)`

```ts
function createStore<T>(
  name: string,
  creator: (set: (partial: Partial<T>) => void, get: () => T) => T,
): StoreApi<T>;

interface StoreApi<T> {
  getState(): T;
  setState(partial: Partial<T> | ((prev: T) => Partial<T>)): void;
  subscribe(listener: (state: T, prevState: T) => void): () => void;
  destroy(): void;
}
```

### `computed(deps, fn)`

```ts
function computed<T>(deps: readonly string[], fn: () => T): T;
```

### `bindStore(ctx, store, selector?)`

```ts
function bindStore<T>(
  ctx: ViewCtx,
  store: StoreApi<T>,
  selector?: (state: T) => Record<string, unknown>,
): () => void;
```

## State (cross-view singleton)

### `State` singleton

| Method   | Signature                                       |
| -------- | ----------------------------------------------- |
| `get`    | `<T>(key?: string) => T`                        |
| `set`    | `(data, excludes?) => this`                     |
| `digest` | `(data?, excludes?) => void`                    |
| `diff`   | `() => ReadonlySet<string>`                     |
| `clean`  | `(keys: string) => (ctx: { on: ... }) => void`  |
| `on`     | `(event, handler) => this`                      |
| `off`    | `(event, handler?) => this`                     |
| `fire`   | `(event, data?, remove?, lastToFirst?) => this` |

## Router

### `Router` singleton

| Method       | Signature                                                          |
| ------------ | ------------------------------------------------------------------ |
| `parse`      | `(href?) => Location`                                              |
| `diff`       | `() => LocationDiff \| undefined`                                  |
| `to`         | `(pathOrParams, params?, replace?, silent?) => void`               |
| `join`       | `(...paths: string[]) => string`                                   |
| `beforeEach` | `(guard: (to, from) => boolean \| Promise<boolean>) => () => void` |
| `on`         | `(event, handler) => this`                                         |
| `off`        | `(event, handler?) => this`                                        |
| `fire`       | `(event, data?, remove?, lastToFirst?) => this`                    |

### `useUrlState(ctx, initialState?)`

```ts
function useUrlState<S extends Record<string, string>>(
  ctx: ViewCtx,
  initialState?: S,
): [Readonly<S>, (patch: Partial<S> | ((prev: S) => Partial<S>)) => void];
```

## Frame

### `Frame` singleton (static API)

| Method       | Signature                               |
| ------------ | --------------------------------------- |
| `get`        | `(id: string) => FrameObj \| undefined` |
| `getAll`     | `() => Map<string, FrameObj>`           |
| `getRoot`    | `() => FrameObj \| undefined`           |
| `createRoot` | `(rootId?: string) => FrameObj`         |
| `on`         | `(event, handler) => Frame`             |
| `off`        | `(event, handler?) => Frame`            |
| `fire`       | `(event, data?) => Frame`               |

### `createFrame(id, parentId?)`

```ts
function createFrame(id: string, parentId?: string): FrameObj;
```

### `FrameObj`

| Property        | Type                     |
| --------------- | ------------------------ |
| `id`            | `string`                 |
| `parentId`      | `string \| undefined`    |
| `view`          | `ViewCtx \| undefined`   |
| `signature`     | `number`                 |
| `destroyed`     | `number`                 |
| `childrenMap`   | `Record<string, string>` |
| `childrenCount` | `number`                 |
| `invokeList`    | `FrameInvokeEntry[]`     |
| `emitter`       | `EmitterApi`             |

**Methods**: `getViewPath()`, `mountView(viewPath, params?)`, `unmountView()`, `mountFrame(frameId, viewPath, params?)`, `unmountFrame(id?)`, `mountZone(zoneId?)`, `unmountZone(zoneId?)`, `parent(level?)`, `invoke(name, args?)`, `children()`, `on/off/fire`

## Service (API requests)

### `createService(syncFn, cacheMax?, cacheBuffer?)`

```ts
function createService(
  syncFn: (payload: PayloadApi, callback: () => void) => void,
  cacheMax?: number, // default 20
  cacheBuffer?: number, // default 5
): ServiceApi;
```

### `ServiceApi`

| Method     | Signature                                                             |
| ---------- | --------------------------------------------------------------------- |
| `add`      | `(attrs: ServiceMetaEntry \| ServiceMetaEntry[]) => void`             |
| `meta`     | `(attrs: string \| Record<string, unknown>) => ServiceMetaEntry`      |
| `create`   | `(attrs: Record<string, unknown>) => PayloadApi`                      |
| `get`      | `(attrs, createNew?) => { entity: PayloadApi; needsUpdate: boolean }` |
| `cached`   | `(attrs) => PayloadApi \| undefined`                                  |
| `clear`    | `(names: string \| string[]) => void`                                 |
| `instance` | `() => ServiceInstance`                                               |
| `on`       | `(event, handler) => void`                                            |
| `off`      | `(event, handler?) => void`                                           |
| `fire`     | `(event, data?) => void`                                              |

### `ServiceInstance`

| Method    | Signature                              |
| --------- | -------------------------------------- |
| `all`     | `(attrs, done) => ServiceInstance`     |
| `one`     | `(attrs, done) => ServiceInstance`     |
| `save`    | `(attrs, done) => ServiceInstance`     |
| `enqueue` | `(callback) => ServiceInstance`        |
| `dequeue` | `(...args) => void`                    |
| `destroy` | `() => void`                           |
| `on`      | `(event, handler) => ServiceInstance`  |
| `off`     | `(event, handler?) => ServiceInstance` |
| `fire`    | `(event, data?) => ServiceInstance`    |

### `createPayload(data?)`

```ts
function createPayload(data?: Record<string, unknown>): PayloadApi;
```

## EventEmitter

### `createEmitter<T>()`

```ts
function createEmitter<T = unknown>(): EmitterApi<T>;

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

Supports the `onEventName` convention: setting `emitter.onDestroy = fn` causes `fire("destroy")` to call `fn` automatically.

## Cache

### `createCache<T>(options?)`

```ts
function createCache<T = unknown>(options?: CacheOptions<T>): CacheApi<T>;

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

## Updater

### `createUpdater(viewId)`

```ts
function createUpdater(viewId: string): UpdaterApi;

interface UpdaterApi {
  get<T>(key?: string): T;
  set(
    data: Record<string, unknown>,
    excludes?: ReadonlySet<string>,
  ): UpdaterApi;
  digest(data?, excludes?, callback?): void;
  forceDigest(): void;
  snapshot(): UpdaterApi;
  altered(): boolean | undefined;
  refData: Record<string, unknown>;
  translate(data: unknown): unknown;
  parse(expr: string): unknown;
  getChangedKeys(): ReadonlySet<string>;
}
```

## EventDelegator

Module-level singleton. Delegates DOM events to `document.body`.

| Method             | Signature                                                 |
| ------------------ | --------------------------------------------------------- |
| `bind`             | `(eventType: string, hasSelector?: boolean) => void`      |
| `unbind`           | `(eventType: string, hasSelector?: boolean) => void`      |
| `clearRangeEvents` | `(viewId: string) => void`                                |
| `setFrameGetter`   | `(getter: (id: string) => FrameObj \| undefined) => void` |
| `nextElementGuid`  | `() => number`                                            |

At event dispatch time, `EventDelegator` looks up handlers via `view.getEvents()["handlerName<eventType>"]`.

## HMR

### Runtime functions

| Function                            | Description                                                 |
| ----------------------------------- | ----------------------------------------------------------- |
| `hotSwapByTemplate(old, new)`       | Swap template on all matching views                         |
| `hotSwapByView(oldSetup, newSetup)` | Swap setup on all matching views                            |
| `hotSwapView(frame, newSetup)`      | Swap setup on a single frame (re-runs setup, preserves ctx) |
| `hotSwapFrames(viewPath, newSetup)` | Swap all frames matching viewPath                           |
| `reloadViews(viewPath)`             | Legacy full-remount (loses state)                           |
| `acceptView(hot, viewPath)`         | Set up HMR accept handler                                   |
| `disposeView(hot, viewPath)`        | Set up HMR dispose handler                                  |

### Injection functions

| Function                                    | Description                              |
| ------------------------------------------- | ---------------------------------------- |
| `injectTemplateHmrSnippet(source, bundler)` | Append template HMR snippet              |
| `injectViewHmr(source, bundler)`            | Rewrite export default + append view HMR |
| `importsHtmlTemplate(source)`               | Check if source imports .html            |

## Framework

### `Framework` singleton

Key methods: `boot(config)`, `getConfig(key?)`, `setConfig(patch)`, `isBooted()`, `toMap(list, key?)`, `toTry(fns, args?, context?, onError?)`, `toUrl(path, params?, keepEmpty?)`, `parseUrl(url)`, `mix(target, ...sources)`, `has(owner, prop)`, `keys(src)`, `inside(node, container)`, `node(id)`, `nodeId(element)`, `use(names, callback?)`, `generateId(prefix?)`, `mark(host, key)`, `unmark(host)`, `delay(time)`, `dispatch(target, type, init?)`, `task(fn, args?, context?)`, `waitZoneViewsRendered(viewId, timeout?)`

Factory aliases: `createEmitter`, `defineView`, `createCache`

## CrossSite

Built-in view for micro-frontend via Module Federation. Default export from `@lark.js/mvc`.

## Template types

| Type           | Signature                                                    |
| -------------- | ------------------------------------------------------------ |
| `ViewTemplate` | `(data, viewId, refData, ...encoders) => string`             |
| `VDomTemplate` | `(data, viewId, refData) => VDomNode`                        |
| `ViewSetup`    | `(ctx: ViewCtx, params?) => { template?, events?, assign? }` |

# Lark API Reference

This document is the complete API reference for every public module in `@lark.js/mvc`. The runtime helpers used by compiled templates live in the separate `@lark.js/mvc/runtime` entry; the Vite plugin and Webpack loader live in `@lark.js/mvc/vite` and `@lark.js/mvc/webpack` respectively.

## Table of Contents

- [Framework](#framework)
- [Router](#router)
- [useUrlState](#useurlstate)
- [State](#state)
- [View](#view)
- [defineView](#defineview)
- [Updater](#updater)
- [Frame](#frame)
- [view-registry](#view-registry)
- [Store](#store)
- [Service & Payload](#service--payload)
- [CrossSite](#crosssite)
- [Cache](#cache)
- [EventEmitter](#eventemitter)
- [EventDelegator](#eventdelegator)
- [HMR](#hmr)
- [VDOM](#vdom)
- [Frame Devtool Bridge](#frame-devtool-bridge)
- [Template Runtime](#template-runtime)
- [Compiler](#compiler)
- [Utilities & Constants](#utilities--constants)
- [Vite / Webpack / Rspack integrations](#vite--webpack--rspack-integrations)

---

## Framework

The main entry point object, imported via `import { Framework } from '@lark.js/mvc'`.

### Framework.boot(config)

Starts the application. Order: merge config → set router config → set EventDelegator frame getter → bind router/state CHANGED events → mark booted → install Frame Devtool Bridge → `Frame.createRoot(config.rootId)` → `Router._bind()` → mount default view (only if Router didn't already mount one).

```ts
Framework.boot(config: FrameworkConfig): void
```

### Framework.getConfig() / Framework.getConfig(key)

Read the framework configuration. Two overloads.

```ts
Framework.getConfig(): FrameworkConfig
Framework.getConfig<T = unknown>(key: string): T | undefined
```

### Framework.setConfig(patch)

Merge a patch into the framework configuration and return the merged config.

```ts
Framework.setConfig<T extends object = Partial<FrameworkConfig>>(
  patch: Partial<FrameworkConfig> & T,
): FrameworkConfig & T
```

### Framework.isBooted()

```ts
Framework.isBooted(): boolean
```

### Framework.mark(host, key) / Framework.unmark(host)

Async-callback validity tracking. Marks live in a module-level `WeakMap`, so nothing is written to `host`. `mark` returns a checker that returns `true` while the mark is still valid; `unmark` invalidates all checkers for the host. Works on frozen objects.

```ts
Framework.mark(host: object, key: string): () => boolean
Framework.unmark(host: object): void
```

### Framework.dispatch(target, type, init?)

Dispatch a custom DOM event.

```ts
Framework.dispatch(target: EventTarget, type: string, init?: CustomEventInit): void
```

### Framework.task(fn, args?, context?)

Schedule a function for time-sliced execution. Uses `scheduler.postTask('background')` → `requestIdleCallback` → `setTimeout(0)` as fallback. Tasks are executed in chunks with a `CALL_BREAK_TIME = 48ms` budget.

```ts
Framework.task(fn: AnyFunc, args?: unknown[], context?: unknown): void
```

### Framework.delay(time)

Promise-wrapped `setTimeout`.

```ts
Framework.delay(time: number): Promise<void>
```

### Framework.use(names, callback?)

Load modules through the configured `FrameworkConfig.require`, or via dynamic `import()` if `require` isn't set.

```ts
Framework.use(
  names: string | string[],
  callback?: (...modules: unknown[]) => void,
): Promise<unknown[]>
```

### Framework.waitZoneViewsRendered(viewId, timeout?)

Wait for every view inside `viewId` to finish rendering. Resolves to `Framework.WAIT_OK` (1) or `Framework.WAIT_TIMEOUT_OR_NOT_FOUND` (0). `timeout` defaults to 30 000 ms.

```ts
Framework.waitZoneViewsRendered(viewId: string, timeout?: number): Promise<number>
```

### Framework.guard(o)

Wrap an object with a Safeguard Proxy that warns on direct mutation. No-op outside debug mode.

```ts
Framework.guard<T extends object>(o: T): T
```

### Framework.guid(prefix?)

Generate a globally unique ID. Default prefix is `"lark-"`.

```ts
Framework.guid(prefix?: string): string
```

### Framework.nodeId(element)

Ensure an element has an ID (generates `l_<n>` if missing). Returns the resulting id.

```ts
Framework.nodeId(element: HTMLElement): string
```

### Framework.WAIT_OK / Framework.WAIT_TIMEOUT_OR_NOT_FOUND

Return constants from `waitZoneViewsRendered`.

| Name                        | Value | Meaning                    |
| --------------------------- | ----- | -------------------------- |
| `WAIT_OK`                   | 1     | All views rendered in time |
| `WAIT_TIMEOUT_OR_NOT_FOUND` | 0     | Timeout or zone not found  |

### Framework module accessors

| Property           | Description                           |
| ------------------ | ------------------------------------- |
| `Framework.Router` | Router singleton                      |
| `Framework.State`  | State singleton                       |
| `Framework.View`   | View class                            |
| `Framework.Frame`  | Frame class                           |
| `Framework.Cache`  | Cache class                           |
| `Framework.Base`   | `EventEmitter` (used as a base class) |

### Framework utility aliases

| Property             | Delegates to       | Notes                                     |
| -------------------- | ------------------ | ----------------------------------------- |
| `Framework.toMap`    | `toMap()`          | Array → hash map                          |
| `Framework.toTry`    | `funcWithTry()`    | Execute in try-catch                      |
| `Framework.toUrl`    | `toUri()`          | `(path, params, keepEmpty?: Set<string>)` |
| `Framework.parseUrl` | `parseUri()`       | URL → `{ path, params }`                  |
| `Framework.mix`      | `assign()`         | Merge sources into target                 |
| `Framework.has`      | `hasOwnProperty()` | Safe `hasOwnProperty`                     |
| `Framework.keys`     | `keys()`           | Own enumerable keys                       |
| `Framework.inside`   | `nodeInside()`     | Container/descendant check                |
| `Framework.node`     | `getById()`        | Element by id or passthrough              |

---

## Router

Hash-based router with two-phase change confirmation. Imported via `import { Router } from '@lark.js/mvc'`.

### Router.parse(href?)

Parse a URL into `Location`. Defaults to `window.location.href`. Results are cached.

```ts
Router.parse(href?: string): Location
```

### Router.diff()

Compare last/current Locations and return the `LocationDiff`. Triggers the `changed` event when not silent.

```ts
Router.diff(): LocationDiff | undefined
```

### Router.to(pathOrParams, params?, replace?, silent?)

Programmatic navigation.

```ts
Router.to(
  pathOrParams: string | Record<string, unknown>,
  params?: Record<string, unknown>,
  replace?: boolean,
  silent?: boolean,
): void
```

- `to("/list", { page: 2 })` — set both path and params.
- `to({ page: 2 })` — params only; keeps current path.
- `replace = true` — `location.replace` instead of pushing a history entry.
- `silent = true` — don't fire CHANGED.

### Router.beforeEach(guard)

Register an async-friendly navigation guard. Returns an unsubscribe function. Guards run sequentially in registration order. Any guard that returns/resolves `false` (or throws) aborts the navigation and reverts the URL.

```ts
Router.beforeEach(
  guard: (to: Location, from: Location) => boolean | void | Promise<boolean | void>,
): () => void
```

### Router.join(...paths)

Join path segments, collapsing `./`, `../`, and `//`.

```ts
Router.join(...paths: string[]): string
```

### Router.on / off / fire

`Router` is an `EventEmitter`.

```ts
Router.on(event: string, handler: AnyFunc): typeof Router
Router.off(event: string, handler?: AnyFunc): typeof Router
Router.fire(event: string, data?: Record<string, unknown>, remove?: boolean): typeof Router
```

### Router events

| Event         | Phase             | Payload / control                                   |
| ------------- | ----------------- | --------------------------------------------------- |
| `change`      | before navigation | `{ p, prevent(), reject(), resolve() }` mutate flow |
| `changed`     | after navigation  | `LocationDiff & { type: "changed" }`                |
| `page_unload` | beforeunload      | mutate `data.msg` to surface a browser confirmation |

The `change` event handler may:

- `e.prevent()` — pause; no further router work happens.
- `e.reject()` — revert to `lastHash`.
- `e.resolve()` — commit; URL updates and `changed` fires.
- Do none of the above — Router auto-resolves (or runs `beforeEach` guards first if any are registered).

### Location

```ts
interface Location {
  href: string;
  srcQuery: string;
  srcHash: string;
  query: ParsedUri;
  hash: ParsedUri;
  params: Record<string, string>;
  view?: string;
  path?: string;
  get(key: string, defaultValue?: string): string;
}

interface ParsedUri {
  path: string;
  params: Record<string, string>;
}
```

### LocationDiff

```ts
interface LocationDiff {
  params: Record<string, ParamDiff>;
  path?: ParamDiff;
  view?: ParamDiff;
  force: boolean;
  changed: boolean;
}
interface ParamDiff {
  from: string;
  to: string;
}
```

### Hashbang mode

Default hashbang is `"#!"`. URLs look like `http://localhost/#!/home?count=5`.

---

## useUrlState

Sync view state with URL query parameters. Imported via `import { useUrlState } from '@lark.js/mvc'`.

### useUrlState(view, initialState?)

Returns a `[state, setState]` tuple. Reads URL query parameters into a state object and provides a `setState` function that writes back to the URL via `Router.to()`. Automatically calls `view.observeLocation(keys)` so the view re-renders when the URL changes.

```ts
function useUrlState<S extends Record<string, string>>(
  view: ViewApi,
  initialState?: S,
): [S, (patch: Partial<S> | ((prev: S) => Partial<S>)) => void];
```

- `initialState` provides default values and determines which URL params are observed.
- `setState` accepts a partial object or an updater function `(prev) => partial`.
- Works with both history and hash routing modes.
- The returned `state` object always reflects the current URL params merged with defaults.

```ts
const [state, setState] = useUrlState(this, { page: "1", size: "20" });
// state.page, state.size are read from URL or defaults
setState({ page: "2" }); // writes ?page=2 to URL, keeps size=20
setState((prev) => ({ page: String(Number(prev.page) + 1) }));
```

---

## State

Global singleton for cross-view observable data. Imported via `import { State } from '@lark.js/mvc'`. Best for simple shared values (counters, page title, session info). For complex reactive state with derived data, prefer store `createStore`.

### State.get(key?)

Read state. Without `key`, returns the entire state object.

```ts
State.get<T = unknown>(key?: string): T
```

In debug mode, results are wrapped with a Safeguard Proxy that warns on direct mutation and on cross-page reads.

### State.set(data, excludes?)

Write data and track changed keys. Always call `State.digest()` afterwards to fire the `changed` event.

```ts
State.set(data: Record<string, unknown>, excludes?: ReadonlySet<string>): typeof State
```

### State.digest(data?, excludes?)

Trigger change notification. If `data` is supplied, runs `set(data, excludes)` first. Fires `changed` with a `keys: ReadonlySet<string>` payload.

```ts
State.digest(data?: Record<string, unknown>, excludes?: ReadonlySet<string>): void
```

### State.diff()

Return the set of keys changed in the most recent digest.

```ts
State.diff(): ReadonlySet<string>
```

### State.clean(keys)

Cleanup function factory. Returns a function that, when called with a `ViewCtx`, registers a `destroy` listener that decrements per-key reference counts; keys with zero refs are removed from state. Use it to prevent State leaks.

```ts
State.clean(keys: string): (ctx: { on: (event: string, handler: () => void) => void }) => void
```

```ts
// Inside setup:
State.clean("user,token")(ctx);
```

### State events

| Event     | Description                                                                      |
| --------- | -------------------------------------------------------------------------------- |
| `changed` | After `State.digest()`. Payload `{ type: "changed", keys: ReadonlySet<string> }` |

State is an `EventEmitter`, so `on/off/fire` are available.

---

## View (Functional)

The view system uses a functional API: `defineView(setup)` returns a `ViewSetup` function, and the framework calls it with a `ViewCtx` on mount. No `class`, no `this`, no `prototype`, no `mixin`.

### defineView(setup)

```ts
function defineView(setup: ViewSetup): ViewSetup;

type ViewSetup = (
  ctx: ViewCtx,
  params?: unknown,
) => {
  template?: ViewTemplate | VDomTemplate;
  events?: Record<string, AnyFunc>;
  assign?: (options?: unknown) => boolean | undefined;
};
```

```ts
import { defineView } from "@lark.js/mvc";
import template from "./home.html";

export default defineView((ctx, params) => {
  ctx.updater.set({ title: "Home" });
  ctx.on("destroy", () => console.log("destroyed"));

  return {
    template,
    events: {
      "navigateTo<click>": (e) => Router.to(e.params.path),
    },
    assign: (options) => {
      ctx.updater.snapshot();
      ctx.updater.set({ ... });
      return ctx.updater.altered();
    },
  };
});
```

### ViewCtx properties

| Property           | Type                                | Description                                           |
| ------------------ | ----------------------------------- | ----------------------------------------------------- |
| `id`               | `string`                            | Same as owner frame id                                |
| `owner`            | `FrameObj`                          | Owner frame reference                                 |
| `updater`          | `UpdaterApi`                        | Per-view data binder                                  |
| `signature`        | `Ref<number>`                       | `>0` = active; incremented on render; `0` = destroyed |
| `rendered`         | `Ref<boolean>`                      | Whether rendered at least once                        |
| `resources`        | `Record<string, ViewResourceEntry>` | Captured resources                                    |
| `cleanups`         | `Array<() => void>`                 | Cleanup functions (useEffect)                         |
| `emitter`          | `EmitterApi`                        | Internal emitter for lifecycle events                 |
| `locationObserved` | `ViewLocationObserved`              | Location observation config                           |
| `renderMethod?`    | `AnyFunc`                           | Custom render function (replaces default digest)      |
| `vdom?`            | `VDomNode`                          | Last rendered VDOM tree                               |

Template and events are accessed via getter/setter functions: `getTemplate()` / `setTemplate()`, `getEvents()` / `setEvents()`, `getAssign()` / `setAssign()`, `getObservedStateKeys()` / `setObservedStateKeys()`, `getEndUpdatePending()` / `setEndUpdatePending()`.

### ViewCtx lifecycle

| Phase   | Description                                                                          |
| ------- | ------------------------------------------------------------------------------------ |
| setup   | Runs once on mount. Receives `(ctx, params)`. Returns `{ template, events, assign }` |
| render  | Auto-called by framework after setup. Calls `updater.digest()` or `ctx.renderMethod` |
| destroy | Runs `cleanups`, unregisters events, destroys resources, fires `"destroy"` event     |

### ViewCtx methods

| Method                                      | Description                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `on(event, handler)`                        | Bind a lifecycle event listener; returns unsubscribe function                                |
| `off(event, handler?)`                      | Unbind a (or all) listener(s)                                                                |
| `fire(event, data?, remove?, lastToFirst?)` | Fire an event                                                                                |
| `observeLocation(params, observePath?)`     | Watch URL params and/or path; accepts string / string[] / `{ path, params }`                 |
| `observeState(keys)`                        | Watch State keys; comma-separated string or string array                                     |
| `capture(key, resource?, destroyOnRender?)` | Register a resource for automatic cleanup. Resource's `destroy()` is invoked on cleanup      |
| `release(key, destroy?)`                    | Manually release a captured resource                                                         |
| `wrapAsync(fn, context?)`                   | Wrap an async callback with a signature check; callback no-ops if view re-rendered/destroyed |
| `beginUpdate(id?)`                          | Notify that HTML for `id` is about to change — unmounts child frames in the zone             |
| `endUpdate(id?, inner?)`                    | Notify update is done — re-mounts frames in the zone and flushes deferred invokes            |
| `leaveTip(message, condition)`              | Set leave confirmation; hooks into Router `change` and `beforeunload`                        |

### Event handler naming

Event handlers are defined in the `events` map returned by setup. The key format is `"name<eventType>"`:

| Pattern                 | Meaning                                           |
| ----------------------- | ------------------------------------------------- |
| `handler<click>`        | Root event on the view element                    |
| `$selector<click>`      | Delegated event matching CSS selector `.selector` |
| `$window<resize>`       | Global event on `window`                          |
| `$document<keydown>`    | Global event on `document`                        |
| `name<click,mousedown>` | Multi-event binding                               |

---

## Updater

Per-view data binder. Accessed via `ctx.updater` inside setup. Created by `createUpdater(viewId)`.

### updater.get(key?)

Read data. Without `key`, returns the whole data object. In debug mode, results are wrapped with Safeguard Proxy.

```ts
updater.get<T = unknown>(key?: string): T
```

### updater.set(data, excludes?)

Merge `data` into the view data and track changed keys. Returns `this`.

```ts
updater.set(
  data: Record<string, unknown>,
  excludes?: ReadonlySet<string>,
): this
```

### updater.digest(data?, excludes?, callback?)

Trigger the render pipeline:

1. If `data` is supplied, run `set(data, excludes)` first.
2. If anything changed, run the template function, parse the resulting HTML into a temporary DOM, diff against the live DOM (via `solidDomSetChildNodes`), apply DOM ops + ID updates, then invoke `endUpdate()` if anything actually mutated or if this is the first render.
3. Supports re-entrant digest via `digestingQueue` (the `null` sentinel marks a digest boundary). Callbacks queued during the cycle run after the cycle completes.

```ts
updater.digest(
  data?: Record<string, unknown>,
  excludes?: ReadonlySet<string>,
  callback?: () => void,
): void
```

### updater.snapshot() / updater.altered()

Cheap O(1) change detection. `snapshot()` records the current monotonic version counter; `altered()` reports whether the version has bumped since.

```ts
updater.snapshot(): this
updater.altered(): boolean | undefined  // undefined if snapshot was never called
```

### updater.forceDigest()

Force a full re-render, bypassing change detection. Marks every current data key as changed and triggers a digest cycle. Used by HMR (`hotSwapView`) to re-render a view after its template has been hot-swapped, ensuring the new template is fully applied even though the data itself has not changed.

```ts
updater.forceDigest(): void
```

Unlike `digest(data)` which only marks keys whose values differ, `forceDigest()` marks ALL keys, so the DOM/VDom diff re-evaluates every template region rather than skipping ones whose data is unchanged.

### updater.translate(value)

Resolve a refData reference token (`SPLITTER + ascii digits`) to its original JS value. Non-ref strings are returned as-is. The protocol is strict: only `\x1e` followed by digits qualifies, so user-supplied strings that merely begin with `\x1e` are never accidentally resolved.

```ts
updater.translate(value: unknown): unknown
```

### updater.parse(expr)

CSP-safe path resolver. Accepts a dotted property path (`a.b.c`) or a numeric literal (`42`, `-1.5`). Anything else (including expressions, function calls, bracket access) returns `undefined`. Does NOT `eval` arbitrary JS.

```ts
updater.parse(expr: string): unknown
```

### updater.getChangedKeys()

The set of keys that changed since the last digest.

```ts
updater.getChangedKeys(): ReadonlySet<string>
```

### updater.refData

Mutable `Record<string, unknown>` storing refData entries (used by `@`-operator templates). The counter slot is at `refData[SPLITTER]`.

---

## Frame

Runtime tree of view containers. Each Frame owns one View and zero-or-more child Frames. Imported via `import { Frame } from '@lark.js/mvc'`.

### Frame.getRoot()

Read-only access to the singleton root frame. Returns `undefined` if no root has been created yet.

```ts
Frame.getRoot(): Frame | undefined
```

### Frame.createRoot(rootId?)

Create (or return the existing) singleton root frame. Idempotent — later `rootId` arguments are ignored once the root exists. Framework.boot calls this.

```ts
Frame.createRoot(rootId?: string): Frame
```

### Frame.root(rootId?) _(deprecated)_

Legacy combined creator + getter. Use `getRoot` or `createRoot`. Behavior unchanged — delegates to `createRoot`.

### Frame.get(id) / Frame.getAll()

```ts
Frame.get(id: string): Frame | undefined
Frame.getAll(): Map<string, Frame>
```

### Frame.on / off / fire (static)

Frame-level events: `add`, `remove`. Payload `{ frame: Frame }`.

```ts
Frame.on(event: string, handler: AnyFunc): typeof Frame
Frame.off(event: string, handler?: AnyFunc): typeof Frame
Frame.fire(event: string, data?: Record<string, unknown>): void
```

### Constructor

```ts
createFrame(id: string, parentId?: string): FrameObj
```

Use `createFrame(containerId)` directly for **independent** root frames — Module Federation hosts that own multiple containers should each call `createFrame(...)` so each mount has its own tree, instead of relying on the global singleton.

### frame.mountView(viewPath, viewInitParams?)

Mount a view. If the path isn't registered in `view-registry`, `Framework.use()` is called to load it asynchronously.

```ts
frame.mountView(viewPath: string, viewInitParams?: Record<string, unknown>): void
```

### frame.unmountView()

Destroy the current view (fires `destroy` event), restore original template, clear range events. Resets the Frame for reuse.

### frame.mountFrame(frameId, viewPath, viewInitParams?)

Create or reuse a child Frame, then mount the view. Returns the child Frame.

### frame.unmountFrame(id?, inner?)

Unmount a child Frame. With no id, unmounts the Frame itself.

### frame.mountZone(zoneId?, inner?) / frame.unmountZone(zoneId?, inner?)

Scan the zone for `[v-lark]` elements and mount/unmount their child frames.

### frame.children()

Returns an array of child Frame ids. Order is NOT stable.

```ts
frame.children(): string[]
```

### frame.parent(level?)

Walk `level` ancestors up the Frame tree. Default `level = 1`.

```ts
frame.parent(level?: number): Frame | undefined
```

### frame.invoke(name, args?)

Call a view method. If the view isn't yet rendered, the call is queued and flushed by `View.runInvokes(frame)` after render.

```ts
frame.invoke(name: string, args?: unknown[]): unknown
```

### frame.invokeTyped<V, K>(name, args)

Type-safe variant. Carries the view's method signature through TypeScript so renames are caught at compile time. Same runtime behavior as `invoke`.

```ts
frame.invokeTyped<
  V extends Record<string, unknown>,
  K extends keyof V & string,
>(
  name: K,
  args: V[K] extends (...a: infer A) => unknown ? A : never[],
): V[K] extends (...a: never[]) => infer R ? R | undefined : unknown
```

### Frame instance properties (selected)

| Property          | Description                                     |
| ----------------- | ----------------------------------------------- |
| `id`              | DOM id this frame is bound to                   |
| `parentId`        | Parent frame id (undefined for root)            |
| `view`            | Current `ViewApi \| undefined`                  |
| `viewPath`        | Currently mounted view path                     |
| `childrenMap`     | `Record<string, string>` of child ids           |
| `childrenCount`   | Number of children                              |
| `readyCount`      | Children that have fired `created`              |
| `readyMap`        | `Set<string>` of ready child ids                |
| `invokeList`      | Deferred invokes pending render                 |
| `signature`       | For async-op tracking                           |
| `hasAltered`      | Whether the original template has been replaced |
| `destroyed`       | Destroy flag                                    |
| `holdFireCreated` | Suppress `created` event during batch mount     |
| `childrenCreated` | All children have fired `created`               |
| `childrenAlter`   | Children entered an alter cycle                 |

### Frame instance events

| Event     | Description                                          |
| --------- | ---------------------------------------------------- |
| `destroy` | View destroyed (fired on `view`, also affects frame) |
| `created` | All child frames have rendered                       |
| `alter`   | A child frame changed content                        |

### Frame object pool

Destroyed Frame objects are pooled and reused (up to `MAX_FRAME_POOL = 64`). Don't hold references to Frame instances after `unmountFrame()` — they may be reinitialized for a different view.

---

## view-registry

Global registry of `viewPath → ViewClass`. Exported via the main entry, but the underlying module is `view-registry.ts`.

```ts
import {
  registerViewClass,
  invalidateViewClass,
  getViewClassRegistry,
} from "@lark.js/mvc";
```

```ts
registerViewClass(viewPath: string, ViewClass: typeof View): void
invalidateViewClass(viewPath: string): void
getViewClassRegistry(): Record<string, typeof View>
```

The internal `getViewClass(path): typeof View | undefined` is not exported (used by `Frame.mountView`).

---

## Store

Zustand-aligned state management for Lark MVC. Simple, explicit, no Proxy magic. Imported via `import { createStore, computed, bindStore } from '@lark.js/mvc'`.

### createStore(name, creator)

Define a store. The creator receives `set` and `get` and returns the initial state object. Functions in the return value become actions (attached to state, ignored by `setState`); `computed(deps, fn)` entries become derived state (read-only, auto-recomputed); everything else becomes plain state.

```ts
function createStore<T extends object>(
  name: string,
  creator: (set: SetFn<T>, get: () => T) => T,
): StoreApi<T>;

type SetFn<T> = (partial: Partial<T> | ((prev: T) => Partial<T>)) => void;
```

The store is registered in a global `storeRegistry` keyed by `name`. Calling `createStore` with the same name replaces the previous entry.

```ts
const useCountStore = createStore("counter", (set, get) => ({
  count: 0,
  doubled: computed(["count"], () => get().count * 2),
  increment() {
    set({ count: get().count + 1 });
  },
  reset() {
    set({ count: 0 });
  },
}));
```

### StoreApi

The object returned by `createStore`. Four methods, no magic.

```ts
interface StoreApi<T = Record<string, unknown>> {
  getState(): T;
  setState(partial: Partial<T> | ((prev: T) => Partial<T>)): void;
  subscribe(listener: (state: T, prevState: T) => void): () => void;
  destroy(): void;
}
```

| Method         | Description                                                                                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getState()`   | Read the current state snapshot. Actions are included as own properties.                                                                                                                      |
| `setState(p)`  | Shallow-merge `p` (or `p(prev)`) into state. Computed keys and action keys are silently skipped. Listeners are notified only when at least one key actually changes (`Object.is` comparison). |
| `subscribe(l)` | Register a listener `(state, prevState) => void`. Returns an unsubscribe function.                                                                                                            |
| `destroy()`    | Mark the store as destroyed, clear all listeners, remove from the global registry.                                                                                                            |

### computed(deps, fn)

Declare a derived property inside a `createStore` creator. `deps` lists the state keys that `fn` reads. Whenever any dep changes via `setState`, `fn` re-evaluates before listeners are notified.

```ts
function computed<T>(deps: readonly string[], fn: () => T): T;
```

Writes to a computed key via `setState` are silently ignored (read-only by contract).

```ts
const store = createStore("cart", (set, get) => ({
  items: [] as Item[],
  total: computed(["items"], () =>
    get().items.reduce((s, i) => s + i.price, 0),
  ),
  addItem(item: Item) {
    set({ items: [...get().items, item] });
  },
}));
```

### bindStore(view, store, selector?)

Bind a store to a Lark View. Subscribes to state changes and pipes them into the view's `updater`. Auto-unsubscribes when the view fires `destroy`.

```ts
function bindStore<T extends Record<string, unknown>>(
  view: unknown,
  store: StoreApi<T>,
  selector?: (state: T) => Record<string, unknown>,
): () => void;
```

- Without `selector`, only non-function state keys are forwarded to the updater (actions are excluded).
- With `selector`, the selector's return value is forwarded on every state change.
- Performs an initial sync (`updater.set` + `updater.digest`) at bind time.
- Returns the unsubscribe function (also called automatically on view destroy).

```ts
const MyView = defineView({
  ctor() {
    // Observe all state keys (minus actions)
    bindStore(this, useCountStore);

    // Or observe with a selector
    bindStore(this, useCountStore, (s) => ({ count: s.count }));
  },
});
```

---

## Service & Payload

API request layer with LFU cache, deduplication, and serial queue. Imported via `import { createService, createPayload } from '@lark.js/mvc'`.

### createService(syncFn, cacheMax?, cacheBuffer?)

Create a subclass with its OWN per-type static state (`_metaList`, `_payloadCache`, `_pendingCacheKeys`, `_syncFn`, `_staticEmitter`, `_cacheMax`, `_cacheBuffer`). This isolation is intentional — endpoints registered on one subclass never leak into another.

```ts
createService(
  syncFn: (payload: Payload, callback: () => void) => void,
  cacheMax?: number,        // default 20
  cacheBuffer?: number,     // default 5
): typeof Service
```

### Service.add(metaList)

Register endpoint metadata.

```ts
Service.add(meta: ServiceMetaEntry | ServiceMetaEntry[]): void
```

### ServiceMetaEntry

```ts
interface ServiceMetaEntry {
  name: string;
  url: string;
  cache?: number; // TTL ms; 0 = no cache
  before?(payload: Payload): void;
  after?(payload: Payload): void;
  cleanKeys?: string; // comma-separated names whose cache is cleared on completion
  [k: string]: unknown;
}
```

### Service static methods

| Method                           | Purpose                                                         |
| -------------------------------- | --------------------------------------------------------------- |
| `Service.meta(attrsOrName)`      | Look up metadata                                                |
| `Service.create(attrs)`          | Create a new `Payload` (fires `begin` event)                    |
| `Service.get(attrs, createNew?)` | `{ entity, needsUpdate }` — cache lookup or fresh               |
| `Service.cached(attrs)`          | Cached `Payload` or `undefined`                                 |
| `Service.clear(names)`           | Drop cached payloads by name (string or `string[]`)             |
| `Service.on/off/fire`            | Static emitter for `begin`/`done`/`fail`/`end` lifecycle events |

### Service instance methods

```ts
new Service();
```

| Method                      | Behavior                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `service.all(attrs, done)`  | Fetch every endpoint; callback receives `(errors, p1, p2, ...)` only when ALL complete |
| `service.one(attrs, done)`  | Fetch every endpoint; callback fires per-endpoint as `(error, payload, isLast, index)` |
| `service.save(attrs, done)` | Like `all` but always bypasses cache                                                   |
| `service.enqueue(callback)` | Queue a task for serial execution                                                      |
| `service.dequeue(...args)`  | Run the next queued task                                                               |
| `service.destroy()`         | Mark destroyed; no further callbacks will run                                          |
| `service.on/off/fire`       | Instance emitter (separate from the static one)                                        |

`attrs` may be a string (endpoint name), a `Record<string, unknown>` (params), or an array combining the two.

### Payload

```ts
class Payload {
  data: Record<string, unknown>;
  cacheInfo?: ServiceCacheInfo;
  get<T = unknown>(key: string): T;
  set(
    keyOrData: string | Record<string, unknown> | ServiceMetaEntry,
    value?: unknown,
  ): Payload;
}
```

### Cache key memoization

`defaultCacheKey(meta, attrs)` computes `JSON.stringify(attrs) + SPLITTER + JSON.stringify(meta)`. `JSON.stringify(meta)` is memoized through a `WeakMap<ServiceMetaEntry, string>`; meta entries are immutable after `Service.add()`.

---

## CrossSite

Micro-frontend bridge View for Module Federation. Renders a loading skeleton, calls the remote project's `prepare` module, then mounts the actual remote view.

```ts
import { CrossSite, resetProjectsMap, registerViewClass } from "@lark.js/mvc";
registerViewClass("cross-site", CrossSite);
```

Then in templates: `v-lark="cross-site?view=remote-app/views/home&bizCode=my_biz"`.

CrossSite reads:

- `view` — remote view path (required).
- `bizCode` — passed to the remote `prepare` function.
- `skeleton` — optional HTML for the loading state.
- `skeletonParams` — optional data for the skeleton.

It uses a `$sign` counter to abort stale loads: if the user navigates away during the async `prepare`, the in-flight mount is cancelled.

`resetProjectsMap()` — clear the per-project map cache (use when `crossSites` change at runtime).

`CrossSite.callView(name, ...args)` — invoke a method on the mounted remote view via `Frame.invoke`.

---

## Cache

LFU cache with frequency + timestamp eviction. Single-pass partial-selection on overflow (O(n·k) instead of O(n log n) sort).

```ts
import { createCache } from "@lark.js/mvc";

const cache = createCache<T>({
  maxSize?: number;       // default 20
  bufferSize?: number;    // default 5  — number of entries evicted per cycle
  onRemove?: (key: string) => void;
  sortComparator?: (a: CacheEntry<T>, b: CacheEntry<T>) => number;
});
```

| Method                  | Description                                               |
| ----------------------- | --------------------------------------------------------- |
| `cache.set(key, value)` | Set; if key exists, value is updated and frequency bumped |
| `cache.get(key)`        | Read; increments frequency and refreshes timestamp        |
| `cache.del(key)`        | Remove immediately (no tombstone); fires `onRemove`       |
| `cache.has(key)`        | Membership check                                          |
| `cache.forEach(cb)`     | Iterate values                                            |
| `cache.size`            | Current entry count                                       |
| `cache.clear()`         | Wipe everything; fires `onRemove` per entry               |

---

## EventEmitter

Multi-cast emitter with re-entrant safety. Used as a base by Frame, View, Router, etc.

```ts
import { createEmitter } from "@lark.js/mvc";

const e = createEmitter();
e.on("change", (data) => ...);
e.fire("change", { value: 1 });
e.off("change", handler);
e.off("change"); // remove all
```

Re-entrant guarantees: handlers may `off()` themselves (or each other) during dispatch without skipping siblings. Removed handlers are replaced with `noop` and compacted once the outermost `fire()` returns.

Fire options:

```ts
emitter.fire(
  event: string,
  data?: Record<string, unknown>,
  remove?: boolean,        // remove all listeners after firing
  lastToFirst?: boolean,   // dispatch in reverse order
): this
```

The emitter also auto-calls `onEventName` methods on `this` if they exist (e.g. `Router.onChanged`).

---

## EventDelegator

Capture-phase event delegation rooted at `document.body`. Reference-counted: first binding adds the listener, last unbinding removes it.

```ts
import { EventDelegator } from "@lark.js/mvc";

EventDelegator.bind(eventType: string, hasSelector?: boolean): void
EventDelegator.unbind(eventType: string, hasSelector?: boolean): void
EventDelegator.clearRangeEvents(viewId: string): void
EventDelegator.setFrameGetter(getter: (id: string) => FrameApi | undefined): void
EventDelegator.nextElementGuid(): number
```

`setFrameGetter` is called by `Framework.boot` so the delegator can find the owning Frame for any DOM event. Early-exit: when `findFrameInfo` sees a target with no `@<eventType>` attribute and no view has registered a selector handler for the event, it returns immediately.

---

## HMR

Lark ships zero-config HMR for Vite, Webpack, and Rspack. The build plugins auto-inject HMR snippets at compile time (like `@vitejs/plugin-react` and `@vitejs/plugin-vue`), so users never write `import.meta.hot` themselves. State is preserved across updates via in-place prototype swap.

### HotContext

Interface compatible with Vite's `import.meta.hot` and Webpack/Rspack's `module.hot`:

```ts
interface HotContext {
  accept(cb?: (newModule: unknown) => void): void;
  dispose(cb: (data: unknown) => void): void;
  invalidate(): void;
}
```

### Bundler type

```ts
type Bundler = "vite" | "webpack" | "rspack";
```

### hotSwapByTemplate(oldTemplate, newTemplate)

Template-only HMR. Finds every mounted view whose `template` property matches `oldTemplate`, replaces it with `newTemplate`, and force-renders. Used by the auto-injected template HMR snippet. Does NOT re-delegate events (handlers live on the prototype, not the template).

```ts
function hotSwapByTemplate(
  oldTemplate: ViewTemplate,
  newTemplate: ViewTemplate,
): void;
```

### hotSwapByView(oldClass, newClass)

View class HMR. Updates the registry (replaces `oldClass` entries with `newClass`) and hot-swaps every mounted frame whose view is an `instanceof oldClass` via `hotSwapView`. Used by the auto-injected view class HMR snippet.

```ts
function hotSwapByView(oldClass: typeof View, newClass: typeof View): void;
```

### hotSwapView(frame, NewViewClass)

In-place prototype swap for a single frame. Preserves `updater.data`, `resources`, `_events`, `signature`. Performs six steps: unbind old events, prepare new class, swap prototype, update template, bind new events, force-render. The user's `init()` / `ctor()` / `render()` are NOT re-invoked.

```ts
function hotSwapView(frame: FrameApi, NewViewClass: typeof View): void;
```

### hotSwapFrames(viewPath, NewViewClass)

Batch `hotSwapView` by viewPath. Finds all frames matching `viewPath` and hot-swaps each. Used by `acceptView` (the manual API).

```ts
function hotSwapFrames(viewPath: string, NewViewClass: typeof View): void;
```

### reloadViews(viewPath)

Legacy full-remount. Destroys the old view instance and creates a fresh one, losing all view-local state. Retained for backward compatibility. Prefer `hotSwapFrames` for state-preserving updates.

```ts
function reloadViews(viewPath: string): void;
```

### acceptView(hot, viewPath) / disposeView(hot, viewPath)

Manual HMR API (fallback for files not covered by auto-injection). `acceptView` calls `hotSwapFrames` (state-preserving). `disposeView` calls `invalidateViewClass`. Both are no-ops when `hot` is `undefined`.

```ts
acceptView(hot: HotContext | undefined, viewPath: string): void
disposeView(hot: HotContext | undefined, viewPath: string): void
```

### injectTemplateHmrSnippet(source, bundler) / injectViewHmr(source, bundler)

Snippet generators from `hmr-inject.ts` (zero runtime imports, safe in Node.js). Used by the Vite/Webpack/Rspack plugins to append HMR code to compiled output.

```ts
function injectTemplateHmrSnippet(source: string, bundler: Bundler): string;
function injectViewHmr(source: string, bundler: Bundler): string;
```

### Cross-bundler HMR API differences

| Bundler | HMR context       | Accept callback receives new module |
| ------- | ----------------- | ----------------------------------- |
| Vite    | `import.meta.hot` | Yes, via `newModule.default`        |
| Webpack | `module.hot`      | No, module already re-executed      |
| Rspack  | `module.hot`      | No, module already re-executed      |

In Vite, the accept callback runs in the OLD module's scope. In Webpack/Rspack, it runs in the NEW module's scope. Both snippets use `dispose` to `hot.data` to `accept` to pass the old reference.

### Manual usage pattern (fallback)

```ts
// src/views/home.ts — only needed if auto-injection doesn't cover this file
import { defineView } from "@lark.js/mvc";
import template from "./home.html";

const HomeView = defineView({ template /* ... */ });

if (import.meta.hot) {
  HomedisposeView(import.meta.hot, "home");
  HomeacceptView(import.meta.hot, "home");
}

export default HomeView;
```

---

## VDOM

Virtual DOM types and functions. Used when `FrameworkConfig.virtualDom` is `true`. Imported via `import { vdomCreate, createVDomRef } from '@lark.js/mvc'`.

### VDomNode

```ts
interface VDomNode {
  tag: string | number; // tag name, 0 for text, SPLITTER for raw HTML
  html: string; // inner HTML or text content
  attrs?: string; // serialized opening tag with attributes
  attrsMap?: Record<string, unknown>;
  attrsSpecials?: Record<string, string>; // DOM property names (value, checked, selected)
  hasSpecials?: Record<string, string> | undefined;
  children?: VDomNode[] | undefined;
  compareKey?: string | undefined; // from id, #, or v-lark path
  reused?: Record<string, number> | undefined; // keyed children count map
  reusedTotal?: number;
  views?: [string, string, string, Record<string, string>][] | undefined;
  selfClose?: boolean;
  isLarkView?: string | undefined;
}
```

### VDomRef

```ts
interface VDomRef {
  viewId: string;
  viewRenders: ViewApi[];
  nodeProps: [Element, string, unknown][];
  asyncCount: number;
  changed: number;
  domOps: DomOp[];
}
```

### vdomCreate(tag, props?, children?, specials?)

Create a VDomNode. The compiled VDOM template calls this function for every element and text node.

```ts
function vdomCreate(
  tag: string | number,
  props?: Record<string, unknown> | number | null,
  children?: VDomNode[] | number | null,
  specials?: Record<string, string>,
): VDomNode;
```

- Text node: `tag=0`, `html=text content`.
- Raw HTML: `tag=SPLITTER`, `html=raw string`.
- Element: serializes opening tag, builds `attrsMap`, detects `v-lark` sub-views, extracts `compareKey` from `#` or `id` or `v-lark` path, propagates `reused` keys upward, merges adjacent text nodes.
- Self-closing: when `children === 1`.

### createVDomRef(viewId)

Create a VDomRef for tracking VDOM diff operations:

```ts
function createVDomRef(viewId: string): VDomRef;
```

### VDOM diff algorithm

The VDOM diff engine (`vdomSetChildNodes`) uses a three-phase algorithm:

1. **Head fast-path**: matches identical nodes from the start, updates in place.
2. **Tail fast-path**: matches identical nodes from the end.
3. **KeyMap reconciliation with LIS**: builds `keyMap` from remaining old children, creates `sequence[]` mapping new to old indices, computes the Longest Increasing Subsequence via patience sorting O(n log n). Iterates backward: LIS nodes stay in place, others are moved via `insertBefore`, unmatched nodes are created fresh.

`computeLIS(sequence)` uses patience sorting with binary search. Entries with value < 0 (unmatched) are skipped.

---

## Frame Devtool Bridge

`postMessage` bridge for the Lark Devtool panel.

```ts
import {
  installFrameDevtoolBridge,
  serializeFrameTree,
  FrameDevtoolBridge,
  type SerializedFrameNode,
  type SerializedFrameTree,
  type SerializedViewInfo,
} from "@lark.js/mvc";
```

`installFrameDevtoolBridge()` — called once by `Framework.boot`. Installs a `message` listener that responds to:

- `LARK_DEVTOOL_PING` → `LARK_DEVTOOL_PONG`
- `LARK_DEVTOOL_REQUEST_TREE` → `LARK_DEVTOOL_TREE`

Also pushes `LARK_DEVTOOL_TREE_DELTA` to `window.parent` on Frame `add`/`remove` (when running in an iframe).

`serializeFrameTree()` — walk the Frame tree from the root, return a JSON-safe snapshot. Returns an empty snapshot if the framework hasn't booted yet.

`FrameDevtoolBridge` — message-type constants.

---

## Template Runtime

Available at `@lark.js/mvc/runtime`. The compiler emits `import { encHtml as __larkEncHtml, ... } from "@lark.js/mvc/runtime"` in every `.html` module so each template doesn't redefine the helpers — saves ~400 bytes per compiled template.

```ts
export const strSafe: (v: unknown) => string;
export const encHtml: (v: unknown) => string;
export const encUri: (v: unknown) => string;
export const encQuote: (v: unknown) => string;
export const refFn: (
  ref: Record<string, unknown>,
  value: unknown,
  key: string,
) => string;
```

You normally don't import these directly — only the compiled template output does.

---

## Compiler

Build-time only. Imported by the Vite plugin and Webpack loader.

```ts
import { compileTemplate, extractGlobalVars } from "@lark.js/mvc";
```

### compileTemplate(source, options?)

Compile an `.html` template into an ES module string.

```ts
function compileTemplate(
  source: string,
  options?: {
    debug?: boolean; // inject line markers + try-catch wrapper for debugging
    globalVars?: string[]; // pre-declared global variable names (destructured from $data)
    file?: string; // file path used in error messages
    virtualDom?: boolean; // generate VDOM output instead of HTML string (default: false)
  },
): string;
```

The output begins with:

```ts
import { encHtml as __larkEncHtml, strSafe as __larkStrSafe, encUri as __larkEncUri, encQuote as __larkEncQuote, refFn as __larkRefFn } from "@lark.js/mvc/runtime";
export default function(data, viewId, refData) { ... }
```

When `virtualDom: true`, the output imports `vdomCreate` from `@lark.js/mvc` and produces a function returning `VDomNode` instead of a string. The VDOM function signature has 7 parameters (no `$encHtml`): `($data,$viewId,$refAlt,$strSafe,$refFn,$encUri,$encQuote) => VDomNode`.

### extractGlobalVars(source)

AST-based extraction of variable names referenced by the template. Uses `@babel/parser` to parse the template, walks the AST to collect `Identifier` nodes, excludes locals and built-in globals (approximately 100 entries including template runtime helpers, JS built-ins, DOM globals).

```ts
function extractGlobalVars(source: string): string[];
```

If parsing fails (malformed template), falls back to a regex-based extractor.

## Utilities & Constants

Exported from the main entry.

| Name              | Signature                                                   | Purpose                                                 |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| `mark` / `unmark` | `mark(host, key) => () => boolean` / `unmark(host) => void` | Async callback validity tracking (module-level WeakMap) |
| `useUrlState`     | `(view, config?) => void`                                   | Sync view state with URL search params                  |

Internal utilities (`noop`, `hasOwnProperty`, `assign`, `keys`, `generateId`, `funcWithTry`, `setData`, `translateData`, `getById`, `ensureElementId`, `nodeInside`, `parseUri`, `toUri`, `toMap`, `now`, `isPlainObject`, `getAttribute`, `EMPTY_STRING_SET`, etc.) are NOT exported from the public entry. They live in `utils.ts` and `constants.ts` for framework-internal use.

### Constants

| Name                       | Value                                     | Purpose                               |
| -------------------------- | ----------------------------------------- | ------------------------------------- |
| `SPLITTER`                 | `"\x1e"`                                  | Internal separator (Record Separator) |
| `LARK_VIEW`                | `"v-lark"`                                | Sub-view attribute name               |
| `CALL_BREAK_TIME`          | `48`                                      | Task chunk budget (ms)                |
| `ROUTER_EVENTS`            | `{ CHANGE, CHANGED, PAGE_UNLOAD }`        | Router event name constants           |
| `TAG_NAME_REGEXP`          | `/<([a-z][^/\0>\x20\t\r\n\f]+)/i`         | First tag detector                    |
| `EVENT_METHOD_REGEXP`      | (see `constants.ts`)                      | Parse `viewId\x1ehandlerName(params)` |
| `VIEW_EVENT_METHOD_REGEXP` | `/^(\$?)([\w]*)<(.*?)>(?:<([\w ,]*)>)?$/` | Match `name<click>` patterns          |
| `nextCounter()`            | `() => number`                            | Increment global counter              |

---

## Vite / Webpack / Rspack integrations

```ts
import { larkMvcPlugin } from "@lark.js/mvc/vite";
import { larkMvcLoader } from "@lark.js/mvc/webpack";
import {
  larkMvcLoader as larkMvcLoaderRspack,
  LarkMvcPlugin,
} from "@lark.js/mvc/rspack";
```

### larkMvcPlugin(options?)

Vite plugin. `enforce: "pre"`. Tags `.html` imports with `?lark-template`, then compiles them in the `load` hook. The `resolveId` hook handles Rolldown URL-style paths (newer Vite versions).

```ts
larkMvcPlugin(options?: {
  debug?: boolean;       // enable debug line markers
  virtualDom?: boolean;  // generate VDOM template output
}): Plugin
```

Also exports `larkMvcPluginLegacy` (simpler resolveId without Rolldown handling) for older Vite versions.

### larkMvcLoader (Webpack)

Webpack loader. Standard loader signature. Uses `this.callback()` for async delivery (standard webpack 5 pattern). Pass `{ debug: true }` via the loader options to enable line markers.

```js
{
  test: /\.html$/,
  use: [{ loader: larkMvcLoader, options: { debug: true } }],
  exclude: /index\.html$/,
}
```

`LarkMvcPlugin` (Webpack) -- webpack plugin that auto-registers the loader rule for `.html` files. Pushes `{test, exclude, use: [{loader: __filename, options}]}` into `compiler.options.module.rules`.

### larkMvcLoader (Rspack)

Rspack loader. Same compilation pipeline as the Webpack loader, but returns a Promise directly instead of calling `this.callback()`. Rspack async loaders must return the result as a Promise.

```js
{
  test: /\.html$/,
  use: [{ loader: larkMvcLoader, options: { debug: true } }],
  exclude: /index\.html$/,
}
```

`LarkMvcPlugin` (Rspack) -- implements `RspackPluginInstance`, uses `Compiler` type from `@rspack/core`. Auto-registers the loader rule for `.html` files.

---
