---
name: lark-mvc
description: >
  Comprehensive guide to the Lark MVC Framework (@lark.js/mvc) for building TypeScript
  single-page applications using a functional programming style — no classes,
  no this, no prototype, no mixin.
  Use this skill any time the user works with Lark: creating Views with defineView()
  and ViewCtx, defining zustand-aligned Stores with createStore() / getState() /
  setState() / subscribe() / computed() / bindStore(), wiring State for cross-view
  data, setting up Router (history or hash mode, Router.beforeEach async guards,
  useUrlState), writing HTML templates with {{=}}/{{forOf}}/{{if}}/@event/v-lark
  syntax, configuring the Vite plugin (larkMvcPlugin), Webpack loader
  (larkMvcLoader), or Rspack loader, registering Views with registerViewClass,
  integrating Module Federation with CrossSite, calling Service for API requests
  with createService/createPayload, or anything mentioning Frame trees, real-DOM
  diff, virtual-DOM diff with LIS reconciliation, capture-phase event delegation,
  HMR (acceptView, disposeView, hotSwapByView, reloadViews), the v-lark attribute,
  the Framework singleton, or the functional factory pattern (createEmitter,
  createCache, createUpdater, createFrame).
  Trigger eagerly on any of these symbols and concepts — defineView, ViewCtx,
  ViewSetup, createStore, computed, bindStore, createService, createPayload,
  createEmitter, createCache, createUpdater, createFrame, useState, useEffect,
  useStore, useUrlState, acceptView, disposeView, hotSwapByView, hotSwapByTemplate,
  hotSwapFrames, injectTemplateHmrSnippet, injectViewHmr, registerViewClass,
  invalidateViewClass, Framework.boot, Framework.setConfig, Router.to,
  Router.beforeEach, Router.parse, State.set, State.digest, State.clean,
  EventDelegator.bind, Frame.createRoot, Frame.get, vdomCreate, v-lark,
  larkMvcPlugin, larkMvcLoader, CrossSite, CrossSiteConfig, or any file that
  imports from @lark.js/mvc.
---

# Lark MVC Framework

`@lark.js/mvc` is a TypeScript MVC framework for single-page applications. It uses a **functional programming style** — no classes, no `this`, no `prototype`, no `mixin`. All objects are created via factory functions (`defineView`, `createEmitter`, `createCache`, `createService`, `createFrame`, `createStore`) or are module-level singletons (`State`, `Router`, `Frame`, `Framework`, `EventDelegator`).

The framework pairs a strict Model-View-Controller architecture with zustand-aligned state management, dual-mode routing (history + hash), dual rendering modes (real-DOM diff + virtual-DOM diff with LIS reconciliation), and first-class micro-frontend support via Webpack Module Federation. It ships build-time integrations for Vite, Webpack, and Rspack.

## When to reach for this skill

Any task that names or clearly implies Lark:

- Creating, extending, or registering Views; wiring view event handlers; setting up view lifecycle.
- Designing state with `createStore()` (zustand-aligned), `computed()`, `bindStore()`, or cross-view sharing through `State`.
- Routing tasks: history/hash navigation, route guards (`Router.beforeEach`), `useUrlState()`.
- Authoring `.html` templates with the `{{=}}` / `{{forOf}}` / `{{if}}` / `@event` / `v-lark` syntax.
- Configuring the Vite plugin (`larkMvcPlugin`), Webpack loader (`larkMvcLoader`), or Rspack loader.
- Embedding remote views via Module Federation (`CrossSite`, `FrameworkConfig.require`).
- API request layers using `createService`, `service.all/one/save`, `cleanKeys`.
- Hot module replacement: `acceptView(hot, viewPath)`, `disposeView(hot, viewPath)`, `reloadViews(viewPath)`.
- Choosing between the real-DOM diff renderer and the virtual-DOM diff renderer (`config.virtualDom`).

## Architecture

Lark separates code along three orthogonal axes:

