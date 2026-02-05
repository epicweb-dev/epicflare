# Updating Remix package docs

Use this checklist to refresh `docs/agents/remix/*.md` from upstream.

## 1) List packages

```sh
gh api repos/remix-run/remix/contents/packages --jq '.[].name'
```

## 2) Refresh each package README

For each package name, download the README from upstream:

```sh
curl -L "https://raw.githubusercontent.com/remix-run/remix/main/packages/<package>/README.md"
```

Replace the corresponding `docs/agents/remix/<package>.md` content under the
`## README` section.

## 3) Refresh component docs

`component` is the only package with a `docs` directory. Sync every file from:

```
https://github.com/remix-run/remix/tree/main/packages/component/docs
```

Update `docs/agents/remix/component.md` under the `## Component Docs` section.
Keep all docs: `animate`, `components`, `composition`, `context`, `events`,
`getting-started`, `handle`, `interactions`, `patterns`, `spring`, `styling`,
`testing`, `tween`.

## 4) Keep the index current

If a package is added or removed upstream, update `docs/agents/remix/index.md`:

- Add/remove package rows in the table.
- Update the "Start here" section if new docs are important.

## 5) Verify

Run formatting and validation before committing:

```sh
bun run format
bun run validate
```
