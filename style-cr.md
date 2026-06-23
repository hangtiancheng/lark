# Tailwind / daisyUI Style Audit

Scope: `src/client.css` + `src/theme/*.{html,ts}`

---

## 1. Duplicate Declarations (client.css)

| Line | Issue | Fix |
|------|-------|-----|
| L3 + L11 | `@plugin "daisyui"` declared twice. L3 has no config block, L11 has the theme config. Both emit full daisyUI CSS — bloats output with a duplicate copy. | Remove L3 |
| L4 + L17 | `@plugin "@tailwindcss/typography"` declared twice. Identical plugin, duplicate CSS output. | Remove L17 |

```css
/* After cleanup */
@import "tailwindcss";

@source "./theme/*.html";
@source "./theme/*.ts";

@plugin "daisyui" {
  themes:
    light --default,
    dark --prefersdark;
}

@plugin "@tailwindcss/typography";
```

---

## 2. Redundant Utility Classes

### 2.1 prose-sm max-w-none (docs-layout.html:54)

```html
<article class="prose prose-sm max-w-none">
```

`prose-sm` sets `max-width: 65ch` on the prose container. `max-w-none` immediately overrides it to `none`. Since client.css:49 already applies `my-1.5` globally to all prose block elements and the layout constrains width via `max-w-7xl` on the outer flex container, the prose-sm max-width is never wanted. The `prose-sm` modifier also scales heading font sizes that are then fully overridden by the client.css prose heading rules (L33-47), making its size contribution inert.

Verdict: `max-w-none` is redundant if `prose-sm` is dropped, or keep `prose-sm` solely for its line-height/base-font-size reduction and accept that `max-w-none` is needed. If the goal is only compact typography, consider using `prose` alone — the custom heading overrides in client.css already define all sizes.

### 2.2 font-semibold on prose headings (client.css:34,38,42,46)

```css
.prose :where(h1):not(...) { @apply mt-6 mb-2 scroll-mt-16 text-xl font-semibold; }
.prose :where(h2):not(...) { @apply mt-5 mb-2 scroll-mt-16 text-lg font-semibold; }
.prose :where(h3):not(...) { @apply mt-4 mb-1 scroll-mt-16 text-base font-semibold; }
.prose :where(h4, h5, h6):not(...) { @apply mt-3 mb-1 scroll-mt-16 text-sm font-semibold; }
```

`@tailwindcss/typography` already sets `font-weight: 600` (semibold) on all prose headings. The explicit `font-semibold` is a no-op override.

Verdict: safe to remove `font-semibold` from all four rules. Keep if intentionally decoupling from the typography plugin's defaults (defensive coding), but document the intent.

### 2.3 text-center in flex centered containers (search.html:48, 52)

```html
<div class="flex flex-col items-center justify-center py-8 text-center">
```

`flex flex-col items-center justify-center` already centers content on both axes. In a flex-col container, children stretch to full width by default (`align-items: stretch`), but `items-center` overrides to `align-items: center`, which centers children horizontally. `text-center` adds `text-align: center` on top of already-centered flex children — visually redundant.

Verdict: remove `text-center` from both empty-state containers.

---

## 3. Visual Inconsistencies

### 3.1 Secondary label opacity: sidebar vs TOC

| File | Element | Class | Opacity |
|------|---------|-------|---------|
| sidebar.html:5 | Group label | `text-base-content/50` | 50% |
| toc.html:3 | "On this page" label | `text-base-content/30` | 30% |

Both are secondary uppercase tracking-wider section labels with identical font-size and weight. The 20% opacity gap makes the TOC label noticeably lighter than the sidebar label despite serving the same visual role.

Recommendation: unify to one opacity value. `text-base-content/40` is a reasonable middle ground, or pick one of the existing values and apply it to both.

### 3.2 Search empty state opacity: no-results vs placeholder

| File | State | Class | Opacity |
|------|-------|-------|---------|
| search.html:49 | "No results found" | `text-base-content/40` | 40% |
| search.html:53 | "Type to search..." | `text-base-content/30` | 30% |

Both are secondary messages in the same search results area. The 10% gap is subtle but inconsistent — "no results" (arguably more important feedback) is lighter than the initial placeholder.

Recommendation: use the same opacity for both, e.g. `text-base-content/40`.

---

## 4. Potential Conflicts

### 4.1 menu-active + bg-primary/10 (sidebar.html:15)

```html
class="{{if item.isActive}}menu-active bg-primary/10 text-primary font-medium{{/if}} rounded-field text-xs"
```

daisyUI's `menu-active` class applies its own background color via CSS (e.g. `background-color: oklch(var(--inc))` in v5). The additional `bg-primary/10` class sets a competing background. Specificity depends on daisyUI's internal selector structure vs Tailwind utility layer, which can vary across daisyUI versions.

Risk: the `bg-primary/10` background may not take effect because `menu-active` wins in the cascade.

Recommendation: drop `bg-primary/10` and rely on `menu-active`'s built-in highlight, or use a CSS override targeting `.menu-active` to customize the background color consistently:

```css
.menu li > .menu-active {
  @apply bg-primary/10 text-primary;
}
```

### 4.2 Search button touch target (docs-layout.html:30-34)

```html
<button class="btn btn-ghost btn-circle btn-xs">
  <span class="h-3.5 w-3.5 [&>svg]:h-full [&>svg]:w-full">
```

`btn-xs` produces a 24px-tall button. `btn-circle` adds equal horizontal padding, resulting in a ~28x28px touch target. WCAG recommends at least 44x44px (24px CSS minimum is acceptable only with sufficient spacing). On mobile, this button is the only way to open search.

Recommendation: bump to `btn-sm` (32px) or remove the size modifier entirely on mobile. Alternatively, add `min-h-11 min-w-11` to guarantee touch target size while keeping the visual size small via padding tricks.

---

## 5. Cross-file Consistency (no issues found)

| Pattern | Locations | Status |
|---------|-----------|--------|
| Icon wrapper span | docs-layout.html:31, search.html:11 | Consistent (`h-3.5 w-3.5 [&>svg]:h-full [&>svg]:w-full`) |
| Menu config | all HTML files | Consistent (`menu menu-xs/menu-sm gap-0 p-0/p-1.5`) |
| `rounded-field` on interactive items | sidebar.html:15, toc.html:12, search.html:33 | Consistent |
| Sticky sidebars `top-11 h-[calc(100vh-2.75rem)]` | docs-layout.html:47, 86 | Consistent, matches `scroll-mt-16` |
| Scroll margin `scroll-mt-16` (64px) vs navbar (44px) | client.css:34-46 | 20px buffer, intentional and correct |
| Prev/Next buttons | docs-layout.html:63, 72 | Identical class sets |

---

## 6. Summary

| Category | Count | Severity |
|----------|-------|----------|
| Duplicate plugin declarations | 2 | High (CSS bloat) |
| Redundant utility classes | 3 sets | Low (no visual impact) |
| Visual inconsistencies (opacity) | 2 | Medium (design coherence) |
| Potential cascade conflicts | 2 | Medium (behavior may not match intent) |
| Cross-file consistency issues | 0 | -- |

Top action items:

1. Remove duplicate `@plugin` declarations in client.css (L3 and L17)
2. Unify secondary label opacity between sidebar and TOC
3. Resolve `menu-active` + `bg-primary/10` conflict in sidebar — pick one background source
4. Increase search button touch target for mobile accessibility
