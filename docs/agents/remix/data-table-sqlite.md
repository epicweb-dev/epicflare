# data-table-sqlite

Source: https://github.com/remix-run/remix/tree/main/packages/data-table-sqlite

## README

SQLite adapter for `remix/data-table`.

## Installation

```sh
npm i remix better-sqlite3
```

## Usage

```ts
import Database from 'better-sqlite3'
import { createDatabase } from 'remix/data-table'
import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'

let sqlite = new Database('app.db')
let db = createDatabase(createSqliteDatabaseAdapter(sqlite))
```

## Default capabilities

- `returning: true`
- `savepoints: true`
- `upsert: true`

## Related packages

- [`data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table)
- [`data-table-postgres`](https://github.com/remix-run/remix/tree/main/packages/data-table-postgres)
- [`data-table-mysql`](https://github.com/remix-run/remix/tree/main/packages/data-table-mysql)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)

## Navigation

- [Remix package index](./index.md)
