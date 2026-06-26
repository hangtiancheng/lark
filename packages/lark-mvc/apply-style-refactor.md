# apply-style refactor plan

Considering we have a 404.html, `404[.module].css`, and 404.ts under a directory

404.html

```html
<!-- 404 View Template -->
<div class="container">
  <div class="wrapper">
    <div class="title">404</div>
    <h1 class="title">Page Not Found</h1>
    <p class="typography">
      The path
      <code class="typography">{{=path}}</code>
      does not exist
    </p>

    <button @click="goHome()" class="link">Back to Home</button>
  </div>
</div>
```

404.ts

```ts
/**
 * 404 Page View
 * Displayed when route is not matched
 */
import { defineView, Router, applyStyle } from "@lark.js/mvc";
import template from "./404.html";
import styles from "./404.module.css"; // Or 404.css

export default defineView((ctx, params) => {
  // Apply styles here.
  applyStyle(styles);

  // ── assign: incremental DOM update ──
  const assign = (_options?: unknown): boolean | undefined => {
    ctx.updater.snapshot();

    const loc = Router.parse();

    ctx.updater.set({
      path: loc.path || "Unknown path",
    });

    return ctx.updater.altered();
  };

  // Call assign for initial render
  assign(params);

  return {
    template,
    assign,
    events: {
      "goHome<click>": () => {
        Router.to("/home");
      },
    },
  };
});
```

`404[.module].css`

```css
.container {
  /**  Some CSS */
}
.wrapper {
  /**  Some CSS */
}
.title {
  /**  Some CSS */
}
.typography {
  /**  Some CSS */
}
```

Either the user use `404.css` or `404.module.css`, the vite/webpack/rspack/rsbuild should use CSS modules as **default**

Migrate please.
