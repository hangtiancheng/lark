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

### Framework.applyStyle(idOrPairs, css?)

Inject CSS into the document. Returns a cleanup function. Supports batch insertion via `[id1, css1, id2, css2, ...]`.

```ts
Framework.applyStyle(idOrPairs: string | string[], css?: string): () => void
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
  view: ViewInterface,
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

Global singleton for cross-view observable data. Imported via `import { State } from '@lark.js/mvc'`. Best for simple shared values (counters, page title, session info). For complex reactive state with derived data, prefer store `create`.

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

Mixin factory. Decrements per-key reference counts on the view's destroy; keys with zero refs are removed from state. Use it to prevent State leaks.

```ts
State.clean(keys: string): { ctor: AnyFunc }
```

```ts
View.extend({ mixins: [State.clean("user,token")] });
```

### State events

| Event     | Description                                                                      |
| --------- | -------------------------------------------------------------------------------- |
| `changed` | After `State.digest()`. Payload `{ type: "changed", keys: ReadonlySet<string> }` |

State is an `EventEmitter`, so `on/off/fire` are available.

---

## View

Base view class. Imported via `import { View } from '@lark.js/mvc'`.

### View.extend(props, statics?)

Create a View subclass. The `ctor` function from `props` (and from mixins) is collected into a `ctors` array invoked in the constructor. Event method names matching `name<eventType>` are scanned at class-prepare time and routed through the EventDelegator.

```ts
View.extend(
  props?: Record<string, unknown>,
  statics?: Record<string, unknown>,
): typeof View
```

**Internals**: The returned class uses ES6 `extends` so `super()` chains correctly. Props are applied as **instance** properties after `super()` (so ES6 class fields don't shadow them) **except** for `render` — `render` stays wrapped on the prototype by `View.wrapMethod()` to manage signature checking, the `"render"` event, and `destroyAllResources()`.

### View.merge(...mixins)

Merge mixin objects into the View prototype. Conflicting event methods become an internal `handlerList` invoked in order. The `ctor` function from each mixin is appended to `ctors`.

```ts
View.merge(...mixins: Record<string, unknown>[]): typeof View
```

### View.prepare(viewClass)

Internal — scans the prototype for event method patterns. Idempotent (guarded by `ctors`). Called from `Frame.mountView` before creating the view instance.

### View instance properties

| Property            | Type                                             | Description                                           |
| ------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| `id`                | `string`                                         | Same as owner frame id                                |
| `owner`             | `FrameInterface \| 0`                            | Owner frame (`0` as placeholder before init)          |
| `updater`           | `UpdaterInterface`                               | Per-view data binder                                  |
| `signature`         | `number`                                         | `>0` = active; incremented on render; `0` = destroyed |
| `rendered`          | `boolean \| undefined`                           | Whether rendered at least once                        |
| `template`          | `ViewTemplate \| undefined`                      | Compiled template function (from `.html` import)      |
| `mixins`            | `Record<string, unknown>[]` (optional)           | Mixin objects                                         |
| `resources`         | `Record<string, ViewResourceEntry>`              | Captured resources                                    |
| `locationObserved`  | `ViewLocationObserved`                           | Location observation config                           |
| `observedStateKeys` | `string[] \| undefined`                          | State keys to observe                                 |
| `endUpdatePending`  | `number \| undefined`                            | Internal flag                                         |
| `eventObjectMap`    | `Record<string, number>` (via prototype getter)  | Event-type → bitmask                                  |
| `eventSelectorMap`  | `Record<string, ViewEventSelectorEntry>` (proto) | Event-type → selector list                            |
| `globalEventList`   | `ViewGlobalEventEntry[]` (proto)                 | window/document listeners                             |

### View lifecycle hooks

| Hook               | Description                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| `ctor()`           | Constructor-like; called once per instance with `(initParams, { node, deep })`                         |
| `init()`           | Initialization. May return a Promise; the framework waits for resolution before calling render         |
| `render()`         | Default implementation calls `updater.digest()`. Wrapped to manage signature + resource cleanup        |
| `assign(options?)` | Incremental update. Call `updater.snapshot()` first, return `updater.altered()` to skip when unchanged |

### View event methods

| Method                                      | Description                   |
| ------------------------------------------- | ----------------------------- |
| `on(event, handler)`                        | Bind an event listener        |
| `off(event, handler?)`                      | Unbind a (or all) listener(s) |
| `fire(event, data?, remove?, lastToFirst?)` | Fire an event                 |

### View data observation

| Method                                      | Description                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `observeLocation(params, observePath?)`     | Watch URL params and/or path; accepts string / string[] / `{ path, params }`                 |
| `observeState(keys)`                        | Watch State keys; comma-separated string or string array                                     |
| `capture(key, resource?, destroyOnRender?)` | Register a resource for automatic cleanup. Resource's `destroy()` is invoked on cleanup      |
| `release(key, destroy?)`                    | Manually release a captured resource                                                         |
| `wrapAsync(fn, context?)`                   | Wrap an async callback with a signature check; callback no-ops if view re-rendered/destroyed |

### View update internals

| Method                   | Description                                                                       |
| ------------------------ | --------------------------------------------------------------------------------- |
| `beginUpdate(id?)`       | Notify that HTML for `id` is about to change — unmounts child frames in the zone  |
| `endUpdate(id?, inner?)` | Notify update is done — re-mounts frames in the zone and flushes deferred invokes |

### View leave-tip

```ts
view.leaveTip(message: string, condition: () => boolean): void
```

Hooks into Router `change` and window `beforeunload`. If `condition()` returns true, navigation/unload prompts the user.

---

## defineView

Type-safe factory that wraps `View.extend`. Threads the literal's own shape into `this` via `ThisType<P & ViewInterface>`, so user fields and methods are properly typed inside hooks.

```ts
export function defineView<P extends Record<string, unknown>>(
  props: P & ThisType<P & ViewInterface>,
  statics?: Record<string, unknown>,
): typeof View;
```

Runtime semantics are identical to `View.extend(props, statics)`. The only difference is the call-site type inference.

```ts
const HomeView = defineView({
  $title: "Home",
  init() {
    // `this.$title` typed as string; `this.updater` typed via ViewInterface.
    this.updater.set({ title: this.$title });
  },
});
```

---

## Updater

Per-view data binder. `View` instances expose it as `this.updater`. Imported standalone via `import { Updater } from '@lark.js/mvc'`.

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
new Frame(id: string, parentId?: string)
```

