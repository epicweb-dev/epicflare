# remix

Source: https://github.com/remix-run/remix/tree/main/packages/remix

## README

The Remix Web Framework

## Navigation

- [Remix package index](./index.md)

## Preview branch in this repo

Remix publishes installable preview builds to the `preview/main` branch using
pnpm's Git subdirectory syntax:

`remix-run/remix#preview/main&path:packages/remix`

Bun currently cannot install that `&path:` format directly, so this repo uses a
vendored snapshot under `vendor/remix-preview/packages/*`.

### Refresh command (Bun)

```sh
bun run remix:preview:update
bun install
```
