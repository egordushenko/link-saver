# Part B — Existing Code Review

## Executive summary

The snippet has a security-critical boundary problem and several correctness failures. Its destructive delete route stores numeric IDs but compares them to a string route parameter with strict equality; every comparison is false, so `filter` drops the entire collection on any delete request. The server also fetches an arbitrary user-controlled URL without validation, which exposes local services and cloud metadata endpoints.

## Findings

| Severity | Finding | Breaking input or scenario | Impact and correction |
| --- | --- | --- | --- |
| Critical | Unrestricted server-side fetch (SSRF) | `http://127.0.0.1:3000`, private IPs, or a public URL redirecting to one | The server can read internal services. Accept HTTP/HTTPS only, resolve and block non-public addresses, use manual redirects, and revalidate every hop. |
| Critical | Delete wipes the full collection | Any `DELETE /links/:id`, including a valid or unknown ID | `l.id === req.params.id` compares a number with a string, so every predicate is false and `filter` returns `[]`. Use one stable ID type and remove with an explicit inequality; the corrected app uses UUID strings throughout. |
| High | Startup assumes a valid `links.json` | First run without the file, empty file, partial/corrupt JSON | `readFileSync` throws before `listen`. Create storage safely or use a database with schema initialization. |
| High | Async/fetch failures are not handled | DNS failure, refused connection, timeout | The async handler rejects without a controlled response; behaviour depends on Express version and may terminate older setups. Use Express 5 promise handling plus centralized safe errors. |
| High | Title extraction can throw | HTML without `<title>`, uppercase/attributed title, malformed markup | `match(...)[1]` dereferences `null`, producing a 500. Parse HTML and provide a hostname fallback. |
| High | Response is unbounded | A server streams indefinitely or returns a multi-GB body | `r.text()` buffers the entire response and has no timeout. Abort and stop reading after a fixed byte limit. |
| Medium | HTTP status and content type are ignored | `404`, `500`, image, PDF, or JSON URL | Error documents are treated like pages and parsing fails unpredictably. Require a successful HTML response. |
| Medium | Weak collision-prone ID | Two creates within the same millisecond | `Date.now()` can generate the same ID for concurrent or burst requests. Use `crypto.randomUUID()` and a database primary key. |
| Medium | Non-atomic synchronous persistence | Process crash during write; a slow or full disk | The event loop blocks and `links.json` can be truncated. SQLite transactions remove this failure mode; an atomic temp-file rename is the minimum JSON alternative. |
| Medium | Missing input validation | `{}`, `{ "url": 42 }`, `file:///etc/passwd`, credential-bearing URL | `fetch` receives invalid or dangerous input. Validate body shape, scheme, credentials and destination before I/O. |
| Low | Delete reports false success | Unknown ID | The route always returns `200`, so clients cannot distinguish deletion from no-op. Return `404` for a missing ID and `204` for success. |
| Low | Two clock reads create inconsistent values | Millisecond boundary between `id` and `date` | The values can disagree and the timestamp-derived ID still collides. Generate one UUID and one timestamp explicitly. |

## Corrected code

The corrected implementation is split by responsibility instead of keeping persistence, networking, parsing, and HTTP behaviour in one route:

- [`src/server/url-policy.ts`](src/server/url-policy.ts) — URL and destination policy.
- [`src/server/metadata.ts`](src/server/metadata.ts) — bounded HTML/title fetch.
- [`src/server/link-repository.ts`](src/server/link-repository.ts) — SQLite persistence.
- [`src/server/app.ts`](src/server/app.ts) — routes and errors.

The following is the complete corrected server entrypoint equivalent to the original `server.js`:

```js
import { resolve } from 'node:path';

import { createApp } from './dist/server/server/app.js';
import { createLinkRepository } from './dist/server/server/link-repository.js';
import { fetchPageMetadata } from './dist/server/server/metadata.js';
import { findClientDist, getServerHost } from './dist/server/server/runtime.js';

const port = Number(process.env.PORT ?? 3000);
const clientDist = findClientDist(process.cwd());
const host = getServerHost();
const repository = createLinkRepository(
  process.env.DATABASE_PATH ?? resolve('data/links.db'),
);

const app = createApp({
  clientDist,
  fetchMetadata: fetchPageMetadata,
  repository,
});

const server = app.listen(port, host, () => {
  console.log(`Link Saver listening on http://${host}:${port}`);
});

function shutdown() {
  server.close(() => {
    repository.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

This entrypoint is intentionally small. The route implementation uses UUID strings consistently, returns `201/204/400/403/404/409/413/422/500` deliberately, catches metadata failures at the boundary, rejects foreign `Host` headers, and never sends internal exception details to the client. The repository creates its schema on first run and uses prepared SQLite statements, so missing/corrupt JSON files and partial rewrites are no longer part of the runtime model.

## Severity rationale

The SSRF issue is critical because it crosses a network trust boundary and can expose data outside the application. The delete bug is also critical because an ordinary request destroys the full persisted collection. Startup, async failure, title parsing, and unbounded responses are high because ordinary or adversarial inputs break core behaviour; cosmetic and response-semantic issues are ranked below failures that lose data, expose internal resources, or destabilize the process.
