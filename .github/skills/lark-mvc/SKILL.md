---
name: lark-mvc
description: >
  Comprehensive guide to the Lark MVC Framework (@lark.js/mvc) for building
  TypeScript SPAs. Use this skill any time the user works with Lark -- creating
  Views with View.extend() or defineView(), defining zustand-aligned Stores
  with create() / getState() / setState() / subscribe() / computed() /
  bindStore(), wiring State for cross-view data, setting up Router (history
  or hash mode, Router.beforeEach async guards, useUrlState), writing HTML
  templates with {{=}}/{{forOf}}/{{if}}/@event/v-lark syntax, configuring
  the Vite plugin (larkMvcPlugin) or Webpack loader (larkMvcLoader),
  registering Views with registerViewClass, integrating Module Federation
  with CrossSite, calling Service for API requests with caching/dedup/queue,
  or anything mentioning Frame trees, history/hash routing, real-DOM diff,
  capture-phase event delegation, or the v-lark attribute. Also trigger on
  Lark-related debugging (window.__lark_Debug, Frame Visualizer Bridge,
  ldk/lak/lvk attributes) and on questions about Lark's three data pipelines
  (Updater / State / Store) or migration patterns between them.
---

# Lark MVC Framework

`@lark.js/mvc` is a TypeScript MVC framework for single-page applications. It pairs a strict Model-View-Controller layout with zustand-aligned state management, dual-mode routing (history + hash), and a real-DOM diff renderer. The framework treats micro-frontend integration (Module Federation) as a first-class concern.

