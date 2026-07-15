# Link Saver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver and publish a tested full-stack link saver with automatic page-title fetching, SQLite persistence, deletion, favourites, filtering, documentation, and CI.

**Architecture:** A Vite React client calls an Express 5 JSON API. The server owns URL validation, bounded metadata fetching, and a `better-sqlite3` repository; shared TypeScript types define the wire contract.

**Tech Stack:** Node.js 20.19+ or 22.12+, TypeScript, React, Vite 8, Express 5, SQLite, Vitest, Supertest, React Testing Library, ESLint, GitHub Actions.

---

### Task 1: Repository foundation

**Files:** `.gitignore`, `.editorconfig`, `README.md`, `docs/superpowers/specs/2026-07-15-link-saver-design.md`, this plan.

- [ ] Initialize `main` and commit the non-code foundation as `chore: initialize repository`.
- [ ] Create public `egordushenko/link-saver`, add `origin`, and push before application work.

### Task 2: Server domain and persistence

**Files:** `src/server/url-policy.ts`, `src/server/metadata.ts`, `src/server/link-repository.ts`, `src/shared/link.ts`, and matching `*.test.ts` files.

- [ ] Add package/configuration files needed to run isolated tests.
- [ ] Write failing URL normalization and private-address tests; run them and confirm RED.
- [ ] Implement the minimum URL policy; rerun and confirm GREEN.
- [ ] Write failing bounded-fetch/title tests; implement redirect validation, timeout, size and HTML checks; confirm GREEN.
- [ ] Write failing temporary-SQLite persistence tests; implement schema and prepared statements; confirm GREEN.
- [ ] Run the server test slice and commit `feat: add persistent link domain`.

### Task 3: Express API

**Files:** `src/server/app.ts`, `src/server/index.ts`, `src/server/errors.ts`, `src/server/app.test.ts`.

- [ ] Write failing Supertest cases for list, create, duplicate, favourite, delete, missing ID, and safe errors.
- [ ] Implement dependency-injected routes and centralized Express 5 error middleware.
- [ ] Run the API suite and commit `feat: expose link API`.

### Task 4: Focused Utility client

**Files:** `index.html`, `src/client/App.tsx`, `src/client/api.ts`, focused components/hooks/styles, and component tests.

- [ ] Write failing tests for initial load, create, invalid input, empty states, and delete confirmation.
- [ ] Implement the responsive core interface and verify GREEN.
- [ ] Commit `feat: build focused link saver interface`.

### Task 5: Favourite change

**Files:** the link row, filter controls, client state/API module, shared styles, tests, and README file list.

- [ ] Write failing favourite-toggle and favourites-filter tests.
- [ ] Implement optimistic favourite updates with rollback and filtered removal.
- [ ] Verify the client and API suites and commit `feat: add favourite filtering`.

### Task 6: Review, CI, and repository presentation

**Files:** `REVIEW.md`, `.github/workflows/ci.yml`, final `README.md`, and `docs/assets/*.png`.

- [ ] Document and rank the Part B defects, then include a complete corrected `server.js`.
- [ ] Add CI for lint, typecheck, tests, and build.
- [ ] Run the application and capture verified desktop/mobile screenshots.
- [ ] Replace the scaffold README with the complete English project presentation.
- [ ] Commit documentation and polish in focused commits.

### Task 7: Final verification and publication

- [ ] Run `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd test -- --run`, and `npm.cmd run build` from a clean working tree.
- [ ] Perform the outbound-fetch security review and a clean-clone install/run smoke test.
- [ ] Confirm the PDF, database, secrets, and unrelated files are absent from Git.
- [ ] Push all commits; set repository description and topics; inspect the public repository.

