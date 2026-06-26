# SVG Icon Integration in @lark.js/mvc

This document describes how the `@lark.js/mvc` framework integrates SVG icon libraries. Two complementary approaches are covered: inline SVG via raw imports (primary) and external SVG sprite sheets (supplementary).

---

## Approach 1: Inline SVG via Raw Imports (Recommended)

This is the primary pattern. Individual SVG files from a third-party icon library (`lucide-static`) are imported as raw strings at build time, then injected directly into Lark templates using the unescaped output operator `{{!}}`.

### 1. Install the Icon Library

```bash
pnpm add lucide-static
```

`lucide-static` ships standalone `.svg` files under `icons/`, one file per icon. Any icon package that provides individual SVG files works with this pattern.

### 2. Declare the Type Shim

Vite's `?raw` suffix instructs the bundler to import a file as a plain string rather than a URL. TypeScript needs a module declaration to accept this import shape.

```ts
// src/shims.d.ts
declare module "*.svg?raw" {
  const content: string;
  export default content;
}
```

### 3. Create a Centralized Icon Registry

Define a single module that imports every icon the application needs and re-exports them as a keyed object. This keeps icon management in one place and enables tree-shaking: only imported icons are bundled.

```ts
// src/icons.ts
import messageSquare from "lucide-static/icons/message-square.svg?raw";
import users from "lucide-static/icons/users.svg?raw";
import user from "lucide-static/icons/user.svg?raw";
import settings from "lucide-static/icons/settings.svg?raw";
import logOut from "lucide-static/icons/log-out.svg?raw";
import paperclip from "lucide-static/icons/paperclip.svg?raw";
import video from "lucide-static/icons/video.svg?raw";
import messageCircle from "lucide-static/icons/message-circle.svg?raw";
import shield from "lucide-static/icons/shield.svg?raw";
import chartBar from "lucide-static/icons/chart-bar.svg?raw";

export const icons = {
  messageSquare,
  messageCircle,
  users,
  user,
  settings,
  logOut,
  paperclip,
  video,
  shield,
  chartBar,
};
```

Each import resolves to a complete `<svg>...</svg>` string at build time (e.g., `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" ...>...</svg>`).

### 4. Pass Icons into the View Updater

In the view's setup function, pass the `icons` object to `ctx.updater.set()` so the template can reference individual icons by key.

```ts
// src/components/nav-bar.ts
import { defineView } from "@lark.js/mvc";
import template from "./nav-bar.html";
import { icons } from "@/icons";

export default defineView((ctx) => {
  ctx.updater.set({ icons });

  return {
    template,
    events: {
      "goSessions<click>": () => {
        // navigate to sessions
      },
    },
  };
});
```

### 5. Render Icons in Templates with `{{!}}`

The raw output operator `{{!expr}}` emits the string without HTML escaping. Since SVG markup contains angle brackets and attributes that would be destroyed by the default `{{=}}` encoder, `{{!}}` is required for inline SVG.

```html
<!-- src/components/nav-bar.html -->
<button @click="goSessions()">
  <span class="h-5 w-5 [&>svg]:h-full [&>svg]:w-full">
    {{!icons.messageSquare}}
  </span>
</button>
```

The wrapper `<span>` serves as a sizing container. The Tailwind utility `[&>svg]:w-full [&>svg]:h-full` targets the child `<svg>` element directly and forces it to fill the container dimensions.

### 6. Sizing and Styling

Because the SVG is inlined as a DOM element (not an `<img>` or background), it inherits `currentColor` from its parent for `stroke` and `fill` attributes. This makes icon color controllable through standard CSS color utilities:

```html
<!-- Green icon -->
<span class="h-5 w-5 text-green-700 [&>svg]:h-full [&>svg]:w-full">
  {{!icons.shield}}
</span>

<!-- Red icon -->
<span class="h-5 w-5 text-red-400 [&>svg]:h-full [&>svg]:w-full">
  {{!icons.logOut}}
</span>

<!-- Large icon -->
<span class="h-16 w-16 [&>svg]:h-full [&>svg]:w-full">
  {{!icons.messageSquare}}
</span>
```

### Complete View Example

