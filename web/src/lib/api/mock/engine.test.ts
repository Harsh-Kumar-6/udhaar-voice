import { describe, expect, it } from "vitest";
import { answerQuestion } from "./assistant";
import { rescheduleCallInDb, scheduleInDb, tick } from "./engine";
import { callItems, candidates, dailyReport, dashboard, graph, summaries } from "./queries";
import { createSeed } from "./seed";
import type { MockDb } from "./types";

// A fixed Wednesday inside calling hours keeps these tests independent of when they run.
const NOW = new Date("2026-10-21T11:00:00");

const fresh = () => createSeed(NOW);
const status = (db: MockDb, id: string, now = NOW) => summaries(db, now).find((s) => s.customer.id === id)?.status;
const eligibility = (db: MockDb, id: string) => candidates(db, NOW).find((c) => c.customer.id === id);

/** Runs the simulator for `seconds` of wall-clock time and returns the time reached. */
function runFor(db: MockDb, seconds: number, from = NOW): Date {
  let t = from.getTime();
  for (let i = 0; i < seconds; i++) {
    t += 1000;
    tick(db, new Date(t));
  }
  return new Date(t);
}

describe("seed", () => {
  it("starts with ₹9,560 pending across 14 customers", () => {
    const d = dashboard(fresh(), NOW);
    expect(d.totalPending).toBe(9560);
    expect(d.customersOwing).toBe(14);
    expect(d.openDisputes).toBe(1);
  });

  it("covers every customer state", () => {
    const db = fresh();
    expect(status(db, "c13")).toBe("overdue");
    expect(status(db, "c05")).toBe("disputed");
    expect(status(db, "c02")).toBe("promised");
    expect(status(db, "c10")).toBe("opted_out");
    expect(status(db, "c14")).toBe("paid");
    expect(status(db, "c01")).toBe("due");
  });

  it("builds a connected knowledge graph", () => {
    const g = graph(fresh(), NOW);
    const ids = new Set(g.nodes.map((n) => n.id));
    expect(g.edges.every((e) => ids.has(e.source) && ids.has(e.target))).toBe(true);
    expect(g.edges.some((e) => e.kind === "pays_through")).toBe(true);
  });
});

describe("who can be called", () => {
  it("skips opted-out, fully paid and recently reminded customers", () => {
    const db = fresh();
    expect(eligibility(db, "c10")?.reason).toBe("Asked not to be called");
    expect(eligibility(db, "c14")?.reason).toBe("Nothing due");
    expect(eligibility(db, "c05")?.reason).toMatch(/^Reminded/);
  });

  it("never re-dials a wrong number until it is changed", () => {
    const db = fresh();
    const later = new Date("2026-10-23T11:00:00"); // past the 3-day reminder gap
    const at = (when: Date) => candidates(db, when).find((c) => c.customer.id === "c11");
    expect(at(later)?.reason).toMatch(/Update the number/);
    db.customers.find((c) => c.id === "c11")!.phone = "+919876500011";
    expect(at(NOW)?.reason).toMatch(/^Reminded/); // the gap still applies today
    expect(at(later)?.eligible).toBe(true);
  });

  it("leaves a customer alone for 14 days after a refusal", () => {
    expect(eligibility(fresh(), "c08")?.reason).toMatch(/settle in person/);
  });

  it("schedules nothing outside calling hours, so the shopkeeper can pick another time", () => {
    const db = fresh();
    const evening = new Date("2026-10-21T20:30:00");
    const r = scheduleInDb(db, { customerIds: ["c01"], at: evening.toISOString(), language: "auto", bypassHours: false }, NOW);
    expect(r.batch).toBeUndefined();
    expect(r.outsideHours).toEqual(db.shop.callingHours);
    expect(db.calls.some((k) => k.status === "scheduled")).toBe(false);
  });
});

describe("rescheduling", () => {
  it("leaves the call unchanged when the new time is outside calling hours", () => {
    const db = fresh();
    const later = new Date("2026-10-21T15:00:00").toISOString();
    const r = scheduleInDb(db, { customerIds: ["c01"], at: later, language: "auto", bypassHours: false }, NOW);
    const callId = r.batch!.callIds[0];
    const moved = rescheduleCallInDb(db, callId, new Date("2026-10-21T21:00:00").toISOString(), false, NOW);
    expect(moved.outsideHours).toEqual(db.shop.callingHours);
    expect(db.calls.find((k) => k.id === callId)?.scheduledAt).toBe(later);
  });
});

