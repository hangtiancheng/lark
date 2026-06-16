## @lark.js/mvc

A TypeScript MVC framework designed for back-office single-page applications and micro-frontend scenarios.

`@lark.js/mvc` explicitly separates Model, View, and Controller layers: state management aligns with the zustand design (`create` / `getState` / `setState` / `subscribe`), routing supports both history and hash modes, templates compile to functions and render via real DOM diff, and micro-frontends are natively supported through the built-in CrossSite bridge and first-class Webpack Module Federation integration. The framework has zero runtime third-party dependencies; the template runtime helper module weighs approximately 1 KB (`dist/runtime.js` measured at 964 bytes).

- Package: `@lark.js/mvc`
- Version: see `package.json` (currently 0.0.5)
- Entry points: `./` main entry, `./vite` build plugin, `./webpack` loader, `./runtime` template runtime
- Build: tsup, producing ESM + CJS + `.d.ts` in `dist/`
- Tests: vitest, 16 test files covering core modules

## Table of Contents

- Design Goals and Use Cases
- Installation and Build Tool Configuration
- Five-Minute Quick Start
- Three Data Pipelines: Updater / State / Store
- View Definition and Lifecycle
- Router and Route Guards
- Service Request Layer
- Template Syntax
- Frame and the View Tree
- Module Federation Micro-Frontend
- Debugging and DevTools Bridge
- Public API Reference
- Common Pitfalls
- Recent API Changes
- Comparison with Vue 3 / React 19
- Testing and Local Development

## Design Goals and Use Cases

Lark's trade-offs center around one category of requirements: back-office business systems with deep route hierarchies, heavy forms and API calls, and the need to compose several independent applications into a single shell. The framework makes explicit choices along the following dimensions.

First, explicit layering. The Model layer provides `State` / `Store` (zustand-style) / `Service`, the View layer provides `View` / `Updater`, and the Controller layer provides `Router` (history/hash dual mode) / `Frame`. These communicate through explicit interfaces and events, allowing new team members to locate code by layer.

Second, native micro-frontend support. The `CrossSite` bridge view + `FrameworkConfig.require` + Module Federation form a complete pipeline. Write `v-lark="remote-app/views/home"` in a template and the remote view loads and mounts automatically, eliminating the need for secondary containers like single-spa or qiankun.

Third, zero runtime dependencies. `@babel/parser` / `@babel/types` are used only at build time for template parsing. The runtime helper module `@lark.js/mvc/runtime` contains five functions (`strSafe` / `encHtml` / `encUri` / `encQuote` / `refFn`) and weighs approximately 1 KB as ESM.

Fourth, real DOM diff. Templates compile to functions that produce HTML strings, which are parsed into temporary DOM via `document.implementation.createHTMLDocument` and then diffed against the live DOM using keyed comparison. The advantage is that context-sensitive tags like `<table>` / `<select>` / `<svg>` are handled by the native parser. The trade-off is that large templates incur parse overhead, and SSR is not supported.

Fifth, debug-friendly. `window.__lark_Debug = true` enables Safeguard Proxy protection against cross-page pollution and accidental writes. `installFrameVisualizerBridge` exposes the Frame tree to visual DevTools via `postMessage`. A set of `window.__lark_*` global shortcuts cover Framework / State / Router / Frame / View and HMR helpers.

Not suitable for: projects requiring SSR/streaming rendering, cross-platform needs like React Native, or projects needing off-the-shelf Chrome extension panels. For those, consider the React or Vue ecosystems.

## Installation and Build Tool Configuration

### Installation

```bash
pnpm add @lark.js/mvc
```

### Vite (Recommended)

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

`larkMvcPlugin()` registers at the `enforce: "pre"` stage: the `resolveId` hook appends a `?lark-template` suffix to `.html` imports to prevent Vite from treating them as static assets; the `load` hook calls `extractGlobalVars()` and `compileTemplate()` to compile templates into ES modules exporting a render function of the form `(data, viewId, refData) => string`. With `{ debug: true }`, source location markers are injected into the output so runtime errors can be traced back to the original HTML line.

### Webpack

```js
// webpack.config.mjs
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

Two important notes: the `loader` field must be imported as a value (`loader: larkMvcLoader`), not as a string name; you must use `exclude: /index\.html$/` to let `HtmlWebpackPlugin` handle the entry HTML, otherwise it will be compiled as a template.

Both integrations share the same compilation pipeline: `extractGlobalVars` extracts external variables referenced in the template, and `compileTemplate` produces an ES module that imports helper functions from `@lark.js/mvc/runtime`.

## Five-Minute Quick Start

### Entry HTML

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Lark App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/boot.ts"></script>
  </body>
</html>
```

`<div id="app">` corresponds to `rootId: "app"` in the boot configuration. `boot.ts` must reside in `src/` because the HTML references `/src/boot.ts`; placing it at the project root will cause a runtime resolution failure.

### Project-Level Base View

