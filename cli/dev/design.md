## Resolve/Load/Transform (RLT) pipeline

### RLT pipeline

- Resolve
- Load
- Transform
  - Transformers are run if the type changes

### Server RLT pipeline

- One entry point (`entry-server.ts`)
- Everything ultimately resolves to either `file:`, `http(s):`, `data:` or `virtual:`
  - `http(s):` requests load from a cache
- File changes invalidate their modules and their dependents
- Invalidated modules are reloaded and re-evaluated once they're requested

### Browser RLT pipeline

- Everything ultimately resolves to either `file:`, `http(s):`, `data:`, or `virtual:`
  - External `http(s):` requests load from a cache
- File changes trigger hot reloads
- Browser maintains a list of active modules and reloads when they change

## Types

- Supported final types:
  - JavaScript
  - JSON
  - WebAssembly
  - CSS
    - Importing from JavaScript inserts a `<link>` tag
  - CSS module
    - Importing from JavaScript inserts a `<link>` tag
    - Exports a map of class names
  - Asset
    - Exports a URL string to the asset

| Importer -> |    HTML     | JavaScript  |    CSS     | Media type               |
| ----------- | :---------: | :---------: | :--------: | ------------------------ |
| HTML        |      -      |     URL     |     -      | `text/html`              |
| JavaScript  |  JS import  |  JS import  |     -      | `application/javascript` |
| CSS         | Insert CSS  | Insert CSS  | CSS import | `text/css`               |
| CSS module  | Insert CSS  |  JS + CSS   | CSS import | `text/css-module`        |
| Asset       |  Asset URL  |  Asset URL  | Asset URL  | `*`                      |
| JSON        |    JSON     |     JS      |     -      | `application/json`       |
| WebAssembly | WebAssembly | WebAssembly |     -      | `application/wasm`       |

---

- `html`: `.html`
- `javascript`: `.js`
- `css`: `.css`
- `json`: `.json`
- `wasm`: `.wasm`
- `text`: `.txt`
- `asset`:

---

- `typescript`
- `jsx`
- `tsx`

## File watcher

## Web server

## Websocket server