describe("simulated batch", () => {
  it("plays every call to an end state and records what was learned", () => {
    const db = fresh();
    const ids = candidates(db, NOW).filter((c) => c.eligible).map((c) => c.customer.id);
    const r = scheduleInDb(db, { customerIds: ids, at: "now", language: "auto", bypassHours: false }, NOW);
    expect(r.batch).toBeDefined();
    const end = runFor(db, 600);

    const batch = db.batches.find((b) => b.id === r.batch!.id)!;
    expect(batch.status).toBe("completed");
    const calls = batch.callIds.map((id) => db.calls.find((k) => k.id === id)!);
    expect(calls.every((k) => k.status === "completed" || k.status === "no_answer")).toBe(true);
    expect(calls.filter((k) => k.status === "completed").every((k) => k.transcript.length > 0 && k.extraction)).toBe(true);

    // Imran asked for Maggi; Mousumi split her payment in two; Deepak made a new promise.
    expect(db.notes.some((n) => n.customerId === "c09" && n.product === "Maggi")).toBe(true);
    expect(db.promises.filter((p) => p.customerId === "c07" && p.status === "open")).toHaveLength(2);
    expect(status(db, "c13", end)).toBe("promised");
    expect(db.plans).toEqual({});
  });

  it("lets a customer who asked for a call back be called again, and doesn't count unanswered calls", () => {
    const db = fresh();
    const ids = candidates(db, NOW).filter((c) => c.eligible).map((c) => c.customer.id);
    scheduleInDb(db, { customerIds: ids, at: "now", language: "auto", bypassHours: false }, NOW);
    const end = runFor(db, 600);
    const after = (id: string) => candidates(db, end).find((c) => c.customer.id === id);

    expect(after("c03")?.eligible).toBe(true); // Bapi asked: "call me tomorrow morning"
    expect(after("c03")?.note).toMatch(/called back/);
    expect(after("c06")?.eligible).toBe(true); // Rahul didn't pick up
    expect(after("c01")?.reason).toMatch(/^Reminded/); // Ramesh answered and promised
  });

  it("never has more than 2 calls on the line, and tells waiting calls their place in line", () => {
    const db = fresh();
    const ids = candidates(db, NOW).filter((c) => c.eligible).map((c) => c.customer.id);
    scheduleInDb(db, { customerIds: ids, at: "now", language: "auto", bypassHours: false }, NOW);
    let t = NOW.getTime();
    for (let i = 0; i < 300; i++) {
      t += 1000;
      tick(db, new Date(t));
      expect(db.calls.filter((k) => k.status === "ringing" || k.status === "in_progress").length).toBeLessThanOrEqual(2);
      const waiting = callItems(db).filter((x) => x.call.status === "queued");
      expect(waiting.map((x) => x.queue?.position).sort()).toEqual(waiting.map((_, i) => i + 1));
    }
  });
});

describe("ask your khata", () => {
  const ask = (q: string, db = fresh()) => answerQuestion(db, q, NOW);

  it("understands Hinglish, Bengali and English", () => {
    expect(ask("Kaun is hafte dega?").tool).toMatch(/^list_promises/);
    expect(ask("এই সপ্তাহে কে দেবে?").tool).toMatch(/^list_promises/);
    expect(ask("Ramesh ka kitna baaki hai?").answer).toContain("₹350");
    expect(ask("any disputes?").tool).toMatch(/^list_disputes/);
    expect(ask("who broke a promise").answer).toMatch(/1 customer/);
    expect(ask("what did customers ask for").tool).toMatch(/^find_notes/);
  });

  it("schedules a call when asked", () => {
    const db = fresh();
    const a = ask("Ramesh ko kal call karo", db);
    expect(a.tool).toMatch(/^schedule_call/);
    expect(db.calls.some((k) => k.customerId === "c01" && k.status === "scheduled")).toBe(true);
  });
});

describe("evening report", () => {
  it("reads naturally when nobody promised anything today", () => {
    const r = dailyReport(fresh(), NOW);
    expect(r.spoken.en).toContain("No new promises today");
    expect(r.spoken.en).not.toMatch(/\(s\)/);
    expect(r.spoken.en).not.toMatch(/[ऀ-ॿ]/); // no Devanagari in the English text
  });
});