```ts
// src/view.ts
import { defineView, Router } from "@lark.js/mvc";

export default defineView({
  make() {
    this.updater.set({ appName: "My App" });
    this.on("destroy", () => console.log(`view destroyed: ${this.id}`));
  },
  navigate(path: string, params?: Record<string, unknown>) {
    Router.to(path, params);
  },
});
```

`defineView` is a typed wrapper around `View.extend`: via `ThisType<P & ViewInterface>` it threads the literal's own fields into `this`, so writing `this.appName` in `make` requires no cast. Runtime behavior is equivalent to `View.extend({...})`.

### View and Template

```html
<!-- src/views/home.html -->
<div>
  <h1>{{=title}}</h1>
  <p>Count: {{=count}}</p>
  <button @click="incr()">+1</button>
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
  <div v-lark="components/counter-store"></div>
</div>
```

```ts
// src/views/home.ts
import { bindStore } from "@lark.js/mvc";
import View from "../view";
import template from "./home.html";
import useCountStore from "../store/count";

export default View.extend({
  template,
  init() {
    this.assign();
    bindStore(this, useCountStore, (s) => ({ count: s.count }));
  },
  assign() {
    this.updater.snapshot();
    const { count } = useCountStore.getState();
    this.updater.set({
      title: "Home",
      count,
      items: [
        { id: "a", name: "Alpha" },
        { id: "b", name: "Beta" },
      ],
    });
    return this.updater.altered();
  },
  render() {
    this.updater.digest();
  },
  "incr<click>"() {
    useCountStore.getState().increment();
  },
});
```

### Boot

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
  error(e) {
    console.error("Lark error:", e);
  },
};

Framework.boot(config);
```

`Framework.boot()` executes the following steps in order (order is correctness-sensitive): merge user config (including `routeMode`), inject config into Router (which determines history/hash mode), set EventDelegator's frame getter, subscribe to Router/State `changed` events, mark Framework/Router/State as booted, install the Frame Visualizer Bridge, create the root Frame via `Frame.createRoot(config.rootId)`, call `Router._bind()` to bind route events (popstate for history mode, hashchange + popstate for hash mode) and trigger the first `diff()`, and finally mount `defaultView` if Router has not mounted a view. Step seven must precede step eight because the first `diff()` may immediately trigger `CHANGED` followed by `Frame.getRoot()`, and if the root Frame does not exist it degrades to rendering against the wrong element.

## Three Data Pipelines: Updater / State / Store

Lark provides three data flow mechanisms simultaneously, ranging from simple to complex, corresponding to "view-private", "lightweight cross-view sharing", and "complex reactive cross-view sharing". Choose the simplest approach that meets your needs to reduce cognitive overhead.

### Updater: View-Private

`Updater` is each View's local data manager. All intra-view data flow ultimately goes through the Updater:

```ts
this.updater.set({ count: newCount });
this.updater.digest();
```

Full pipeline: `updater.set(data)` shallow-merges data into the internal data object and collects changed keys. `updater.digest()` calls the compiled template function to generate an HTML string. `vdomGetNode` uses `tmp.innerHTML = wrap + html` to parse it into temporary DOM. `vdomSetChildNodes` compares against the live DOM to produce a keyed diff. DOM operations are applied in batch. `endUpdate()` notifies child Frames to complete mounting.

Supports digest re-entry: calling `updater.digest()` during an active digest does not nest; instead it queues to `digestingQueue` and executes after the current digest completes. `null` serves as a digest boundary sentinel in the queue.

### State: Lightweight Cross-View

`State` is a global singleton key-value container, suitable for lightweight shared values like page title, login info, or current theme:

```ts
import { State } from "@lark.js/mvc";

State.set({ pageTitle: "Home", isLoggedIn: true });
State.digest();
```

Subscription has two approaches. First, declare `observeState` in a view, and the framework automatically re-renders when the corresponding keys change:

```ts
export default View.extend({
  template,
  observeState: "pageTitle,isLoggedIn",
  assign() {
    this.updater.snapshot();
    this.updater.set({
      title: State.get("pageTitle"),
      logged: State.get("isLoggedIn"),
    });
    return this.updater.altered();
  },
});
```

Second, listen directly to the `changed` event where `e.keys` is a `ReadonlySet<string>`:

```ts
State.on("changed", (e) => {
  if (e.keys?.has("pageTitle")) console.log("Title changed");
});
```

State manages lifecycle through reference counting on keys. Best practice is to add a `State.clean` mixin to all consumers, ensuring that when the last observer is destroyed, the key is automatically reclaimed:

```ts
export default View.extend({
  mixins: [State.clean("pageTitle,isLoggedIn")],
  template,
});
```

Without cleanup, keys persist on global State causing leaks.

### Store: Zustand-Style State Management

The Store API aligns with zustand's design: `create(name, (set, get) => body)` returns a `StoreApi` object providing `getState` / `setState` / `subscribe` / `destroy`. State is a plain object with no Proxy; all writes must go through `setState` or actions. `bindStore(view, store, selector?)` binds a store to a Lark View with automatic unsubscription on view destruction.

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
    set({ count: count - step });
  },
  reset() {
    set({ count: 0, history: [] });
  },
}));

export default useCountStore;
```

