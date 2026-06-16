# @lark.js/mvc — Module Federation Implementation Guide

## Overview

`@lark.js/mvc` treats Module Federation (MF) as a first-class concern of the
framework rather than a bolt-on plugin. The micro-frontend story is built on
three orthogonal primitives:

1. A module loader ([module-loader.ts](file:///Users/hangtiancheng/github/lark/packages/lark-mvc/src/module-loader.ts) `use()`)
   that bridges `FrameworkConfig.require` to the Webpack MF runtime, falling
   back to native `dynamic import()` when no loader is configured.
2. A view registry ([view-registry.ts](file:///Users/hangtiancheng/github/lark/packages/lark-mvc/src/view-registry.ts))
   that caches loaded `View` classes by path, turning the second access to a
   remote view into a synchronous lookup.
3. A bridge view ([cross-site.ts](file:///Users/hangtiancheng/github/lark/packages/lark-mvc/src/cross-site.ts)
   `CrossSite`) that wraps a remote view path with skeleton rendering,
   per-project `prepare` preloading, in-place `assign` reuse, and race-protected
   mounting.

The dispatcher (Frame tree walker) and the lifecycle (`Frame.mountView` →
`doMountView`) are MF-aware: every async branch is guarded by a per-frame
signature, so a cancelled or replaced frame cannot overwrite live UI when its
network response finally arrives.

---

## Architecture Layers

```
┌────────────────────────────────────────────────────────────-──┐
│  Template layer                                               │
│  v-lark="remote-app/views/home"                               │
│  v-lark="cross-site?view=remote-app/views/home&bizCode=…"    │
└────────────────────────┬────────────────────────────────────-─┘
                         │
┌────────────────────────--──────────────────────────────────-──┐
│  Frame.mountView(viewPath, params)                            │
│  - parseUri(viewPath) → { path, params }                     │
│  - getViewClass(path) hit  → doMountView (sync path)         │
│  - getViewClass(path) miss → use(path, cb) (async path)      │
│  - sign = this.signature is captured before await             │
└────────────────────────┬─────────────────────────────────────-┘
                         │
┌────────────────────────--─────────────────────────────────────┐
│  module-loader.ts :: use(names, callback?)                    │
│  - config.require defined → delegate (Webpack MF / SystemJS) │
│  - config.require undefined → Promise.all(import(path))      │
│  - ESM unwrap: __esModule || typeof mod.default === function  │
└────────────────────────┬────────────────────────────────────-─┘
                         │
┌────────────────────────-──────────────────────────────────-───┐
│  Webpack Module Federation runtime (host application)         │
│  - __webpack_init_sharing__("default")                        │
│  - container = window[remoteName]                             │
│  - container.init(__webpack_share_scopes__.default)           │
│  - container.get("./module-path") → factory                  │
└────────────────────────────────────────────────────────────-──┘
```

The dashed boundary between layers means each tier can be replaced
independently: the loader can be swapped for a SystemJS variant, and
`CrossSite` can be replaced by direct `v-lark` mounting when prepare hooks are
unnecessary.

---

## Core Modules

### 1. `module-loader.ts` — the loader bridge

`module-loader` was deliberately extracted from `framework.ts` to break a
circular dependency: `frame.ts` needs to call `use()`, but `framework.ts`
imports `frame.ts`. By owning the framework `config` object — a single mutable
export — the loader gives both `Frame.mountView` and
`CrossSite.loadRemoteView` a stable, side-effect-free import target.

#### 1.1 Shared mutable config

```ts
export const config: FrameworkConfig = {
  rootId: "root",
  routeMode: "history",
  hashbang: "#!",
  error: (error: Error) => {
    throw error;
  },
};
```

Every framework subsystem mutates this exact object via
`Framework.setConfig(patch)`. Because the import is a _binding_ and not a
copy, hot updates of `config.require` or `config.crossConfigs` are observed by
the loader on the next `use()` call without any explicit re-wiring.

#### 1.2 `use(names, callback?)`

Two calling conventions, one Promise:

```ts
// 1. callback style
use("remote-app/views/home", (View) => mountFrame(View));

// 2. promise style
const [Home] = await use(["remote-app/views/home"]);
```

Resolution algorithm:

```
nameList = typeof names === "string" ? [names] : names

if (config.require) {
  const result = config.require(nameList);
  if (result && typeof result.then === "function") return result;
  // require returned non-Promise (or undefined) → resolve []
  return Promise.resolve([]);
}

// Fallback path
return Promise.all(nameList.map(name => {
  const importPath = name.startsWith(".") || name.startsWith("/")
    ? name
    : `./${name}`;
  return import(/* @vite-ignore */ /* webpackIgnore: true */ importPath)
    .then(mod => (mod.__esModule || typeof mod.default === "function")
      ? mod.default
      : mod)
    .catch(err => { config.error?.(err); return undefined; });
}));
```

Three details worth highlighting:

- Path normalization — bare specifiers are rewritten to `./<name>` so the
  ESM resolver treats them as relative paths instead of node_modules lookups.
  The inline `@vite-ignore` and `webpackIgnore: true` comments instruct both
  bundlers to leave the import target untouched at build time.
- ESM unwrap heuristic — Webpack tags namespace objects with
  `__esModule: true` whereas Vite dev mode does not. The loader checks both:
  if either flag is true _or_ `mod.default` is callable, the default export is
  unwrapped.
- Failure isolation — a failed dynamic import does _not_ reject the outer
  Promise; instead the offending slot is `undefined`, allowing
  `Frame.mountView` to surface a clean "Cannot load view" error through
  `config.error`.

### 2. `Frame.mountView` — the asynchronous mount branch

`mountView` is the single entry point for both local and remote views. The
MF-aware branch lives at the bottom of the method and is short by design:

```ts
const sign = this.signature;

const registered = getViewClass(viewClassName);
if (registered) {
  this.doMountView(registered, initParams, node, sign);
  return;
}

use(viewClassName, (ViewClass: unknown) => {
  if (sign !== this.signature) return; // race guard #1
  if (typeof ViewClass !== "function") {
    config.error?.(new Error(`Cannot load view: ${viewClassName}`));
    return;
  }
  registerViewClass(viewClassName, ViewClass as typeof View);
  this.doMountView(ViewClass as typeof View, initParams, node, sign);
});
```

`doMountView` performs a _second_ signature check on entry, then increments
the signature again before awaiting the optional `init()` promise:

```ts
const nextSign = ++this.signature;
Promise.resolve(initResult).then(() => {
  if (nextSign !== this.signature) return; // race guard #2
  if (view.template) view.render();
  else {
    /* no-template path */
  }
});
```

The two-stage guard handles two distinct race scenarios:

| Scenario                                                                    | Caught by |
| --------------------------------------------------------------------------- | --------- |
| Remote bundle resolves _after_ the frame is unmounted                       | guard #1  |
| `view.init()` returns a Promise that resolves after the frame is re-mounted | guard #2  |

Once the asynchronous load succeeds, `registerViewClass` is called _before_
`doMountView`, so any subsequent mount of the same path becomes a synchronous
lookup — the network round-trip is amortized across the lifetime of the page.

### 3. `cross-site.ts` — the bridge view

`CrossSite` is a `View.extend(...)` subclass that, when mounted, behaves as a
lightweight controller for a remote view. Its lifecycle reads as a state
machine:

```
init(params)         → $sign = 0
                       on('destroy') → $sign = -1
                       assign(params)            // store $view + $params
render() (first)     → digest({ skeleton })
                       updateView()              // kick off remote load
assign(newParams)    → if $sign > 0: updateView()
updateView()         → const sign = ++this.$sign
                       await loadRemoteView($view, bizCode)
                       if ($sign !== sign) return                 // race guard
                       if (samePath && view.assign) view.assign($params)
                       else owner.mountFrame(`mf_${id}`, $view, $params)
```

#### 3.1 `loadRemoteView`

```ts
function loadRemoteView(viewPath: string, bizCode?: string): Promise<void> {
  const crossConfigs = config.crossConfigs || window.crossConfigs;
  const slashIndex = viewPath.indexOf("/");
  const projectName =
    slashIndex > -1 ? viewPath.substring(0, slashIndex) : viewPath;

  if (projectName === (config.projectName || "")) return Promise.resolve();

  if (!preparePromises[projectName]) {
    if (!projectsMap) projectsMap = toMap(crossConfigs || [], "projectName");
    if (!projectsMap[projectName]) {
      return Promise.reject(
        new Error(`Cannot find ${projectName} from crossConfigs`),
      );
    }

    preparePromises[projectName] = use(`${projectName}/prepare`)
      .then((modules) => {
        let mod = modules[0];
        if (mod && typeof mod === "object" && (mod as any).__esModule) {
          mod = (mod as any).default;
        }
        if (typeof mod === "function") return (mod as PrepareFn)({ bizCode });
        return undefined;
      })
      .catch((err) => {
        Reflect.deleteProperty(preparePromises, projectName);
        throw err;
      });
  }

  return preparePromises[projectName];
}
```

Four design points:

- `projectName` extraction — substring before the first `/` in `viewPath`.
  Same-project paths short-circuit to `Promise.resolve()` so the prepare
  contract is paid only when crossing a project boundary.
- `preparePromises` cache — keyed by `projectName`, stores the _Promise_
  itself, not its resolved value. Concurrent calls for the same project share
  one in-flight load; serialized calls reuse the resolved Promise.
- Failure self-heals — a rejected prepare deletes its cache entry inside
  `catch` and re-throws, so a transient CDN error does not poison the project
  for the rest of the session.
- `projectsMap` lazy build — built once from `crossConfigs` on first miss
  and reused. `resetProjectsMap()` is exported so an embedding host can
  rebuild it after a runtime config swap.

#### 3.2 `updateView` reuse semantics

The post-await branch chooses between three outcomes:

1. Same path + assign-capable view → `view.assign($params)` followed by
   `view.render()`. Neither the DOM container nor the remote bundle is
   re-fetched.
2. Different path → `owner.mountFrame("mf_" + id, $view, $params)` mounts a
   fresh remote view into the skeleton container.
3. Failed `loadRemoteView` → the skeleton container's `innerHTML` is
   replaced with the error message; the function returns without mounting.

The reuse path is the cheapest hot-swap available: it bypasses the MF runtime,
the registry, and the constructor, leaving only `assign + render` (a DOM
diff).

#### 3.3 The skeleton container contract

```ts
const skeletonTemplate = (data, viewId) =>
  `<div id="mf_${viewId}">${data?.skeleton ?? "<div>Loading...</div>"}</div>`;
```

Every remote view is mounted into an element whose id is
`mf_${parentViewId}`. This naming convention is the single source of truth
shared between `CrossSite.render`, `CrossSite.updateView`,
`Frame.get("mf_" + id)`, and `CrossSite.callView`. Hosts overriding the
skeleton template must preserve the `id="mf_${viewId}"` container or the
remote mount will silently no-op.

#### 3.4 Cross-frame method invocation

```ts
callView(this: ViewInterface, name: string, ...args: unknown[]): unknown {
  const mf = Frame.get("mf_" + this.id);
  return mf?.invoke(name, args);
}
```

`Frame.invoke` is queue-aware: if the remote view has not yet rendered, the
call is appended to `invokeList` and replayed automatically once
`view.rendered` flips to true. This makes cross-project method calls safe to
issue _during_ the remote load.

### 4. `view-registry.ts` — the cache

```ts
const viewClassRegistry: Record<string, typeof View> = {};

export function registerViewClass(
  viewPath: string,
  ViewClass: typeof View,
): void;
export function getViewClass(path: string): typeof View | undefined;
export function invalidateViewClass(viewPath: string): void;
export function getViewClassRegistry(): Record<string, typeof View>;
```

The registry is keyed by the _parsed path_ (`parseUri(viewPath).path`) so
query parameters do not poison the cache. `invalidateViewClass` exists
exclusively for HMR — the dev server fires it before re-importing a changed
module so the next mount picks up the new class.

### 5. Independent frames vs. singleton root

```ts
Frame.createRoot(rootId); // idempotent — returns existing root on subsequent calls
new Frame(containerId); // independent frame, no caching, no auto-discovery
```

`createRoot` is called by `Framework.boot` and is intentionally idempotent:
the second call ignores its `rootId` argument. This is correct for a
single-page app but wrong for an MF host that mounts several remote
shells, each of which needs an independent frame tree, dispatcher tag, and DOM
root.

The pattern used by `mountCounter` (Pattern C below) bypasses `createRoot`
entirely and uses `new Frame(containerId)`. The frame is registered in
`frameRegistry` immediately, so `Frame.get(containerId)` and the dispatcher
pick it up automatically. The framework also pools destroyed frames in
`frameCache` (capped at 64) so high-churn mount/unmount loops avoid GC
pressure.

---

## Configuration Surface

### `FrameworkConfig` MF fields

```ts
export interface FrameworkConfig {
  /** Project identifier of the *current* application. */
  projectName?: string;

  /** Remote project descriptors. May also be supplied via window.crossConfigs. */
  crossConfigs?: CrossSiteConfig[];

  /**
   * Module loader hook. Called by `use()` whenever a view class is missing
   * from the registry. Typically wraps Webpack's federation runtime or a
   * SystemJS equivalent. Returning `undefined` falls through to dynamic import.
   */
  require?: (
    names: string[],
    params?: Record<string, unknown>,
  ) => Promise<unknown[]> | undefined;

  /** Global error sink — invoked by every catch in the loader path. */
  error?: (error: Error) => void;

  // …other framework options…
}
```

### `CrossSiteConfig`

```ts
export interface CrossSiteConfig {
  /** Prefix used in viewPath. Must equal the MF container `name`. */
  projectName: string;
  /**
   * Module Federation remote spec.
   * Format: `<container>@<remoteEntry-url>`
   * Example: "remote_app@//cdn.example.com/remote-app/remoteEntry.js"
   */
  source: string;
  /** Optional API host override consumed by the remote's prepare hook. */
  apiHost?: string;
  /** Optional business code, propagated as `prepare({ bizCode })`. */
  bizCode?: string;
}
```

### Webpack `ModuleFederationPlugin`

Host:

```js
new ModuleFederationPlugin({
  name: "host_app",
  remotes: {
    "remote-app": "remote_app@//cdn.example.com/remote-app/remoteEntry.js",
  },
  shared: {
    "@lark.js/mvc": { singleton: true, requiredVersion: "^1.0.0" },
  },
});
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

Two non-negotiable rules:

- `@lark.js/mvc` must be configured `singleton: true` on **both** sides. The
  `Frame` registry, the View class registry, `Router._booted`, and
  `State._booted` are module-scoped state. A duplicated runtime would split
  the registries across realms and silently break `instanceof` checks.
- `optimization.splitChunks.chunks` must be `"async"`. The default `"all"`
  hoists `@lark.js/mvc` into a synchronous vendor chunk, which beats
  `__webpack_init_sharing__` and produces "Shared module is not available for
  eager consumption" at runtime.

---

## Integration Patterns

### Pattern A — Direct asynchronous mount

Lowest ceremony. No prepare hook, no skeleton.

```html
<div v-lark="remote-app/views/home"></div>
```

Pipeline: `v-lark` → `Frame.mountView("remote-app/views/home")` →
`getViewClass(...)` miss → `use("remote-app/views/home")` →
`config.require([...])` → MF runtime resolves the chunk →
`registerViewClass(path, View)` → `doMountView`.

Use this when the remote view is self-contained and does not require
business-code-aware initialization.

### Pattern B — `CrossSite` bridge

Adds prepare preloading, skeleton rendering, and `assign` reuse:

```html
<div v-lark="cross-site?view=remote-app/views/home&bizCode=mybiz"></div>
```

Pipeline: `v-lark` → mount `CrossSite` → render skeleton template →
`updateView()` → `loadRemoteView("remote-app/views/home", "mybiz")` →
`use("remote-app/prepare")` → `prepare({ bizCode })` resolves →
`owner.mountFrame("mf_" + id, "remote-app/views/home", $params)` → real view.

Choose this pattern whenever you need:

- A loading state that survives slow networks.
- An idempotent preflight (auth, tenant config, i18n bundles) per remote
  project.
- In-place updates when only `params` change but the path stays the same.

### Pattern C — Exposing a `mount(container)` factory

Required when embedding `@lark.js/mvc` views inside React/Vue/Angular hosts
that manage their own root. The remote project exposes a function:

```ts
import { Framework, EventDelegator, Router, State, Frame } from "@lark.js/mvc";

export function mountCounter(container: HTMLElement): () => void {
  const containerId = container.id || "mf-counter-root";
  container.id = containerId;

  Framework.setConfig({ rootId: containerId, error: console.error });
  EventDelegator.setFrameGetter((id) => Frame.get(id));
  Reflect.set(Router, "_booted", true);
  Reflect.set(State, "_booted", true);

  const frame = new Frame(containerId); // independent root, NOT createRoot
  frame.mountView("mf/counter");

  return () => {
    frame.unmountView();
    Frame.getAll().delete(containerId);
  };
}
```

Three things to notice:

- `Framework.setConfig` is called instead of `Framework.boot` to skip the
  router/state binding step — the host owns those.
- `Router._booted` and `State._booted` must be flipped manually so any
  `dispatcherNotifyChange` triggered later does not no-op.
- `new Frame(containerId)` is the correct primitive — `Frame.createRoot`
  would return the host's pre-existing singleton.

---

## Race-Condition Protection

Module Federation makes async the default. Two complementary mechanisms keep
asynchronous results from clobbering live UI.

### Frame-level: `signature`

Every `Frame` carries a monotonically increasing `signature: number`. The
value is captured _before_ any await, then re-checked inside every callback:

```ts
const sign = this.signature;
use(viewClassName, (ViewClass) => {
  if (sign !== this.signature) return; // frame moved on
  // …
});
```

`unmountView`, `doMountView`, and the post-init `Promise.resolve(initResult)`
each bump `signature`, ensuring that _any_ of unmount, replace, or
async-init-finishing-late will be detected.

### CrossSite-level: `$sign`

Per-instance counter on the bridge view, initialised to `0` and set to `-1`
on `destroy`. `updateView` increments it:

```ts
async updateView() {
  const sign = ++this.$sign;
  await loadRemoteView(this.$view, bizCode);
  if (this.$sign !== sign) return; // a newer updateView has won
  // …
}
```

The negative sentinel value means "this view is dead, nothing else may run".
Combined with `Frame.signature`, the framework guarantees:

- Stale prepare promises cannot mount a view into a destroyed frame.
- Concurrent navigation within the same `CrossSite` instance — e.g. a user
  switching tabs rapidly — only the latest navigation wins.

---

## Prepare-Promise Cache

```ts
const preparePromises: Record<string, Promise<void>> = {};
```

Cache lifecycle:

| Event                  | Cache effect                                 |
| ---------------------- | -------------------------------------------- |
| First `loadRemoteView` | `preparePromises[name] = use(...).then(...)` |
| Subsequent calls       | Return the same Promise object               |
| Promise rejects        | `delete preparePromises[name]; throw err`    |
| `resetProjectsMap()`   | Does not clear preparePromises by design     |

Resetting `projectsMap` without resetting `preparePromises` is intentional:
the project map is a config-derived lookup that may legitimately be rebuilt
on config change, but the prepare promise represents a real network
round-trip and must survive the rebuild to honour the "prepare runs once per
project" contract.

---

## `crossConfigs` Dual Channel

```ts
const crossConfigs = config.crossConfigs || window.crossConfigs;
```

The framework deliberately accepts both injection styles because the typical
deployment pipeline straddles two timeframes:

- Build time — bundlers can stamp `window.crossConfigs = [...]` into a
  generated `<script>` tag so `crossConfigs` is available before
  `Framework.boot` runs (useful when `crossConfigs` itself depends on a
  CDN-resolved manifest).
- Boot time — `Framework.boot({ crossConfigs })` is the canonical way for
  a host application to declare its remotes programmatically.

`config.crossConfigs` always wins when both are set, so build-time defaults
can be overridden by runtime configuration without conditional plumbing.

---

## Dispatcher and MF

When `Router` or `State` fires a `CHANGED` event, `framework.ts`'s
`dispatcherNotifyChange` walks the Frame tree and re-renders any view whose
observed keys have changed. Two MF-relevant properties:

- The walker is iterative, not recursive — it uses a LIFO stack so deeply
  nested cross-site frames cannot blow the JS call stack.
- The walker is async-aware: if `view.render()` returns a thenable, the
  subtree under that frame is processed only after the promise resolves;
  sibling subtrees keep draining synchronously meanwhile. This matters because
  remote views frequently render asynchronously after fetching data.

Each dispatcher pass increments a global `dispatcherUpdateTag` and tags every
visited frame, so a frame whose subtree spans both the host and a remote
project is visited at most once per pass even when re-entered through the
async branch.

---

## Practical Constraints

| Constraint                                           | Rationale                                                 |
| ---------------------------------------------------- | --------------------------------------------------------- |
| `@lark.js/mvc` must be `singleton: true`             | Frame / View registries are module-scoped state.          |
| `splitChunks.chunks` must be `"async"`               | Eager vendor chunks defeat MF share-scope initialization. |
| MF hosts must use `new Frame()` not `createRoot()`   | `createRoot` is idempotent and ignores subsequent ids.    |
| Remote modules must `import` their own CSS           | Webpack only bundles CSS reachable from the expose entry. |
| Remote `prepare` exposed at `${projectName}/prepare` | Hard-coded in `loadRemoteView`.                           |
| viewPath separator is `/`                            | First slash splits projectName from local module path.    |
| `crossConfigs[i].projectName` ≡ MF container name    | Used as the cache key for the prepare Promise.            |
| Skeleton must keep `id="mf_${viewId}"`               | Anchor for `mountFrame` and `Frame.get(...)`.             |

---

## Source File Index

| File                     | Responsibility                                                     |
| ------------------------ | ------------------------------------------------------------------ |
| `src/module-loader.ts`   | `use()` and the framework `config` singleton.                      |
| `src/cross-site.ts`      | `CrossSite` bridge view, `loadRemoteView`, `resetProjectsMap`.     |
| `src/frame.ts`           | Frame tree, `mountView` async branch, signature races, frame pool. |
| `src/view-registry.ts`   | View class registry + HMR invalidation helpers.                    |
| `src/framework.ts`       | `Framework.boot`, dispatcher, devtools bridge install.             |
| `src/types.ts`           | `FrameworkConfig`, `CrossSiteConfig`, `FrameInterface`, …          |
| `src/event-delegator.ts` | DOM event delegation; consumed by Pattern C `setFrameGetter`.      |
| `src/index.ts`           | Public barrel — surfaces `CrossSite`, `use`, `frameworkConfig`.    |

---

## Design Trade-offs and Strengths

1. Progressive disclosure — applications without MF pay zero cost: the
   loader's fallback path uses native dynamic import, and `CrossSite` is
   opt-in.
2. Template-level transparency — `v-lark="local/path"` and
   `v-lark="remote-app/path"` are syntactically identical; the framework
   picks the loader based on registry lookup, not template grammar.
3. Two-tier cache — view classes are cached in `view-registry`, prepare
   promises in `preparePromises`. The first amortises module instantiation;
   the second amortizes business-level preflight.
4. Self-healing failures — both caches delete their entry on rejection, so
   a single transient error does not blacklist the resource for the session.
5. Race resilience by construction — every async boundary (loader,
   `init()`, `updateView`) takes a signature snapshot before awaiting and
   bails on mismatch. There is no observer-based "isAlive" check; the
   discipline is structural.
6. Reuse over rebuild — `CrossSite` recognises same-path navigations and
   delegates to `view.assign`, so router-level param changes within a remote
   view skip the entire MF round trip.
7. Devtools-aware — `Framework.boot` installs the Frame Visualizer Bridge,
   exposing the live frame tree (including remote frames) over `postMessage`
   for the lark-visualizer panel.
