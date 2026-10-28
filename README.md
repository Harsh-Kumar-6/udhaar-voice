# Udhaar Voice

Photograph a shop's credit ledger (khata). Udhaar Voice calls each customer in Bengali or Hindi, records promises to pay, and lets the shopkeeper ask the khata anything by voice. Built for the Bolna Buildathon 2026.

**Status:** the app runs on Supabase (Postgres and Auth). Real calls (Bolna) and photo reading and voice questions (vision and speech models) are not connected yet.

## Run it

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit tests (business rules, queries, scheduling, assistant) |
| `npm run typecheck` | Regenerates route types, then runs TypeScript |
| `npm run lint` | ESLint |
| `npm run build` | Production build (also checks Cache Components rules) |
| `npm run db:seed` | Loads the demo shop (Maa Tara Variety Stores) and its login into Supabase, replacing any earlier copy |
| `npm run bolna:setup` | Writes the prompts, greeting, webhook and extractions onto the two Bolna agents |

## What's where

```
bolna/
├─ credits-ledger.md          Bolna credit spend, updated after every test
├─ web/                       Next.js 16 app
│  ├─ supabase/migrations/    Tables, access rules and multi-row functions, in order
│  ├─ scripts/                The demo shop loader (`db:seed`) and the Bolna agent setup (`bolna:setup`)
│  └─ src/
│     ├─ app/                 Routes: / (landing), /try (judges' demo), /app/* (shopkeeper app), /api/udhaar/* (the API)
│     ├─ components/screens/  One file per screen
│     ├─ components/app/      Shared pieces: status chips, transcript, app shell
│     ├─ components/ui/       shadcn/ui components (Radix)
│     ├─ lib/domain/          Types (Zod) and business rules: pure functions, unit-tested
│     ├─ lib/api/             The API contract every screen uses, and its browser client
│     ├─ lib/server/          The API on Supabase: loading a shop's rows, queries, scheduling, validation
│     ├─ lib/demo/            The demo shop, scripted conversations, the sample khata page
│     └─ lib/i18n/            All shopkeeper-facing text: English (en/), Bengali (bn.ts), Hindi (hi.ts)
```

## The screens

| Route | Screen |
|---|---|
| `/` | Landing page |
| `/try` | Public demo: a visitor gets a scripted reminder call (one per number per day, 20 a day in all) |
| `/app` | Dashboard: pending, promised, collected, what needs attention |
| `/app/customers`, `/app/customers/[id]` | Customer list and page (memory, promises, disputes, khata, calls) |
| `/app/khata` | Snap khata: photo → entries → review (crossed-out values, repeats, changes) → save; undo a whole import |
| `/app/calls`, `/app/calls/[id]` | Calls: schedule reminder batches (change a batch's time before it starts, remove anyone not yet called), watch them run, call history, and the call screen (live state, transcript, extraction, event log). `/app/reminders` redirects here. |
| `/app/ask` | Ask your khata (shows the tool the assistant called) |
| `/app/report` | Today's report and the evening call |
| `/app/graph` | Knowledge graph |
| `/app/profile` | Your details, shop and UPI ID (from the avatar menu: sidebar bottom on desktop, header top-right on phones) |
| `/app/settings` | How the app works: app language, calling rules, language for new customers, evening voice summary, demo controls |

## What's connected

| Part | How |
|---|---|
| Accounts and data | Supabase Auth (phone or email with a password); every shop's data in Postgres, private to its owner by row-level security |
| Calls | Bolna reminder and evening summary agents in Bengali, Hindi and English; results written into promises, disputes, notes and opt-outs |
| Khata photos | Gemini reads each page into rows with a confidence per field and crossed-out amounts; the photo is kept in private storage |
| Ask your khata | Gemini answers by calling tools on the shop's data, in the language asked; voice questions are transcribed by Gemini. Without a Gemini key, keyword answers |
| `/try` | A real Bolna call when `TRY_REAL_CALLS` is on (a Bolna trial only reaches verified numbers), otherwise a scripted conversation |

## Calls

- **Agents:** two Bolna agents, Reminder and Evening summary. Their voices and languages are set on Bolna; `npm run bolna:setup` writes the prompts (`lib/server/bolna/prompts.ts`), greeting, webhook and extractions onto them. Each call fills the prompt from `user_data`: the customer's name, amount due, what they bought, memory from earlier calls and any open dispute.
- **Dispatcher** (`lib/server/dispatcher.ts`): every minute (Supabase cron, `0005_scheduler.sql`) and right after a call is scheduled for now. It creates evening summary calls at each shop's time, queues due calls, and dials them while lines are free, taking turns between shops and only inside calling hours. A call is claimed before it's dialled, so it's never dialled twice.
- **Results:** Bolna's webhook (`/api/bolna/webhook`) and the dispatcher's check of calls on a line both read the call back from Bolna's API, then write the status, transcript, cost and the extracted outcome, promise, dispute, notes and opt-out (`lib/server/call-results.ts`). A finished call's result is written once.

## Corrections and accounts

- **Customers** can be added by hand on the Customers page, as well as from khata photos.
- **Entries and payments** can be corrected or deleted from a customer's page. A deleted one is voided, not erased, so the history stays (deleting payments needs `0006`).
- **Passwords** can be changed from Profile, after checking the current one.
- **Sign-in limits** (`lib/server/limits.ts`, `0006`): after 5 failed sign-ins for one phone or email, or 20 from one network address, within 15 minutes, sign-in pauses; one network can create at most 10 accounts in 15 minutes.
- **Phones:** the app can be added to the home screen (`app/manifest.ts`, icons in `public/icons`), opening straight into the khata.

## The database

`web/supabase/migrations/` holds the schema. Every row a shop owns carries `shop_id`, and one access rule limits signed-in users to their own shop. Totals (balances, collections, call stats) are computed from rows, not stored. Undoing a khata import voids its entries instead of deleting them. Server work that no single shop owns (sign-up, the shared call lines, the `/try` limits) uses the service role key on the server only.

## Reading and understanding

- **Khata photos** (`lib/server/gemini.ts`, `khata.ts`): the photo is shrunk in the browser, stored in `khata-photos/{shop}/{scan}.jpg`, and read by Gemini against a JSON schema. Rows are then matched to customers and saved entries exactly like the sample page.
- **Ask** (`lib/server/ask.ts`): Gemini gets tools over the shop's data (summary, a customer, promises by range, top dues, disputes, missed promises, collections, product requests, scheduling a call) and answers in the question's language. The keyword assistant answers when Gemini isn't set up or fails.
- **Voice questions:** Gemini transcribes the recording in its own script before it is asked.
- **Models and limits:** `GEMINI_MODEL` (default `gemini-3.8-flash`) with `GEMINI_FALLBACK_MODEL` (default `gemini-3.6-flash`) when it is busy. Each call has a time budget and no hidden retries, so a request finishes well inside 60 s; Ask gives up after about 40 s and answers by keywords. The free tier allows only 20 requests per model a day, so real use needs billing on the Gemini key.