The creator function receives `(set, get)` and executes once during `create`. Lark iterates the return value: functions become actions (attached to state, unaffected by `setState`); `computed(deps, fn)` occupies a derived slot, running `fn()` once for the initial value and recomputing whenever any dep key changes via `setState`; all other fields become initial state. Writing to a computed key via `setState` is silently ignored.

Reading and writing state:

```ts
// Read
const { count, step } = useCountStore.getState();

// Write (shallow merge)
useCountStore.setState({ count: 5 });
useCountStore.setState((prev) => ({ count: prev.count + 1 }));

// Call action
useCountStore.getState().increment();
```

Binding in a view:

```ts
import { bindStore } from "@lark.js/mvc";

export default View.extend({
  template,
  init() {
    // Bind all non-function state keys to view updater; auto-unsubscribes on destroy
    bindStore(this, useCountStore);

    // Or use a selector to sync only specific keys
    bindStore(this, useCountStore, (s) => ({ count: s.count }));
  },
  "increment<click>"() {
    useCountStore.getState().increment();
  },
});
```

Custom subscription callback (when data transformation is needed before sync):

```ts
init() {
  const syncToView = () => {
    const s = useCountStore.getState();
    this.updater.digest({ count: s.count, isPositive: s.count > 0 });
  };
  const off = useCountStore.subscribe(syncToView);
  this.on("destroy", off);
  syncToView();
}
```

Destroying a store:

```ts
useCountStore.destroy(); // Clears all listeners, removes from registry
```

### Comparison

| Dimension    | State                                  | Store                                              |
| ------------ | -------------------------------------- | -------------------------------------------------- |
| Write        | `State.set(...)` + `State.digest()`    | `store.setState(partial)` or action                |
| Read         | `State.get(key)`                       | `store.getState()`                                 |
| Subscribe    | `observeState` or `on("changed")`      | `store.subscribe(listener)` or `bindStore`         |
| View binding | `observeState("keys")`                 | `bindStore(view, store, selector?)`                |
| Lifecycle    | `State.clean` mixin auto-reclaims keys | `store.destroy()` manual teardown                  |
| Derived data | Not supported                          | `computed(deps, fn)`                               |
| Use case     | Page title, login state, theme         | Business entities, forms, complex cross-view state |

Selection guide: start with State; upgrade to Store when you need actions, derived data, or fine-grained subscriptions; view-private data always goes through Updater.

## View Definition and Lifecycle

### Two Definition Approaches

`View.extend({...})` is the low-level primitive approach where all mixins, event methods, and lifecycle hooks are declared in the passed object:

```ts
import { View } from "@lark.js/mvc";

export default View.extend({
  template,
  init() {
    /* ... */
  },
  assign() {
    /* ... */
  },
  render() {
    /* ... */
  },
});
```

`defineView({...})` is a typed wrapper that threads the literal's own fields into `this` via `ThisType<P & ViewInterface>`:

```ts
import { defineView } from "@lark.js/mvc";

export default defineView({
  customField: "x",
  init() {
    console.log(this.customField);
  },
});
```

Both produce equivalent runtime artifacts; the difference is purely in TypeScript inference.

### Lifecycle

- `init(params?)` — Called when the view is first instantiated. `params` comes from query strings on `v-lark`. Read stores and call `this.assign()` to prepare initial data here.
- `make()` — Called by the merged ctors pipeline; each mixin's `make` executes in order. Suitable for "run once per instance" initialization.
- `assign()` — Should be called when data may have changed. Pattern: `this.updater.snapshot()` at the top, `this.updater.set(...)` in the middle, `return this.updater.altered()` at the end. The framework uses `altered()` to determine whether re-render is needed.
- `render()` — Default implementation is `this.updater.digest()`. Wrapped by `View.wrapMethod`: increments signature on entry, handles pending endUpdate cleanup on exit.
- Destruction — The framework automatically calls `release(key, true)` to release all `capture`d resources, cleans up event delegation, and sets signature to 0.

`view.signature` marks async operation validity: greater than 0 means the view is alive (incremented on each render), 0 means destroyed. Never modify it manually.

### Event Methods

Event methods are named `name<eventType>` or `$selector<eventType>`. `View.prepare` scans the prototype at class definition time, parsing methods into three maps (`$evtObjMap` / `$selMap` / `$globalEvtList`) written to the prototype, managed at runtime by `EventDelegator`.

| Syntax                     | Meaning                                            |
| -------------------------- | -------------------------------------------------- |
| `handler<click>`           | Event on the view's root element                   |
| `$selector<click>`         | Delegated to child elements matching `.selector`   |
| `$<click>`                 | Empty selector, triggers Frame boundary event only |
| `$window<resize>`          | Delegated to `window`                              |
| `$document<keydown>`       | Delegated to `document`                            |
| `handler<click,mousedown>` | Multi-event binding                                |
| `name<click><ctrl>`        | Fires only when Ctrl modifier is held              |

The event callback receives an object `e` that, beyond standard Event fields, provides `e.eventTarget` (the actual hit DOM element) and `e.params` (parsed from the `@event` parameter string). Multiple mixins defining the same event method name are merged into a handler chain called in mixin order.

