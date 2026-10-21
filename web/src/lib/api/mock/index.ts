import { addDays } from "date-fns";
import { normalizeIndianMobile, toDateKey } from "@/lib/domain/rules";
import { Shop as ShopSchema, type Customer, type LedgerEntry, type Payment } from "@/lib/domain/types";
import type { KhataExtraction, UdhaarApi } from "../contract";
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
        return {
          id: `row${i + 1}`,
          name: { value: line.name, confidence: line.confidence.name },
          nameNative: line.nameNative,
          amount: { value: line.amount, confidence: line.confidence.amount },
          date: { value: toDateKey(addDays(now, -line.daysAgo)), confidence: line.confidence.date },
          items: { value: line.items, confidence: line.confidence.items },
          matchCustomerId: match?.id,
          phone: match ? undefined : "",
          language: match?.language ?? "bn",
          include: true,
        };
      }),
    };
    return clone(result);
  },

  saveKhata: (rows) =>
    write((db, now) => {
      let entries = 0;
      let newCustomers = 0;
      for (const row of rows) {
        if (!row.include) continue;
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
          newCustomers++;
        }
        db.entries.push({
          id: newId("e"),
          customerId,
          amount: row.amount.value,
          items: row.items.value,
          date: row.date.value,
          source: "photo",
          createdAt: now.toISOString(),
        });
        entries++;
      }
      return { entries, newCustomers };
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
