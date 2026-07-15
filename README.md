# Link Saver

[![CI](https://github.com/egordushenko/link-saver/actions/workflows/ci.yml/badge.svg)](https://github.com/egordushenko/link-saver/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-20.19%2B-339933)](https://nodejs.org/)

A focused full-stack link saver that fetches each page's real title, persists bookmarks in SQLite, and keeps favourites one click away.

![Link Saver desktop interface](docs/assets/link-saver-desktop.png)

## Features

- Paste a complete HTTP or HTTPS URL and fetch its `<title>` automatically.
- Keep links across restarts with a local SQLite database.
- Open, favourite, filter, and delete links from a responsive single-page interface.
- Handle duplicates, malformed URLs, unreachable pages, empty states, and missing records explicitly.
- Guard server-side fetches with address checks, redirect validation, timeout, content-type, and response-size limits.

## Run locally

Requirements: Node.js `^20.19.0 || >=22.12.0` and npm.

```bash
git clone https://github.com/egordushenko/link-saver.git
cd link-saver
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite client proxies `/api` to Express on port `3000`. On Windows PowerShell with script execution disabled, use `npm.cmd` in place of `npm`.

Production mode:

```bash
npm run build
npm start
```

Then open [http://localhost:3000](http://localhost:3000). The database is created at `data/links.db` and is intentionally ignored by Git.

## Architecture

I chose React + Vite for a small, expressive UI and Express + SQLite for a backend that is easy to run and inspect. SQLite provides real persistence without asking the reviewer to provision infrastructure; the server is split into URL policy, metadata fetching, repository, and HTTP layers so each risk can be tested independently.

| Area | Responsibility |
| --- | --- |
| `src/client` | React interface, local interaction state, API client, responsive styling |
| `src/server/url-policy.ts` | URL normalization, DNS resolution, private/reserved address rejection |
| `src/server/metadata.ts` | Manual redirects, bounded HTML fetch, title extraction and fallback |
| `src/server/link-repository.ts` | SQLite schema and prepared CRUD statements |
| `src/server/app.ts` | Express API, validation, status codes and safe error responses |
| `src/shared/link.ts` | Client/server wire types |

### API

| Method | Route | Result |
| --- | --- | --- |
| `GET` | `/api/links?favorite=true` | List all links or favourites |
| `POST` | `/api/links` | Validate URL, fetch title, persist link |
| `PATCH` | `/api/links/:id/favorite` | Set favourite state |
| `DELETE` | `/api/links/:id` | Delete a saved link |

Expected failures use stable JSON errors: `400` invalid input, `404` missing record, `409` duplicate URL, and `422` page metadata unavailable. Unexpected details are not disclosed to the client.

## Favourite feature change

The base save/list/delete flow was committed first. The follow-up favourite feature touched:

- `src/client/App.tsx` — favourite state, counts, optimistic update, filter and rollback.
- `src/client/api.ts` — favourite API request.
- `src/client/components/LinkItem.tsx` — accessible star action.
- `src/client/styles.css` — chips, selected star and filtered-empty state.
- `src/client/App.test.tsx` — toggle and filter interaction tests.
- `src/server/app.ts` and `src/server/link-repository.ts` — favourite endpoint and persistence (included in the server foundation).

The dedicated commit is `feat: add favourite filtering`.

## Tests and quality checks

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
# or all checks in sequence
npm run check
```

Vitest covers URL policy, bounded metadata fetching, SQLite persistence, API behaviour, and React interactions. Supertest exercises the API without a network listener; React Testing Library verifies the user-visible flows. GitHub Actions runs the full check on every push and pull request to `main`.

## Security boundary and assumptions

- The app is local and single-user; there is no authentication or authorization layer.
- Only HTTP/HTTPS URLs without embedded credentials are accepted.
- Every destination and redirect is resolved and checked against private, loopback, link-local, multicast, and reserved ranges before fetch.
- HTML downloads are limited to 1 MB, three redirects, and eight seconds.
- The fetch boundary is appropriate for this exercise, but a production multi-tenant service should pin the validated IP in its HTTP dispatcher to close the remaining DNS-rebinding window and add rate limiting.
- Duplicate identity is the normalized URL with its fragment removed; query strings remain meaningful.

## Part B: existing-code review

The planted bugs, breaking inputs, severity ranking, and corrected implementation are documented in [REVIEW.md](REVIEW.md). The most severe findings are the arbitrary server-side fetch, startup crash, brittle title extraction, and delete route that can never match numeric IDs against string parameters.

## AI-assisted workflow

The work started from one broad user request and the supplied brief. These are the three distilled directions that did the most work; they are presented as working prompts, not as invented verbatim chat history:

1. **Requirements and design:** “Read the complete candidate brief, extract every acceptance criterion and ambiguity, compare a few restrained architectures, then lock a responsive visual direction before writing code.”
2. **Implementation:** “Build the approved React + Express + SQLite design with test-first RED/GREEN cycles; keep title fetching bounded, revalidate redirects, and use separate commits for the base flow and favourite change.”
3. **Final review:** “Audit the result against the brief, run lint/typecheck/tests/build, review the outbound-fetch trust boundary, verify desktop and mobile UI, and make the public repository readable to a reviewer.”

I used AI as an implementation and review tool, while making the scope, architecture, error semantics, visual direction, and security trade-offs explicitly.

## What I would improve with more time

- Pin validated DNS results through a custom HTTP dispatcher and add request rate limits.
- Add Playwright browser tests and automated accessibility checks.
- Introduce versioned database migrations before the schema grows.
- Add search/tags only after observing a real collection large enough to need them.
- Deploy a live demo with managed persistence.

I deliberately left out authentication, multi-user sharing, tags, search, live hosting, and a screen-recording placeholder. They are not required for the focused local workflow, and adding them would hide the decisions the exercise is intended to evaluate.

## Questions I would have asked before starting

I would have asked whether metadata failures should prevent saving or fall back to the hostname, whether URL fragments count as distinct bookmarks, and whether the expected reviewer environment permits native SQLite dependencies. I chose to reject unreachable/non-HTML pages, treat fragments as the same resource, preserve query strings, and document the supported Node versions.

<details>
<summary>Mobile view</summary>

![Link Saver mobile interface](docs/assets/link-saver-mobile.png)

</details>