Event delegation implementation: `EventDelegator` attaches listeners on `document.body` in the capture phase. When an event fires, it walks from `e.target` up to body, calling `findFrameInfo` at each level to locate the owning View and filter handlers by selector. Reference counting manages addition/removal of same-name events on body to prevent duplicate binding or premature unbinding.

### Resource Management

`capture` registers "destroyable objects tied to the view lifecycle":

```ts
const timer = setInterval(tick, 1000);
this.capture(
  "myTimer",
  {
    destroy() {
      clearInterval(timer);
    },
  },
  true,
);
```

The third parameter `destroyOnRender` when `true` causes automatic destruction and removal on the next render call; when `false` cleanup happens only on view destruction. `release(key, destroy = true)` manually removes an entry.

### Async Safety

Async callbacks may arrive after a view has re-rendered or been destroyed. `wrapAsync` adds a signature check layer:

```ts
async loadData() {
  const safe = this.wrapAsync((data: unknown) => {
    this.updater.set({ items: data }).digest();
  });
  const data = await fetch("/api/items").then((r) => r.json());
  safe(data); // Will not execute if view has re-rendered or been destroyed
}
```

`mark(host, key)` / `unmark(host)` is the lower-level equivalent mechanism: returns a `() => boolean` validator. All mark state is stored in a module-level `WeakMap` rather than polluting the host object, so it works on `Object.freeze`d objects.

## Router and Route Guards

Router supports two routing modes, configured via `FrameworkConfig.routeMode`:

- `"history"` (default): uses `history.pushState` / `popstate`, URLs like `/home?page=2`
- `"hash"`: uses URL hash fragment, URLs like `#!/home?page=2`

All state parses into a single `Location` object; cache hits skip parsing.

### Basic Usage

```ts
import { Router } from "@lark.js/mvc";

Router.to("/list", { page: 2 }); // path + params
Router.to({ page: 3 }); // params only
Router.to("/list", { page: 2 }, true); // replace mode
Router.to("/list", { page: 2 }, false, true); // silent, no events
```

```ts
const loc = Router.parse(); // current Location
const loc2 = Router.parse("https://x/?a=1#!/path?p=v");
const diff = Router.diff(); // most recent LocationDiff
```

`Location` provides `path` / `params` / `hash` / `query` / `view` and a `get(key, defaultValue?)` method.

### Two-Phase Change Event

```ts
Router.on("change", (e) => {
  if (hasUnsavedChanges) e.prevent();
  else if (mustReject) e.reject();
  else e.resolve();
});
Router.on("changed", (diff) => {
  // diff: LocationDiff { params, path?, view?, force, changed }
});
```

The `change` phase allows `prevent` (suspend further processing), `reject` (rollback URL to `lastHash`), or `resolve` (commit; if none is called explicitly, resolve is the default). The `changed` phase is the final notification where the framework re-mounts views.

### Async Route Guards

```ts
const off = Router.beforeEach(async (to, from) => {
  if (to.path === "/admin") {
    const ok = await checkPermission();
    return ok;
  }
  return true;
});
// Unregister
off();
```

Guards execute in registration order. Any guard that returns/resolves to `false`, throws, or rejects will abort the navigation and rollback the URL. Returning `true` / `undefined` / any non-`false` value allows passage.

### useUrlState: URL Parameter State Sync

`useUrlState(view, initialState?)` reads URL query parameters into a state object and provides a `setState` function that writes changes back to the URL (via `Router.to()`). It automatically observes the specified parameter keys, re-rendering the view when the URL changes.

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

Supports both history and hash routing modes.

## Service Request Layer

`Service` is a request management layer built on `fetch` (or any synchronous function) with built-in LFU caching, concurrent deduplication, serial queuing, and lifecycle events.

### Defining Subclasses and Endpoints

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
    cleanKeys: "userList",
  },
]);
```

### Using in Views

```ts
export default View.extend({
  template,
  init() {
    const service = new AppService();
    this.capture("userService", service, true);
    this.service = service;
    this.loadData();
  },
  loadData() {
    this.service.all("userList", (errors, payload) => {
      if (!errors[0]) {
        this.updater.set({ users: payload.get("data") }).digest();
      }
    });
  },
});
```

| Method                      | Behavior                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `service.all(attrs, done)`  | Fetch all endpoints; callback `(errors, p1, p2, ...)` when all complete            |
| `service.one(attrs, done)`  | Fetch all endpoints; callback `(error, payload, isLast, index)` on each completion |
| `service.save(attrs, done)` | Same as `all` but skips cache, always makes a fresh request                        |
| `service.enqueue(task)`     | Add to serial queue                                                                |
| `service.dequeue(...args)`  | Take one item and execute                                                          |
| `service.destroy()`         | Destroy instance and cancel pending callbacks                                      |

### Caching and Deduplication

`Cache` implements an LFU-style bounded cache: sorted by `(frequency, lastTimestamp)`, evicting `bufferSize` entries via single-pass partial selection (O(n\*k), k typically 5) when capacity exceeds `maxSize + bufferSize`. `del` immediately removes from the `entries` array and `lookup` Map.

`_pendingCacheKeys` tracks in-flight requests per `(endpoint, params)` key. Concurrent calls to the same key are added to a callback chain; a single request completes and invokes all callbacks, avoiding redundant network round-trips.

`cleanKeys: "userList"` means the current endpoint, upon completion, clears the corresponding cache entry — commonly used to invalidate list queries after a write operation.

## Template Syntax

Template files use the `.html` extension and are compiled at build time by `larkMvcPlugin` / `larkMvcLoader` into ES modules exporting a `(data, viewId, refData) => string` render function.

### Expression Operators

| Syntax          | Meaning                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| `{{=variable}}` | HTML-escaped output (escapes `& < > " ' \``)                                                                      |
| `{{!variable}}` | Raw output, use with caution (potential XSS)                                                                      |
| `{{@variable}}` | Reference lookup: stores the JS value in refData and produces a token, used with `@event` to pass live references |
| `{{:variable}}` | Two-way binding marker; renders equivalently to `=`                                                               |

