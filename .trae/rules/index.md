- Type robustness: Avoid using `eslint-disable`, 
TypeScript suppression comments (e.g. `@ts-ignore`, `@ts-expect-error`), 
or `as` assertions to bypass type checking. 
Prefer strict typing; use `unknown` instead of `any` whenever possible. 
Use `any` only as a last resort and keep its scope minimal.