- **Model**: `State` (simple global singleton), `createStore()` (zustand-aligned store), `createService()` (API request manager with LFU cache + deduplication + serial queue).
- **View**: `defineView(setup)` produces a `ViewSetup` function. The setup function receives a `ViewCtx` and returns `{ template, events, assign? }`. Hooks (`useState`, `useEffect`, etc.) can be called inside setup.
- **Controller**: `Router` (history or hash routing, two-phase change confirmation, `beforeEach` async guards), `Updater` (per-view data binding, change tracking, DOM diff), `Frame` (the runtime tree of view containers, mount/unmount lifecycle, deferred `invoke` queue).

### The three data pipelines

1. **Updater pipeline** (view-local). `ctx.updater.set(data)` → `ctx.updater.digest()` → compiled template function → HTML string (or VDomNode tree) → DOM diff → DOM mutations → `endUpdate()` notifies child frames.

2. **State pipeline** (simple cross-view). `State.set(data)` → `State.digest()` → `changed` event fires with `keys: ReadonlySet<string>` → views observing via `ctx.observeState()` read via `State.get()` in their `assign` function → standard Updater path.

3. **Store pipeline** (complex cross-view, zustand-aligned). `store.setState(partial)` → shallow merge → recompute `computed` deps → `subscribe` listeners fire → `bindStore` adapter calls `ctx.updater.set(data).digest()`.

### Boot sequence (order matters)

`Framework.boot(config)` runs these steps in this exact order:

1. Merge user config into the shared `config` object.
2. Inject the merged config into `Router` via `Router._setConfig`.
3. Set the EventDelegator's frame getter.
4. Subscribe Router and State `changed` events to the dispatcher.
5. Mark Framework / Router / State as booted.
6. Install the Frame Devtool Bridge.
7. Create the root Frame with `Frame.createRoot(config.rootId)`.
8. Bind `Router._bind()` so hashchange/popstate/beforeunload fire and `Router.diff()` runs once initially.
9. Mount the `defaultView` ONLY if Router did not already mount one.

### Dispatcher: iterative frame-tree walk

When Router or State fires `changed`, the dispatcher walks the Frame tree using an explicit LIFO stack (not recursion). Each visit checks whether the view's observed keys have changed; if so, it calls `render()`. A monotonic `dispatcherUpdateTag` prevents double-visits within the same cycle.

### Window globals

After boot, the framework attaches these to `window` for debugging and HMR:

| Global                               | Value            | Purpose                               |
| ------------------------------------ | ---------------- | ------------------------------------- |
| `window.__lark_Framework`            | Framework object | Direct framework access               |
| `window.__lark_State`                | State object     | Direct state access                   |
| `window.__lark_Router`               | Router object    | Direct router access                  |
| `window.__lark_Frame`                | Frame singleton  | Direct Frame access                   |
| `window.__lark_registerViewClass`    | function         | HMR helper: re-register a View setup  |
| `window.__lark_invalidateViewClass`  | function         | HMR helper: drop a View from registry |
| `window.__lark_getViewClassRegistry` | function         | HMR helper: read the View registry    |

## Project structure

```
project/
|- index.html            # entry, references <script type="module" src="/src/boot.ts">
|- vite.config.ts        # OR webpack.config.mjs OR rspack.config.mjs
+- src/
   |- boot.ts            # registerViewClass(...) + Framework.boot(config)
   |- view.ts            # project-wide base view helper (withBaseView higher-order function)
   |- styles.css
   |- store/
   |  +- count.ts        # createStore() store declarations
   |- views/
   |  |- home.ts         # defineView((ctx, params) => { ... })
   |  |- home.html       # compiled by larkMvcPlugin / larkMvcLoader
   +- components/        # sub-views embedded via v-lark
      |- counter-store.ts
      +- counter-store.html
```

## Quick start

### 1. Install

```bash
pnpm add @lark.js/mvc
```

### 2. Configure your bundler

**Vite (recommended):**

```ts
import { defineConfig } from "vite";
import { resolve } from "path";
import { larkMvcPlugin } from "@lark.js/mvc/vite";

export default defineConfig({
  plugins: [larkMvcPlugin()],
  resolve: { alias: { "@": resolve(__dirname, "./src") } },
});
```