### Control Flow

```html
{{if condition}}...{{else if other}}...{{else}}...{{/if}} {{forOf list as item}}
... {{/forOf}} {{forOf list as item idx}} {{=idx}}: {{=item.name}} {{/forOf}}
{{forOf list as {name, age} idx last first}} ... {{/forOf}} {{forIn object as
value key}} ... {{/forIn}} {{for (let i = 0; i < n; i++)}} ... {{/for}} {{set
localVar = expr}}
```

`forOf` requires the `as` keyword. `{{forOf list item}}` is a compile-time error; the correct form is `{{forOf list as item}}`.

### Event Binding

```html
<button @click="handlerName({key: 'value', other: 123})">Go</button>
<input @input="onInput()" />
<form @submit.prevent="onSubmit()">...</form>
```

The compiler converts JS object literal parameters (`{a:1}`) to URL query string format (`a=1`) for transmission through DOM attributes, and injects the current view's `$viewId` with SPLITTER delimiters into the attribute so that EventDelegator routes events to the correct view and method across nested Frame boundaries.

### Child View Embedding

```html
<div v-lark="components/child"></div>
<div v-lark="components/child?title=hello&id=42"></div>
<div v-lark="remote-app/views/home"></div>
```

With query strings, parameters are translated into the first argument of the child view's `init`. When containing SPLITTER reference tokens, `translateData` resolves original JS values from the parent view's refData before passing them to the child.

### VDOM Optimization Hints

| Attribute | Purpose                                                                    |
| --------- | -------------------------------------------------------------------------- |
| `ldk`     | diff key: when old and new ldk match, the entire subtree's diff is skipped |
| `lak`     | attribute key: skips attribute diff but children continue to diff          |
| `lvk`     | view key: assign optimization marker                                       |

Marking large static subtrees with `ldk` can completely skip rendering work. This is currently the framework's only "fine-grained skip diff" mechanism; the compiler does not automatically mark fully static subtrees.

## Frame and the View Tree

`Frame` manages view mounting and unmounting, maintains parent-child relationships, and provides cross-view method invocation. Each Frame corresponds to one DOM container and one View instance.

### Typed API

| API                                               | Description                                                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `Frame.get(id)`                                   | Look up Frame by DOM id                                                                                                        |
| `Frame.getAll()`                                  | All Frames as `Map<string, Frame>`                                                                                             |
| `Frame.getRoot()`                                 | Current root Frame; returns `undefined` if not created                                                                         |
| `Frame.createRoot(id)`                            | Idempotent root creation (`Framework.boot` calls this)                                                                         |
| `Frame.root(id)`                                  | `@deprecated` alias, forwards to `createRoot`                                                                                  |
| `new Frame(containerId)`                          | Independent Frame instance for micro-frontend / embedded widget scenarios                                                      |
| `frame.invoke(name, args?)`                       | Call the owning view's method; if view not mounted, pushes to `invokeList`, flushed by `View.runInvokes(frame)` after mounting |
| `frame.children()`                                | Child Frame id array (order not guaranteed)                                                                                    |
| `frame.parent(level?)`                            | Ancestor Frame, defaults to one level up                                                                                       |
| `frame.mountFrame(id, viewPath, params?)`         | Explicitly create a child Frame                                                                                                |
| `frame.unmountFrame(id)`                          | Unmount a specific child Frame                                                                                                 |
| `frame.mountZone(id?)` / `frame.unmountZone(id?)` | Batch mount/unmount all `v-lark` child nodes in a zone                                                                         |
| `Frame.on("add" \| "remove", handler)`            | Frame instance lifecycle events (static emitter)                                                                               |
| `frame.on("created" \| "alter", handler)`         | All child Frames rendered / child content changed (instance emitter)                                                           |

Frame instances enter `frameCache` object pool upon destruction, caching up to `MAX_FRAME_POOL = 64`; beyond that threshold they are GC'd. Do not retain Frame references after unmounting as the object may be reused.

## Module Federation Micro-Frontend

Lark treats Module Federation as a first-class citizen, providing two integration modes.

