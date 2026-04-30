# Remix v3 alpha.6 release notes

Release notes retrieved with `gh release view ... --repo remix-run/remix` for
the umbrella Remix release and each package version present at
`remix@3.0.0-alpha.6`.

## Contents

- [remix@3.0.0-alpha.6](#remix300-alpha6)
- [assert@0.1.0](#assert010)
- [assets@0.2.0](#assets020)
- [async-context-middleware@0.2.1](#async-context-middleware021)
- [auth@0.2.0](#auth020)
- [auth-middleware@0.1.1](#auth-middleware011)
- [cli@0.1.0](#cli010)
- [compression-middleware@0.1.6](#compression-middleware016)
- [cookie@0.5.1](#cookie051)
- [cop-middleware@0.1.1](#cop-middleware011)
- [cors-middleware@0.1.1](#cors-middleware011)
- [csrf-middleware@0.1.1](#csrf-middleware011)
- [data-schema@0.3.0](#data-schema030)
- [data-table@0.2.0](#data-table020)
- [data-table-mysql@0.3.0](#data-table-mysql030)
- [data-table-postgres@0.3.0](#data-table-postgres030)
- [data-table-sqlite@0.4.0](#data-table-sqlite040)
- [fetch-proxy@0.8.0](#fetch-proxy080)
- [fetch-router@0.18.1](#fetch-router0181)
- [file-storage@0.13.4](#file-storage0134)
- [file-storage-s3@0.1.1](#file-storage-s3011)
- [form-data-middleware@0.2.2](#form-data-middleware022)
- [form-data-parser@0.17.0](#form-data-parser0170)
- [fs@0.4.3](#fs043)
- [headers@0.19.0](#headers0190)
- [html-template@0.3.0](#html-template030)
- [lazy-file@5.0.3](#lazy-file503)
- [logger-middleware@0.2.0](#logger-middleware020)
- [method-override-middleware@0.1.6](#method-override-middleware016)
- [mime@0.4.1](#mime041)
- [multipart-parser@0.16.0](#multipart-parser0160)
- [node-fetch-server@0.13.0](#node-fetch-server0130)
- [response@0.3.3](#response033)
- [route-pattern@0.20.1](#route-pattern0201)
- [session@0.4.1](#session041)
- [session-middleware@0.2.1](#session-middleware021)
- [session-storage-memcache@0.1.0](#session-storage-memcache010)
- [session-storage-redis@0.1.0](#session-storage-redis010)
- [static-middleware@0.4.7](#static-middleware047)
- [tar-parser@0.7.1](#tar-parser071)
- [terminal@0.1.0](#terminal010)
- [test@0.2.0](#test020)
- [ui@0.1.0](#ui010)

## remix@3.0.0-alpha.6

- Name: remix v3.0.0-alpha.6
- Published: 2026-04-29T17:32:47Z

### Pre-release Changes

- BREAKING CHANGE: `MultipartPart.headers` from `remix/multipart-parser` and
  `remix/multipart-parser/node` is now a plain decoded object keyed by
  lower-case header name instead of a native `Headers` instance. Access part
  headers with bracket notation like `part.headers['content-type']` instead of
  `part.headers.get('content-type')`.

- BREAKING CHANGE: Removed the deprecated `remix/component`,
  `remix/component/jsx-runtime`, `remix/component/jsx-dev-runtime`, and
  `remix/component/server` package exports. Import the consolidated UI runtime
  from `remix/ui`, `remix/ui/jsx-runtime`, `remix/ui/jsx-dev-runtime`, and
  `remix/ui/server` instead.

  Removed `package.json` `bin` commands:
  - `remix-test`

  Added `package.json` `exports`:
  - `remix/node-fetch-server/test` to re-export APIs from
    `@remix-run/node-fetch-server/test`
  - `remix/terminal` to re-export APIs from `@remix-run/terminal`
  - `remix/test/cli` to re-export APIs from `@remix-run/test/cli`

  Added `package.json` `exports` for the consolidated UI runtime:
  - `remix/ui` to re-export APIs from `@remix-run/ui`
  - `remix/ui/jsx-runtime` to re-export APIs from `@remix-run/ui/jsx-runtime`
  - `remix/ui/jsx-dev-runtime` to re-export APIs from
    `@remix-run/ui/jsx-dev-runtime`
  - `remix/ui/server` to re-export APIs from `@remix-run/ui/server`
  - `remix/ui/animation` to re-export APIs from `@remix-run/ui/animation`
  - `remix/ui/accordion` to re-export APIs from `@remix-run/ui/accordion`
  - `remix/ui/anchor` to re-export APIs from `@remix-run/ui/anchor`
  - `remix/ui/breadcrumbs` to re-export APIs from `@remix-run/ui/breadcrumbs`
  - `remix/ui/button` to re-export APIs from `@remix-run/ui/button`
  - `remix/ui/combobox` to re-export APIs from `@remix-run/ui/combobox`
  - `remix/ui/glyph` to re-export APIs from `@remix-run/ui/glyph`
  - `remix/ui/listbox` to re-export APIs from `@remix-run/ui/listbox`
  - `remix/ui/menu` to re-export APIs from `@remix-run/ui/menu`
  - `remix/ui/popover` to re-export APIs from `@remix-run/ui/popover`
  - `remix/ui/scroll-lock` to re-export APIs from `@remix-run/ui/scroll-lock`
  - `remix/ui/select` to re-export APIs from `@remix-run/ui/select`
  - `remix/ui/separator` to re-export APIs from `@remix-run/ui/separator`
  - `remix/ui/theme` to re-export APIs from `@remix-run/ui/theme`
  - `remix/ui/test` to re-export APIs from `@remix-run/ui/test`

- Added `package.json` exports and binaries for the Remix CLI:
  - `remix/cli` to expose the Remix CLI programmatic API
  - `remix` as a `package.json` `bin` command that delegates to `@remix-run/cli`

  The Remix CLI now reads the current Remix version from the `remix` package and
  declares Node.js 24.3.0 or later in package metadata.

- Bumped `@remix-run/*` dependencies:
  - [`assets@0.2.0`](https://github.com/remix-run/remix/releases/tag/assets@0.2.0)
  - [`auth@0.2.0`](https://github.com/remix-run/remix/releases/tag/auth@0.2.0)
  - [`cli@0.1.0`](https://github.com/remix-run/remix/releases/tag/cli@0.1.0)
  - [`compression-middleware@0.1.6`](https://github.com/remix-run/remix/releases/tag/compression-middleware@0.1.6)
  - [`data-schema@0.3.0`](https://github.com/remix-run/remix/releases/tag/data-schema@0.3.0)
  - [`data-table-sqlite@0.4.0`](https://github.com/remix-run/remix/releases/tag/data-table-sqlite@0.4.0)
  - [`fetch-proxy@0.8.0`](https://github.com/remix-run/remix/releases/tag/fetch-proxy@0.8.0)
  - [`file-storage@0.13.4`](https://github.com/remix-run/remix/releases/tag/file-storage@0.13.4)
  - [`file-storage-s3@0.1.1`](https://github.com/remix-run/remix/releases/tag/file-storage-s3@0.1.1)
  - [`form-data-middleware@0.2.2`](https://github.com/remix-run/remix/releases/tag/form-data-middleware@0.2.2)
  - [`form-data-parser@0.17.0`](https://github.com/remix-run/remix/releases/tag/form-data-parser@0.17.0)
  - [`fs@0.4.3`](https://github.com/remix-run/remix/releases/tag/fs@0.4.3)
  - [`lazy-file@5.0.3`](https://github.com/remix-run/remix/releases/tag/lazy-file@5.0.3)
  - [`logger-middleware@0.2.0`](https://github.com/remix-run/remix/releases/tag/logger-middleware@0.2.0)
  - [`mime@0.4.1`](https://github.com/remix-run/remix/releases/tag/mime@0.4.1)
  - [`multipart-parser@0.16.0`](https://github.com/remix-run/remix/releases/tag/multipart-parser@0.16.0)
  - [`response@0.3.3`](https://github.com/remix-run/remix/releases/tag/response@0.3.3)
  - [`static-middleware@0.4.7`](https://github.com/remix-run/remix/releases/tag/static-middleware@0.4.7)
  - [`tar-parser@0.7.1`](https://github.com/remix-run/remix/releases/tag/tar-parser@0.7.1)
  - [`terminal@0.1.0`](https://github.com/remix-run/remix/releases/tag/terminal@0.1.0)
  - [`test@0.2.0`](https://github.com/remix-run/remix/releases/tag/test@0.2.0)
  - [`ui@0.1.0`](https://github.com/remix-run/remix/releases/tag/ui@0.1.0)

## assert@0.1.0

- Name: assert v0.1.0
- Published: 2026-04-23T00:44:16Z

### Minor Changes

- Initial release of `@remix-run/assert`.

  A compatible subset of `node:assert/strict` that works in any JavaScript
  environment, including browsers. Uses strict equality (`===`) for all
  comparisons — no type coercion.
  - `AssertionError` — compatible with `node:assert.AssertionError` (`actual`,
    `expected`, `operator`, `name`)
  - `assert.ok` — truthy check
  - `assert.equal` / `assert.notEqual` — strict equality (`===` / `!==`)
  - `assert.deepEqual` / `assert.notDeepEqual` — recursive strict deep equality
  - `assert.match` — string matches a regexp
  - `assert.fail` — unconditional failure
  - `assert.throws` — synchronous throw assertion
  - `assert.rejects` — async rejection assertion

## assets@0.2.0

- Name: assets v0.2.0
- Published: 2026-04-29T17:32:36Z

### Minor Changes

- BREAKING CHANGE: `target` configuration is now configured at the top level
  with an object format, supporting `es` version targets along with browser
  version targets.

  Browser targets are configured with string versions such as
  `target: { chrome: '109', safari: '16.4' }`, and scripts can specify `es` as a
  year of `2015` or higher such as `target: { es: '2020' }`.

  To migrate existing script configuration, replace `scripts.target` options
  like `scripts: { target: 'es2020' }` with `target: { es: '2020' }`.

- BREAKING CHANGE: Shared compiler options are now provided at the top level of
  `createAssetServer()`. Use `sourceMaps`, `sourceMapSourcePaths`, and `minify`
  directly on the asset server options instead of being nested under `scripts`.
  This allows these options to also be used for styles as well as scripts.

  To migrate existing configuration, move `scripts.minify`,
  `scripts.sourceMaps`, `scripts.sourceMapSourcePaths` to the top-level asset
  server options.

- `createAssetServer()` now compiles and serves `.css` files alongside scripts,
  including local `@import` rewriting, fingerprinting, and shared compiler
  options for minification, source maps, and browser compatibility targeting.

### Patch Changes

- Fix matching of dot-prefixed files and directories in `allow` and `deny` globs

- Improve asset server import errors to include the resolved file path when a
  resolved import is later rejected by validation for allow/deny rules,
  supported file types and `fileMap` configuration.

## async-context-middleware@0.2.1

- Name: async-context-middleware v0.2.1
- Published: 2026-04-23T00:39:58Z

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.1)

## auth@0.2.0

- Name: auth v0.2.0
- Published: 2026-04-29T17:32:45Z

### Minor Changes

- Added `createAtmosphereAuthProvider(options)` to support atproto OAuth flows
  against Atmosphere-compatible authorization servers.

  The new provider resolves handles and DIDs with
  `provider.prepare(handleOrDid)` before redirecting, performs required pushed
  authorization requests with DPoP, supports both public web clients and
  localhost loopback development clients, and seals per-session DPoP state into
  the in-flight OAuth transaction using the required `sessionSecret` option
  instead of a separate persistent store.

  Create the Atmosphere provider once with shared options, call
  `provider.prepare(handleOrDid)` only before `startExternalAuth()`, and pass
  the module-scope provider directly to `finishExternalAuth()` and
  `refreshExternalAuth()`. Atmosphere callback results preserve the DPoP binding
  state and authorization server refresh details alongside the returned
  `accessToken` and `refreshToken`, so callers can reuse the completed token
  bundle directly for refresh-token exchange and follow-up DPoP-signed requests.

- Added `refreshExternalAuth()` to `@remix-run/auth` so apps can exchange stored
  refresh tokens for fresh OAuth and OIDC token bundles.

  The built-in OIDC providers, X, and Atmosphere now implement refresh-token
  exchange. Refreshed token bundles preserve the existing refresh token when the
  provider omits a rotated value.

## auth-middleware@0.1.1

- Name: auth-middleware v0.1.1
- Published: 2026-04-23T00:40:01Z

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.1)

## cli@0.1.0

- Name: cli v0.1.0
- Published: 2026-04-29T17:32:45Z

### Minor Changes

- Initial release of `@remix-run/cli` with the public `runRemix()` API and
  commands for project scaffolding, health checks and fixes, route inspection,
  skills syncing, and running tests. The package requires Node.js 24.3.0 or
  later and exposes the programmatic CLI API; use the `remix` package for the
  user-facing `remix` executable.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`tar-parser@0.7.1`](https://github.com/remix-run/remix/releases/tag/tar-parser@0.7.1)
  - [`terminal@0.1.0`](https://github.com/remix-run/remix/releases/tag/terminal@0.1.0)
  - [`test@0.2.0`](https://github.com/remix-run/remix/releases/tag/test@0.2.0)

## compression-middleware@0.1.6

- Name: compression-middleware v0.1.6
- Published: 2026-04-29T17:32:42Z

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`mime@0.4.1`](https://github.com/remix-run/remix/releases/tag/mime@0.4.1)
  - [`response@0.3.3`](https://github.com/remix-run/remix/releases/tag/response@0.3.3)

## cookie@0.5.1

- Name: cookie v0.5.1
- Published: 2026-02-28T01:27:38Z

### Patch Changes

- Changed `@remix-run/*` peer dependencies to regular dependencies

## cop-middleware@0.1.1

- Name: cop-middleware v0.1.1
- Published: 2026-04-23T00:39:58Z

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.1)

## cors-middleware@0.1.1

- Name: cors-middleware v0.1.1
- Published: 2026-04-23T00:40:00Z

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.1)

## csrf-middleware@0.1.1

- Name: csrf-middleware v0.1.1
- Published: 2026-04-23T00:40:03Z

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.1)

## data-schema@0.3.0

- Name: data-schema v0.3.0
- Published: 2026-04-29T17:32:35Z

### Minor Changes

- Add `Schema.transform()` for mapping validated schema outputs to new values
  and output types.

## data-table@0.2.0

- Name: data-table v0.2.0
- Published: 2026-03-25T23:06:15Z

### Minor Changes

- BREAKING CHANGE: Rename adapter operation contracts and fields.

  `AdapterStatement` becomes `DataManipulationOperation`, and `statement`
  becomes `operation`.

  Add separate adapter execution methods for DML and migration/DDL operations:
  `execute` for `DataManipulationOperation` requests and `migrate` for
  `DataMigrationOperation` requests.

  Add adapter introspection methods with optional transaction context:
  `hasTable(table, transaction?)` and `hasColumn(table, column, transaction?)`.

- BREAKING CHANGE: Replace the public `QueryBuilder` API with `Query` objects
  that can be created with `query(table)` and executed with `db.exec(...)`.

  `db.query(table)` still provides the same chainable ergonomics, but it now
  returns the public `Query` class in a database-bound form instead of a
  separate `QueryBuilder` type. `db.exec(...)` now accepts only raw SQL or
  `Query` values, and unbound terminal methods like `first()`, `count()`,
  `exists()`, `insert()`, `update()`, and `delete()` return `Query` objects
  instead of separate command descriptor types.

  The incidental `QueryMethod` type export has also been removed; use
  `Database['query']` or `QueryForTable<table>` when you need that type shape.

- BREAKING CHANGE: Remove the `@remix-run/data-table/sql` export. Import
  `SqlStatement`, `sql`, and `rawSql` from `@remix-run/data-table` instead.

  `@remix-run/data-table/sql-helpers` remains available as the adapter-facing
  SQL helper module.

- BREAKING CHANGE: Rename the top-level table-definition helper from
  `createTable(...)` to `table(...)` and switch column definitions to
  `column(...)` builders. Runtime validation is now optional and table-scoped
  via `validate({ operation, tableName, value })`.

  Remove `~standard` table-schema compatibility and
  `getTableValidationSchemas(...)`, and stop runtime validation/coercion for
  predicate values.

- `@remix-run/data-table` now exports `Database` as the runtime class instead of
  separating the runtime implementation from a structural `Database` type. You
  can construct databases directly with `new Database(adapter, options)` or keep
  using `createDatabase(adapter, options)`, which now delegates to the class
  constructor.

- Add a first-class migration system under `remix/data-table/migrations` with:
  - `createMigration(...)` and timestamp-based migration loading
  - chainable `column` builders plus schema APIs for create, alter, drop, and
    index work
  - `createMigrationRunner(adapter, migrations)` for `up`, `down`, `status`, and
    `dryRun`
  - migration journaling, checksum tracking, and optional Node loading from
    `remix/data-table/migrations/node`

  Migration callbacks now use split handles: `{ db, schema }`.
  - `db` is the immediate data runtime
    (`query/create/update/delete/exec/transaction`)
  - `schema` owns migration operations like `createTable`, `alterTable`, `plan`,
    and introspection

  Migration-time DDL, DML, and introspection now share the same transaction
  token when migration transactions are enabled. In `dryRun`, schema
  introspection (`schema.hasTable` / `schema.hasColumn`) reads live
  adapter/database state and does not simulate pending dry-run operations.

  Add public subpath exports for migrations, Node migration loading, SQL
  helpers, operators, and SQL builders. SQL compilation stays adapter-owned,
  while shared SQL compiler helpers remain available from
  `remix/data-table/sql-helpers`.

  `@remix-run/data-table/migrations` no longer exports a separate `Database`
  type alias. Migration callbacks still receive `context.db` as the main
  `Database` runtime, so if you need the type directly, import `Database` from
  `@remix-run/data-table` instead.

- Add optional table lifecycle callbacks for write/delete/read flows:
  `beforeWrite`, `afterWrite`, `beforeDelete`, `afterDelete`, and `afterRead`.

  Add `fail(...)` as a helper for returning structured validation/lifecycle
  issues from `validate(...)`, `beforeWrite(...)`, and `beforeDelete(...)`.

## data-table-mysql@0.3.0

- Name: data-table-mysql v0.3.0
- Published: 2026-04-23T00:40:05Z

### Minor Changes

- BREAKING CHANGE: Removed adapter options

  **Affected APIs**
  - `MysqlDatabaseAdapterOptions` type: removed
  - `createMysqlDatabaseAdapter` function: `options` arg removed
  - `MysqlDatabaseAdapter` constructor: `options` arg removed

  **Why**

  Adapter options existed solely for tests to override adapter capabilities. If
  you must override capabilities, you can do so directly via mutation:

  ```ts
  let adapter = createMysqlDatabaseAdapter(mysql)
  adapter.capabilities = {
  	...adapter.capabilities,
  	upsert: false,
  }
  ```

## data-table-postgres@0.3.0

- Name: data-table-postgres v0.3.0
- Published: 2026-04-23T00:40:06Z

### Minor Changes

- BREAKING CHANGE: Removed adapter options

  **Affected APIs**
  - `PostgresDatabaseAdapterOptions` type: removed
  - `createPostgresDatabaseAdapter` function: `options` arg removed
  - `PostgresDatabaseAdapter` constructor: `options` arg removed

  **Why**

  Adapter options existed solely for tests to override adapter capabilities. If
  you must override capabilities, you can do so directly via mutation:

  ```ts
  let adapter = createPostgresDatabaseAdapter(postgres)
  adapter.capabilities = {
  	...adapter.capabilities,
  	returning: false,
  }
  ```

- Types for `createPostgresDatabaseAdapter` now accept a `Client` in addition to
  `Pool` and `PoolClient`.

  This is a type-only change that aligns the function signature with existing
  runtime behavior.

## data-table-sqlite@0.4.0

- Name: data-table-sqlite v0.4.0
- Published: 2026-04-29T17:32:37Z

### Minor Changes

- Widened `createSqliteDatabaseAdapter` to accept synchronous SQLite clients
  that match the shared `prepare`/`exec` surface used by Node's `node:sqlite`,
  Bun's `bun:sqlite`, and compatible clients. The package no longer requires
  `better-sqlite3` as an optional peer dependency.

## fetch-proxy@0.8.0

- Name: fetch-proxy v0.8.0
- Published: 2026-04-29T17:32:38Z

### Minor Changes

- Add an `X-Forwarded-Port` header when `xForwardedHeaders` is enabled.

## fetch-router@0.18.1

- Name: fetch-router v0.18.1
- Published: 2026-04-23T00:39:58Z

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`route-pattern@0.20.1`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.20.1)

## file-storage@0.13.4

- Name: file-storage v0.13.4
- Published: 2026-04-29T17:32:43Z

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fs@0.4.3`](https://github.com/remix-run/remix/releases/tag/fs@0.4.3)
  - [`lazy-file@5.0.3`](https://github.com/remix-run/remix/releases/tag/lazy-file@5.0.3)

## file-storage-s3@0.1.1

- Name: file-storage-s3 v0.1.1
- Published: 2026-04-29T17:32:46Z

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`file-storage@0.13.4`](https://github.com/remix-run/remix/releases/tag/file-storage@0.13.4)

## form-data-middleware@0.2.2

- Name: form-data-middleware v0.2.2
- Published: 2026-04-29T17:32:43Z

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`form-data-parser@0.17.0`](https://github.com/remix-run/remix/releases/tag/form-data-parser@0.17.0)

## form-data-parser@0.17.0

- Name: form-data-parser v0.17.0
- Published: 2026-04-29T17:32:39Z

### Minor Changes

- BREAKING CHANGE: Errors thrown or rejected by a `parseFormData()` upload
  handler now propagate directly instead of being wrapped in a
  `FormDataParseError`.

### Patch Changes

- Preserve non-ASCII multipart field names and filenames when parsing
  `multipart/form-data` requests.

- Bumped `@remix-run/*` dependencies:
  - [`multipart-parser@0.16.0`](https://github.com/remix-run/remix/releases/tag/multipart-parser@0.16.0)

## fs@0.4.3

- Name: fs v0.4.3
- Published: 2026-04-29T17:32:40Z

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`lazy-file@5.0.3`](https://github.com/remix-run/remix/releases/tag/lazy-file@5.0.3)
  - [`mime@0.4.1`](https://github.com/remix-run/remix/releases/tag/mime@0.4.1)

## headers@0.19.0

- Name: headers v0.19.0
- Published: 2026-02-28T01:27:44Z

### Minor Changes

- BREAKING CHANGE: Removed `Headers`/`SuperHeaders` class and default export.
  Use the native `Headers` class with the static `from()` method on each header
  class instead.

  New individual header `.from()` methods:
  - `Accept.from()`
  - `AcceptEncoding.from()`
  - `AcceptLanguage.from()`
  - `CacheControl.from()`
  - `ContentDisposition.from()`
  - `ContentRange.from()`
  - `ContentType.from()`
  - `Cookie.from()`
  - `IfMatch.from()`
  - `IfNoneMatch.from()`
  - `IfRange.from()`
  - `Range.from()`
  - `SetCookie.from()`
  - `Vary.from()`

  New raw header utilities added:
  - `parse()`
  - `stringify()`

  Migration example:

  ```ts
  // Before:
  import SuperHeaders from '@remix-run/headers'
  let headers = new SuperHeaders(request.headers)
  let mediaType = headers.contentType.mediaType

  // After:
  import { ContentType } from '@remix-run/headers'
  let contentType = ContentType.from(request.headers.get('content-type'))
  let mediaType = contentType.mediaType
  ```

  If you were using the `Headers` constructor to parse raw HTTP header strings,
  use `parse()` instead:

  ```ts
  // Before:
  import SuperHeaders from '@remix-run/headers'
  let headers = new SuperHeaders(
  	'Content-Type: text/html\r\nCache-Control: no-cache',
  )

  // After:
  import { parse } from '@remix-run/headers'
  let headers = parse('Content-Type: text/html\r\nCache-Control: no-cache')
  ```

  If you were using `headers.toString()` to convert headers to raw format, use
  `stringify()` instead:

  ```ts
  // Before:
  import SuperHeaders from '@remix-run/headers'
  let headers = new SuperHeaders()
  headers.set('Content-Type', 'text/html')
  let rawHeaders = headers.toString()

  // After:
  import { stringify } from '@remix-run/headers'
  let headers = new Headers()
  headers.set('Content-Type', 'text/html')
  let rawHeaders = stringify(headers)
  ```

## html-template@0.3.0

- Name: html-template v0.3.0
- Published: 2025-11-05T00:08:34Z

- Build using `tsc` instead of `esbuild`. This means modules in the `dist`
  directory now mirror the layout of modules in the `src` directory.

## lazy-file@5.0.3

- Name: lazy-file v5.0.3
- Published: 2026-04-29T17:32:38Z

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`mime@0.4.1`](https://github.com/remix-run/remix/releases/tag/mime@0.4.1)

## logger-middleware@0.2.0

- Name: logger-middleware v0.2.0
- Published: 2026-04-29T17:32:41Z

### Minor Changes

- Colorize high-signal logger tokens when terminal color detection allows it by
  default, with a `colors` option to force colorized output on or off and
  support for `CI`, `NO_COLOR`, `FORCE_COLOR`, `TERM=dumb`, and TTY output
  streams when the `process` global is defined.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`terminal@0.1.0`](https://github.com/remix-run/remix/releases/tag/terminal@0.1.0)

## method-override-middleware@0.1.6

- Name: method-override-middleware v0.1.6
- Published: 2026-04-23T00:40:04Z

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.1)

## mime@0.4.1

- Name: mime v0.4.1
- Published: 2026-04-29T17:32:36Z

### Patch Changes

- Prefer `video/mp4` for `.mp4` files and `image/x-icon` for `.ico` files.

## multipart-parser@0.16.0

- Name: multipart-parser v0.16.0
- Published: 2026-04-29T17:32:39Z

### Minor Changes

- BREAKING CHANGE: `MultipartPart.headers` is now a plain decoded object keyed
  by lower-case header name instead of a native `Headers` instance. Access part
  headers with bracket notation like `part.headers['content-type']` instead of
  `part.headers.get('content-type')`.

  This lets multipart part headers preserve decoded UTF-8 field names and
  filenames that native `Headers` cannot store.

## node-fetch-server@0.13.0

- Name: node-fetch-server v0.13.0
- Published: 2025-12-18T22:04:38Z

- Use the `:authority` header to set the URL of http/2 requests.

## response@0.3.3

- Name: response v0.3.3
- Published: 2026-04-29T17:32:41Z

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`mime@0.4.1`](https://github.com/remix-run/remix/releases/tag/mime@0.4.1)

## route-pattern@0.20.1

- Name: route-pattern v0.20.1
- Published: 2026-04-23T00:39:59Z

### Patch Changes

- Matches return decoded values for params in hostname

  ```ts
  pattern = new RoutePattern('://:subdomain.example.com/posts/:slug')

  url = new URL('https://café.example.com/posts/123')
  pattern.match(url)?.params.subdomain
  // Before -> 'xn--caf-dma'
  // After -> 'café'

  url = new URL('https://北京.example.com/posts/123')
  pattern.match(url)?.params.subdomain
  // Before -> 'xn--1lq90i'
  // After -> '北京'
  ```

## session@0.4.1

- Name: session v0.4.1
- Published: 2025-12-06T20:36:30Z

- Always delete the original session ID when it is regenerated with the
  `deleteOldSession` option. Intermediate IDs are never saved to storage, so
  they can't be deleted.

## session-middleware@0.2.1

- Name: session-middleware v0.2.1
- Published: 2026-04-23T00:40:01Z

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.1)

## session-storage-memcache@0.1.0

- Name: session-storage-memcache v0.1.0
- Published: 2026-02-28T01:27:49Z

### Minor Changes

- Add Memcache session storage with
  `createMemcacheSessionStorage(server, options)`.

  This adds a Node.js Memcache backend with support for `useUnknownIds`,
  `keyPrefix`, and `ttlSeconds`, along with integration tests that run against
  Memcached in CI.

## session-storage-redis@0.1.0

- Name: session-storage-redis v0.1.0
- Published: 2026-02-28T01:27:49Z

### Minor Changes

- Initial release of `@remix-run/session-storage-redis` with
  `createRedisSessionStorage()`.

## static-middleware@0.4.7

- Name: static-middleware v0.4.7
- Published: 2026-04-29T17:32:47Z

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fs@0.4.3`](https://github.com/remix-run/remix/releases/tag/fs@0.4.3)
  - [`mime@0.4.1`](https://github.com/remix-run/remix/releases/tag/mime@0.4.1)
  - [`response@0.3.3`](https://github.com/remix-run/remix/releases/tag/response@0.3.3)

## tar-parser@0.7.1

- Name: tar-parser v0.7.1
- Published: 2026-04-29T17:32:44Z

### Patch Changes

- Fix parsing tar entries whose file body ends exactly at a chunk boundary.

## terminal@0.1.0

- Name: terminal v0.1.0
- Published: 2026-04-29T17:32:48Z

### Minor Changes

- Initial release of terminal output utilities for ANSI styles, color capability
  detection, escape sequences, and testable terminal streams. Automatic color
  detection disables styles for CI, `NO_COLOR`, `TERM=dumb`, and non-TTY output
  streams by default, and can be overridden with the `colors` option. Style
  helpers include common modifiers, foreground colors, background colors, bright
  variants, and preserve outer styles when nested formatted strings close inner
  styles.

## test@0.2.0

- Name: test v0.2.0
- Published: 2026-04-29T17:32:34Z

### Minor Changes

- Add `glob.exclude` config for filtering paths during test discovery (defaults
  to `node_modules/**`)

- Add code coverage reporting to `remix-test`
  - You can enable coverage with default settings vis `remix-test --coverage` or
    setting `coverage:true` in your `remix-test.config.ts`
  - Or you can specify individual coverage settings via the following config
    fields:
    - `coverage.dir`: Directory to store coverage information (default
      `.coverage`)
    - `coverage.include`: Array of globs for files to include in coverage
    - `coverage.exclude`: Array of globs for files to exclude from coverage
    - `coverage.statements`: Percentage threshold for statement coverage
    - `coverage.lines`: Percentage threshold for line coverage
    - `coverage.branches`: Percentage threshold for branch coverage
    - `coverage.functions`: Percentage threshold for function coverage

- Export `runRemixTest` from `@remix-run/test/cli` so other tools can run the
  Remix test runner programmatically without exiting the host process. The
  function returns an exit code so callers can decide how to terminate. The
  `remix-test` executable now declares Node.js 24.3.0 or later in package
  metadata.

### Patch Changes

- Internal refactor to test discovery to better support test execution in `bun`.
  - Unlike Node, Bun's `fs.promises.glob` _follows_ symbolic links and does not
    prune traversal via the `exclude` option, which can cause the test runner to
    enter `node_modules` symlink cycles in pnpm workspaces
  - Refactored the internal test discovery logic to detect and use Bun's native
    `Glob` class when running under the Bun runtime. Bun's `Glob#scan` does not
    follow symlinks by default, avoiding the cycle.
  - The Node runtime continues to use `fs.promises.glob`

- Use native dynamic `import()` in Bun to load `.ts` and `.tsx` files in the
  test runner

- Bumped `@remix-run/*` dependencies:
  - [`terminal@0.1.0`](https://github.com/remix-run/remix/releases/tag/terminal@0.1.0)

## ui@0.1.0

- Name: ui v0.1.0
- Published: 2026-04-29T17:38:14Z

### Minor Changes

- BREAKING CHANGE: Consolidated the deprecated `@remix-run/component` package
  into `@remix-run/ui`. Import component runtime APIs from `@remix-run/ui`,
  server rendering APIs from `@remix-run/ui/server`, JSX runtime APIs from
  `@remix-run/ui/jsx-runtime` and `@remix-run/ui/jsx-dev-runtime`, and animation
  APIs from `@remix-run/ui/animation`.

  Removed the deprecated `@remix-run/ui/on-outside-pointer-down` export. Use the
  popover, menu, or other component-level outside interaction APIs instead.

- BREAKING CHANGE: Components now receive props through a stable `handle.props`
  object using `Handle<Props, Context>` instead of receiving a separate `setup`
  argument and render callback props. Move initialization values that previously
  used `<Component setup={...} />` onto regular props, and read all props from
  `handle.props` in both the component function and render callback.

  Before:

  ```tsx
  function Counter(
  	handle: Handle<CounterContext>,
  	setup: { initialCount: number },
  ) {
  	let count = setup.initialCount

  	return (props: { label: string }) => (
  		<button>
  			{props.label}: {count}
  		</button>
  	)
  }

  ;<Counter setup={{ initialCount: 10 }} label="Count" />
  ```

  After:

  ```tsx
  function Counter(
  	handle: Handle<{ initialCount: number; label: string }, CounterContext>,
  ) {
  	let count = handle.props.initialCount

  	return () => (
  		<button>
  			{handle.props.label}: {count}
  		</button>
  	)
  }

  ;<Counter initialCount={10} label="Count" />
  ```

  The `handle.props` object keeps the same identity for the component lifetime
  while its values are updated before each render, so destructuring
  `let { props, update } = handle` remains safe. The `setup` prop is no longer
  special and is treated like any other prop.

  This also removes the old pattern where setup-scope helpers had to read from a
  mutable variable that was reassigned inside the render callback:

  ```tsx
  function Listbox(handle: Handle<ListboxContext>) {
  	let props: ListboxProps

  	function select(value: string) {
  		props.onSelect(value)
  	}

  	handle.context.set({ select })

  	return (nextProps: ListboxProps) => {
  		props = nextProps
  		return props.children
  	}
  }
  ```

  Helpers can now read the current props directly from the stable handle:

  ```tsx
  function Listbox(handle: Handle<ListboxProps, ListboxContext>) {
  	function select(value: string) {
  		handle.props.onSelect(value)
  	}

  	handle.context.set({ select })

  	return () => handle.props.children
  }
  ```

- BREAKING CHANGE: Removed the deprecated `keysEvents`, `pressEvents`, and
  `PressEvent` exports from `@remix-run/ui`. Use `on(...)` with native DOM
  keyboard, pointer, and click events directly instead.