Options: `{ debug?: boolean, virtualDom?: boolean }`.

**Webpack:**

```js
import { larkMvcLoader } from "@lark.js/mvc/webpack";

export default {
  module: {
    rules: [
      { test: /\.ts$/, use: "ts-loader", exclude: /node_modules/ },
      {
        test: /\.html$/,
        use: [{ loader: larkMvcLoader }],
        exclude: /index\.html$/,
      },
    ],
  },
};
```

**Rspack:**

```js
import { larkMvcLoader, LarkMvcPlugin } from "@lark.js/mvc/rspack";

export default {
  plugins: [new LarkMvcPlugin()],
};
```

### 3. Entry HTML

```html
<!doctype html>
<html lang="en">
  <body>
    <div id="app"></div>
    <script type="module" src="/src/boot.ts"></script>
  </body>
</html>
```

### 4. A project-level base View helper

```ts
// src/view.ts
import { Router } from "@lark.js/mvc";
import type { ViewSetup } from "@lark.js/mvc";

/** Higher-order function that wraps a ViewSetup with common initialization. */
export function withBaseView(setup: ViewSetup): ViewSetup {
  return (ctx, params) => {
    console.log(`View instance created: ${ctx.id}`);
    ctx.updater.set({ appName: "My App" });
    ctx.on("destroy", () => console.log(`View destroyed: ${ctx.id}`));
    return setup(ctx, params);
  };
}

export function navigate(path: string, params?: Record<string, unknown>): void {
  Router.to(path, params);
}
```

### 5. Boot

```ts
// src/boot.ts
import { Framework, registerViewClass } from "@lark.js/mvc";
import type { FrameworkConfig, ViewSetup } from "@lark.js/mvc";
import HomeView from "./views/home";

registerViewClass("home", HomeView as ViewSetup);

const config: FrameworkConfig = {
  rootId: "app",
  defaultPath: "/home",
  defaultView: "home",
  routes: { "/home": "home" },
  error(e: Error) {
    console.error("Lark error:", e);
  },
};

Framework.boot(config);
```

## Defining Stores (zustand-aligned)