### Mode 1: Direct Async Loading

Via `FrameworkConfig.require`, resolve unregistered view paths to remote modules:

```ts
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
        const rc = (window as Record<string, unknown>)[remote];
        if (!rc) return undefined;
        await rc.init(container);
        const factory = await rc.get(`./${mod}`);
        const raw = factory();
        return raw && raw.__esModule ? raw.default : raw;
      }),
    );
  },
});
```

Then write `v-lark="remote-app/views/home"` in templates to trigger async loading and mounting of the remote view.

### Mode 2: CrossSite Bridge View

For skeleton screens and remote `prepare` hooks, use `CrossSite`:

```ts
import { CrossSite, registerViewClass } from "@lark.js/mvc";
registerViewClass("cross-site", CrossSite);
```

```html
<div v-lark="cross-site?view=remote-app/views/home&bizCode=mybiz"></div>
```

CrossSite first renders as a normal view showing a skeleton (default `Loading...`, overridable via `skeleton` parameter) and occupies a `<div id="mf_${viewId}">` sub-container. `updateView()` uses `++this.$sign` to get a sequence number, loads the remote prepare module via `use(projectName/prepare)` and executes it. Race guard: if after loading `this.$sign !== sign`, return immediately (user navigated away). If the same view path as last time and the remote view exposes an `assign` method, it calls `assign` + `render` in-place to reuse the existing view; otherwise it calls `owner.mountFrame('mf_' + this.id, this.$view, this.$params)` to actually mount.

### Webpack Configuration

Host:

```js
new ModuleFederationPlugin({
  name: "host_app",
  remotes: {
    "remote-app": "remote_app@//cdn.example.com/remote-app/remoteEntry.js",
  },
  shared: { "@lark.js/mvc": { singleton: true, requiredVersion: "^1.0.0" } },
});
```

Remote:

```js
new ModuleFederationPlugin({
  name: "remote_app",
  filename: "remoteEntry.js",
  exposes: { "./views/home": "./src/views/home", "./prepare": "./src/prepare" },
  shared: { "@lark.js/mvc": { singleton: true, requiredVersion: "^1.0.0" } },
});
```

`@lark.js/mvc` must be `singleton: true`; otherwise host and remote hold different View/Frame class instances and all `instanceof` checks fail across boundaries.

`splitChunks.chunks` must be `"async"`. Using `"all"` extracts `@lark.js/mvc` into a separate vendor chunk, breaking MF shared scope initialization (`ScriptExternalLoadError: Loading script failed`).

## Debugging and DevTools Bridge

### Global Objects

After `Framework.boot` completes, the following are attached to `window`:

| Global                               | Value                         | Purpose                             |
| ------------------------------------ | ----------------------------- | ----------------------------------- |
| `window.__lark_Framework`            | Framework object              | Direct access                       |
| `window.__lark_State`                | State object                  | Direct access                       |
| `window.__lark_Router`               | Router object                 | Direct access                       |
| `window.__lark_Frame`                | Frame class                   | Direct access                       |
| `window.__lark_View`                 | View class                    | Direct access                       |
| `window.__lark_registerViewClass`    | Function                      | HMR: re-register View class         |
| `window.__lark_invalidateViewClass`  | Function                      | HMR: remove View from registry      |
| `window.__lark_getViewClassRegistry` | Function                      | HMR: read registry                  |
| `window.__lark_Debug`                | boolean, must be set manually | Enable Safeguard Proxy debug checks |

### Safeguard Debug Mode

Set `window.__lark_Debug = true` before boot, and the framework wraps `State.get()` / `Router.diff()` results and `Updater.get()` return values with Safeguard Proxy:

- Warns when reading data written by another page (potential cross-page pollution).
- Warns immediately when assigning directly to objects returned by `State.get()` (deduplicated by key); the correct approach is `State.set(patch)` + `State.digest()`.

### Frame Visualizer Bridge

`installFrameVisualizerBridge()` is automatically installed during `Framework.boot`, listening for `window` message events and communicating with DevTools via postMessage:

- `LARK_VIS_PING` — responds with `LARK_VIS_PONG` to confirm this page is a Lark application.
- `LARK_VIS_REQUEST_TREE` — responds with `LARK_VIS_TREE` carrying `SerializedFrameTree`.
- Internally listens to `Frame.on('add' | 'remove')` and automatically pushes `LARK_VIS_TREE_DELTA`; JSON.stringify is compared with `lastTreeJson` before pushing to avoid flooding when nothing changed.

The `lark-visual` sub-project in this repository is the paired visual DevTools that loads the target application via iframe to display the real-time Frame tree.

## Public API Reference

### Framework

