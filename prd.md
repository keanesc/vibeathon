# Product Requirements Document: URL Shortener

**Project:** vibeathon  
**Date:** March 9, 2026  
**Stack:** Next.js 16 (App Router) · Convex · Tailwind CSS 4 · TypeScript

---

## Overview

A browser-based URL shortening service that converts long URLs into short, shareable links and tracks how often each link is accessed. All data is persisted in Convex's cloud database, providing real-time sync without requiring a custom backend or traditional REST API.

---

## Tech Stack Decisions

### Next.js 16 (App Router)

Next.js was chosen over a pure client-side React app because the redirect path (`/:slug`) needs to execute server-side. A client-rendered page would cause a visible flash — the browser would load JavaScript, mount a component, call Convex, and only then issue the redirect. A Next.js Route Handler (`app/[slug]/route.ts`) handles the `GET` request before any HTML reaches the browser, making redirects instant and transparent to the end user.

The App Router specifically was preferred over the Pages Router because Route Handlers and React Server Components are first-class primitives there, removing the need for `getServerSideProps` boilerplate or custom API routes under `pages/api/`. The colocation of the redirect handler alongside the page routes also keeps the file structure flat and obvious.

Next.js 16 was targeted (rather than 14 or 15) to take advantage of stable async APIs for `params` and `headers` in Route Handlers, which removes the need for runtime workarounds when reading slug values inside the handler.

### Convex

The primary constraint was avoiding a hand-rolled backend entirely. Traditional alternatives — a Postgres database behind a REST API, or a Firebase Firestore setup — would require either a separate server process, manual connection pooling, or bespoke webhook plumbing to push live updates to the dashboard.

Convex was selected because it collapses three distinct concerns into a single dependency:

1. **Database** — a fully hosted document store with a typed schema and automatic indexing.
2. **Backend logic** — mutations and queries written in TypeScript that run inside Convex's infrastructure, not on any server we maintain.
3. **Real-time sync** — the `useQuery` hook subscribes to a WebSocket connection managed by Convex, so the dashboard reflects live click counts without polling or manual cache invalidation.

The serialized-transaction guarantee on mutations was specifically important for the `incrementClicks` path: under concurrent redirects, a counter increment using a read-modify-write pattern would race without transactional isolation. Convex mutations are serialized, so no lost updates are possible without any additional locking code.

The `ConvexHttpClient` (used in the Route Handler) allows server-side Convex calls without the React context, keeping the redirect path decoupled from the browser WebSocket while sharing the same typed `api` object.

### Tailwind CSS 4

Tailwind was chosen over component libraries (e.g., shadcn/ui, MUI, Chakra) because the UI surface is intentionally minimal — a single form and a table. Pulling in a full component library would add significant bundle weight and abstraction for no meaningful benefit at this scale.

Tailwind CSS 4 specifically offers native CSS cascade layers and a PostCSS-based compilation path that eliminates the need for a `tailwind.config.js` file for basic usage, reducing configuration overhead. The utility-first approach also makes it easy to iterate on layout and spacing quickly during a time-boxed hackathon.

### TypeScript

TypeScript is non-negotiable when working with Convex because the `convex/_generated/` directory emits a fully typed `api` object and `DataModel` types derived directly from `convex/schema.ts`. Calling a Convex function with wrong argument types or referencing a non-existent field is a compile-time error rather than a runtime surprise. This tight feedback loop was especially valuable during rapid development where schema changes are frequent.

---

## Architecture

### Frontend — Next.js 16 (App Router)

The application uses the Next.js App Router with a minimal file structure:

- `app/layout.tsx` — Root layout. Wraps all pages in a `ConvexClientProvider` so every page can subscribe to live data.
- `app/providers.tsx` — Client component that instantiates a `ConvexReactClient` from `NEXT_PUBLIC_CONVEX_URL` and provides it to the React tree.
- `app/page.tsx` — The single-page UI (client component). Contains both the submission form and the link dashboard.
- `app/[slug]/route.ts` — A Next.js Route Handler (not a page). Handles the redirect path server-side.

### Backend — Convex

All server-side logic lives in `convex/links.ts`, declared against a typed schema in `convex/schema.ts`.

**Data model (`links` table):**

| Field           | Type          | Notes                        |
| --------------- | ------------- | ---------------------------- |
| `_id`           | `Id<"links">` | Auto-generated by Convex     |
| `_creationTime` | `number`      | Auto-generated by Convex     |
| `slug`          | `string`      | 6-char alphanumeric, indexed |
| `originalUrl`   | `string`      | The full destination URL     |
| `clicks`        | `number`      | Incremented on each redirect |

An index `by_slug` on `["slug"]` enables O(1) slug lookups on every redirect.

**Convex functions:**

| Function          | Type     | Purpose                                                                    |
| ----------------- | -------- | -------------------------------------------------------------------------- |
| `createLink`      | mutation | Validates URL, generates unique slug, inserts and returns the new document |
| `listLinks`       | query    | Returns all links ordered by `_creationTime` descending                    |
| `getLinkBySlug`   | query    | Looks up a single link by slug using the `by_slug` index                   |
| `incrementClicks` | mutation | Reads the current `clicks` value, patches it with `clicks + 1`             |

---

## Feature Implementations

### 1. URL Shortening

The `createLink` mutation generates a 6-character slug from a 62-character alphabet (a–z, A–Z, 0–9), yielding ~56 billion possible combinations. It verifies uniqueness by querying the `by_slug` index and retries up to 10 times on collision before inserting.

Client-side validation (in `page.tsx`) rejects empty inputs and any string that fails the `new URL()` constructor check or does not use the `http:` or `https:` protocol. Validation errors are shown inline beneath the input before any network call is made.

### 2. Redirection

Short links are served at `/:slug` via `app/[slug]/route.ts`, a Next.js Route Handler. On `GET /:slug`:

1. A singleton `ConvexHttpClient` queries `getLinkBySlug`.
2. If not found, returns `404 JSON`.
3. Awaits `incrementClicks` to record the visit.
4. Returns `NextResponse.redirect(originalUrl, 302)`.

Using a Route Handler (not a React page) means the redirect and click increment happen entirely server-side before the browser receives any response, eliminating client-side flash.

### 3. Click Tracking

Every redirect passes through the Route Handler, which calls `incrementClicks` before issuing the `302`. The mutation uses `ctx.db.patch` to atomically update only the `clicks` field. Because Convex mutations are serialized transactions, concurrent redirects cannot produce lost updates.

### 4. Link Dashboard

The dashboard is rendered in `app/page.tsx` using the `useQuery(api.links.listLinks)` hook. Convex delivers real-time updates over a WebSocket connection, so the click count and newly created links appear without a page refresh. The table displays the original URL, the constructed short URL (`window.location.origin + "/" + slug`), a live click count, and a copy-to-clipboard button.

### 5. Data Persistence

All data lives in Convex's cloud database. There is no local state for link records — the `useQuery` hook rehydrates data from Convex on every page load, satisfying the persistence requirement across refreshes.

---

## Environment Configuration

| Variable                 | Purpose                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL, used by both the React client and the Route Handler's `ConvexHttpClient` |
| `CONVEX_DEPLOYMENT`      | Used by the Convex CLI (`npx convex dev`) to target the correct deployment                      |

Both are set automatically in `.env.local` when `npx convex dev` is first run.

---

## Running the Application

```bash
# Terminal 1: start Convex dev server (syncs schema + functions, watches for changes)
npx convex dev

# Terminal 2: start Next.js dev server
npm run devs
```
