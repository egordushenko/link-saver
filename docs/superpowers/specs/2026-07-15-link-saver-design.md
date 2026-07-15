# Link Saver Design

## Goal

Build a polished single-page link saver for a take-home exercise. A user pastes a URL, the server fetches the real page title, and the application persists, lists, deletes, favourites, and filters saved links.

## Architecture

- React and Vite render the Focused Utility interface.
- Express 5 exposes a small JSON API and serves the production client build.
- SQLite persists links locally without external infrastructure.
- Shared TypeScript types keep the client and API contract aligned.
- The metadata fetcher validates each destination and redirect before downloading a bounded HTML response.

## Data and API

`Link` contains `id`, `url`, `normalizedUrl`, `title`, `savedAt`, and `isFavorite`. Normalized URLs are unique. Links are returned newest first.

- `GET /api/links?favorite=true` lists all links or favourites.
- `POST /api/links` accepts `{ "url": string }` and returns `201`.
- `PATCH /api/links/:id/favorite` accepts `{ "isFavorite": boolean }`.
- `DELETE /api/links/:id` returns `204`.

Expected errors are stable JSON responses: `400` invalid URL, `404` missing link, `409` duplicate URL, `422` page fetch failure, and a disclosure-safe `500` fallback.

## Metadata safety

Only HTTP and HTTPS URLs are accepted. Hostnames are resolved before fetch; loopback, private, link-local, multicast, and reserved addresses are rejected. Redirects are manual, bounded, and revalidated. Requests have a timeout and maximum response size. Only HTML responses are parsed. Missing titles fall back to the destination hostname.

This is a strong local-application boundary, not a hardened multi-tenant crawling service; DNS rebinding remains documented as future hardening.

## Interface

The approved visual direction is **Focused Utility**: a calm light surface, blue accent, prominent URL field, filter chips, and readable link rows. The interface includes loading, error, empty, filtered-empty, confirmation, keyboard focus, live-region, desktop, and mobile states.

## Delivery

The repository is public and uses a readable sequence of commits. CI runs lint, type checking, tests, and the production build. `README.md` is English and `REVIEW.md` contains the Part B findings and corrected code. Desktop and mobile screenshots are committed. No live deployment or screen-recording placeholder is included.

