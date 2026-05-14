# http-link-header-kit

[![License: MPL-2.0](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Recoveredd/http-link-header-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/Recoveredd/http-link-header-kit/actions/workflows/ci.yml)

Small TypeScript toolkit to parse, inspect, and format HTTP `Link` headers.

It is designed for browser and edge runtimes: no runtime dependencies, no Node-only APIs, and no environment-variable behavior in the core parser.

## Demo

Try the browser preview: [packages.wasta-wocket.fr/http-link-header-kit](https://packages.wasta-wocket.fr/http-link-header-kit/).

## Package quality

- TypeScript types are generated from the source.
- ESM-only package with no runtime dependencies.
- Marked as side-effect free for bundlers.
- CI runs `npm ci`, `typecheck`, `build`, and `test`.
- Tested on Node.js 20 and 22 with GitHub Actions.
- Browser-friendly implementation with no Node-only APIs.

## Install

```bash
npm install http-link-header-kit
```

## Parse a header

```ts
import { findLinkByRel, parseLinkHeader } from "http-link-header-kit";

const result = parseLinkHeader(
  '<https://api.example.test/items?page=2>; rel="next"; title="next page"'
);

if (result.ok) {
  const next = findLinkByRel(result.links, "next");
  console.log(next?.uri);
}
```

## Inspect diagnostics

```ts
import { parseLinkHeader } from "http-link-header-kit";

const result = parseLinkHeader("<https://example.test>; rel");

if (!result.ok) {
  console.log(result.diagnostics[0]);
}
```

## Format links

```ts
import { formatLinkHeader } from "http-link-header-kit";

const header = formatLinkHeader([
  {
    uri: "https://api.example.test/items?page=3",
    params: { rel: "next", title: "page 3" }
  }
]);
```

## API

- `parseLinkHeader(input, options?)` returns `{ ok: true, links, diagnostics }` or `{ ok: false, links, diagnostics }`.
- `formatLinkHeader(links)` serializes link values back to a header string.
- `indexLinksByRel(links)` groups parsed links by each relation token.
- `findLinkByRel(links, rel)` returns the first link for a relation.
- `paginationLinks(links)` returns `{ first, prev, next, last }` shortcuts.

## Limits

This draft focuses on common RFC 8288-style `Link` headers. It preserves duplicate links, diagnoses duplicate parameters, indexes `rel` tokens case-insensitively, and treats URI references as strings without fetching them.

It intentionally does not fetch URLs, validate URL reachability, decode every extended parameter variant, or implement a streaming parser.

## License

MPL-2.0