Use `new Frame(containerId)` directly for **independent** root frames — Module Federation hosts that own multiple containers should each call `new Frame(...)` so each mount has its own tree, instead of relying on the global singleton.

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
| `view`            | Current `ViewInterface \| undefined`            |
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

Zustand-aligned state management for Lark MVC. Simple, explicit, no Proxy magic. Imported via `import { create, computed, bindStore } from '@lark.js/mvc'`.

### create(name, creator)

Define a store. The creator receives `set` and `get` and returns the initial state object. Functions in the return value become actions (attached to state, ignored by `setState`); `computed(deps, fn)` entries become derived state (read-only, auto-recomputed); everything else becomes plain state.

```ts
function create<T>(
  name: string,
  creator: (set: SetFn<T>, get: () => T) => T,
): StoreApi<T>;

type SetFn<T> = (partial: Partial<T> | ((prev: T) => Partial<T>)) => void;
```

The store is registered in a global `storeRegistry` keyed by `name`. Calling `create` with the same name replaces the previous entry.

```ts
const useCountStore = create("counter", (set, get) => ({
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

The object returned by `create`. Four methods, no magic.

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

Declare a derived property inside a `create` creator. `deps` lists the state keys that `fn` reads. Whenever any dep changes via `setState`, `fn` re-evaluates before listeners are notified.

```ts
function computed<T>(deps: readonly string[], fn: () => T): T;
```

Writes to a computed key via `setState` are silently ignored (read-only by contract).

```ts
const store = create("cart", (set, get) => ({
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

API request layer with LFU cache, deduplication, and serial queue. Imported via `import { Service, Payload } from '@lark.js/mvc'`.

### Service.extend(syncFn, cacheMax?, cacheBuffer?)

Create a subclass with its OWN per-type static state (`_metaList`, `_payloadCache`, `_pendingCacheKeys`, `_syncFn`, `_staticEmitter`, `_cacheMax`, `_cacheBuffer`). This isolation is intentional — endpoints registered on one subclass never leak into another.

```ts
Service.extend(
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

Then in templates: `v-lark="cross-site?view=remote-app/views/home&bizCode=mybiz"`.

CrossSite reads:

- `view` — remote view path (required).
- `bizCode` — passed to the remote `prepare` function.
- `skeleton` — optional HTML for the loading state.
- `skeletonParams` — optional data for the skeleton.

It uses a `$sign` counter to abort stale loads: if the user navigates away during the async `prepare`, the in-flight mount is cancelled.

`resetProjectsMap()` — clear the per-project map cache (use when `crossConfigs` change at runtime).

`CrossSite.callView(name, ...args)` — invoke a method on the mounted remote view via `Frame.invoke`.

---

## Cache

LFU cache with frequency + timestamp eviction. Single-pass partial-selection on overflow (O(n·k) instead of O(n log n) sort).

```ts
import { Cache } from "@lark.js/mvc";

const cache = new Cache<T>({
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
import { EventEmitter } from "@lark.js/mvc";

const e = new EventEmitter();
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
EventDelegator.setFrameGetter(getter: (id: string) => FrameInterface | undefined): void
EventDelegator.nextElementGuid(): number
```

`setFrameGetter` is called by `Framework.boot` so the delegator can find the owning Frame for any DOM event. Early-exit: when `findFrameInfo` sees a target with no `@<eventType>` attribute and no view has registered a selector handler for the event, it returns immediately.

---

## HMR

Hot Module Replacement support compatible with Vite's `import.meta.hot` and Webpack's `module.hot`. Imported via `import { reloadViews, View } from '@lark.js/mvc'`.

### HotContext

Interface compatible with both Vite and Webpack HMR APIs:

```ts
interface HotContext {
  accept(cb?: (newModule: unknown) => void): void;
  dispose(cb: (data: unknown) => void): void;
  invalidate(): void;
}
```

### View.accept(hot, viewPath)

Set up HMR accept handler for a View module. When the module is hot-updated:

1. Extracts the new View class from `newModule.default`.
2. Calls `registerViewClass(viewPath, NewViewClass)` to update the registry.
3. Calls `reloadViews(viewPath)` to re-mount all frames using this view path.

```ts
View.accept(hot: HotContext, viewPath: string): void
```

### View.dispose(hot, viewPath)

Set up HMR dispose handler. When the old module is disposed, calls `invalidateViewClass(viewPath)` to remove the old class from the registry.

```ts
View.dispose(hot: HotContext, viewPath: string): void
```

### reloadViews(viewPath)

Iterate `Frame.getAll()`, find frames whose `viewPath` matches, and call `frame.mountView(fullPath)` on each. The existing Frame is reused (no unmount/remount of the container), preserving parent-child relationships and frame state.

```ts
function reloadViews(viewPath: string): void;
```

### Usage pattern

```ts
// src/views/home.ts
import View from "../view";
import template from "./home.html";

const HomeView = View.extend({
  template,
  init() {
    /* ... */
  },
});

if (import.meta.hot) {
  View.accept(import.meta.hot, "views/home");
  View.dispose(import.meta.hot, "views/home");
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
  viewRenders: ViewInterface[];
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

When `virtualDom: true`, the output imports `vdomCreate` from `@lark.js/mvc` and produces a function returning `VDomNode` instead of a string. The VDOM function signature has 7 parameters (no `$encHtml`): `($data,$viewId,$refAlt,$n,$refFn,$encUri,$encQuote) => VDomNode`.

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
| `applyStyle`      | `(idOrPairs, css?) => () => void`                           | Inject CSS into `<style>` tags; returns cleanup fn      |
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