The Store API follows [zustand](https://github.com/pmndai/zustand)'s design: `createStore(name, (set, get) => body)` returns a `StoreApi` object with `getState`, `setState`, `subscribe`, and `destroy`.

### Basic store

```ts
import { createStore, computed } from "@lark.js/mvc";

interface CountStore {
  count: number;
  step: number;
  doubled: number;
  increment: () => void;
}

const useCountStore = createStore<CountStore>("count", (set, get) => ({
  count: 0,
  step: 1,
  doubled: computed(["count"], () => get().count * 2),
  increment() {
    const { count, step } = get();
    set({ count: count + step });
  },
}));

export default useCountStore;
```

### Reading and writing state

```ts
const state = useCountStore.getState();
useCountStore.setState({ count: 5 });
useCountStore.setState((prev) => ({ count: prev.count + 1 }));
useCountStore.getState().increment();
```

### Subscribing to changes

```ts
const off = useCountStore.subscribe((state, prevState) => {
  console.log("count changed:", prevState.count, "->", state.count);
});
off(); // unsubscribe
```

### Binding to a Lark View

`bindStore(ctx, store, selector?)` subscribes the view to the store, syncs state to the view's `updater`, and auto-unsubscribes when the view is destroyed.

```ts
import { defineView, bindStore } from "@lark.js/mvc";

export default defineView((ctx) => {
  bindStore(ctx, useCountStore, (s) => ({ count: s.count, step: s.step }));
  return {
    template,
    events: { "increment<click>": () => useCountStore.getState().increment() },
  };
});
```

### Destroying a store

```ts
useCountStore.destroy();
```

## Defining Views

### View template

```html
<!-- src/views/home.html -->
<div>
  <h1>{{=title}}</h1>
  <button @click="navigateTo({path: '/about'})">About</button>
  {{if count > 0}}
  <p>Positive</p>
  {{else}}
  <p>Zero</p>
  {{/if}}
  <ul>
    {{forOf items as item idx}}
    <li>{{=item.name}}</li>
    {{/forOf}}
  </ul>
  <div v-lark="components/child"></div>
</div>
```

### View setup (functional)

```ts
import { defineView, Router, bindStore } from "@lark.js/mvc";
import { withBaseView } from "../view";
import template from "./home.html";
import useCountStore from "../store/count";

export default defineView(
  withBaseView((ctx, params) => {
    // init: bind store
    bindStore(ctx, useCountStore, (s) => ({ count: s.count, step: s.step }));

    // assign: incremental DOM update
    const assign = (_options?: unknown): boolean | undefined => {
      ctx.updater.snapshot();
      const { count, step } = useCountStore.getState();
      ctx.updater.set({ title: "Home", count, step });
      return ctx.updater.altered();
    };

    // Call assign for initial render
    assign(params);

    return {
      template,
      assign,
      events: {
        "navigateTo<click>": (e: Record<string, unknown>) => {
          const p = e["params"] as Record<string, string> | undefined;
          if (p?.path) Router.to(p.path);
        },
      },
    };
  }),
);
```

### ViewCtx interface

The setup function receives a `ViewCtx` — a plain object with closure-based methods (no `this` binding). Key properties:

| Property / Method                               | Type                                              | Description                                       |
| ----------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| `ctx.id`                                        | `string`                                          | View ID (same as owner frame ID)                  |
| `ctx.owner`                                     | `FrameObj`                                        | Owner frame reference                             |
| `ctx.updater`                                   | `UpdaterApi`                                      | Data binding and DOM diff                         |
| `ctx.signature`                                 | `Ref<number>`                                     | >0 means active, 0 = destroyed                    |
| `ctx.rendered`                                  | `Ref<boolean>`                                    | Whether rendered at least once                    |
| `ctx.getTemplate()`                             | `() => ViewTemplate \| VDomTemplate \| undefined` | Get current template function                     |
| `ctx.setTemplate(v)`                            | `(v) => void`                                     | Set template function                             |
| `ctx.getEvents()`                               | `() => Record<string, AnyFunc> \| undefined`      | Get event handlers map                            |
| `ctx.setEvents(v)`                              | `(v) => void`                                     | Set event handlers map                            |
| `ctx.getAssign()` / `ctx.setAssign(v)`          |                                                   | Get/set incremental update function               |
| `ctx.resources`                                 | `Record<string, ViewResourceEntry>`               | Resource map                                      |
| `ctx.cleanups`                                  | `Array<() => void>`                               | Cleanup functions (useEffect)                     |
| `ctx.emitter`                                   | `EmitterApi`                                      | Internal emitter for lifecycle events             |
| `ctx.render()`                                  | `() => void`                                      | Trigger render (auto-called by framework)         |
| `ctx.on(event, handler)`                        | `(event, handler) => () => void`                  | Subscribe to lifecycle event, returns unsubscribe |
| `ctx.off(event, handler?)`                      |                                                   | Unsubscribe                                       |
| `ctx.fire(event, data?)`                        |                                                   | Fire event                                        |
| `ctx.observeLocation(params, path?)`            |                                                   | Observe URL changes                               |
| `ctx.observeState(keys)`                        |                                                   | Observe State keys                                |
| `ctx.capture(key, resource?, destroyOnRender?)` |                                                   | Manage resource lifecycle                         |
| `ctx.release(key, destroy?)`                    |                                                   | Release managed resource                          |
| `ctx.wrapAsync(fn, context?)`                   |                                                   | Wrap async callback with signature guard          |
| `ctx.leaveTip(message, condition)`              |                                                   | Set leave confirmation                            |

### Hooks runtime

Hooks can be called inside the setup function. They rely on a module-level `currentCtx` that is set during setup execution.

```ts
import { defineView, useState, useEffect } from "@lark.js/mvc";

export default defineView((ctx) => {
  const [getCount, setCount] = useState("count", 0);

  useEffect(() => {
    console.log("mounted with count:", getCount());
    return () => console.log("cleanup");
  }, []);

  return {
    template,
    events: { "incr<click>": () => setCount(getCount() + 1) },
  };
});
```

Available hooks: `useState`, `useEffect`, `useStore`, `useInterval`, `useTimeout`, `useResource`, `useEvent`.

### Event methods

Event handlers are defined in the `events` map returned by setup. The key format is `"name<eventType>"` or `"$selector<eventType>"`.

| Pattern                 | Meaning                                           |
| ----------------------- | ------------------------------------------------- |
| `handler<click>`        | Root event on the view element                    |
| `$selector<click>`      | Delegated event matching CSS selector `.selector` |
| `$window<resize>`       | Global event on `window`                          |
| `$document<keydown>`    | Global event on `document`                        |
| `name<click,mousedown>` | Multi-event binding                               |

Each event handler receives an event object with `e.eventTarget` (actual DOM element) and `e.params` (parsed from `@event` attributes).

### Resource management

```ts
const timer = setInterval(() => {}, 1000);
ctx.capture(
  "myTimer",
  {
    destroy() {
      clearInterval(timer);
    },
  },
  true,
);
// destroyOnRender=true: destroyed on next render call
ctx.release("myTimer", true); // destroy now
```

### Async safety with `wrapAsync`

```ts
async loadData() {
  const safeCallback = ctx.wrapAsync((data) => {
    ctx.updater.set({ items: data }).digest();
  });
  const data = await fetch("/api/items").then(r => r.json());
  safeCallback(data); // no-op if view re-rendered or destroyed
}
```

### Sub-view embedding

```html
<div v-lark="components/child-view"></div>
<div v-lark="components/child-view?title=hello&id=42"></div>
```

At mount time, `Frame.mountZone` scans `v-lark` attributes, creates child Frames, and mounts the registered View setup. For dynamic loading, `mountView` calls `Framework.use()` to load the View setup through the configured `require` hook.

## Defining the Framework Boot

`Framework.boot(config)` accepts a `FrameworkConfig` with `rootId` (required), `routeMode` ("history" | "hash"), `defaultView`, `routes`, `unmatchedView`, `require` (async View loader), `virtualDom` (boolean), and more. After boot, use `Framework.getConfig(key)` for reads and `Framework.setConfig(patch)` for writes.

## Router

The Router supports `"history"` (default, `history.pushState` / `popstate`) and `"hash"` (`#!` prefix) modes.

### Navigation

```ts
Router.to("/list", { page: 2 }); // path + params
Router.to({ page: 3 }); // params-only, keeps path
Router.to("/list", { page: 2 }, true); // replace (no history entry)
Router.to("/list", { page: 2 }, false, true); // silent (no events)
```

### Parsing

```ts
const loc = Router.parse();
// loc.path, loc.params, loc.hash, loc.query, loc.view, loc.get("key", "default")
const diff = Router.diff(); // LocationDiff | undefined
```

### Two-phase change events

```ts
Router.on("change", (e) => {
  if (hasUnsavedChanges) e.prevent();
  else if (mustReject) e.reject();
  else e.resolve();
});
Router.on("changed", (diff) => {
  /* LocationDiff */
});
```

### Async route guards

```ts
const off = Router.beforeEach(async (to, from) => {
  if (to.path === "/admin") return await checkPermission();
  return true;
});
off(); // unsubscribe
```

### `useUrlState`

```ts
import { useUrlState, defineView } from "@lark.js/mvc";

export default defineView((ctx) => {
  const [state, setState] = useUrlState(ctx, { page: "1", size: "20" });
  ctx.updater.set({ page: state.page, size: state.size });
  return {
    template,
    events: {
      "nextPage<click>": () =>
        setState((prev) => ({ page: String(Number(prev.page) + 1) })),
    },
  };
});
```

## Service (API requests)

`createService(syncFn, cacheMax?, cacheBuffer?)` creates a Service type with LFU caching, in-flight deduplication, and serial task queueing.

```ts
import { createService, createPayload } from "@lark.js/mvc";

const AppService = createService(
  (payload, callback) => {
    fetch(payload.get<string>("url"), {
      method: payload.get<string>("method") || "GET",
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
    cleanKeys: "userList",
  },
]);

const service = AppService.instance();
service.all({ name: "userList" }, (errors, ...payloads) => {
  /* ... */
});
service.one({ name: "userList" }, (error, payload, finish, idx) => {
  /* ... */
});
service.save({ name: "userList" }, (errors, ...payloads) => {
  /* skip cache */
});
```

`createPayload(data?)` creates a response wrapper with `get(key)` and `set(keyOrData, value?)` methods.

## HMR (Hot Module Replacement)

Lark ships zero-config HMR for Vite, Webpack, and Rspack. See `hmr.md` for full details.

### Manual HMR API

```ts
import { defineView, acceptView, disposeView } from "@lark.js/mvc";
import type { HotContext } from "@lark.js/mvc";
import template from "./home.html";

const HomeView = defineView((ctx) => ({ template }));

if (import.meta.hot) {
  const hot = import.meta.hot as HotContext;
  disposeView(hot, "home");
  acceptView(hot, "home");
}

export default HomeView;
```

### Runtime HMR functions

- `hotSwapByTemplate(oldTemplate, newTemplate)` — swap template on all matching views
- `hotSwapByView(oldSetup, newSetup)` — swap setup function on all matching views
- `hotSwapView(frame, newSetup)` — swap setup on a single frame (re-runs setup, preserves ctx)
- `hotSwapFrames(viewPath, newSetup)` — swap all frames matching viewPath
- `reloadViews(viewPath)` — legacy full-remount (loses state)

## Cross-site (Micro-Frontend)

`CrossSite` is a built-in View that loads remote views via Module Federation. Configure via `FrameworkConfig.crossSites` or `window.crossSites`.

```ts
const config: FrameworkConfig = {
  rootId: "app",
  projectName: "host-app",
  crossSites: [
    {
      projectName: "remote-app",
      source: "remote_app@//cdn.example.com/remote-app/remoteEntry.js",
    },
  ],
  require: async (names) => {
    /* custom loader */
  },
};
```

## State (cross-view data)

`State` is a simple global singleton for lightweight shared values (counters, toggles, page title).

```ts
State.set({ count: 1 }).digest();
const count = State.get<number>("count");
State.on("changed", (e) => {
  /* e.keys: ReadonlySet<string> */
});

// Cleanup keys when view unmounts
State.clean("count,step")(ctx); // registers destroy cleanup on ctx
```

## Frame (view lifecycle)

`Frame` is a module-level singleton managing the frame tree. `createFrame(id, parentId?)` creates individual frame objects.

```ts
Frame.get(id); // get frame by ID
Frame.getAll(); // get all frames Map
Frame.createRoot(id); // create root frame (singleton)
Frame.on("add", handler); // static events
```

Each `FrameObj` has: `id`, `getViewPath()`, `parentId`, `view` (ViewCtx | undefined), `mountView(viewPath, params?)`, `unmountView()`, `mountFrame(frameId, viewPath, params?)`, `unmountFrame(id?)`, `mountZone(zoneId?)`, `unmountZone(zoneId?)`, `parent(level?)`, `invoke(name, args?)`, `children()`, `on/off/fire`.

## EventDelegator

`EventDelegator` is a module-level singleton that delegates DOM events to `document.body` with capture-phase listeners and reference counting.

```ts
EventDelegator.bind("click", false); // bind root event
EventDelegator.bind("click", true); // bind selector event
EventDelegator.unbind("click", false);
EventDelegator.setFrameGetter((id) => Frame.get(id));
EventDelegator.clearRangeEvents(viewId);
```

At event dispatch time, `EventDelegator` looks up handlers via `view.getEvents()["handlerName<eventType>"]`.

## References

- **API reference**: `references/api-reference.md` — full type signatures
- **Template syntax**: `references/template-syntax.md` — `{{=}}` / `{{forOf}}` / `{{if}}` / `@event` / `v-lark` syntax
- **HMR**: `hmr.md` — hot module replacement architecture and API
- **Naming conventions**: `naming-convention.md` — identifier contracts across compilation layers