```ts
// src/views/chat.ts
import { defineView, bindStore } from "@lark.js/mvc";
import template from "./chat.html";
import { icons } from "@/icons";
import useChatStore from "@/store/chat";

export default defineView((ctx) => {
  bindStore(ctx, useChatStore);
  ctx.updater.set({ icons });

  return {
    template,
    events: {
      "attach<click>": () => {
        // handle attachment
      },
      "startCall<click>": () => {
        // handle video call
      },
    },
  };
});
```

```html
<!-- src/views/chat.html -->
<div class="flex gap-2">
  <button @click="attach()">
    <span class="h-4 w-4 [&>svg]:h-full [&>svg]:w-full">
      {{!icons.paperclip}}
    </span>
  </button>
  <button @click="startCall()">
    <span class="h-4 w-4 [&>svg]:h-full [&>svg]:w-full">
      {{!icons.video}}
    </span>
  </button>
</div>
```

---

## Approach 2: External SVG Sprite Sheet

For custom icons not available in a third-party library, use a classic SVG sprite sheet placed in the `public/` directory. Each icon is defined as a `<symbol>` with a unique `id`, then referenced in templates via `<use>`.

### 1. Create the Sprite File

Place a single SVG file containing all custom symbols under `public/`:

```xml
<!-- public/icons.svg -->
<svg xmlns="http://www.w3.org/2000/svg">
  <symbol id="github-icon" viewBox="0 0 19 19">
    <path fill="#08060d" d="M9.356 1.85C5.05 1.85 ..." />
  </symbol>
  <symbol id="discord-icon" viewBox="0 0 20 19">
    <path fill="#08060d" d="M16.224 3.768 ..." />
  </symbol>
</svg>
```

Vite copies everything under `public/` to the build output root unchanged, so the file is served at `/icons.svg`.

### 2. Reference Symbols in Templates

Use the standard SVG `<use>` element with a fragment identifier pointing to the symbol's `id`:

```html
<svg class="h-5 w-5" aria-hidden="true">
  <use href="/icons.svg#github-icon"></use>
</svg>
```

This approach avoids duplicating SVG markup across the page. The browser fetches and caches the sprite file once; each `<use>` reference is lightweight.

---

## When to Use Each Approach

| Criterion       | Inline Raw Import (`{{!}}`)                               | SVG Sprite (`<use>`)                                    |
| --------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| Icon source     | Third-party library with individual `.svg` files          | Custom or hand-crafted icons                            |
| Color control   | Inherits `currentColor` automatically                     | Requires `fill="currentColor"` in the symbol definition |
| Tree-shaking    | Only imported icons are bundled                           | Entire sprite file is shipped                           |
| Caching         | Bundled into JS; cached as part of the chunk              | Separate HTTP request; cached independently             |
| Template syntax | `{{!icons.name}}` (raw output)                            | Standard `<svg><use href="..."></svg>`                  |
| Best for        | Application-wide UI icons (navigation, toolbars, buttons) | Brand logos, social icons, one-off illustrations        |

---

## Build Configuration

The Vite configuration requires the `larkMvcPlugin` for compiling `.html` templates. No additional SVG-specific plugin is needed; Vite's built-in `?raw` import handles SVG string loading natively.

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

---

## Key Points

- Always use `{{!}}` (raw output) for SVG strings, never `{{=}}` (escaped output). The escaped operator encodes `<`, `>`, and `"`, which destroys SVG markup.
- Centralize all icon imports in a single `icons.ts` module. This prevents scattered raw imports and makes it straightforward to audit which icons the application uses.
- Pass the `icons` object to `ctx.updater.set()` in the setup function, not in `assign()`. Icons are static data that do not change between renders. Setting them once in setup avoids unnecessary work on each digest cycle.
- Size the SVG through its parent container, not through the `<svg>` element's `width`/`height` attributes. The `[&>svg]:w-full [&>svg]:h-full` pattern delegates sizing entirely to the wrapper, keeping the icon responsive.
- The `?raw` suffix is a Vite feature. For Webpack-based builds, use `raw-loader` or the asset module equivalent (`asset/source` type) to achieve the same string import behavior.
