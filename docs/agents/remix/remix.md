# remix

Source: https://github.com/remix-run/remix/tree/main/packages/remix

## README

A modern web framework for JavaScript.

See [remix.run](https://remix.run) for framework docs.

## Installation

```sh
npm i remix
```

## Package usage in Remix 3 alpha

The `remix` package is used through subpath imports.

- ✅ `import { createRouter } from 'remix/fetch-router'`
- ✅ `import { route } from 'remix/fetch-router/routes'`
- ✅ `import { createRoot } from 'remix/component'`
- ❌ `import { ... } from 'remix'` (root import removed in `3.0.0-alpha.3`)

## Notable subpath exports

- `remix/data-schema`
- `remix/data-schema/checks`
- `remix/data-schema/coerce`
- `remix/data-schema/lazy`
- `remix/data-table`
- `remix/data-table-mysql`
- `remix/data-table-postgres`
- `remix/data-table-sqlite`
- `remix/fetch-router/routes`
- `remix/file-storage-s3`
- `remix/session-storage-memcache`
- `remix/session-storage-redis`

## Navigation

- [Remix package index](./index.md)
