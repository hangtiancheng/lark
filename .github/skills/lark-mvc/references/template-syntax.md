# Lark Template Syntax Reference

This document provides a comprehensive reference for the Lark template syntax used in `.html` template files. Templates are compiled into JavaScript functions at build time by the `larkMvcPlugin` (Vite) or `larkMvcLoader` (Webpack).

## Table of Contents

- [Compilation Pipeline](#compilation-pipeline)
- [Template Operators](#template-operators)
- [Control Flow](#control-flow)
- [Event Binding](#event-binding)
- [Sub-View Embedding](#sub-view-embedding)
- [Special Attributes](#special-attributes)
- [Compiled Function Signature](#compiled-function-signature)
- [Built-in Encoding Functions](#built-in-encoding-functions)
- [HTML Comment Handling](#html-comment-handling)
- [Debug Mode](#debug-mode)
- [Global Variable Extraction](#global-variable-extraction)

## Compilation Pipeline

The template compiler processes source through four phases:

1. **Protect Comments** -- HTML comments (`<!-- ... -->`) are replaced with `__lark_comment_N__` placeholders to prevent template syntax inside comments from being processed.
2. **Art Syntax Conversion** -- `{{}}` template expressions are converted to internal `<% %>` syntax blocks. In debug mode, line markers (`\x1e + lineNo`) are inserted before each `{{` tag.
3. **@event Processing** -- `@<eventType>` attributes are processed AFTER art syntax conversion (so `{{=variable}}` inside @event params is already `<%=variable%>`). View ID placeholder (`\x1f`) is injected, and JS object literal parameters are converted to URL query parameter format.
4. **Function Compilation** -- The internal `<% %>` syntax is compiled into a JavaScript arrow function that returns the rendered HTML string. Post-processing removes empty concatenations (`$out+='';`) and optimizes the output.

## Template Operators

| Operator | Syntax          | Description                                                                                                                                                                                                                                        |
| -------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `=`      | `{{=variable}}` | HTML-escaped output. The value is passed through `$encHtml()` which encodes `& < > " ' backtick` into HTML entities                                                                                                                                |
| `!`      | `{{!variable}}` | Raw output without HTML escaping. The value is passed through `$strSafe()` which converts null/undefined to empty string. Automatically wrapped in `$strSafe()` unless already wrapped in `$encUri()`. Use with caution for user-generated content |
| `@`      | `{{@variable}}` | Reference lookup. Resolves the variable through `$refFn()` to find or allocate a key in refData. Used for passing object references to child views via `v-lark` attributes                                                                         |
| `:`      | `{{:variable}}` | Two-way binding. Renders identically to `=` (HTML-escaped output via `$encHtml()`). The distinction is semantic -- marks the field as bound for future update tracking                                                                             |

### Operator Details

**`=` (Escaped Output)**

```html
<p>{{=title}}</p>
<p>{{=user.name}}</p>
<p>{{=count + 1}}</p>
```

The `=` operator wraps the expression with `$encHtml()` at compile time, producing `'+$encHtml(title)+'` in the output function. This ensures all rendered values are safe against XSS.

**`!` (Raw Output)**

```html
<div>{{!rawHtml}}</div>
<a href="{{!url}}">Link</a>
```

The `!` operator wraps the expression with `$strSafe()` (null-safe toString). If the content is already wrapped in `$encUri()`, the additional `$strSafe()` wrapper is skipped to avoid double-wrapping.

**`@` (Reference Lookup)**

```html
<div v-lark="components/detail" data-item="{{@item}}"></div>
```

The `@` operator enables passing object references (not serialized strings) to child views. It uses `$refFn()` to register the value in `refData` and produce a SPLITTER-prefixed key. The child view can then look up the original object from `refData` using this key.

**`:` (Binding Output)**

```html
<input value="{{:searchQuery}}" />
```

Functionally identical to `=` for rendering purposes. Both `=` and `:` are compiled to `'+$encHtml(expression)+'`. The `:` operator exists to mark values that participate in two-way binding, which may be used by future framework features.

## Control Flow

### Conditionals

```html
{{if condition}}
<p>Condition is true</p>
{{else if anotherCondition}}
<p>Another condition is true</p>
{{else}}
<p>Neither condition is true</p>
{{/if}}
```

The compiler converts `{{if}}` to `<%if(...){%>`, `{{else if}}` to `<%}else if(...){%>`, `{{else}}` to `<%}else{%>`, and `{{/if}}` to `<%}%>`.

Block validation enforces that every `{{if}}` has a matching `{{/if}}`. Mismatched blocks (e.g., `{{/forOf}}` inside an `{{if}}` without closing the `{{if}}` first) produce a compile-time error with the line number.

Shorthand parentheses are also supported:

```html
{{if(active)}}<span>Active</span>{{/if}}
{{if(user.isAdmin)}}<span>Admin</span>{{/if}}
```

The compiler automatically normalizes `if(condition)` to `if (condition)` before processing. Outer parentheses are stripped using balanced-parentheses analysis, so `{{if((a > b))}}` becomes `if(a > b)`.

### Array Iteration (forOf)

```html
{{forOf list as item}}
<li>{{=item}}</li>
{{/forOf}} {{forOf list as item index}}
<li>{{=index}}: {{=item}}</li>
{{/forOf}} {{forOf list as item index last}}
<li class="{{if last}}last{{/if}}">{{=item}}</li>
{{/forOf}}
```

The `forOf` loop compiles to a `for` loop with the following features:

- The `as` keyword is required between the collection and the iteration variable. `{{forOf list item}}` is invalid syntax.
- The first parameter after `as` is the value variable.
- The second parameter is the index variable (defaults to `_i` if not specified).
- The third parameter is the `last` boolean variable.
- The `first` helper variable is available as the fourth parameter.

Built-in iteration variables:

| Variable | Availability                     | Description                           |
| -------- | -------------------------------- | ------------------------------------- |
| `first`  | Always (when 4th param declared) | Boolean, true for the first iteration |
| `last`   | When 3rd param declared          | Boolean, true for the last iteration  |

**Destructuring assignment:**

```html
{{forOf users as {name, age} idx}}
<li>{{=idx}}: {{=name}}, {{=age}}</li>
{{/forOf}}
```

When the collection expression contains property access (`obj.list` or `arr[0]`), the compiler creates a temporary variable to hold the reference:

```html
<!-- Template -->
{{forOf obj.items as item}}
<!-- Compiled internally -->
<%let _art_obj_obj_items=obj.items;for(let
_i=0,_l=_art_obj_obj_items.length;_i<_l;_i++){let item=_art_obj_obj_items[_i]}%>
```

### Object Iteration (forIn)

```html
{{forIn obj as value}}
<p>{{=value}}</p>
{{/forIn}} {{forIn obj as value key}}
<p>{{=key}}: {{=value}}</p>
{{/forIn}}
```

The `forIn` loop compiles to a `for...in` loop. The `as` keyword is required.

- The first parameter after `as` is the value variable.
- The second parameter is the key variable (defaults to `_k` if not specified).

When the object expression contains property access, a temporary variable is created similarly to `forOf`.

### For Loop

```html
{{for(let i = 0; i < 10; i++)}}
<p>{{=i}}</p>
{{/for}}
```

The `for` loop accepts a standard C-style for-loop header. Parentheses around the entire expression are optional -- both `{{for(let i=0;i<n;i++)}}` and `{{for (let i = 0; i < n; i++)}}` are valid.

### Variable Declaration (set)

```html
{{set total = price * quantity}}
<p>Total: {{=total}}</p>
```

The `set` directive compiles to a `let` declaration:

```javascript
// Compiled: let total = price * quantity;
```

Variables declared with `set` are scoped to the current block.

## Event Binding

### @event Attributes

Events are bound using `@<eventType>` attributes on HTML elements. The compiler processes these into an internal format that includes the View ID and handler name.

```html
<!-- Simple click handler -->
<button @click="handlerName()">Click Me</button>

<!-- Click handler with object parameters -->
<button @click="navigate({path: '/home', id: 123})">Navigate</button>

<!-- Change handler -->
<input @change="onInputChange()" />

<!-- Multiple event types on different elements -->
<div @click="onClick()" @mouseenter="onHover()">...</div>
```

### Parameter Format Conversion

JS object literal parameters passed in `@event` attributes are automatically converted to URL query parameter format during compilation. This enables efficient parsing at event dispatch time.

```
Template:   @click="navigate({path: '/home', id: 123})"
Compiled:   @click="\x1f\x1enavigate(path=/home&id=123)"
```

The conversion rules:

- `{key: 'value', key2: 123}` is converted to `key=value&key2=123`
- String values have quotes stripped
- Numeric values are preserved as-is
- Already-URL-format strings (`key=value&key2=value2`) are passed through unchanged

At event dispatch time, the `parseUri()` utility parses the URL query string back into a params object. The event handler receives the parsed parameters via `e.params`:

```typescript
"navigate<click>"(e: Event & { params?: Record<string, string> }) {
  const path = e.params?.path;   // '/home'
  const id = e.params?.id;       // '123' (string)
}
```

### Event Handler Without Parameters

```html
<button @click="doAction()">Action</button>
```

When no parameters are provided, the compiled attribute is `@click="\x1f\x1edoAction()"`. The handler receives an event object without a `params` property.

### Non-handler @event Values

If the attribute value does not match the `handlerName(params)` pattern (e.g., no parentheses), it is left unchanged:

```html
<!-- Not a handler -- left as-is by the compiler -->
<div @click="somePlainValue"></div>
```

### Selector Events ($-prefix)

Selector events are defined in the View class using the `$` prefix pattern in method names. They do not require `@event` attributes in the template.

```html
<!-- No @event needed; selector binding is automatic -->
<button class="btn">Click</button>
```

```typescript
// In the View class:
"$btn<click>"(e: Event) {
  // Triggered when any element matching CSS selector .btn is clicked
}
```

Selector event patterns:

| Pattern                   | Meaning                    | CSS Selector                 |
| ------------------------- | -------------------------- | ---------------------------- |
| `"$<click>"(e)`           | View root element click    | (matches frame root element) |
| `"$btn<click>"(e)`        | Delegated event on `.btn`  | `.btn`                       |
| `"$window<resize>"(e)`    | Global event on `window`   | N/A (direct binding)         |
| `"$document<keydown>"(e)` | Global event on `document` | N/A (direct binding)         |

### Event Method Name Format

The full pattern for event method names:

```
$?name<eventType(,eventType)*>(&modifier(,modifier)*)?
```

Components:

- `$` prefix: optional, indicates CSS selector-based delegated event
- `name`: handler name or CSS selector (without the `.` prefix -- the framework adds it)
- `<eventType>`: one or more DOM event types, comma-separated
- `(&modifiers)`: optional event modifiers (e.g., `&ctrl`, `&shift`)

Examples:

```typescript
"increment<click>"(e); // Basic event method
"$btn<click>"(e); // Selector-based event method (.btn)
"handleInput<click,mousedown>"(e); // Multi-event binding
"$window<resize>"(e); // Global window event
"onKey<keydown>(&ctrl)"(e); // Key event with modifier
```

### Event Modifiers

Event modifiers are specified in parentheses after the event type. Supported modifiers correspond to DOM event properties:

```typescript
"onSave<keydown>(&ctrl)"(e) { ... }   // Only fires when Ctrl is held
"onDelete<keyup>(&ctrl,&shift)"(e) { ... }  // Ctrl+Shift
```

### Event Delegation Architecture

All DOM events are delegated to `document.body` using capture-phase listeners for performance. The EventDelegator:

1. Binds event types to `document.body` with reference counting -- the first binding adds the listener, the last unbinding removes it.
2. On event dispatch, walks up the DOM from the target element to `document.body`.
3. At each element, checks for `@<eventType>` attributes and parses them using the EVENT_METHOD_REGEXP.
4. If the attribute has a View ID prefix (from the `\x1f` placeholder), looks up the corresponding Frame and View.
5. If no View ID is present, walks up the Frame tree to find the nearest View that handles the event.
6. For selector events, checks the View's `eventSelectorMap` to find matching CSS selectors.
7. Attaches metadata to the event object: `eventTarget` (actual clicked element) and `params` (parsed URL parameters).
8. Calls the handler function via `funcWithTry()` for error safety.
9. Stops propagation at view boundaries when range events are configured.

## Sub-View Embedding

Child views are embedded using the `v-lark` attribute on a container element. The attribute value is the view path registered with `registerViewClass`.

```html
<div v-lark="components/counter-store"></div>
```

The framework automatically:

1. Creates a child Frame for each `v-lark` element.
2. Mounts the registered View class into the Frame.
3. Manages the child View lifecycle (mount, render, unmount).

During DOM diff, if both old and new elements have the same `v-lark` path, the existing child View is preserved (children are not re-rendered). Only when the view path changes is the old View unmounted and a new one mounted.

The `v-lark` attribute value can include URL-style query parameters:

```html
<div v-lark="components/detail?id=123&type=full"></div>
```

These parameters are parsed and passed to the child View as `initParams` during `mountView()`.

## Special Attributes

| Attribute | Description                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v-lark`  | Declares a child view slot. Value is the registered view path, optionally with query parameters for initParams                                    |
| `ldk`     | Provides a comparison key for DOM diff optimization. Elements with the same `ldk` value skip diff entirely (no attribute or children comparison) |
| `lak`     | Provides a comparison key for attribute-only diff optimization. Elements with the same `lak` value skip attribute diff but still diff children    |
| `lvk`     | Provides a view key for assign optimization. When `lvk` values match, the view's `assign()` method is called instead of full unmount/remount      |

### ldk Usage

Use `ldk` to mark static or expensive-to-diff elements:

```html
<div ldk="header-section">
  <!-- Complex content that rarely changes -->
</div>
```

When the DOM engine encounters two elements with matching `ldk` values, it skips the entire diff for that subtree, treating it as unchanged.

### lak Usage

Use `lak` when element structure is stable but attributes may change:

```html
<button lak="submit-btn" class="{{=btnClass}}" disabled="{{=isDisabled}}">
  Submit
</button>
```

When `lak` values match, the DOM engine skips attribute comparison but still diffs child nodes.

### DOM Compare Key Resolution

The DOM engine uses the following priority order to determine compare keys for keyed diff:

1. `id` attribute (if not auto-generated)
2. `ldk` attribute
3. `v-lark` path (parsed from the attribute value)

## Compiled Function Signature

The template compiler transforms `.html` files into ES modules. Each compiled module imports the runtime helpers from `@lark.js/mvc/runtime` (a small shared module, ~948 bytes), rather than inlining ~400 bytes of helper code per template. Output shape:

```typescript
import {
  encHtml as __larkEncHtml,
  strSafe as __larkStrSafe,
  encUri as __larkEncUri,
  encQuote as __larkEncQuote,
  refFn as __larkRefFn,
} from "@lark.js/mvc/runtime";

export default function (data, viewId, refData) {
  let $data = data || {},
    $viewId = viewId || "";
  return innerFunction(
    $data,
    $viewId,
    refData,
    __larkEncHtml,
    __larkStrSafe,
    __larkEncUri,
    __larkRefFn,
    __larkEncQuote,
  );
}
```

The outer function is the public API. The inner arrow function has this signature:

```typescript
(
  $data: unknown, // Template data (all variables destructured from this)
  $viewId: string, // View ID for event delegation (\x1f placeholder replaced with '+$viewId+')
  $refAlt: unknown, // Reference data for $refFn lookup (defaults to $data if not provided)
  $encHtml: Function, // HTML entity encoding: & < > " ' ` -> &amp; &lt; etc.
  $strSafe: Function, // Null-safe toString: null/undefined -> ""
  $encUri: Function, // URI encoding with extra character handling: ! ' ( ) *
  $refFn: Function, // Reference lookup in refData (lazy-initialized on first @ operator use)
  $encQuote: Function, // Quote encoding: escapes ' " \ for attribute embedding
) => string;
```

Global variables detected by `extractGlobalVars()` are destructured from `$data` at the top of the inner function:

```javascript
,variable1=$data.variable1,variable2=$data.variable2
```

The inner function also declares: `$splitter` (the SPLITTER constant `\x1e`), `$tmp` (temporary variable), and `$out` (output buffer string).

## Built-in Encoding Functions

These functions are provided by the `@lark.js/mvc/runtime` module and injected into each compiled template as `__larkEncHtml` / `__larkStrSafe` / `__larkEncUri` / `__larkEncQuote` / `__larkRefFn`. Inside the inner arrow function they are bound to `$encHtml` / `$strSafe` / `$encUri` / `$encQuote` / `$refFn`.

| Function                 | Signature                                                            | Description                                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `$encHtml(value)`        | `v => String(v == null ? '' : v).replace(/[&<>"'`]/g, entityMap)`    | HTML entity encoding. Maps `& < > " ' backtick` to `&amp; &lt; &gt; &quot; &#39; &#96;`                                                         |
| `$strSafe(value)`        | `v => String(v == null ? '' : v)`                                    | Null-safe toString. Converts null/undefined to empty string                                                                                     |
| `$encUri(value)`         | `v => encodeURIComponent($strSafe(v)).replace(/[!')(*]/g, extraMap)` | URI encoding with extra character encoding for `! ' ( ) *`                                                                                      |
| `$encQuote(value)`       | `v => $strSafe(v).replace(/['"\\]/g, '\\$&')`                        | Quote encoding. Escapes quotes and backslashes for safe embedding in attribute values                                                           |
| `$refFn(refData, value)` | `(ref, v, k, f) => { /* find or allocate key */ }`                   | Reference lookup in refData. Finds or allocates a SPLITTER-prefixed key for the given value. Used whenever `@` operator appears in the template |

Why this matters: the helpers are defined exactly once (in the runtime module) and shared across every compiled template. Earlier versions inlined the helpers into each module — for 100 templates that meant ~40 KB of duplicated bytes. The current scheme saves that overhead and is the reason `@lark.js/mvc/runtime` exists as a dedicated package entry.

## HTML Comment Handling

HTML comments are protected during compilation. Template syntax inside comments is preserved as-is and restored after processing.

```html
<!-- This {{=willNotBeProcessed}} stays as literal text -->
```

The compiler replaces HTML comments with `__lark_comment_N__` placeholders before template processing, then restores them afterward.

## Debug Mode

When debug mode is enabled (via `larkMvcPlugin({ debug: true })` for Vite or `options: { debug: true }` for the Webpack larkMvcLoader), the compiler adds instrumentation:

1. **Line markers** -- Inserts `\x1e` + line number before each `{{` tag for error reporting.
2. **Expression tracking** -- Wrap template expressions with `$dbgExpr`/`$dbgArt`/`$dbgLine` tracking variables:
   - `$dbgExpr`: the internal `<% %>` expression being evaluated
   - `$dbgArt`: the original `{{ }}` template syntax
   - `$dbgLine`: the source line number
3. **Try-catch wrapper** -- The compiled function body is wrapped in a try-catch that produces detailed error messages including:
   - The error message
   - The original art syntax (`{{=variable}}`)
   - The compiled expression (`<%=variable%>`)
   - The source line number
   - The file path (if provided via `CompileOptions.file`)

Error message format:

```
render view error: <error message>
    src art: {{=user.name}}
    at line: 42
    translate to: <%=user.name%>
    at file:src/views/home.html
```

## Global Variable Extraction

The `extractGlobalVars()` function performs AST-based scope analysis to determine which variables in a template need to be passed in as data. This eliminates the need for manual variable declarations.

The analysis:

1. Converts `{{ }}` template expressions to `<% %>` internal format.
2. Replaces HTML text between template expressions with unique placeholders.
3. Parses the resulting code using `@babel/parser`.
4. Walks the AST to find all `Identifier` nodes.
5. Tracks local variable declarations (`VariableDeclarator`) and function parameters as non-global.
6. Skips `MemberExpression` properties (e.g., `obj.prop` -- `prop` is not a standalone variable).
7. Skips `ObjectProperty` keys (e.g., `{key: value}` -- `key` is not a variable).
8. Remaining identifiers that are not local and not in the built-in exclusion list are treated as global variables.

The exclusion list includes:

- Template runtime helpers (`$splitter`, `$data`, `$strSafe`, `$encHtml`, `$entMap`, `$entReg`, `$entFn`, `$out`, `$refFn`, `$encUri`, `$uriMap`, `$uriFn`, `$uriReg`, `$encQuote`, `$qReg`, `$viewId`, `$dbgExpr`, `$dbgArt`, `$dbgLine`, `$refAlt`, `$tmp`)
- JS literals (`undefined`, `null`, `true`, `false`, `NaN`, `Infinity`)
- JS built-in globals (`window`, `self`, `globalThis`, `document`, `console`, `JSON`, `Math`, `Intl`, `Promise`, `Symbol`, `Number`, `String`, `Boolean`, `Array`, `Object`, `Date`, `RegExp`, `Error`, `TypeError`, `RangeError`, `SyntaxError`, `Map`, `Set`, `WeakMap`, `WeakSet`, `Proxy`, `Reflect`, `ArrayBuffer`, `DataView`, `Float32Array`, `Float64Array`, `Int8Array`, `Int16Array`, `Int32Array`, `Uint8Array`, `Uint16Array`, `Uint32Array`, `Uint8ClampedArray`, `parseInt`, `parseFloat`, `isNaN`, `isFinite`, `encodeURIComponent`, `decodeURIComponent`, `encodeURI`, `decodeURI`)
- Babel helpers (`arguments`, `this`, `require`)
- Framework references (`Lark`)

If AST parsing fails (malformed templates), a fallback regex-based extraction is used.
