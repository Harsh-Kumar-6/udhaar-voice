import { addDays, format } from "date-fns";
import type { FunctionDeclaration } from "@google/genai";
import { formatINR, isPromiseBroken, toDateKey } from "@/lib/domain/rules";
import type { AskAnswer, ScheduleInput, ScheduleResult } from "@/lib/api/contract";
import { answerQuestion } from "./assistant";
import type { ShopData } from "./data";
import { answerWithTools, geminiConfigured } from "./gemini";
import { candidates, customerSummary, findCustomerByName, fmtDay, summaries } from "./queries";

/**
 * "Ask your khata": Gemini answers by calling these tools on the shop's data. Without a Gemini key,
 * or if Gemini fails, the keyword assistant answers instead.
 */

type Item = NonNullable<AskAnswer["items"]>[number];
/** What a tool hands back to Gemini, plus what the app shows under the answer. */
type ToolResult = { data: unknown; items?: Item[]; action?: AskAnswer["action"] };

const link = (id: string) => `/app/customers/${id}`;

export const TOOLS: FunctionDeclaration[] = [
  { name: "get_summary", description: "Totals for the whole shop: pending dues, customers owing, collected today and this week, promised this week, open disputes." },
  {
    name: "find_customer",
    description: "One customer's dues, status, next promise, open dispute and last call. Matches Latin or native-script names, first or full.",
    parametersJsonSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "list_promises",
    description: "Promises to pay that are still open, by when they are due.",
    parametersJsonSchema: { type: "object", properties: { range: { type: "string", enum: ["today", "tomorrow", "this_week", "overdue"] } }, required: ["range"] },
  },
  { name: "list_top_dues", description: "Customers who owe the most.", parametersJsonSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 10 } } } },
  { name: "list_disputes", description: "Open disputes: customers who say they already paid or that the amount is wrong." },
  { name: "list_broken_promises", description: "Customers who missed a promise to pay, and how many times." },
  {
    name: "list_collections",
    description: "Payments received.",
    parametersJsonSchema: { type: "object", properties: { period: { type: "string", enum: ["today", "this_week"] } }, required: ["period"] },
  },
  { name: "list_product_requests", description: "Products customers asked the shop to keep, from their calls." },
  {
    name: "schedule_call",
    description: "Schedule a reminder call to one customer. Only when the shopkeeper asks for a call.",
    parametersJsonSchema: {
      type: "object",
      properties: { name: { type: "string" }, when: { type: "string", enum: ["now", "tomorrow_morning"] } },
      required: ["name", "when"],
    },
  },
];

export function instruction(db: ShopData, now: Date): string {
  return `You are Asha, the assistant inside ${db.shop.name}'s credit book (khata) app. The shopkeeper asks about their customers' dues, promises and calls.
Today is ${format(now, "EEEE d MMMM yyyy")}.
- Always use the tools for names, amounts and dates. Never guess or invent them.
- Answer in the same language and script as the question: Bengali, Hindi, Hinglish (Latin letters) or English.
- Keep it to one or two short sentences. Amounts in rupees with Indian grouping, like ₹1,240.
- The list of customers is shown under your answer, so don't repeat every row.
- Only schedule a call when asked to. If a tool says someone can't be called, say why.`;
}

