# Code style

## Function forms

- Prefer function declarations for named, reusable functions.
- Use arrow functions for callbacks and inline handlers.
- Use object method shorthand for multi-line object methods.

## Array types

- Prefer `Array<T>` and `ReadonlyArray<T>` over `T[]`.
- This avoids precedence pitfalls in union types and keeps type reads clearer.

## Exports

- Prefer named exports.
- Use default exports only when a framework contract requires them.

## Type conventions

- Prefer `type` aliases for object shapes and unions.
- Use `interface` only when you need declaration merging or public extension
  points.
- Use `satisfies` when exporting objects that must match framework contracts.

## Absence values

- Use `null` for explicit "no value" in local state or API responses.
- Use `undefined` for optional or omitted fields, and avoid mixing within one
  API.

## References

- https://kentcdodds.com/blog/function-forms
- https://tkdodo.eu/blog/array-types-in-type-script
