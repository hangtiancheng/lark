template hmr snippet for vite

```js
// ── Lark template HMR (auto-injected by larkMvcPlugin — Vite) ──
if (import.meta.hot) {
  import.meta.hot.dispose(function (__larkData) {
    __larkData.oldTemplate = "${TEMPLATE_VAR}";
  });
  import.meta.hot.accept(function (__larkNewModule) {
    var __larkNew = __larkNewModule && __larkNewModule.default;
    var __larkOld = import.meta.hot.data && import.meta.hot.data.oldTemplate;
    if (__larkOld && __larkNew && __larkOld !== __larkNew) {
      import("@lark.js/mvc").then(function (m) {
        if (m && m.hotSwapByTemplate) m.hotSwapByTemplate(__larkOld, __larkNew);
      });
    }
  });
}
```

template hmr sippet for webpack/rspack

```js
// ── Lark template HMR (auto-injected by larkMvcPlugin — ${bundler}) ──
if (typeof module !== "undefined" && module.hot) {
  module.hot.dispose(function (__larkData) {
    __larkData.oldTemplate = "${TEMPLATE_VAR}";
  });
  module.hot.accept(function () {
    var __larkNew = "${TEMPLATE_VAR}";
    var __larkOld =
      module.hot && module.hot.data && module.hot.data.oldTemplate;
    if (__larkOld && __larkNew && __larkOld !== __larkNew) {
      import("@lark.js/mvc").then(function (m) {
        if (m && m.hotSwapByTemplate) m.hotSwapByTemplate(__larkOld, __larkNew);
      });
    }
  });
}
```

view hmr snippet for vite

```ts
// ── Lark view class HMR (auto-injected by larkMvcPlugin — Vite) ──
if (import.meta.hot) {
  import.meta.hot.dispose(function (__larkData) {
    __larkData.oldClass = "${VIEW_VAR}";
  });
  import.meta.hot.accept(function (__larkNewModule) {
    var __larkNew = __larkNewModule && __larkNewModule.default;
    var __larkOld = import.meta.hot.data && import.meta.hot.data.oldClass;
    if (__larkOld && __larkNew && __larkOld !== __larkNew) {
      import("@lark.js/mvc").then(function (m) {
        if (m && m.hotSwapByView) m.hotSwapByView(__larkOld, __larkNew);
      });
    }
  });
}
```

view hmr snippet for webpack/rspack

```ts
// ── Lark view class HMR (auto-injected by larkMvcPlugin — ${bundler}) ──
if (typeof module !== "undefined" && module.hot) {
  module.hot.dispose(function (__larkData) {
    __larkData.oldClass = "${VIEW_VAR}";
  });
  module.hot.accept(function () {
    var __larkNew = "${VIEW_VAR}";
    var __larkOld = module.hot && module.hot.data && module.hot.data.oldClass;
    if (__larkOld && __larkNew && __larkOld !== __larkNew) {
      import("@lark.js/mvc").then(function (m) {
        if (m && m.hotSwapByView) m.hotSwapByView(__larkOld, __larkNew);
      });
    }
  });
}
```
