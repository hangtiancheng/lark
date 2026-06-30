template hmr snippet for vite

```js
// Auto-injected by larkMvcPlugin
if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.oldTemplate = __larkTemplate;
  });
  import.meta.hot.accept((newMod) => {
    const newTemplate = newMod?.default;
    const oldTemplate = import.meta.hot.data?.oldTemplate;
    if (oldTemplate && newTemplate && oldTemplate !== newTemplate) {
      const hmr = globalThis.__lark_hmr__;
      if (hmr && hmr.hotSwapByTemplate) hmr.hotSwapByTemplate(oldTemplate, newTemplate);
    }
  });
}
```

template hmr sippet for webpack/rspack

```js
// Auto-injected by larkMvcPlugin
if (import.meta.webpackHot) {
  // import.meta.webpackHot.accept();
  import.meta.webpackHot.dispose((data) => {
    data.oldTemplate = __larkTemplate;
  });
  import.meta.webpackHot.accept(() => {
    const oldTemplate = import.meta.webpackHot.data?.oldTemplate;
    const newTemplate = __webpack_require__(__webpack_module__.id);
    if (oldTemplate && newTemplate && oldTemplate !== newTemplate) {
      const hmr = globalThis.__lark_hmr__;
      if (hmr && hmr.hotSwapByTemplate) hmr.hotSwapByTemplate(oldTemplate, newTemplate);
    }
  });
}
```

view hmr snippet for vite

```js
// Auto-injected by larkMvcPlugin
if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.oldView = __larkViewDefault;
  });
  import.meta.hot.accept((newMod) => {
    const newView = newMod?.default;
    const oldView = import.meta.hot.data?.oldView;
    if (oldView && newView && oldView !== newView) {
      const hmr = globalThis.__lark_hmr__;
      if (hmr && hmr.hotSwapByView) hmr.hotSwapByView(oldView, newView);
    }
  });
}
```

view hmr snippet for webpack/rspack

```js
// Auto-injected by larkMvcPlugin
if (import.meta.webpackHot) {
  // import.meta.webpackHot.accept();
  import.meta.webpackHot.dispose((data) => {
    data.oldView = __larkViewDefault;
  });
  import.meta.webpackHot.accept(() => {
    const oldView = bundler === import.meta.webpackHot.data?.oldView;
    const newView = __webpack_require__(__webpack_module__.id);
    if (oldView && newView && oldView !== newView) {
      const hmr = globalThis.__lark_hmr__;
      if (hmr && hmr.hotSwapByView) hmr.hotSwapByView(oldView, newView);
    }
  });
}
```