export async function runTool(
  db: ShopData,
  now: Date,
  name: string,
  args: Record<string, unknown>,
  schedule: (input: ScheduleInput) => Promise<ScheduleResult>,
): Promise<ToolResult> {
  const today = toDateKey(now);
  const customer = (id: string) => db.customers.find((c) => c.id === id);
  switch (name) {
    case "get_summary": {
      const owing = summaries(db, now).filter((s) => s.balance > 0);
      const weekAgo = toDateKey(addDays(now, -6));
      const weekEnd = toDateKey(addDays(now, 6));
      const paid = (from: string) => db.payments.filter((p) => p.date >= from && p.date <= today).reduce((s, p) => s + p.amount, 0);
      const promised = db.promises.filter((p) => p.status === "open" && p.dueDate >= today && p.dueDate <= weekEnd);
      return {
        data: {
          pending: formatINR(owing.reduce((s, x) => s + x.balance, 0)),
          customers_owing: owing.length,
          collected_today: formatINR(paid(today)),
          collected_this_week: formatINR(paid(weekAgo)),
          promised_this_week: formatINR(promised.reduce((s, p) => s + p.amount, 0)),
          open_disputes: db.disputes.filter((d) => d.status === "open").length,
        },
      };
    }
    case "find_customer": {
      const c = findCustomerByName(db, ` ${String(args.name ?? "").toLowerCase()} `);
      if (!c) return { data: { found: false } };
      const s = customerSummary(db, c, now);
      return {
        data: {
          found: true,
          name: c.name,
          owes: formatINR(s.balance),
          status: s.status,
          next_promise: s.nextPromise ? `${formatINR(s.nextPromise.amount)} by ${fmtDay(s.nextPromise.dueDate)}` : null,
          open_dispute: s.openDispute?.reason ?? null,
          last_call: s.lastCall ? `${fmtDay(s.lastCall.at.slice(0, 10))}: ${s.lastCall.outcome ?? s.lastCall.status}` : null,
        },
        action: { label: `Open ${c.name.split(" ")[0]}'s page`, href: link(c.id) },
      };
    }
    case "list_promises": {
      const range = String(args.range ?? "this_week");
      const tomorrow = toDateKey(addDays(now, 1));
      const weekEnd = toDateKey(addDays(now, 6));
      const open = db.promises.filter((p) => p.status === "open");
      const [from, to] = range === "today" ? [today, today] : range === "tomorrow" ? [tomorrow, tomorrow] : [today, weekEnd];
      const list = (range === "overdue" ? open.filter((p) => isPromiseBroken(p, now)) : open.filter((p) => p.dueDate >= from && p.dueDate <= to)).sort((a, b) =>
        a.dueDate.localeCompare(b.dueDate),
      );
      const items = list.flatMap((p) => {
        const c = customer(p.customerId);
        return c ? [{ label: c.name, value: `${formatINR(p.amount)} · ${fmtDay(p.dueDate)}`, href: link(c.id) }] : [];
      });
      return { data: { count: list.length, total: formatINR(list.reduce((s, p) => s + p.amount, 0)), promises: items.map((i) => `${i.label}: ${i.value}`) }, items };
    }
    case "list_top_dues": {
      const limit = Math.min(10, Math.max(1, Number(args.limit) || 5));
      const top = summaries(db, now).filter((s) => s.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, limit);
      const items = top.map((s) => ({ label: s.customer.name, value: formatINR(s.balance), href: link(s.customer.id) }));
      return { data: { customers: items.map((i) => `${i.label}: ${i.value}`) }, items };
    }
    case "list_disputes": {
      const items = db.disputes
        .filter((d) => d.status === "open")
        .flatMap((d) => {
          const c = customer(d.customerId);
          return c ? [{ label: c.name, value: d.reason, href: link(c.id) }] : [];
        });
      return { data: { count: items.length, disputes: items.map((i) => `${i.label}: ${i.value}`) }, items };
    }
    case "list_broken_promises": {
      const counts = new Map<string, number>();
      for (const p of db.promises) if (isPromiseBroken(p, now)) counts.set(p.customerId, (counts.get(p.customerId) ?? 0) + 1);
      const items = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .flatMap(([id, n]) => {
          const c = customer(id);
          return c ? [{ label: c.name, value: `${n} missed`, href: link(id) }] : [];
        });
      return { data: { customers: items.map((i) => `${i.label}: ${i.value}`) }, items };
    }
    case "list_collections": {
      const from = args.period === "today" ? today : toDateKey(addDays(now, -6));
      const list = db.payments.filter((p) => p.date >= from && p.date <= today).sort((a, b) => b.date.localeCompare(a.date));
      const items = list.flatMap((p) => {
        const c = customer(p.customerId);
        return c ? [{ label: c.name, value: `${formatINR(p.amount)} · ${p.method.toUpperCase()} · ${fmtDay(p.date)}`, href: link(c.id) }] : [];
      });
      return { data: { total: formatINR(list.reduce((s, p) => s + p.amount, 0)), payments: items.length }, items };
    }
    case "list_product_requests": {
      const byProduct = new Map<string, string[]>();
      for (const n of db.notes.filter((x) => x.kind === "product_demand")) {
        const key = n.product ?? n.text;
        byProduct.set(key, [...(byProduct.get(key) ?? []), customer(n.customerId)?.name ?? "Unknown"]);
      }
      const items = [...byProduct.entries()].map(([product, names]) => ({ label: product, value: `asked by ${[...new Set(names)].join(", ")}` }));
      return { data: { products: items.map((i) => `${i.label} (${i.value})`) }, items };
    }
    case "schedule_call": {
      const c = findCustomerByName(db, ` ${String(args.name ?? "").toLowerCase()} `);
      if (!c) return { data: { scheduled: false, reason: "No customer by that name." } };
      const eligible = candidates(db, now).find((x) => x.customer.id === c.id);
      if (!eligible?.eligible) return { data: { scheduled: false, reason: eligible?.reason ?? "Can't be called right now." } };
      let at = "now";
      if (args.when === "tomorrow_morning") {
        const morning = addDays(now, 1);
        morning.setHours(Math.max(10, db.shop.callingHours.start), 0, 0, 0);
        at = morning.toISOString();
      }
      const result = await schedule({ customerIds: [c.id], at, language: "auto", bypassHours: db.shop.demoBypassHours });
      if (result.outsideHours) return { data: { scheduled: false, reason: `Outside calling hours (${result.outsideHours.start}:00–${result.outsideHours.end}:00).` } };
      if (!result.batch) return { data: { scheduled: false, reason: result.skipped[0]?.reason ?? "Not scheduled." } };
      return {
        data: { scheduled: true, name: c.name, when: format(new Date(result.batch.scheduledAt), "EEEE h:mm a") },
        action: { label: "See the scheduled call", href: `/app/calls/${result.batch.callIds[0]}` },
      };
    }
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}

const describeCall = (c: { name: string; args: Record<string, unknown> }) =>
  `${c.name}(${Object.entries(c.args)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(", ")})`;

export async function ask(db: ShopData, question: string, now: Date, schedule: (input: ScheduleInput) => Promise<ScheduleResult>): Promise<AskAnswer> {
  if (!geminiConfigured()) return answerQuestion(db, question, now, schedule);
  let shown: Omit<ToolResult, "data"> = {};
  try {
    const { answer, calls } = await answerWithTools(
      question,
      TOOLS,
      async (name, args) => {
        const result = await runTool(db, now, name, args, schedule);
        if (result.items || result.action) shown = { items: result.items, action: result.action };
        return result.data;
      },
      instruction(db, now),
    );
    if (!answer) throw new Error("No answer");
    return { question, answer, tool: calls.length ? calls.map(describeCall).join(" → ") : "none", items: shown.items, action: shown.action };
  } catch (err) {
    console.error("[ask]", err instanceof Error ? err.message : err);
    return answerQuestion(db, question, now, schedule);
  }
}