This guide walks through architecture, the full public API, project layout, the three data pipelines, the template language, the build-tool integrations, and the common pitfalls. For exhaustive API signatures and template syntax, follow the pointers in [References](#references) at the end.

## When to reach for this skill

Any task that names -- or clearly implies -- Lark:

- Creating, extending, or registering Views; wiring view event handlers; setting up view lifecycle (`init`, `make`, `assign`, `render`, `destroy`).
- Designing state with `create()` (zustand-aligned), `computed()`, `bindStore()`, `getState()` / `setState()` / `subscribe()`, or cross-view sharing through `State`.
- Routing tasks: history/hash navigation, route guards (`Router.beforeEach`), two-phase `change`/`changed` events, `Router.to(...)`, `useUrlState()`.
- Authoring `.html` templates with the `{{=}}` / `{{forOf}}` / `{{if}}` / `@event` / `v-lark` syntax.
- Configuring the Vite plugin (`larkMvcPlugin`) or Webpack loader (`larkMvcLoader`).
- Embedding remote views via Module Federation (`CrossSite`, `FrameworkConfig.require`).
- API request layers using `Service.extend`, `Service.add`, `service.all/one/save`, `cleanKeys`.
- Debugging Frame trees, working with `window.__lark_Debug`, or the Frame Visualizer Bridge.

## Architecture

Lark separates code along three orthogonal axes:

- **Model**: `State` (simple global singleton, recommended for lightweight cross-view values), `create()` (zustand-aligned store with `getState`/`setState`/`subscribe`, `computed`, `bindStore` for View binding), `Service` (API request manager with LFU cache + deduplication + serial queue).
- **View**: `View.extend()` and the typed `defineView()` factory both produce View subclasses. Views own templates, event handlers, the lifecycle, the per-view `Updater`, and resource bookkeeping.
- **Controller**: `Router` (history or hash routing, two-phase change confirmation, `beforeEach` async guards), `Updater` (per-view data binding, change tracking, DOM diff), `Frame` (the runtime tree of view containers, mount/unmount lifecycle, deferred `invoke` queue).

### The three data pipelines

Lark exposes three ways to flow data to a view. Pick the simplest one that solves the task.

1. **Updater pipeline** (view-local). Use when only the current view reads and writes the data.
   `updater.set(data)` -> `updater.digest()` -> compiled template function -> HTML string -> `solidDomGetNode` parses it into a temporary DOM tree -> `solidDomSetChildNodes` diffs against the live DOM using keyed matching -> DOM ops applied -> `endUpdate()` notifies child frames.

2. **State pipeline** (simple cross-view, recommended for lightweight shared values like counters, toggles, page title, session info).
   `State.set(data)` -> `State.digest()` -> `changed` event fires with `keys: ReadonlySet<string>` -> views listening read via `State.get()` in their `assign()` -> standard Updater path. State uses key reference counting; pair with `mixins: [State.clean("a,b")]` so keys are removed when the last view unmounts.

3. **Store pipeline** (complex cross-view, zustand-aligned, recommended when you need actions, derived data, or store-internal reactions).
   `store.setState(partial)` -> shallow merge -> recompute `computed` deps -> `subscribe` listeners fire -> `bindStore` adapter calls `updater.set(data).digest()`. Supports `computed(deps, fn)` for derived state.

### Boot sequence (order matters)

`Framework.boot(config)` runs these steps in this exact order:

1. Merge user config into the shared `config` object.
2. Inject the merged config into `Router` via `Router._setConfig`.
3. Set the EventDelegator's frame getter so global events can find views.
4. Subscribe Router and State `changed` events to the dispatcher.
5. Mark Framework / Router / State as booted.
6. Install the Frame Visualizer Bridge (`postMessage` listener for DevTools).
7. **Create the root Frame with `Frame.createRoot(config.rootId)` BEFORE step 8.**
8. **Bind `Router._bind()` so hashchange/popstate/beforeunload fire -- and Router.diff() runs once initially.**
9. Mount the `defaultView` ONLY if Router didn't already mount one (e.g., after a page reload with `#!/counter`).

The root must exist before `Router._bind()` because the initial `diff()` may immediately fire CHANGED -> `dispatcherNotifyChange` -> `Frame.getRoot()`. If the root didn't exist yet, Frame.createRoot() would default to `"root"` and the view would render into the wrong element.

### Dispatcher: iterative frame-tree walk

When Router or State fires `changed`, the dispatcher walks the Frame tree using an explicit LIFO stack (not recursion) to avoid blowing the JS call stack on deeply nested frame trees. Each visit checks whether the view's observed keys have changed (`viewIsObserveChanged` for Router, `stateIsObserveChanged` for State); if so, it calls `render()`. If `render()` returns a Promise (async render), the subtree under that frame is deferred until the promise resolves while sibling subtrees keep draining synchronously.

A monotonic `dispatcherUpdateTag` prevents double-visits within the same cycle.

### Window globals

After boot, the framework attaches these to `window` for debugging and HMR:

| Global                               | Value            | Purpose                               |
| ------------------------------------ | ---------------- | ------------------------------------- |
| `window.__lark_Framework`            | Framework object | Direct framework access               |
| `window.__lark_State`                | State object     | Direct state access                   |
| `window.__lark_Router`               | Router object    | Direct router access                  |
| `window.__lark_Frame`                | Frame class      | Direct Frame class access             |
| `window.__lark_View`                 | View class       | Direct View class access              |
| `window.__lark_registerViewClass`    | function         | HMR helper: re-register a View class  |
| `window.__lark_invalidateViewClass`  | function         | HMR helper: drop a View from registry |
| `window.__lark_getViewClassRegistry` | function         | HMR helper: read the View registry    |
| `window.__lark_Debug`                | boolean (opt-in) | Enables Safeguard Proxy debug checks  |

Set `window.__lark_Debug = true` before boot to enable Safeguard Proxy wrapping on `State.get()` reads, `Router.diff()` results, Location params, and `Updater.get()` -- it warns when data set on one page is read from a different page, and when something tries to mutate `State.get()` data directly instead of going through `State.set()` + `State.digest()`.

## Project structure

```
project/
|- index.html            # entry, references <script type="module" src="/src/boot.ts">
|- vite.config.ts        # OR webpack.config.mjs
+- src/
   |- boot.ts            # registerViewClass(...) + Framework.boot(config)
   |- view.ts            # project-wide base view (re-export of defineView/View.extend)
   |- styles.css
   |- store/
   |  +- count.ts        # create() store declarations
   |- views/
   |  |- home.ts
   |  |- home.html       # compiled by larkMvcPlugin / larkMvcLoader
   |  |- about.ts
   |  +- about.html
   +- components/        # sub-views embedded via v-lark
      |- counter-store.ts
      +- counter-store.html
```

`boot.ts` must live inside `src/` -- `index.html` references it as `/src/boot.ts`. Putting it at the project root breaks the import resolution at runtime.

## Quick start

### 1. Install

```bash
pnpm add @lark.js/mvc
```

### 2. Configure your bundler

Vite (recommended):

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { resolve } from "path";
import { larkMvcPlugin } from "@lark.js/mvc/vite";

export default defineConfig({
  plugins: [larkMvcPlugin()],
  resolve: { alias: { "@": resolve(__dirname, "./src") } },
});
```

The plugin runs in the `pre` phase. Its `resolveId` hook tags `.html` imports with a `?lark-template` suffix so Vite doesn't treat them as static assets, then its `load` hook reads the raw HTML, runs `extractGlobalVars()` (AST-based via @babel/parser) to discover template data variables, and feeds them along with the source to `compileTemplate()`, producing an ES module exporting `(data, viewId, refData) => string`.

For Webpack, mirror the same idea with the loader:

```js
// webpack.config.mjs
import { larkMvcLoader } from "@lark.js/mvc/webpack";

export default {
  // ...
  module: {
    rules: [
      { test: /\.ts$/, use: "ts-loader", exclude: /node_modules/ },
      {
        test: /\.html$/,
        use: [{ loader: larkMvcLoader }],
        exclude: /index\.html$/, // HtmlWebpackPlugin handles the entry HTML
      },
    ],
  },
};
```

Both integrations accept `{ debug: true }` to inject source-position markers into the compiled template, so runtime errors point back to the original `.html` line and expression.

### 3. Entry HTML

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Lark App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/boot.ts"></script>
  </body>
</html>
```

The `<div id="app">` matches `rootId: "app"` in the boot config.

### 4. A project-level base View

```ts
// src/view.ts
import { defineView, Router } from "@lark.js/mvc";

export default defineView({
  make() {
    this.updater.set({ appName: "My App" });
    this.on("destroy", () => {
      console.log(`View destroyed: ${this.id}`);
    });
  },
  navigate(path: string, params?: Record<string, unknown>) {
    Router.to(path, params);
  },
});
```

`defineView` is a thin, type-safe wrapper around `View.extend`: it threads the literal's own shape into `this` via `ThisType<P & ViewInterface>`, so `this.appName` inside `make` is typed without manual casts. Runtime behavior is identical to `View.extend({...})`.

### 5. Boot

```ts
// src/boot.ts
import { Framework, registerViewClass, View } from "@lark.js/mvc";
import type { FrameworkConfig } from "@lark.js/mvc";
import HomeView from "./views/home";
import AboutView from "./views/about";
import NotFoundView from "./views/404";

registerViewClass("home", HomeView as typeof View);
registerViewClass("about", AboutView as typeof View);
registerViewClass("404", NotFoundView as typeof View);

const config: FrameworkConfig = {
  rootId: "app",
  defaultPath: "/home",
  defaultView: "home",
  routes: {
    "/home": "home",
    "/about": "about",
  },
  unmatchedView: "404",
  error(e: Error) {
    console.error("Lark error:", e);
  },
};

Framework.boot(config);
```

All view classes must be registered _before_ `Framework.boot()`. The registry lives in `src/view-registry.ts` and is exposed through `registerViewClass` (re-exported from `@lark.js/mvc`).

## Defining Stores (zustand-aligned)

The Store API follows [zustand](https://github.com/pmndrs/zustand)'s design: `create(name, (set, get) => body)` returns a `StoreApi` object with `getState`, `setState`, `subscribe`, and `destroy`. State is a plain object (no Proxy). Mutations go through `setState` only. `bindStore(view, store, selector?)` connects a store to a Lark View with automatic lifecycle cleanup.

### Basic store

```ts
// src/store/count.ts
import { create, computed } from "@lark.js/mvc";

interface CountStore {
  count: number;
  step: number;
  doubled: number;
  history: string[];
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

const useCountStore = create<CountStore>("count", (set, get) => ({
  count: 0,
  step: 1,
  doubled: computed(["count"], () => get().count * 2),
  history: [] as string[],
  increment() {
    const { count, step } = get();
    set({
      count: count + step,
      history: [...get().history, `+${step} -> ${count + step}`],
    });
  },
  decrement() {
    const { count, step } = get();
    set({
      count: count - step,
      history: [...get().history, `-${step} -> ${count - step}`],
    });
  },
  reset() {
    set({ count: 0, history: [] });
  },
}));

export default useCountStore;
```

### How the creator runs

The creator receives `(set, get)` and runs once at definition time. Lark walks the return value:

- Function entries become **actions** on the store (accessible via `store.getState().increment()`). Actions are not state and are not affected by `setState`.
- `computed(deps, fn)` markers occupy a derived state slot. After all other state keys are initialized, `computed` runs `fn()` to produce the initial value. On each `setState`, if any dep key changed, the computed re-evaluates before listeners are notified. Writes to a computed key via `setState` are silently ignored.
- Everything else becomes initial state.

Internally, `computed` uses a `COMPUTED_BRAND` Symbol to mark the value. The store separates state, actions, and computed during initialization, storing computed definitions in a `Map<string, ComputedMarker>` for efficient dependency checking.

### Reading and writing state

```ts
// Read
const state = useCountStore.getState();
console.log(state.count); // 0

// Write (shallow merge, like zustand)
useCountStore.setState({ count: 5 });

// Write with updater function
useCountStore.setState((prev) => ({ count: prev.count + 1 }));

// Call an action
useCountStore.getState().increment();
```

### Subscribing to changes

```ts
// Framework-agnostic subscription
const off = useCountStore.subscribe((state, prevState) => {
  console.log("count changed:", prevState.count, "->", state.count);
});
off(); // unsubscribe
```

### Binding to a Lark View

`bindStore(view, store, selector?)` subscribes the view to the store, syncs state to the view's `updater`, and auto-unsubscribes when the view is destroyed.

```ts
import { bindStore } from "@lark.js/mvc";

export default View.extend({
  template,
  init() {
    // Bind all non-function state keys to the view updater
    bindStore(this, useCountStore);

    // Or with a selector (only selected keys are forwarded)
    bindStore(this, useCountStore, (s) => ({
      count: s.count,
      step: s.step,
    }));
  },
  "increment<click>"() {
    useCountStore.getState().increment();
  },
});
```

`bindStore` performs an initial sync immediately (`updater.set` + `updater.digest`), then subscribes. Without a selector, it forwards only non-function keys (actions are excluded). It validates that the view has a proper `updater` with `set`/`digest` methods using the internal `isLarkView` guard.

### Custom subscription with manual sync

For views that need a custom sync callback (e.g., transforming data before rendering), use `store.subscribe` directly:

```ts
init() {
  const syncToView = () => {
    const s = useCountStore.getState();
    this.updater.digest({
      count: s.count,
      isPositive: s.count > 0,
    });
  };
  const off = useCountStore.subscribe(syncToView);
  this.on("destroy", off);
  syncToView(); // initial sync
}
```

### Destroying a store

```ts
useCountStore.destroy(); // clears all listeners, removes from registry
```

Stores are registered in a module-level `Map<string, StoreApi>`. After `destroy()`, the store is flagged as destroyed and all `setState` calls become no-ops.

## Defining Views

### View template

```html
<!-- src/views/home.html -->
<div>
  <h1>{{=title}}</h1>
  <div>Count: {{=count}}</div>
  <button @click="navigateTo({path: '/about'})">About</button>

  {{if count > 0}}
  <p>Positive</p>
  {{else}}
  <p>Zero or negative</p>
  {{/if}}

  <ul>
    {{forOf items as item idx}}
    <li id="item-{{=item.id}}">{{=idx}}: {{=item.name}}</li>
    {{/forOf}}
  </ul>

  <!-- Sub-view embedding -->
  <div v-lark="components/child"></div>
</div>
```

### View class

```ts
// src/views/home.ts
import { Router, bindStore } from "@lark.js/mvc";
import View from "../view"; // project-level base
import template from "./home.html";
import useCountStore from "../store/count";

export default View.extend({
  template,

  init() {
    this.assign();

    // bindStore auto-syncs store state to updater and auto-unsubscribes on destroy
    bindStore(this, useCountStore, (s) => ({
      count: s.count,
      step: s.step,
    }));
  },

  // assign() pulls the latest store + State values into this.updater.
  // Always call snapshot() at the top and return altered() at the end
  // so the framework knows whether a re-digest is needed.
  assign() {
    this.updater.snapshot();

    const { count, step } = useCountStore.getState();
    this.updater.set({
      title: "Home",
      count,
      step,
      items: [
        { id: "a", name: "Alpha" },
        { id: "b", name: "Beta" },
      ],
    });

    return this.updater.altered();
  },

  // render() is wrapped by the framework to manage signature/lifecycle.
  // The default implementation calls this.updater.digest().
  render() {
    this.updater.digest();
  },

  // Event method naming: `name<eventType>`. See "Event methods" below.
  "navigateTo<click>"(e: Record<string, unknown>) {
    const params = e["params"] as Record<string, string> | undefined;
    if (params?.path) Router.to(params.path);
  },
});
```

### View.extend internals

`View.extend(props, statics)` uses ES6 `class extends` for proper constructor chaining. The key implementation detail: extend props (like `template`) are applied as _instance_ properties in the constructor _after_ `super()`, because ES6 class field declarations (`template;` in the base View) set `this.template = undefined` in the constructor body, which would shadow any prototype property. The `render` method is explicitly _not_ copied as an instance property -- it must remain on the prototype where `View.wrapMethod` has already wrapped it with signature checking and resource cleanup.

The constructor calls `make()` functions (from `props.make` and mixin `makes`) with arguments `[initParams, { node, deep }]`.

### View.merge

`View.merge(...mixins)` merges mixin objects into an existing View prototype. Unlike `extend` which creates a new subclass, `merge` modifies the current class in place. Event method conflicts are automatically resolved via `processMixinsSameEvent`, producing a single function that calls both handlers in sequence via a `handlerList` array.

### Event methods

Lark scans the View prototype once per class (in `View.prepare`) and builds three event maps on the prototype (`$evtObjMap`, `$selMap`, `$globalEvtList`). DOM events are delegated to `document.body` using **capture-phase** listeners with reference counting -- the first binding installs the listener, the last unbinding removes it.

| Pattern                    | Meaning                                            |
| -------------------------- | -------------------------------------------------- |
| `handler<click>`           | Root event on the view element                     |
| `$selector<click>`         | Delegated event matching CSS selector `.selector`  |
| `$<click>`                 | Empty selector -- frame boundary event only        |
| `$window<resize>`          | Global event on `window`                           |
| `$document<keydown>`       | Global event on `document`                         |
| `handler<click,mousedown>` | Multi-event binding                                |
| `name<click><ctrl>`        | Modifier filter -- only fires when Ctrl is pressed |

The regex that parses event method names: `/^(\$?)([\w]*)<(.*?)>(?:<([\w ,]*)>)?$/`

Each event handler receives an event object with these augmented fields:

- `e.eventTarget` -- the actual DOM element that was clicked.
- `e.params` -- parsed parameters from `@event` attributes (URL query string format).
- All standard DOM Event properties (`type`, `target`, etc.).

When two mixins define the same event method, they're merged into a single function that calls both in sequence via a `handlerList` array.

### View.wrapMethod (render wrapping)

`View.prepare` wraps `render()` on the prototype so that every call:

1. Checks `this.signature > 0` (view is alive).
2. Increments `this.signature` (invalidates pending `wrapAsync` callbacks).
3. Fires the `"render"` event.
4. Calls `View.destroyAllResources(this, false)` (destroys resources marked `destroyOnRender`).
5. Calls the original `render()`.

This wrapping is stored on the prototype as `$renderWrap`. Instance-level `render` assignments are correctly handled: the wrapper checks `this[fnName]` at call time and delegates to the instance method if it differs from the wrapped version.

### Resource management

`capture` and `release` manage objects whose lifetime tracks the view (timers, services, observers, etc.):

```ts
const timer = setInterval(() => {
  /* ... */
}, 1000);
this.capture(
  "myTimer",
  {
    destroy() {
      clearInterval(timer);
    },
  },
  true,
);
// destroyOnRender=true: destroyed on next render call
// destroyOnRender=false: destroyed only on view destroy
```

`release(key, destroy=true)` removes the entry (and calls `.destroy()` unless `destroy=false`).

When `capture` is called with only a key (no resource), it returns the previously captured resource -- acting as a getter.

### Async safety with `wrapAsync`

Async callbacks may resolve after the view has been re-rendered or destroyed. `wrapAsync` captures the current signature so the callback short-circuits if the view has moved on:

```ts
async loadData() {
  const safeCallback = this.wrapAsync((data) => {
    this.updater.set({ items: data }).digest();
  });
  const data = await fetch("/api/items").then(r => r.json());
  safeCallback(data); // no-op if view re-rendered or destroyed
}
```

### Leave confirmation with `leaveTip`

`leaveTip(message, condition)` sets up a leave confirmation that intercepts both Router `change` events and browser `beforeunload`:

```ts
init() {
  this.leaveTip("You have unsaved changes", () => {
    return this.formIsDirty;
  });
}
```

When `condition()` returns `true` during a route change, the navigation is prevented (the change event is prevented, and the resolve path is followed). On page unload, the browser's native confirmation dialog is shown with the provided message. The listener is automatically cleaned up on view destroy.

### Location observation

```ts
// In a view:
this.observeLocation("page,size", true); // params + observePath
this.observeLocation(["page", "size"]); // array form
this.observeLocation({ params: ["page"], path: true }); // object form
```

When the listed params or path change, the framework re-runs the view's render automatically.

### State observation (for the State pipeline)

```ts
this.observeState("count,step"); // comma-separated
this.observeState(["count", "step"]); // array
```

When State.digest() flips one of these keys, the framework re-renders the view.

### Sub-view embedding

```html
<div v-lark="components/child-view"></div>
```

At mount time, `Frame.mountZone` runs `querySelectorAll("[v-lark]")` on the view's root, creates a child Frame for each match, and mounts the registered View class. The container's inner content is replaced by the child view's rendered output.

For dynamic loading (no upfront `registerViewClass`), `mountView` automatically calls `Framework.use()` to load the View class through the configured `require` hook (see Module Federation below). The async load is guarded by the Frame's `signature` -- if the frame is unmounted during the load, the stale mount is aborted.

## Defining the Framework Boot

`Framework.boot(config)` config accepts:

```ts
interface FrameworkConfig {
  rootId: string; // required -- DOM id for the root frame
  routeMode?: "history" | "hash"; // defaults to "history"
  defaultView?: string; // default view path
  defaultPath?: string; // path when URL is empty (defaults to "/")
  routes?: Record<string, string | RouteViewConfig>; // path -> view path mapping
  hashbang?: string; // defaults to "#!" (hash mode only)
  unmatchedView?: string; // 404 view path
  rewrite?: (path, params, routes) => string; // dynamic path rewriting
  error?: (e: Error) => void; // global error handler (do not re-throw)
  extensions?: string[]; // extension view paths loaded at startup
  initModule?: string; // init module path
  skipViewRendered?: boolean;
  projectName?: string; // for Module Federation discriminator
  crossConfigs?: CrossSiteConfig[]; // MF remote configs
  require?: (names: string[], params?) => Promise<unknown[]>; // async View loader
  [k: string]: unknown; // custom keys are allowed
}
```

After boot, prefer `Framework.getConfig(key)` for reads and `Framework.setConfig(patch)` for writes. The older `Framework.config(...)` overload still works but is `@deprecated`.

## Router

The Router supports two modes controlled by `FrameworkConfig.routeMode`:

- `"history"` (default): uses `history.pushState` / `popstate` for clean URLs like `/home?page=2`
- `"hash"`: uses URL hash fragment with `#!` prefix, e.g. `#!/home?page=2`

### Navigation

```ts
Router.to("/list", { page: 2 }); // path + params
Router.to({ page: 3 }); // params-only -- keeps current path
Router.to("/list", { page: 2 }, true); // replace (no history entry)
Router.to("/list", { page: 2 }, false, true); // silent (no events)
```

### Parsing

```ts
const loc = Router.parse(); // current location
const loc = Router.parse("https://x.com/?a=1#!/path?p=v");
// loc.path, loc.params, loc.hash, loc.query, loc.view, loc.get("key", "default")
const diff = Router.diff(); // last LocationDiff or undefined
```

Router internally caches parsed locations in an LFU `Cache<Location>` (keyed by href) and diffs in a `Cache<{ changed, diff }>` (keyed by `oldHref + SPLITTER + newHref`). Caches are cleared on each navigation event.

### Two-phase change events (existing API)

```ts
Router.on("change", (e) => {
  if (hasUnsavedChanges)
    e.prevent(); // pause subsequent processing
  else if (mustReject)
    e.reject(); // revert URL to lastHash
  else e.resolve(); // commit (auto if neither called)
});
Router.on("changed", (diff) => {
  // diff is a LocationDiff: { params, path?, view?, force, changed }
});
```

### Async route guards (`Router.beforeEach`)

```ts
const off = Router.beforeEach(async (to, from) => {
  if (to.path === "/admin") {
    const ok = await checkPermission();
    return ok; // false -> revert URL, throw -> also reverts
  }
  return true; // or undefined -- permits navigation
});
// later, off() to unsubscribe
```

Guards run in registration order via a chained Promise. Any guard that returns/resolves to `false`, throws, or rejects aborts the navigation and reverts the URL. Returning `true`, `undefined`, or any non-`false` value permits it.

### `useUrlState` -- sync view state with URL params

`useUrlState(view, initialState?)` reads URL query parameters into a state object and provides a `setState` function that writes back to the URL via `Router.to()`. It automatically observes the specified param keys so the view re-renders when the URL changes.

```ts
import { useUrlState } from "@lark.js/mvc";

export default View.extend({
  template,
  init() {
    const [state, setState] = useUrlState(this, { page: "1", size: "20" });
    this.updater.set({ page: state.page, size: state.size }).digest();
    this.setPageState = setState;
  },
  "nextPage<click>"() {
    this.setPageState((prev) => ({ page: String(Number(prev.page) + 1) }));
  },
});
```

Works with both history and hash routing modes.

## Service (API requests)

`Service` is an opinionated layer around `fetch` (or any sync function) with LFU caching, in-flight deduplication, serial task queueing, and lifecycle events.

```ts
import { Service, type Payload } from "@lark.js/mvc";

const AppService = Service.extend(
  (payload, callback) => {
    fetch(payload.get<string>("url"), {
      method: payload.get<string>("method") || "GET",
      headers: { "Content-Type": "application/json" },
      body: payload.get("data")
        ? JSON.stringify(payload.get("data"))
        : undefined,
    })
      .then((r) => r.json())
      .then((data) => {
        payload.set(data);
        callback();
      })
      .catch(() => callback());
  },
  20, // cacheMax
  5, // cacheBuffer
);

AppService.add([
  { name: "userList", url: "/api/users", cache: 60_000 },
  {
    name: "userDetail",
    url: "/api/users/:id",
    cache: 30_000,
    before(payload) {
      payload.set(
        "url",
        payload.get<string>("url").replace(":id", payload.get<string>("id")),
      );
    },
    after(payload) {
      const data = payload.get("data");
      payload.set({ formatted: formatUser(data) });
    },
    cleanKeys: "userList", // invalidate userList cache when this completes
  },
]);
```

### Per-subclass isolation

`Service.extend()` produces a subclass with its own `_metaList`, `_payloadCache`, `_pendingCacheKeys`, `_syncFn`, `_staticEmitter`, `_cacheMax`, and `_cacheBuffer` via `static override`. This isolation is intentional -- endpoints registered on one subclass never leak into another. Refactoring these `static override` declarations away would break the isolation.

### Service lifecycle events

Each Service subclass has its own static `EventEmitter`. The lifecycle events fire in this order:

| Event   | When                                        |
| ------- | ------------------------------------------- |
| `begin` | Before the sync function is called          |
| `done`  | After sync function completes without error |
| `fail`  | After sync function completes with error    |
| `end`   | After `done` or `fail`, always fires        |

Subscribe via `AppService.on("begin", (e) => { ... })` (static level).

### Using a service in a view

```ts
export default View.extend({
  template,
  init() {
    const service = new AppService();
    this.capture("userService", service, true); // auto-destroy on render
    this.service = service;
    this.loadData();
  },
  loadData() {
    this.service.all("userList", (errors, userListPayload) => {
      if (!errors[0]) {
        this.updater.set({ users: userListPayload.get("data") }).digest();
      }
    });
  },
  refreshDetail(id: string) {
    this.service.save({ name: "userDetail", id }, (errors, payload) => {
      if (!errors[0]) {
        this.updater.set({ detail: payload.get("data") }).digest();
      }
    });
  },
});
```

### Service method summary

| Method                      | Behavior                                                                      |
| --------------------------- | ----------------------------------------------------------------------------- |
| `service.all(attrs, done)`  | Fetch all endpoints; callback with `(errors, p1, p2, ...)` when ALL complete  |
| `service.one(attrs, done)`  | Fetch all endpoints; callback PER endpoint: `(error, payload, isLast, index)` |
| `service.save(attrs, done)` | Like `all` but always skips cache (force refresh)                             |
| `service.enqueue(task)`     | Queue a task for serial execution                                             |
| `service.dequeue(...args)`  | Pop and run the next queued task                                              |
| `service.destroy()`         | Destroy instance; cancel further callbacks                                    |

### Caching and dedup

The `Cache` class is an LFU cache with single-pass partial-selection eviction (O(n\*k)) -- see `cache.ts`. When the cache exceeds capacity (`maxSize + bufferSize`), it selects the `bufferSize` worst entries using a sorted insertion-based selection algorithm (not a full sort), then removes them in one pass. The pending-key map (`pendingCacheKeys`) deduplicates concurrent requests for the same `(endpoint, params)`. All pending callbacks are queued and called when the single in-flight request completes.

`defaultCacheKey` memoizes `JSON.stringify(meta)` per `ServiceMetaEntry` via `WeakMap` -- meta entries are immutable after `Service.add()`.

## Templates

### Compilation pipeline

The compiler (`compiler.ts`) processes templates in four phases:

1. **Comment protection**: HTML comments are replaced with placeholders to prevent template syntax inside comments from being processed.
2. **Art-template conversion**: `{{=}}` / `{{!}}` / `{{@}}` / `{{:}}` and control flow (`forOf`, `forIn`, `if`, `for`, `set`) are converted to internal `<% %>` syntax. Block matching is validated -- unclosed blocks produce compile-time errors.
3. **Event processing**: `@event` attributes are prefixed with `VIEW_ID_PLACEHOLDER` (U+001F) + `SPLITTER` (U+001E) + handler name. JS object literal params (`{key: 'value'}`) are converted to URL query format (`key=value`).
4. **Function compilation**: `<% %>` syntax is compiled to a JS arrow function string. The function signature: `($data,$viewId,$refAlt,$encHtml,$strSafe,$encUri,$refFn,$encQuote) => string`.

Global variables are extracted via AST analysis using `@babel/parser` (`extractGlobalVars`). The walker collects all `Identifier` nodes, excludes declared variables (from `VariableDeclarator`, `FunctionDeclaration`), function parameters, and built-in globals (~80 entries: `window`, `document`, `JSON`, `Math`, etc. plus all template runtime helpers like `$data`, `$out`, `$encHtml`). The remaining identifiers are the template data variables that need destructuring from `$data`.

If AST parsing fails (malformed template), a regex-based fallback extracts variables from `{{=variable}}`, `{{forOf list as ...}}`, and `{{if variable}}` patterns.

### Operators

| Operator | Syntax          | Meaning                                                            |
| -------- | --------------- | ------------------------------------------------------------------ |
| `=`      | `{{=variable}}` | HTML-escaped output (`&`, `<`, `>`, `"`, `'`, backtick)            |
| `!`      | `{{!variable}}` | Raw output (no escaping). Use with care for user-generated content |
| `@`      | `{{@variable}}` | Reference lookup -- stores a JS value in refData, emits a token    |
| `:`      | `{{:variable}}` | Two-way binding marker (renders identically to `=`)                |

### Control flow

```html
{{if condition}}...{{else if other}}...{{else}}...{{/if}} {{forOf list as item}}
... {{/forOf}} {{forOf list as item idx}} {{=idx}}: {{=item.name}} {{/forOf}}
{{forOf list as {name, age} idx last first}} ... {{/forOf}} {{forIn object as
value key}} ... {{/forIn}} {{for (let i = 0; i < n; i++)}} ... {{/for}} {{set
localVar = expr}}
```

`forOf` REQUIRES the `as` keyword: `{{forOf list as item}}` is correct; `{{forOf list item}}` is a compile-time error.

`forOf` supports destructuring in the `as` expression: `{{forOf users as {name, age} idx last first}}` provides `last` (boolean, true on last iteration) and `first` (boolean, true on first iteration) helpers.

### Event binding

```html
<button @click="handlerName({key: 'value', other: 123})">Go</button>
<input @input="onInput()" />
<form @submit.prevent="onSubmit()">...</form>
```

The compiler converts JS object literal params (`{a: 1}`) into URL query format (`a=1`) so they can survive transport through DOM attributes. It also injects the current view's `$viewId` and a SPLITTER separator so the EventDelegator can route correctly across nested frames.

### Sub-view embedding

```html
<div v-lark="components/child"></div>
<div v-lark="components/child?title=hello&id=42"></div>
<div v-lark="remote-app/views/home"></div>
<!-- Module Federation -->
```

When `v-lark` carries a query string, the params are translated into the child view's `init` arguments. If the value contains a SPLITTER reference, `translateData` resolves it via the parent view's refData before the child mounts.

### DOM diff engine

The DOM diff (`solid-dom.ts`) operates on real DOM nodes, not a virtual representation. Key characteristics:

- **Keyed matching**: Child nodes are matched by key (`id`, `ldk`, or `v-lark` path). Unkeyed nodes are diffed in order. When a keyed node moves position, it is reattached via `appendChild` without re-creating.
- **Special element handling**: Form elements (`INPUT`, `TEXTAREA`, `OPTION`) have their `value`, `checked`, and `selected` properties synced directly (not through attributes), because these carry DOM state not reflected in `getAttribute`.
- **Same v-lark optimization**: When old and new elements have the same `v-lark` path, children are not diffed (the child view manages its own rendering).
- **HTML parsing**: New DOM is parsed from the template HTML string using a virtual document (`document.implementation.createHTMLDocument("")`). Special elements (table rows, SVG, MathML) are wrapped in their required parent containers before parsing.
- **Deferred operations**: DOM mutations are collected in a `SolidDomRef.domOps` array and applied in a single batch after the diff completes. ID updates are also deferred and applied separately.

### DOM optimization hints

| Attribute | Effect                                                                 |
| --------- | ---------------------------------------------------------------------- |
| `ldk`     | "Diff key" -- if old and new have the same `ldk`, skip the entire diff |
| `lak`     | "Attribute key" -- skip attribute diff but still diff children         |
| `lvk`     | "View key" -- assign-optimization marker                               |

Mark large static subtrees with `ldk` to skip rendering work entirely.

## Module Federation (micro-frontend)

### Pattern 1 -- Direct async loading

Configure `FrameworkConfig.require` to resolve unknown view paths through MF:

```ts
declare const __webpack_init_sharing__: (name: string) => Promise<void>;
declare const __webpack_share_scopes__: Record<string, Record<string, unknown>>;

Framework.boot({
  rootId: "app",
  projectName: "host-app",
  crossConfigs: [
    {
      projectName: "remote-app",
      source: "remote_app@//cdn.example.com/remote-app/remoteEntry.js",
    },
  ],
  require: async (names: string[]) => {
    await __webpack_init_sharing__("default");
    const container = __webpack_share_scopes__["default"];
    return Promise.all(
      names.map(async (name) => {
        const slash = name.indexOf("/");
        const remote = slash > -1 ? name.substring(0, slash) : name;
        const mod = slash > -1 ? name.substring(slash + 1) : "./index";
        const rc = (window as Record<string, unknown>)[remote] as
          | {
              init: (s: Record<string, unknown>) => Promise<void>;
              get: (m: string) => Promise<() => unknown>;
            }
          | undefined;
        if (!rc) return undefined;
        await rc.init(container);
        const factory = await rc.get(`./${mod}`);
        const raw = factory();
        return raw && (raw as Record<string, unknown>).__esModule
          ? (raw as Record<string, unknown>).default
          : raw;
      }),
    );
  },
});
```

Then `v-lark="remote-app/views/home"` just works.

When `FrameworkConfig.require` is not configured, `Framework.use()` falls back to dynamic `import()` with automatic ESM default export extraction (handles both Webpack's `__esModule` flag and Vite's direct `default` function detection).

### Pattern 2 -- CrossSite bridge view (with skeleton + prepare)

For richer scenarios that want a loading skeleton and a `prepare` hook on the remote side:

```ts
import { CrossSite, registerViewClass } from "@lark.js/mvc";
registerViewClass("cross-site", CrossSite);
```

```html
<div v-lark="cross-site?view=remote-app/views/home&bizCode=mybiz"></div>
```

CrossSite renders a skeleton container `mf_${viewId}` first, then loads the remote project's `prepare` module via `loadRemoteView()`, then mounts the actual view. Race condition is guarded by `$sign`: if the user navigates away during the async load, the stale mount is aborted. When the remote view path matches the previous one and the existing view supports `assign()`, CrossSite updates in place instead of re-mounting.

`CrossSite.callView(name, ...args)` invokes a method on the embedded remote view via `Frame.invoke()`.

### Module Federation Webpack config

Host:

```js
import { ModuleFederationPlugin } from "webpack/container";

export default {
  plugins: [
    new ModuleFederationPlugin({
      name: "host_app",
      remotes: {
        "remote-app": "remote_app@//cdn.example.com/remote-app/remoteEntry.js",
      },
      shared: {
        "@lark.js/mvc": { singleton: true, requiredVersion: "^1.0.0" },
      },
    }),
  ],
};
```

Remote:

```js
new ModuleFederationPlugin({
  name: "remote_app",
  filename: "remoteEntry.js",
  exposes: {
    "./views/home": "./src/views/home",
    "./prepare": "./src/prepare",
  },
  shared: {
    "@lark.js/mvc": { singleton: true, requiredVersion: "^1.0.0" },
  },
});
```

`@lark.js/mvc` MUST be shared as `singleton: true` so host and remote use the same View/Frame class instances -- `instanceof` checks fail across boundaries otherwise.

### `splitChunks.chunks` must be `"async"` in MF projects

If `chunks: "all"` extracts `@lark.js/mvc` into a separate vendor chunk, the MF shared scope initialization fails -- `remoteEntry.js` needs `@lark.js/mvc` synchronously available in the initial entry chunk. With `chunks: "async"`, shared singletons stay in the entry chunk and `window.<remote_name>` is set correctly.

### `Frame.root()` vs `new Frame()` for MF

`Frame.root()` (and the newer `Frame.createRoot()`) is a singleton -- always returns the first root, ignoring later `id` arguments. For MF containers that need independent rendering contexts, use `new Frame(containerId)` directly so each mount owns its frame tree.

Use the new APIs (preferred):

- `Frame.getRoot()` -- pure getter, returns `undefined` if not yet created.
- `Frame.createRoot(id)` -- idempotent create (Framework.boot calls this).
- `new Frame(containerId)` -- independent root for MF or for an embeddable widget.
- `Frame.root(id)` -- `@deprecated` alias that delegates to `createRoot`.

### Exposed mount function pattern

For React/other-host integrations, expose a mount function rather than raw View classes:

```ts
// src/exposed/counter-view.ts
import {
  Framework,
  Frame,
  registerViewClass,
  EventDelegator,
  Router,
  State,
} from "@lark.js/mvc";
import CounterView from "../views/counter";
import "../index.css"; // MF remote must explicitly import CSS

const MF_COUNTER = "mf/counter";
registerViewClass(MF_COUNTER, CounterView);

export function mountCounter(container: HTMLElement): () => void {
  const containerId = container.id || "mf-counter-root";
  container.id = containerId;

  Framework.setConfig({ rootId: containerId, error: console.error });
  EventDelegator.setFrameGetter((id: string) => Frame.get(id));
  Reflect.set(Router, "_booted", true);
  Reflect.set(State, "_booted", true);

  const frame = new Frame(containerId); // NOT Frame.createRoot
  frame.mountView(MF_COUNTER);

  return () => {
    frame.unmountView();
    Frame.getAll().delete(containerId);
    const el = document.getElementById(containerId);
    if (el) Reflect.set(el, "frameBound", 0);
  };
}
```

The MF remote MUST explicitly import its CSS (`import "../index.css"`) -- Webpack only bundles CSS reachable from the exposed module's import graph.

## Three pipelines side-by-side

```ts
// Updater (view-local, manual)
this.updater.set({ count: newCount }).digest();

// State (simple cross-view)
State.set({ count: newCount }).digest();
// to react:
State.on("changed", (e) => {
  if (e.keys?.has("count")) this.assign();
});
// to clean up on view destroy:
export default View.extend({ mixins: [State.clean("count")] });

// Store (zustand-aligned, recommended for non-trivial state)
bindStore(this, useCountStore); // auto-sync + auto-cleanup
useCountStore.getState().increment(); // mutate from anywhere
useCountStore.setState({ count: 5 }); // direct set
```

Key distinctions:

|              | State                                       | Store                                          |
| ------------ | ------------------------------------------- | ---------------------------------------------- |
| Write API    | `State.set()` + `State.digest()`            | `store.setState(partial)` or actions           |
| Read API     | `State.get(key)`                            | `store.getState()`                             |
| Subscribe    | `State.on("changed", ...)` + manual cleanup | `store.subscribe(listener)` or `bindStore`     |
| View binding | `observeState("keys")`                      | `bindStore(view, store, selector?)`            |
| Memory       | Auto-deleted via `State.clean()` mixin      | Persists until `store.destroy()`               |
| Derived data | not supported                               | `computed(deps, fn)`                           |
| Best for     | Counters, toggles, page title, session info | Business entities, forms, complex shared state |

## EventEmitter internals

The `EventEmitter` class supports re-entrant safety. While `fire()` is iterating a listener list, `off()` calls schedule deferred removal (the handler is replaced with `noop` and the key is added to `pendingCompaction`). Once the outermost `fire()` completes (`firingDepth` drops to 0), all noop-marked entries are compacted in a single pass. This means handlers can safely detach themselves or each other during dispatch without skipping siblings or breaking iteration.

Events are stored in a `Map<string, EventListenerEntry[]>` where keys are prefixed with `SPLITTER` for namespace isolation.

## Updater APIs worth knowing

- `updater.get(key?)` -- read data; without key returns the whole data object.
- `updater.set(data, excludes?)` -- merge `data` into the view's data, track changed keys. Bumps an internal monotonic `version` counter when anything actually changes.
- `updater.digest(data?, excludes?, callback?)` -- render; optional `data` is set first. Supports re-digest during an active digest via an internal queue (the `null` sentinel marks digest boundaries).
- `updater.snapshot()` -- record the current `version` (O(1), no serialization); pair with `altered()`.
- `updater.altered()` -- returns `boolean | undefined`. `undefined` if `snapshot` was never called. Compares current `version` to snapshotted `version`.
- `updater.translate(value)` -- resolve a `SPLITTER + digits` ref token to its original value. Non-ref strings are returned as-is. The protocol is strict: only `SPLITTER` followed by ASCII digits qualifies.
- `updater.parse(expr)` -- **safe** path resolver. Accepts a dotted property path (`a.b.c`) or a numeric literal (`42`, `-1.5`). Anything else returns `undefined`. Does NOT eval arbitrary JS -- CSP-safe.
- `updater.getChangedKeys()` -- `ReadonlySet<string>` of keys changed since the last digest.

## Frame APIs worth knowing

- `Frame.get(id)` -- look up a Frame by DOM id.
- `Frame.getAll()` -- registry as `Map<string, Frame>`.
- `Frame.getRoot()` -- current root or `undefined`.
- `Frame.createRoot(id)` -- create root (idempotent; ignores `id` after first creation).
- `Frame.root(id)` -- `@deprecated` alias to `createRoot`.
- `frame.invoke(name, args?)` -- call a method on the frame's view. If the view isn't yet rendered, the call is deferred until render via `invokeList`.
- `frame.invokeTyped<V, K>(name, args)` -- type-safe variant; carries the view's method signature through TS.
- `frame.children()` -- array of child Frame ids (order is not stable).
- `frame.parent(level?)` -- ancestor frame; defaults to parent (level=1).
- `frame.mountFrame(id, viewPath, params?)` -- explicit child Frame creation.
- `frame.unmountFrame(id)` / `frame.mountZone(id?)` / `frame.unmountZone(id?)` -- bulk operations.
- `Frame.on("add" | "remove", handler)` -- lifecycle events (static).
- `frame.on("created" | "alter", handler)` -- fires when all children have rendered / when child content changes. `created` propagates up the tree via `notifyCreated`.

Frame object pooling: destroyed Frame instances are pooled up to `MAX_FRAME_POOL = 64` and reused via `reInitFrame`. Don't hold references to Frame instances after `unmountFrame()`.

## Framework APIs worth knowing

- `Framework.boot(config)` -- start the app.
- `Framework.getConfig()` / `Framework.getConfig(key)` -- read config.
- `Framework.setConfig(patch)` -- merge into config; returns the merged result.
- `Framework.config(...)` -- `@deprecated`; still works.
- `Framework.isBooted()` -- boolean.
- `Framework.use(names, callback?)` -- async View loader. Returns `Promise<unknown[]>` when no callback is passed.
- `Framework.mark(host, key)` / `Framework.unmark(host)` -- async callback validity tracking. Stored in a module-level `WeakMap`, does NOT pollute the host object with magic keys.
- `Framework.dispatch(target, type, init?)` -- fire a custom DOM event.
- `Framework.task(fn, args?, ctx?)` -- schedule a function for chunked execution. Scheduling priority: `scheduler.postTask('background')` (Chrome 94+) -> `requestIdleCallback` (Chrome 47+, Firefox) -> `setTimeout(0)`. Time-slicing uses `deadline.timeRemaining()` when available, falling back to fixed 48ms (`CALL_BREAK_TIME`) budget.
- `Framework.delay(ms)` -- Promise-based setTimeout.
- `Framework.waitZoneViewsRendered(viewId, timeout?)` -- Promise resolving to `Framework.WAIT_OK` (1) or `Framework.WAIT_TIMEOUT_OR_NOT_FOUND` (0). Default timeout is 30 seconds.
- `Framework.applyStyle(idOrPairs, css?)` -- inject CSS dynamically; returns a cleanup function. Deduplicates by style ID -- calling with the same ID twice is a no-op.
- `Framework.guid(prefix?)` / `Framework.toMap(list, key?)` / `Framework.toUrl(...)` / `Framework.parseUrl(url)` / `Framework.mix(target, ...sources)` / `Framework.keys(obj)` / `Framework.inside(a, b)` / `Framework.node(idOrEl)` / `Framework.nodeId(el)` -- utility helpers.
- `Framework.guard(o)` -- Safeguard Proxy wrap (no-op outside debug mode).
- `Framework.Base` / `Framework.View` / `Framework.Frame` / `Framework.Cache` / `Framework.State` / `Framework.Router` -- class re-exports.

## Frame Visualizer Bridge

The framework installs a `postMessage` bridge during boot for the lark-visualizer devtools panel. The protocol:

| Direction            | Message type            | Data                  |
| -------------------- | ----------------------- | --------------------- |
| Visualizer -> Bridge | `LARK_VIS_PING`         | (none)                |
| Bridge -> Visualizer | `LARK_VIS_PONG`         | (none)                |
| Visualizer -> Bridge | `LARK_VIS_REQUEST_TREE` | (none)                |
| Bridge -> Visualizer | `LARK_VIS_TREE`         | `SerializedFrameTree` |
| Bridge -> Visualizer | `LARK_VIS_TREE_DELTA`   | `SerializedFrameTree` |

Delta updates are pushed automatically on Frame `add`/`remove` events. The bridge only sends if the serialized JSON has actually changed since the last push.

Exported: `installFrameVisualizerBridge()`, `serializeFrameTree()`, `FrameVisualBridge` (message type constants), and the serialization types (`SerializedFrameNode`, `SerializedFrameTree`, `SerializedViewInfo`).

## Vite vs Webpack at a glance

| Feature             | Vite (`larkMvcPlugin`)                                   | Webpack (`larkMvcLoader`)                                    |
| ------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| Import path         | `@lark.js/mvc/vite`                                      | `@lark.js/mvc/webpack`                                       |
| Type                | Vite plugin (`resolveId` + `load` hooks, `enforce: pre`) | Standard Webpack loader                                      |
| Configuration       | `plugins: [larkMvcPlugin()]`                             | `module.rules` with the loader rule                          |
| Debug mode          | `larkMvcPlugin({ debug: true })`                         | `use: [{ loader: larkMvcLoader, options: { debug: true } }]` |
| HTML entry handling | Vite handles `index.html` natively                       | MUST `exclude: /index\.html$/` so HtmlWebpackPlugin owns it  |
| Dev server          | Vite dev server (fast HMR)                               | webpack-dev-server                                           |
| Template pipeline   | Same: `extractGlobalVars` -> `compileTemplate`           | Same: `extractGlobalVars` -> `compileTemplate`               |

Both produce compiled `.html` modules that import their runtime helpers from `@lark.js/mvc/runtime` (a small module containing `encHtml`, `strSafe`, `encUri`, `encQuote`, `refFn`).

## Common pitfalls

1. **`boot.ts` must live inside `src/`** -- the entry HTML references `/src/boot.ts`, not `/boot.ts`.
2. **`registerViewClass` before `Framework.boot()`** -- all view classes (and their sub-components) must be registered before boot, OR you must provide a `FrameworkConfig.require` so unknown paths can be loaded on demand.
3. **`.html` imports require the bundler integration** -- they only work because the Vite plugin or Webpack loader compiles them at build time.
4. **Use `State.set` + `State.digest`, not direct mutation** -- direct mutation bypasses change detection. Debug mode (`window.__lark_Debug = true`) warns synchronously and dedupes the warning per key.
5. **`bindStore` auto-cleans on view destroy** -- `bindStore(this, store)` unsubscribes when the view is destroyed. Manual `store.subscribe(listener)` calls need explicit unsubscribe (e.g. `this.on("destroy", off)`).
6. **Event method names use `<>`, not `()`** -- the pattern is `name<click>`, not `name(click)`.
7. **`assign()` must call `snapshot()` and return `altered()`** -- otherwise the framework can't tell if data actually changed.
8. **Do not modify `view.signature`** -- it's managed internally. Setting it to 0 destroys the view. The wrapped `render()` increments it.
9. **`v-lark` containers are replaced** -- content inside a `v-lark` element gets replaced by the child view's rendered output. Don't put authoring text there.
10. **Webpack: exclude `index.html`** -- `larkMvcLoader` must not process the entry HTML; HtmlWebpackPlugin owns it.
11. **Webpack: import the loader as a value** -- `loader: larkMvcLoader`, not `loader: "larkMvcLoader"`.
12. **Store state is a plain object** -- `store.getState()` returns the actual state object. Reads are direct; mutations must go through `setState()` or actions. Direct mutation of `getState()` fields does NOT notify subscribers.
13. **`forOf` requires `as`** -- `{{forOf list item}}` is invalid; use `{{forOf list as item}}`.
14. **`wrapAsync` is signature-based** -- the callback runs only if `view.signature` hasn't changed since `wrapAsync` was called.
15. **Frame object pooling has a cap** -- destroyed Frame objects are pooled up to `MAX_FRAME_POOL = 64`. Don't hold references to Frame instances after `unmountFrame()`.
16. **Updater supports re-entrant digest** -- calling `updater.digest()` inside an active digest is supported through `digestingQueue`. The `null` sentinel marks digest boundaries.
17. **Store creator runs once** -- at definition time. State persists across view mounts/unmounts. Call `store.destroy()` to tear it down.
18. **State for simple, Store for complex** -- use `State.set` + `State.digest` for lightweight shared values. Reach for `create()` when you need actions, derived data via `computed(deps, fn)`, or fine-grained subscriptions. Always pair State writes with `State.clean(keys)` mixin on consumers so data doesn't leak globally.
19. **MF view paths use the remote project prefix** -- `v-lark="remote-app/views/home"` triggers async loading through `FrameworkConfig.require` if the path isn't yet registered. Ensure `require` is configured AND `ModuleFederationPlugin` shares `@lark.js/mvc` as a singleton.
20. **`CrossSite` is the export name** -- register it as `registerViewClass("cross-site", CrossSite)`.
21. **CrossSite uses `view=` not `xview=`** -- `v-lark="cross-site?view=remote-app/views/home"`.
22. **`Framework.use()` returns a Promise** -- without the optional callback, it resolves to `unknown[]`. Without a configured `require`, it falls back to dynamic `import()`.
23. **`Updater.parse` is path-only, no eval** -- it accepts dotted paths and numeric literals. `updater.parse("1 + 2")` returns `undefined`. CSP-safe by design.
24. **`LarkInnerKeys` for DOM short-circuits** -- `ldk` skips the entire diff for static elements; `lak` skips attribute diff but still diffs children; `lvk` is an assign-optimization marker.
25. **MF: `splitChunks.chunks` MUST be `"async"`** -- using `"all"` extracts `@lark.js/mvc` into a separate vendor chunk, breaking shared-scope initialization. The error surfaces as `ScriptExternalLoadError: Loading script failed (missing)`.
26. **MF: `new Frame(containerId)` for independent contexts** -- `Frame.createRoot()` (and the deprecated `Frame.root()`) is a singleton that ignores later id arguments. Each MF mount needs its own `new Frame()`.
27. **MF: remote must explicitly import CSS** -- Webpack bundles only CSS reachable from the exposed module's import graph. Without an `import "../index.css"` in the exposed entry, host pages won't receive utility classes used in the templates.
28. **Sub-component `v-lark` paths must match exactly** -- template strings embed the paths at build time; renaming a `registerViewClass` path without updating the template breaks the load.
29. **Dynamic `import()` shape is unknown** -- for chunk splitting, use a small `extractDefault()` helper to unwrap the ESM default, then cast with `as typeof View` (NOT `as any`).
30. **`capture` with one argument is a getter** -- `this.capture("key")` returns the previously captured resource, not undefined. Only `this.capture("key", resource, destroyOnRender)` stores.
31. **`View.prepare` runs once per class** -- guarded by `makes` marker on the constructor. Calling it twice is a no-op. This is why mixin event maps are frozen after first mount.
32. **EventEmitter is re-entrant safe** -- `off()` during `fire()` defers removal until all nested `fire()` calls complete. Handlers replaced with `noop` are compacted when `firingDepth` returns to 0.

## Migration notes (recent API changes)

- **Store rewrite (zustand-aligned)**:
  - `defineStore(name, (store) => body)` is replaced by `create(name, (set, get) => body)`. `defineStore` is kept as a deprecated alias.
  - `store.key = value` (Proxy write) is replaced by `set({ key: value })`.
  - `store.key` (Proxy read in actions) is replaced by `get().key`.
  - `useStore(view)` + `store.observe(view, keys?)` is replaced by `bindStore(view, store, selector?)`.
  - `useStore()` (read-only) is replaced by `store.getState()`.
  - `useStore().action()` is replaced by `store.getState().action()`.
  - `store.observe(undefined, keys, cb)` (inner observe) is replaced by `store.subscribe((state, prev) => ...)`.
  - `useStore.$destroyFn()` is replaced by `store.destroy()`.
  - Removed: `multi()`, `cell()`, `observeCell()`, `cloneStore()`, `getStore()`, `delStore()`, `getUseStore()`, `isStoreActive()`, `createState()`, `shallowSet()`, `lazySet()`, `cloneData()`, `isState()`, `storeMark`, `storeUnmark`, `getPlatform`, `Platform`, `StoreConfig`, `ObservePayload`, `StoreMethods`, `LarkUseStore`, `ReactUseStore`, `NodeUseStore`.
- **Router: history mode support**:
  - `FrameworkConfig.routeMode` added (`"history"` default, `"hash"` opt-in).
  - In history mode, path comes from `window.location.pathname`, params from search query.
  - `useUrlState(view, initialState?)` added for syncing view state with URL query parameters.
- `ChangeEvent.keys` is now `ReadonlySet<string>` (was `Record<string, 1>`). Use `keys.has("foo")` instead of `keys.foo`. Affects `State.on("changed")` handlers and `view.observeState` callbacks.
- `StateInterface.diff()` returns `ReadonlySet<string>`.
- `Framework.toUrl(path, params, keepEmpty?)` -- `keepEmpty` is now `Set<string>` (was `Record<string, number>`).
- `Updater.set/digest`, `State.set/digest`, and `setData` take `excludes?: ReadonlySet<string>` (was `Set<string>`).
- `Frame.root(id)` is `@deprecated`. Use `Frame.getRoot()` for reads, `Frame.createRoot(id)` for the explicit singleton creation, or `new Frame(id)` for independent mounts.
- `Framework.config(...)` is `@deprecated`. Use `Framework.getConfig(key?)` and `Framework.setConfig(patch)`.
- `Updater.parse` no longer evals -- only safe path/literal resolution. Migrate to a small helper function if you needed expression eval.
- `mark.ts` no longer writes magic keys onto host objects -- it uses a module-level `WeakMap`. Works on frozen objects.
- `Cache.del` now splices immediately (was leaving tombstones until the next eviction).

## References

For deeper detail than this guide:

- `references/api-reference.md` -- Complete API signatures for every Lark module.
- `references/template-syntax.md` -- Full template language reference, including compilation pipeline, operators, control flow, encoders, and debug mode.