- `Framework.boot(config)` — Start the application.
- `Framework.getConfig()` / `Framework.getConfig(key)` — Read configuration.
- `Framework.setConfig(patch)` — Merge configuration, returns merged result.
- `Framework.use(names, callback?)` — Async view loader; returns `Promise<unknown[]>` when no callback.
- `Framework.mark(host, key)` / `Framework.unmark(host)` — Async callback validity tracking via module-level `WeakMap`.
- `Framework.dispatch(target, type, init?)` — Trigger custom DOM event.
- `Framework.task(fn, args?, ctx?)` — Chunked execution: prefers `scheduler.postTask` then `requestIdleCallback` then `setTimeout(0)`, with a fixed 48ms budget or adaptive time slicing.
- `Framework.delay(ms)` — Promise-wrapped setTimeout.
- `Framework.waitZoneViewsRendered(viewId, timeout?)` — Wait until all views in a zone have rendered.
- `Framework.applyStyle(idOrPairs, css?)` — Dynamically inject CSS, returns cleanup function.

### Updater

- `updater.get(key?)` — Read data; returns entire data object when no key.
- `updater.set(data, excludes?)` — Shallow merge and collect changed keys.
- `updater.digest(data?, excludes?, callback?)` — Render; supports re-entry via `digestingQueue`.
- `updater.snapshot()` — Record current monotonic version.
- `updater.altered()` — Check if changed, returns `boolean | undefined`.
- `updater.translate(value)` — Resolve SPLITTER + number reference tokens to original values.
- `updater.parse(expr)` — Safe path parser: dot paths (`a.b.c`) or numeric literals only, no eval.
- `updater.getChangedKeys()` — `ReadonlySet<string>` of keys changed since last digest.

### Store (zustand-style)

- `create(name, (set, get) => body)` — Create store, returns `StoreApi`.
- `store.getState()` — Read current state.
- `store.setState(partial | updater)` — Shallow merge, notify all listeners.
- `store.subscribe(listener)` — Listen for changes, returns unsubscribe function.
- `store.destroy()` — Destroy store, clear listeners.
- `computed(deps, fn)` — Declare derived state.
- `bindStore(view, store, selector?)` — Bind to Lark View with auto-sync and auto-cleanup.
- `useUrlState(view, initialState?)` — URL parameter state sync.

## Common Pitfalls

1. `boot.ts` must be inside `src/`: HTML references `/src/boot.ts`; placing it at the project root causes runtime resolution failure.
2. `registerViewClass` must precede `Framework.boot()`: all View classes (including sub-components) must either be pre-registered or loaded via `FrameworkConfig.require`.
3. `.html` imports require build integration: only works in projects compiled by `larkMvcPlugin` / `larkMvcLoader`.
4. Write State with `State.set` + `State.digest`, never mutate the returned object directly: Safeguard warns in debug mode, deduplicated by key.
5. `bindStore` auto-unsubscribes on view destroy; manual `store.subscribe(listener)` calls need explicit cleanup (e.g., `this.on("destroy", off)`).
6. Event methods use `<>` not `()`: write `name<click>`, not `name(click)`.
7. `assign()` must have `snapshot` at the top and `return altered()` at the bottom: both are required for the framework to determine re-render necessity.
8. Never modify `view.signature`: internally managed; 0 means destroyed, render wrapper auto-increments.
9. `v-lark` container content is replaced: do not put scaffold text inside.
10. Webpack must use `exclude: /index\.html$/`: entry HTML is handled by HtmlWebpackPlugin.
11. Webpack loader must be imported as a value: `loader: larkMvcLoader`, not a string name.
12. Store state is a plain object: `store.getState()` returns the actual state object; reads are direct access, writes must go through `setState()` or actions.
13. `forOf` requires `as`: `{{forOf list item}}` is a compile error.
14. `wrapAsync` validates by signature: callback only executes when `view.signature` matches the value at wrap time.
15. Frame object pool caps at `MAX_FRAME_POOL = 64`: do not retain Frame references after `unmountFrame`.
16. Updater supports digest re-entry: digest during digest enters `digestingQueue`; `null` is the boundary.
17. Store creator runs once: state persists across view mount/unmount cycles; call `store.destroy()` to tear down.
18. State is simple, Store is complex: lightweight shared values use State; use `create()` for actions, derived data, or fine-grained subscriptions; always pair State writes with `mixins: [State.clean("keys")]` to prevent leaks.
19. MF view paths use the remote project name as prefix: `v-lark="remote-app/views/home"` triggers async loading via `FrameworkConfig.require` when unregistered; `@lark.js/mvc` must be `singleton: true`.
20. `splitChunks.chunks` must be `"async"` in MF projects: `"all"` breaks shared scope initialization.

## Recent API Changes

- Store rewrite (zustand-style):
  - `defineStore(name, (store) => body)` replaced by `create(name, (set, get) => body)`. `defineStore` retained as deprecated alias.
  - `store.key = value` (Proxy write) replaced by `set({ key: value })`.
  - `store.key` reads in actions replaced by `get().key`.
  - `useStore(view)` + `store.observe(view, keys?)` replaced by `bindStore(view, store, selector?)`.
  - `useStore()` (read-only access) replaced by `store.getState()`.
  - `store.observe(undefined, keys, cb)` (internal reaction) replaced by `store.subscribe((state, prev) => ...)`.
  - Removed: `multi()`, `cell()`, `observeCell()`, `cloneStore()`, `getStore()`, `delStore()`, `getUseStore()`, `isStoreActive()`, `createState()`, `shallowSet()`, `lazySet()`, `cloneData()`, `isState()`, `storeMark`, `storeUnmark`, `getPlatform`, `Platform`, `StoreConfig`, `ObservePayload`, `StoreMethods`, `LarkUseStore`, `ReactUseStore`, `NodeUseStore`.
