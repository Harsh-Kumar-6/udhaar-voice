import { addDays } from "date-fns";
import { matchSavedEntry, normalizeIndianMobile, toDateKey } from "@/lib/domain/rules";
import { Shop as ShopSchema, type Customer, type KhataImport, type LedgerEntry, type Payment } from "@/lib/domain/types";
import type { KhataExtraction, KhataImportSummary, UdhaarApi } from "../contract";
import { answerQuestion } from "./assistant";
import { cancelBatchInDb, newId, scheduleInDb, scheduleReportCall } from "./engine";
import { SAMPLE_KHATA } from "./khata-sample";
import {
  batchSummaries,
  callDetail,
  callItems,
  candidates,
  customerDetail,
  customerSummary,
  dailyReport,
  dailyReportWithScript,
  dashboard,
  findCustomerByName,
  graph,
  summaries,
} from "./queries";
import { buildReminderScript } from "./scripts";
import { readDb, resetDb, updateDb } from "./store";
import type { MockDb } from "./types";

/**
 * MOCK ONLY. Implements the API contract against the in-browser demo database,
 * with a small artificial delay so loading states look like a real network.
 */

const delay = (ms = 120 + Math.random() * 180) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Results are deep-copied, like JSON from a server. Handing out live objects would let
// TanStack Query miss updates (it compares old and new data, which would be the same object).
const clone = <T>(value: T): T => (value === undefined ? value : structuredClone(value));

async function read<T>(query: (db: MockDb, now: Date) => T): Promise<T> {
  await delay();
  return clone(query(readDb(), new Date()));
}

async function write<T>(change: (db: MockDb, now: Date) => T): Promise<T> {
  await delay();
  return clone(updateDb((db) => change(db, new Date())));
}

function requireCustomer(db: MockDb, id: string): Customer {
  const c = db.customers.find((x) => x.id === id);
  if (!c) throw new Error("Customer not found");
  return c;
}

