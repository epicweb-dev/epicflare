# Remix packages

Docs for every package in https://github.com/remix-run/remix/tree/main/packages.

## Start here

- Building UI with Remix Component: [component](./component.md)
- Routing and request handling: [fetch-router](./fetch-router.md) +
  [route-pattern](./route-pattern.md)
- Sessions and cookies: [session](./session.md) +
  [session-middleware](./session-middleware.md) + [cookie](./cookie.md)
- Responses, headers, and HTML safety: [response](./response.md) +
  [headers](./headers.md) + [html-template](./html-template.md)
- File upload pipelines: [form-data-middleware](./form-data-middleware.md) +
  [form-data-parser](./form-data-parser.md) +
  [multipart-parser](./multipart-parser.md)
- File storage and streaming: [file-storage](./file-storage.md) +
  [lazy-file](./lazy-file.md) + [fs](./fs.md)
- Static assets and compression: [static-middleware](./static-middleware.md) +
  [compression-middleware](./compression-middleware.md)

## Package map

| Package                    | Focus                                      | Docs                                                          |
| -------------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| async-context-middleware   | AsyncLocalStorage context for fetch-router | [async-context-middleware](./async-context-middleware.md)     |
| component                  | Remix Component UI system                  | [component](./component.md)                                   |
| compression-middleware     | Response compression for fetch-router      | [compression-middleware](./compression-middleware.md)         |
| cookie                     | Cookie parsing, signing, and serialization | [cookie](./cookie.md)                                         |
| fetch-proxy                | Fetch-based HTTP proxy                     | [fetch-proxy](./fetch-proxy.md)                               |
| fetch-router               | Fetch-based router and middleware          | [fetch-router](./fetch-router.md)                             |
| file-storage               | Storage abstraction for files              | [file-storage](./file-storage.md)                             |
| form-data-middleware       | Request FormData middleware                | [form-data-middleware](./form-data-middleware.md)             |
| form-data-parser           | Streaming multipart/form-data parser       | [form-data-parser](./form-data-parser.md)                     |
| fs                         | Lazy file system utilities                 | [fs](./fs.md)                                                 |
| headers                    | Header parsing and helpers                 | [headers](./headers.md)                                       |
| html-template              | Safe HTML template tag                     | [html-template](./html-template.md)                           |
| interaction                | Event helpers and interactions             | [interaction](./interaction.md)                               |
| lazy-file                  | Streaming File/Blob implementation         | [lazy-file](./lazy-file.md)                                   |
| logger-middleware          | Request/response logging                   | [logger-middleware](./logger-middleware.md)                   |
| method-override-middleware | HTML form method override                  | [method-override-middleware](./method-override-middleware.md) |
| mime                       | MIME type utilities                        | [mime](./mime.md)                                             |
| multipart-parser           | Streaming multipart parser                 | [multipart-parser](./multipart-parser.md)                     |
| node-fetch-server          | Fetch-based Node server                    | [node-fetch-server](./node-fetch-server.md)                   |
| remix                      | Remix framework package                    | [remix](./remix.md)                                           |
| response                   | Response helpers                           | [response](./response.md)                                     |
| route-pattern              | URL matching and href generation           | [route-pattern](./route-pattern.md)                           |
| session-middleware         | Session middleware for fetch-router        | [session-middleware](./session-middleware.md)                 |
| session                    | Session management and storage             | [session](./session.md)                                       |
| static-middleware          | Static file middleware                     | [static-middleware](./static-middleware.md)                   |
| tar-parser                 | Streaming tar parser                       | [tar-parser](./tar-parser.md)                                 |

## Update instructions

See [update](./update.md) for how to sync this documentation from upstream.
