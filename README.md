# Udhaar Voice

Photograph a shop's credit ledger (khata). Udhaar Voice calls each customer in Bengali or Hindi, records promises to pay, and lets the shopkeeper ask the khata anything by voice. Built for the Bolna Buildathon 2026.

**Status: frontend prototype.** Every screen works with sample data in the browser. Real calls (Bolna), photo reading (vision model) and the database (Supabase) are not connected yet.

## Run it

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit tests (business rules, call engine, assistant) |
| `npm run typecheck` | Regenerates route types, then runs TypeScript |
| `npm run lint` | ESLint |
| `npm run build` | Production build (also checks Cache Components rules) |

## What's where

```
bolna/
├─ credits-ledger.md          Bolna credit spend, updated after every test
├─ web/                       Next.js 16 app
│  └─ src/
│     ├─ app/                 Routes: / (landing), /try (judges' demo), /app/* (shopkeeper app)
│     ├─ components/screens/  One file per screen
│     ├─ components/app/      Shared pieces: status chips, transcript, app shell
│     ├─ components/ui/       shadcn/ui components (Radix)
│     ├─ lib/domain/          Types (Zod) and business rules: pure functions, unit-tested
│     ├─ lib/api/contract.ts  The API every screen uses
│     ├─ lib/api/mock/        MOCK ONLY: in-browser data, call simulator, sample khata
│     └─ lib/i18n/            All shopkeeper-facing text (English now; Bengali/Hindi later)
```

## The screens

| Route | Screen |
|---|---|
| `/` | Landing page |
| `/try` | Public demo: a visitor gets a (simulated) reminder call |
| `/app` | Dashboard: pending, promised, collected, what needs attention |
| `/app/customers`, `/app/customers/[id]` | Customer list and page (memory, promises, disputes, khata, calls) |
| `/app/khata` | Snap khata: photo → entries → review → save |
| `/app/reminders` | Schedule reminder batches and watch them run |
| `/app/calls`, `/app/calls/[id]` | Call history and the call screen (live state, transcript, extraction, event log) |
| `/app/ask` | Ask your khata (shows the tool the assistant called) |
| `/app/report` | Today's report and the evening call |
| `/app/graph` | Knowledge graph |
| `/app/settings` | Shop, calling rules, languages, prototype controls |

## Simulated vs real

| Simulated now | Real behaviour already |
|---|---|
| Phone calls (scripted Bengali/Hindi conversations) | Calling hours, gap between reminders, opt-outs, wrong numbers, refusals |
| Khata photo reading (same sample result for every photo) | What a call changes: promises, disputes, notes, knowledge graph, memory |
| The voice assistant (typed questions, rule-based answers) | WhatsApp messages with UPI payment links |
| Storage (localStorage, one copy per browser) | All screens, built on the API contract the backend will implement |

## Next steps (replacing the mock)

1. Supabase tables matching `lib/domain/types.ts`; an HTTP client implementing `UdhaarApi`.
2. Bolna: reminder agent (from the Reminders template), batches with calling guardrails, webhook → our API, custom functions for the assistant, Web Call SDK for "Ask".
3. Vision model (Gemini) for khata photos, returning the `KhataExtraction` shape.
4. Delete `lib/api/mock/`, `SimulatorRunner`, the sample khata page and the prototype banner.
