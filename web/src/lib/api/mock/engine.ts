import { format } from "date-fns";
import { dialOrder, isPromiseBroken, isWithinCallingHours } from "@/lib/domain/rules";
import type { Call, CallStatus, Language, ReminderBatch, Turn } from "@/lib/domain/types";
import type { RescheduleResult, ScheduleInput, ScheduleResult } from "../contract";
import { candidates, customerDetail } from "./queries";
import { buildReminderScript, transcriptSeconds } from "./scripts";
import { CALL_LINES, COST_PER_MINUTE_USD } from "./seed";
import { commit, readDb } from "./store";
import type { MockDb, SimPlan } from "./types";

/**
 * MOCK ONLY. Stands in for Bolna: schedules calls, "dials" them, and applies the results.
 * When the real engine arrives, scheduling moves to the server and results come from webhooks.
 */

const RING_SECONDS = 6;
const NO_ANSWER_SECONDS = 30;
const ACTIVE: CallStatus[] = ["scheduled", "queued", "ringing", "in_progress"];

export const newId = (prefix: string) => `${prefix}${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
const iso = (d: Date) => d.toISOString();
const costOf = (seconds: number) => Math.round((seconds / 60) * COST_PER_MINUTE_USD * 1000) / 1000;

export function scheduleInDb(db: MockDb, input: ScheduleInput, now: Date): ScheduleResult {
  const when = input.at === "now" ? now : new Date(input.at);
  const hours = db.shop.callingHours;
  const inside = isWithinCallingHours(when, hours);
  // Outside calling hours nothing is scheduled: the shopkeeper picks another time.
  if (!inside && !input.bypassHours) return { skipped: [], outsideHours: hours };
  const detail = inside ? undefined : "Outside calling hours: bypassed for this demo";

  const pool = new Map(candidates(db, now).map((c) => [c.customer.id, c]));
  const skipped: ScheduleResult["skipped"] = [];
  const batchId = newId("b");
  const callIds: string[] = [];

  for (const id of new Set(input.customerIds)) {
    const candidate = pool.get(id);
    if (!candidate) continue;
    if (!candidate.eligible) {
      skipped.push({ customer: candidate.customer, reason: candidate.reason ?? "Not eligible" });
      continue;
    }
    callIds.push(createReminderCall(db, id, { batchId, when, now, language: input.language, detail }).id);
  }

  if (callIds.length === 0) return { skipped };

  const batch: ReminderBatch = {
    id: batchId,
    shopId: db.shop.id,
    scheduledAt: iso(when),
    language: input.language,
    callIds,
    status: "scheduled",
    createdAt: iso(now),
  };
  db.batches.push(batch);
  return { batch, skipped };
}

function createReminderCall(
  db: MockDb,
  customerId: string,
  opts: { batchId: string; when: Date; now: Date; language: "auto" | Language; detail?: string },
): Call {
  const detail = customerDetail(db, customerId, opts.now);
  if (!detail) throw new Error(`Unknown customer ${customerId}`);
  const c = detail.customer;
  const language = opts.language === "auto" ? c.language : opts.language;
  const open = detail.promises.find((p) => p.status === "open" && !isPromiseBroken(p, opts.now));
  const script = buildReminderScript(db.personas[c.id] ?? "promise", {
    now: opts.when,
    customer: { name: c.name, nameNative: c.nameNative, language },
    amount: detail.balance,
    openPromise: open ? { amount: open.amount, dueDate: open.dueDate } : undefined,
    hasOpenDispute: !!detail.openDispute,
    missedPromises: detail.promises.filter((p) => isPromiseBroken(p, opts.now)).map((p) => ({ amount: p.amount, dueDate: p.dueDate })),
  });

  const id = newId("k");
  db.plans[id] = { answered: script.answered, turns: script.turns, extraction: script.extraction, talkSeconds: transcriptSeconds(script.turns) };
  const call: Call = {
    id,
    shopId: db.shop.id,
    kind: "reminder",
    customerId: c.id,
    batchId: opts.batchId,
    toNumber: c.phone,
    language,
    status: "scheduled",
    scheduledAt: iso(opts.when),
    transcript: [],
    events: [{ at: iso(opts.now), status: "scheduled", detail: opts.detail }],
  };
  db.calls.push(call);
  return call;
}

/** The evening summary call to the shopkeeper. Shopkeepers opt in, so customer calling hours don't apply. */
export function scheduleReportCall(db: MockDb, turns: Turn[], summary: string, now: Date): Call {
  const id = newId("r");
  db.plans[id] = {
    answered: true,
    turns,
    talkSeconds: transcriptSeconds(turns),
    extraction: { outcome: "report_delivered", promises: [], notes: [], sentiment: "positive", confidence: 1, summary },
  };
  const call: Call = {
    id,
    shopId: db.shop.id,
    kind: "report",
    toNumber: db.shop.ownerPhone,
    language: "bn",
    status: "scheduled",
    scheduledAt: iso(now),
    transcript: [],
    events: [{ at: iso(now), status: "scheduled", detail: "Evening report to the shopkeeper" }],
  };
  db.calls.push(call);
  return call;
}

export function rescheduleCallInDb(db: MockDb, callId: string, at: string, bypassHours: boolean, now: Date): RescheduleResult {
  const call = db.calls.find((c) => c.id === callId);
  if (!call) throw new Error("Call not found");
  if (call.status !== "scheduled") throw new Error("Only scheduled calls can be moved");

  const when = new Date(at);
  if (!Number.isFinite(when.getTime())) throw new Error("Invalid time");
  const hours = db.shop.callingHours;
  const inside = isWithinCallingHours(when, hours);
  // Same rule as scheduling: outside calling hours nothing changes; the shopkeeper picks another time.
  if (!inside && !bypassHours) return { call, outsideHours: hours };
  const detail = inside ? `Rescheduled to ${format(when, "EEE d MMM, h:mm a")}` : "Rescheduled outside calling hours: bypassed for this demo";

  call.scheduledAt = iso(when);
  call.events.push({ at: iso(now), status: "scheduled", detail });

  // Keep the owning batch's scheduledAt in sync when it only holds this one call.
  if (call.batchId) {
    const batch = db.batches.find((b) => b.id === call.batchId);
    if (batch && batch.callIds.length === 1) batch.scheduledAt = iso(when);
  }

  return { call };
}

export function cancelCallInDb(db: MockDb, callId: string, now: Date) {
  const call = db.calls.find((c) => c.id === callId);
  if (!call) return;
  if (call.status !== "scheduled" && call.status !== "queued") return;
  call.status = "cancelled";
  call.events.push({ at: iso(now), status: "cancelled", detail: "Cancelled by the shopkeeper" });
  delete db.plans[call.id];
  if (call.batchId) {
    const batch = db.batches.find((b) => b.id === call.batchId);
    if (batch) {
      const stillActive = batch.callIds.some((id) => {
        const s = db.calls.find((k) => k.id === id)?.status;
        return s && ACTIVE.includes(s);
      });
      if (!stillActive) batch.status = "cancelled";
    }
  }
}

export function cancelBatchInDb(db: MockDb, batchId: string, now: Date) {
  const batch = db.batches.find((b) => b.id === batchId);
  if (!batch || batch.status === "completed" || batch.status === "cancelled") return;
  for (const id of batch.callIds) {
    const call = db.calls.find((k) => k.id === id);
    if (call && (call.status === "scheduled" || call.status === "queued")) {
      call.status = "cancelled";
      call.events.push({ at: iso(now), status: "cancelled", detail: "Cancelled by the shopkeeper" });
      delete db.plans[id];
    }
  }
  batch.status = batch.callIds.every((id) => {
    const s = db.calls.find((k) => k.id === id)?.status;
    return !s || !ACTIVE.includes(s);
  })
    ? "cancelled"
    : "running";
}

/** Advances every call by one step. Returns true if anything changed. */
export function tick(db: MockDb, now: Date): boolean {
  let changed = false;
  const t = now.getTime();
  const speed = Math.max(0.5, db.demo.speed);
  const ms = (seconds: number) => (seconds * 1000) / speed;

  for (const call of db.calls) {
    if (call.status === "scheduled" && Date.parse(call.scheduledAt) <= t) {
      call.status = "queued";
      call.events.push({ at: iso(now), status: "queued", detail: "Waiting for a free line" });
      changed = true;
    }
  }

  // Lines are shared by every shop on the account; dialOrder takes turns between shops.
  const onLine = db.calls.filter((k) => k.status === "ringing" || k.status === "in_progress");
  const waiting = db.calls.filter((k) => k.status === "queued");
  for (const call of dialOrder(waiting, onLine).slice(0, Math.max(0, CALL_LINES - onLine.length))) {
    call.status = "ringing";
    call.startedAt = iso(now);
    call.events.push({ at: iso(now), status: "ringing", detail: call.kind === "report" ? "Calling the shopkeeper" : "Calling from Bolna's shared +91 number" });
    changed = true;
  }

  for (const call of db.calls) {
    const plan = db.plans[call.id];
    if (!plan) continue;
    if (call.status === "ringing" && call.startedAt) {
      const elapsed = t - Date.parse(call.startedAt);
      if (!plan.answered && elapsed >= ms(NO_ANSWER_SECONDS)) {
        finishUnanswered(db, call, plan, now);
        changed = true;
      } else if (plan.answered && elapsed >= ms(RING_SECONDS)) {
        call.status = "in_progress";
        call.answeredAt = iso(now);
        call.events.push({ at: iso(now), status: "in_progress", detail: "Answered" });
        changed = true;
      }
    } else if (call.status === "in_progress" && call.answeredAt && t - Date.parse(call.answeredAt) >= ms(plan.talkSeconds)) {
      finishAnswered(db, call, plan, now);
      changed = true;
    }
  }

  for (const batch of db.batches) {
    if (batch.status === "completed" || batch.status === "cancelled") continue;
    const statuses = batch.callIds.map((id) => db.calls.find((k) => k.id === id)?.status ?? "cancelled");
    const next: ReminderBatch["status"] = statuses.every((s) => !ACTIVE.includes(s))
      ? "completed"
      : statuses.some((s) => s !== "scheduled")
        ? "running"
        : "scheduled";
    if (next !== batch.status) {
      batch.status = next;
      changed = true;
    }
  }

  return changed;
}

function finishUnanswered(db: MockDb, call: Call, plan: SimPlan, now: Date) {
  call.status = "no_answer";
  call.endedAt = iso(now);
  call.durationSec = 0;
  call.costUsd = 0;
  call.extraction = plan.extraction;
  call.events.push({ at: iso(now), status: "no_answer", detail: "No answer after 30 s. Bolna would retry in 30 min (not run in this demo)." });
  delete db.plans[call.id];
}

function finishAnswered(db: MockDb, call: Call, plan: SimPlan, now: Date) {
  const seconds = plan.talkSeconds + RING_SECONDS;
  call.status = "completed";
  call.endedAt = iso(now);
  call.durationSec = seconds;
  call.costUsd = costOf(seconds);
  call.transcript = plan.turns;
  call.extraction = plan.extraction;
  call.events.push({ at: iso(now), status: "completed", detail: "Transcript and extraction received by webhook" });
  delete db.plans[call.id];
  applyCallResult(db, call, now);
}

/** Writes what a finished call learned into the ledger and the knowledge graph. */
export function applyCallResult(db: MockDb, call: Call, now: Date) {
  const ex = call.extraction;
  const customerId = call.customerId;
  if (!ex || !customerId || call.kind !== "reminder") return;
  const createdAt = iso(now);

  if (ex.promises.length > 0) {
    for (const p of db.promises) {
      if (p.customerId === customerId && p.status === "open" && isPromiseBroken(p, now)) p.status = "broken";
    }
    for (const p of ex.promises) {
      const duplicate = db.promises.some(
        (x) => x.customerId === customerId && x.status === "open" && x.dueDate === p.dueDate && x.amount === p.amount,
      );
      if (!duplicate)
        db.promises.push({ id: newId("pr"), customerId, callId: call.id, amount: p.amount, dueDate: p.dueDate, status: "open", createdAt });
    }
  }

  if (ex.dispute && !db.disputes.some((d) => d.customerId === customerId && d.status === "open" && d.kind === ex.dispute?.kind)) {
    db.disputes.push({ id: newId("d"), customerId, callId: call.id, ...ex.dispute, status: "open", createdAt });
  }

  for (const n of ex.notes) {
    if (!db.notes.some((x) => x.customerId === customerId && x.text === n.text))
      db.notes.push({ id: newId("n"), customerId, callId: call.id, ...n, createdAt });
  }

  if (ex.outcome === "opted_out") {
    const customer = db.customers.find((c) => c.id === customerId);
    if (customer) customer.optedOut = true;
  }
}

/* ---------------- simulator loop (browser only) ---------------- */

const LEADER_KEY = "udhaar-voice-sim-leader";
const tabId = typeof crypto !== "undefined" ? crypto.randomUUID() : "server";

/** Only one tab advances calls at a time, so two open tabs don't double-play a batch. */
function isLeader(now: number): boolean {
  try {
    const raw = window.localStorage.getItem(LEADER_KEY);
    const current = raw ? (JSON.parse(raw) as { id: string; at: number }) : null;
    if (!current || current.id === tabId || now - current.at > 3000) {
      window.localStorage.setItem(LEADER_KEY, JSON.stringify({ id: tabId, at: now }));
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

export function startSimulator(): () => void {
  if (typeof window === "undefined") return () => {};
  const step = () => {
    const now = new Date();
    if (!isLeader(now.getTime())) return;
    if (tick(readDb(), now)) commit();
  };
  step();
  const timer = window.setInterval(step, 1000);
  return () => window.clearInterval(timer);
}