- Router history mode support:
  - Added `FrameworkConfig.routeMode` (`"history"` default, `"hash"` optional).
  - In history mode, path comes from `window.location.pathname`, params from search query string.
  - Added `useUrlState(view, initialState?)` for URL parameter state sync.
- `ChangeEvent.keys` changed to `ReadonlySet<string>` (was `Record<string, 1>`). Use `keys.has("foo")` instead of `keys.foo`.
- `StateInterface.diff()` returns `ReadonlySet<string>`.
- `Updater.set/digest`, `State.set/digest`, `setData` `excludes?` changed to `ReadonlySet<string>` (was `Set<string>`).
- `Frame.root(id)` `@deprecated`. Read via `Frame.getRoot()`, create singleton via `Frame.createRoot(id)`, independent mount via `new Frame(id)`.
- `Updater.parse` no longer evals; only supports safe paths and literals.
- `mark.ts` no longer writes magic keys to host objects; uses module-level `WeakMap`, works on `Object.freeze`d objects.
- `Cache.del` immediately removes from `entries` array and `lookup` Map (previously left tombstones until next eviction).

## Comparison with Vue 3 / React 19

### vs Vue 3

Similarities: templates compile to functions; reactivity via Proxy; derived data with `computed`; microtask batching; component-level granular updates.

| Dimension             | Vue 3                                  | Lark                                                  |
| --------------------- | -------------------------------------- | ----------------------------------------------------- |
| Component abstraction | SFC / function components / Options    | Class inheritance `View.extend` / `defineView`        |
| Render output         | VNode patch                            | HTML string parsed to real DOM + diff                 |
| Template syntax       | `v-if` / `v-for` / `:bind`             | `{{if}}` / `{{forOf}}` / `@event` / `v-lark`          |
| Dependency tracking   | Automatic effect tracking              | subscribe + bindStore + computed                      |
| Compile optimizations | PatchFlag / hoistStatic / cacheHandler | Only `ldk` / `lak` / `lvk` user-manual markers        |
| Micro-frontend        | Third-party (qiankun / wujie etc.)     | Built-in `CrossSite` + `FrameworkConfig.require`      |
| Scheduling            | Microtask batching + nextTick          | Microtask batching + `Framework.task` sliceable queue |

The key difference is render output: Vue uses virtual node patching; Lark generates HTML strings, parses them via innerHTML into a temporary div, then diffs the resulting real DOM. The advantage is that context-sensitive tags (`<table>` / `<select>` / `<svg>`) are handled by the native parser nearly for free; the disadvantage is the absence of PatchFlag-style compile-time annotations (only user-manual `ldk` / `lak` / `lvk`).

### vs React 19

Similarities: unidirectional data flow; immutable write-back style; async protection (`wrapAsync` is analogous to `useEffect` cleanup + AbortController); microtask batching; global error boundary (`FrameworkConfig.error` + `funcWithTry`).

| Dimension             | React 19                                 | Lark                                                         |
| --------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| Component abstraction | Function components + Hooks              | Class inheritance `View.extend` / `defineView`               |
| State encapsulation   | `useState` / `useReducer`                | View instance fields, `create()` store, `State`              |
| Side effects          | `useEffect` / `useLayoutEffect`          | `init` / `make` + `capture` / `release`                      |
| Render interruption   | Fiber time-slicing, Suspense, Transition | Synchronous digest, not interruptible                        |
| Compile optimization  | React Compiler (auto-memo)               | Template compile-time only; no runtime auto-memo             |
| Server rendering      | RSC, streaming SSR                       | Not supported (design trade-off)                             |
| Cross-platform        | React Native / DOM                       | Web DOM only                                                 |
| Event system          | Synthetic Event                          | `document.body` capture-phase delegation + selector matching |
| Route guards          | Third-party router libraries             | Built-in `Router.beforeEach(asyncGuard)` + two-phase change  |

The key difference is scheduling: React 19's Concurrent mode can interrupt and restart renders by lane priority. Lark's `Updater.digest()` is synchronous (though the internal `digestingQueue` supports re-entry) and never yields the main thread. For large lists or frequent updates, Lark has no time-slicing mechanism, which may cause long tasks; the advantage is predictable behavior and simpler debugging.

## Testing and Local Development

```bash
pnpm install
pnpm test            # vitest unit tests
pnpm test:coverage   # coverage report
pnpm test:watch      # watch mode
pnpm typecheck       # tsc --noEmit
pnpm build           # tsup produces ESM + CJS + dts
pnpm format          # prettier formatting
```

`vitest.config.ts` targets the `tests/` directory with 16 test files covering core modules. `tsup.config.ts` defines four entry points (`index` / `vite` / `webpack` / `runtime`) with output in `dist/`.

## License

ISC. See `LICENSE` in the repository root.
