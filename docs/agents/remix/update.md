# Updating Remix package docs

Use this checklist to refresh `docs/agents/remix/**/*.md` from upstream.

## 1) List packages

```sh
gh api repos/remix-run/remix/contents/packages --jq '.[].name'
```

## 2) Refresh each package README

For each package name, download the README from upstream:

```sh
curl -L "https://raw.githubusercontent.com/remix-run/remix/main/packages/<package>/README.md"
```

Replace the corresponding README content in docs:

- For single-file packages, update `docs/agents/remix/<package>.md`.
- For split packages, update the README chunks under
  `docs/agents/remix/<package>/`.

Keep each Markdown file to roughly 200 lines or fewer. If a README grows beyond
that, split it into multiple files and update the package `index.md` to link the
new chunks.

## 3) Refresh component docs

`component` is the only package with a `docs` directory. Sync every file from:

```
https://github.com/remix-run/remix/tree/main/packages/component/docs
```

Update the split files in `docs/agents/remix/component/` to match upstream. Keep
all docs: `animate`, `components`, `composition`, `context`, `events`,
`getting-started`, `handle`, `interactions`, `patterns`, `spring`, `styling`,
`testing`, `tween`. If any single doc exceeds roughly 200 lines, split it into
multiple files and add links in `component/index.md`.

## 4) Keep the index current

If a package is added or removed upstream, update `docs/agents/remix/index.md`:

- Add/remove package rows in the table.
- Update the "Start here" section if new docs are important.
- If a package moves to a folder, update links to `./<package>/index.md`.

## 5) Refresh the Bun preview snapshot

After updating Remix docs or package guidance, refresh the vendored preview
snapshot used by Bun installs:

```sh
bun run remix:preview:update
bun install
```

## 6) Verify

Run formatting and validation before committing:

```sh
bun run format
bun run validate
```
