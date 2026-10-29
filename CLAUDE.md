# Udhaar Voice: notes for Claude Code

Bolna Buildathon project. Read `README.md` first. The app lives in `web/` (Next.js 16, React 19, TypeScript strict, Tailwind 4, shadcn/ui on Radix, TanStack Query, Zod, Vitest).

## Architecture rules

- **Screens depend only on `src/lib/api/contract.ts`** (through `src/lib/api/hooks.ts`). The browser reaches it through `lib/api/http.ts`; the server implements it in `lib/server/api.ts`. Never import `lib/server/` from a screen. Exception: the sample khata page reads `lib/demo/khata-sample.ts`.
- **Business rules are pure functions in `src/lib/domain/rules.ts`**: no clock reads (pass `now`), no I/O. Add a test in `rules.test.ts` for every new rule.
- **Server queries are pure functions over `ShopData`** (`lib/server/queries.ts`, `scheduling.ts`); `lib/server/data.ts` loads a shop's rows and `api.ts` does the writes. Test the pure parts with `createSeed()`.
- **Database changes go in a new file in `web/supabase/migrations/`**, never by editing an applied one. Every shop-owned table has `shop_id` and the `own_shop` policy. Writes touching several rows go in a SQL function (security invoker).
- **Secrets stay server-side.** The service role key is only used in `lib/server/supabase.ts` (`adminClient`) and `scripts/`; nothing under `NEXT_PUBLIC_`.
- **Calls go through `lib/server/dispatcher.ts`** (claim, then dial; calling hours per shop) and their results through `lib/server/call-results.ts`, which reads the call back from Bolna's API. Prompts and extraction names live in `lib/server/bolna/prompts.ts`; after changing them, `npm run bolna:setup` updates the agents.
- **AI models are providers** (`lib/server/ai.ts`: shared prompts, schemas and `step`): Gemini in `gemini.ts`, then Meta's Muse Spark in `meta.ts`, in the order of `providers.ts`. Every answer is checked against a JSON schema. Each provider is a separate request from the browser (`lib/api/steps.ts`), so each gets a full request's time and the screen shows which one is working. Assistant tools are pure functions over `ShopData` in `lib/server/ask.ts`; add a test for each new tool.
- **The server runs in India time** (`lib/server/timezone.ts`, imported first by the API route), because the rules read local hours and dates.
- **All shopkeeper-facing text goes in `src/lib/i18n/en/*.ts`**, with the same keys in `src/lib/i18n/hi.ts` (Hindi), `or.ts` (Odia), `bn.ts` (Bengali) and `mr.ts` (Marathi), and is read with `useT()`. The typechecker fails if a translation is missing. The landing page and `/try` are English-only and may inline text.
- One modular monolith. No microservices.

## Next.js 16 gotchas (this version differs from older training data)

- Bundled docs: `web/node_modules/next/dist/docs/`. Check them before using an API you're unsure of.
- **Cache Components is on.** Do not read the clock (`new Date()`, `Date.now()`) or `Math.random()` while a component renders during prerender. Read it in event handlers, effects, `useState(() => …)` initialisers of components that only render after data loads, or `useSyncExternalStore`. `npm run build` fails otherwise.
- `useParams` / `usePathname` on routes with unknown dynamic params need a `<Suspense>` boundary (see `app/app/customers/[id]/page.tsx` and the app shell nav).
- `LayoutProps<"/route">` / `PageProps` come from generated types: run `npm run typecheck` (it runs `next typegen` first).
- React Compiler is on: no manual `useMemo`/`useCallback`; don't call `setState` synchronously in effects (lint enforces it).

## Commands (from `web/`)

`npm run dev` · `npm test` · `npm run typecheck` · `npm run lint` · `npm run build`

Run all four checks before saying work is done.

## Product rules the code must keep

- Calls only inside calling hours (default 8 AM–7 PM). A time outside them schedules nothing; the shopkeeper picks another time. Never twice within `reminderGapDays`.
- Calling lines are shared by every shop on our Bolna account (2 on trial). Waiting calls get lines in `dialOrder` (turns between shops) and show their place in line.
- Never call opted-out customers, a number that last reached someone else (until it changes), or someone who refused in the last 14 days.
- The agent discloses it is an AI, never threatens, never tells anyone else what a customer owes.
- Phone numbers are shown only to the shop's own signed-in owner, formatted with `formatPhone`; never in logs, the landing page or `/try`.

## Credits

Bolna credit spend is tracked in `credits-ledger.md`. Estimate the cost before any real test call and update the ledger after it.
