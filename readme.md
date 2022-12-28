# Haydi

**Haydi** (pronounced "high-dee") is an experiment to create an on-demand dev server (like Vite) for Deno.

Open the `playground/react` directory in your IDE and run `deno task dev` to see it in action. It will on-demand compile the source files both for the server and the client and run a simple React SSR demo app.

## Design

Haydi has a plugin system (internal for now) inspired by Vite's. It uses plugins to resolve, load, and transform modules both for the server and the browser.

For the server-side code, modules are transformed into an async function body and executed. This will allow hot loading later on. This will be dropped once Deno supports a [native loader API](https://github.com/denoland/deno/issues/8327).

For the client-side code, modules are transformed and sent to the browser on demand. Bare imports (e.g. `import React from "react"`) are resolved using the `import-map.browser.json` file and rewritten. Currently, they resolve to CDN versions. We can cache them locally later. Relying on a CDN (even if cached) skirts around the most complicated part of Vite (dependency optimization).

## Future plans

- Proper error handling
- Hot reloading and HMR
- Local browser module caching
- CSS and other assets
- Vue, Svelte, Preact, Solid etc.
- Proper CLI
- Configuration options
- External plugin interface
- Production build

## Credits

- Fatih Aygün, MIT License
- The "module to function body" transform is adapted from Vite's SSR transform