export const mockApi: UdhaarApi = {
  getShop: () => read((db) => db.shop),

  updateShop: (patch) =>
    write((db) => {
      db.shop = ShopSchema.parse({ ...db.shop, ...patch });
      return db.shop;
    }),

  listCustomers: () => read((db, now) => summaries(db, now)),
  listReminderCandidates: () => read((db, now) => candidates(db, now)),
  getCustomer: (id) => read((db, now) => customerDetail(db, id, now)),

  updateCustomer: (id, patch) =>
    write((db) => {
      const c = requireCustomer(db, id);
      // A corrected number reaches the real customer next time.
      if (patch.phone !== undefined && patch.phone !== c.phone && db.personas[id] === "wrong_number") db.personas[id] = "promise";
      Object.assign(c, patch);
      return c;
    }),

  addEntry: (input) =>
    write((db, now) => {
      requireCustomer(db, input.customerId);
      const entry: LedgerEntry = { id: newId("e"), ...input, createdAt: now.toISOString() };
      db.entries.push(entry);
      return entry;
    }),

  recordPayment: (input) =>
    write((db, now) => {
      const customer = requireCustomer(db, input.customerId);
      const payment: Payment = { id: newId("p"), ...input, createdAt: now.toISOString() };
      db.payments.push(payment);
      // Settle open promises oldest first; clear them all if nothing is owed any more.
      const open = db.promises
        .filter((p) => p.customerId === customer.id && p.status === "open")
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      let remaining = input.amount;
      for (const p of open) {
        if (remaining < p.amount) break;
        p.status = "kept";
        remaining -= p.amount;
      }
      if (customerSummary(db, customer, now).balance <= 0) for (const p of open) p.status = "kept";
      return payment;
    }),

  resolveDispute: (id) =>
    write((db) => {
      const d = db.disputes.find((x) => x.id === id);
      if (d) d.status = "resolved";
    }),

  listCalls: () => read((db) => callItems(db)),
  getCall: (id) => read((db) => callDetail(db, id)),
  scheduleReminders: (input) => write((db, now) => scheduleInDb(db, input, now)),
  listBatches: () => read((db) => batchSummaries(db)),
  cancelBatch: (id) => write((db, now) => cancelBatchInDb(db, id, now)),

  extractKhata: async ({ source }) => {
    await delay(1600 + Math.random() * 800); // a vision model takes a moment
    const db = readDb();
    const now = new Date();
    const result: KhataExtraction = {
      scanId: newId("scan"),
      source,
      rows: SAMPLE_KHATA.map((line, i) => {
        const match = findCustomerByName(db, ` ${line.name.toLowerCase()} ${line.nameNative} `);
        const date = toDateKey(addDays(now, -line.daysAgo));
        const saved = match
          ? matchSavedEntry(
              { date, amount: line.amount, items: line.items, struckAmount: line.struckAmount },
              db.entries.filter((e) => e.customerId === match.id),
            )
          : undefined;
        return {
          id: `row${i + 1}`,
          name: { value: line.name, confidence: line.confidence.name },
          nameNative: line.nameNative,
          amount: { value: line.amount, confidence: line.confidence.amount, struck: line.struckAmount },
          date: { value: date, confidence: line.confidence.date },
          items: { value: line.items, confidence: line.confidence.items },
          matchCustomerId: match?.id,
          phone: match ? undefined : "",
          language: match?.language ?? "bn",
          saved: saved && { kind: saved.kind, entryId: saved.entry.id, amount: saved.entry.amount, items: saved.entry.items },
          action: saved?.kind === "duplicate" ? "skip" : saved ? "update" : "add",
        };
      }),
    };
    return clone(result);
  },

  saveKhata: ({ source, rows }) =>
    write((db, now) => {
      const record: KhataImport = { id: newId("imp"), shopId: db.shop.id, source, createdAt: now.toISOString(), entryIds: [], customerIds: [], updates: [] };
      for (const row of rows) {
        if (row.action === "skip") continue;
        const existing = row.action === "update" ? db.entries.find((e) => e.id === row.saved?.entryId) : undefined;
        if (existing) {
          record.updates.push({ entryId: existing.id, previous: { amount: existing.amount, items: existing.items } });
          existing.amount = row.amount.value;
          existing.items = row.items.value;
          continue;
        }
        let customerId = row.matchCustomerId;
        if (!customerId) {
          customerId = newId("c");
          db.customers.push({
            id: customerId,
            shopId: db.shop.id,
            name: row.name.value,
            nameNative: row.nameNative,
            phone: (row.phone && normalizeIndianMobile(row.phone)) || "",
            language: row.language,
            optedOut: false,
            createdAt: now.toISOString(),
          });
          db.personas[customerId] = "promise";
          record.customerIds.push(customerId);
        }
        const entry: LedgerEntry = {
          id: newId("e"),
          customerId,
          amount: row.amount.value,
          items: row.items.value,
          date: row.date.value,
          source: "photo",
          importId: record.id,
          createdAt: now.toISOString(),
        };
        db.entries.push(entry);
        record.entryIds.push(entry.id);
      }
      db.imports.push(record);
      return { importId: record.id, added: record.entryIds.length, updated: record.updates.length, newCustomers: record.customerIds.length };
    }),

  listKhataImports: () =>
    read((db) =>
      [...db.imports]
        .filter((i) => !i.undoneAt)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5)
        .map((i): KhataImportSummary => ({
          import: i,
          added: i.entryIds.length,
          updated: i.updates.length,
          amount: db.entries.filter((e) => e.importId === i.id).reduce((sum, e) => sum + e.amount, 0),
        })),
    ),

  undoKhataImport: (id) =>
    write((db, now) => {
      const record = db.imports.find((i) => i.id === id);
      if (!record || record.undoneAt) throw new Error("This import was already undone.");
      const before = db.entries.length;
      db.entries = db.entries.filter((e) => e.importId !== id);
      let restored = 0;
      for (const u of record.updates) {
        const entry = db.entries.find((e) => e.id === u.entryId);
        if (entry) {
          Object.assign(entry, u.previous);
          restored++;
        }
      }
      // A customer this import created goes too, unless something else now refers to them.
      const inUse = (cid: string) =>
        [db.entries, db.payments, db.promises, db.disputes, db.notes, db.calls].some((rows) => rows.some((r: { customerId?: string }) => r.customerId === cid));
      const removable = new Set(record.customerIds.filter((cid) => !inUse(cid)));
      db.customers = db.customers.filter((c) => !removable.has(c.id));
      for (const cid of removable) delete db.personas[cid];
      record.undoneAt = now.toISOString();
      return { removed: before - db.entries.length, restored, customersRemoved: removable.size };
    }),

  // The assistant can schedule calls, so it goes through `write`.
  ask: (question) => write((db, now) => answerQuestion(db, question, now)),

  getDashboard: () => read((db, now) => dashboard(db, now)),
  getDailyReport: () => read((db, now) => dailyReport(db, now)),

  sendReportCall: () =>
    write((db, now) => {
      const { report, turns } = dailyReportWithScript(db, now);
      return scheduleReportCall(db, turns, report.spoken.en, now);
    }),

  getGraph: () => read((db, now) => graph(db, now)),

  startDemoCall: ({ phone, language, name }) =>
    write((db, now) => {
      const today = toDateKey(now);
      if (db.demo.tryCalls[phone] === today) return { allowed: false as const, reason: "This number already had a demo call today. Try again tomorrow." };
      const usedToday = Object.values(db.demo.tryCalls).filter((d) => d === today).length;
      if (usedToday >= 20) return { allowed: false as const, reason: "The demo has reached today's limit of 20 calls. Try again tomorrow." };
      db.demo.tryCalls[phone] = today;
      const visitor = name?.trim() || "friend";
      const script = buildReminderScript(language === "bn" ? "promise_product" : "promise", {
        now,
        customer: { name: visitor, nameNative: visitor, language },
        amount: 350,
      });
      return { allowed: true as const, language, turns: script.turns, extraction: script.extraction };
    }),

  resetDemo: async () => {
    await delay();
    resetDb();
  },
};
