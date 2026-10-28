import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/demo/seed";
import type { LineCall } from "./data";
import { callsToDial, mayDialNow, reportDue } from "./dispatcher";

const shop = createSeed(new Date("2026-10-21T11:00:00")).shop; // calling hours 8 AM–7 PM
const at = (iso: string) => new Date(iso);
const waiting = (id: string, shopId: string, scheduledAt: string): LineCall => ({ id, shopId, scheduledAt, status: "queued" });

describe("dispatcher", () => {
  it("fills only the free lines, taking turns between shops", () => {
    const queue = [waiting("a1", "A", "2026-10-21T05:00:00Z"), waiting("a2", "A", "2026-10-21T05:01:00Z"), waiting("b1", "B", "2026-10-21T05:02:00Z")];
    expect(callsToDial(queue, [], 2, () => true).map((c) => c.id)).toEqual(["a1", "b1"]);
    expect(callsToDial(queue, [{ id: "x", shopId: "A", scheduledAt: "", status: "in_progress" }], 2, () => true).map((c) => c.id)).toEqual(["b1"]);
    expect(callsToDial(queue, [{ id: "x", shopId: "A", scheduledAt: "", status: "in_progress" }, { id: "y", shopId: "B", scheduledAt: "", status: "ringing" }], 2, () => true)).toEqual([]);
  });

  it("skips calls that can't go out now", () => {
    const queue = [waiting("a1", "A", "2026-10-21T05:00:00Z"), waiting("b1", "B", "2026-10-21T05:02:00Z")];
    expect(callsToDial(queue, [], 2, (c) => c.shopId === "B").map((c) => c.id)).toEqual(["b1"]);
  });

  it("dials customers only inside calling hours, unless the call was scheduled with the demo bypass", () => {
    const evening = at("2026-10-21T20:00:00");
    expect(mayDialNow({ kind: "reminder", scheduledAt: at("2026-10-21T18:55:00").toISOString() }, shop, at("2026-10-21T18:56:00"))).toBe(true);
    expect(mayDialNow({ kind: "reminder", scheduledAt: at("2026-10-21T18:55:00").toISOString() }, shop, evening)).toBe(false);
    expect(mayDialNow({ kind: "reminder", scheduledAt: at("2026-10-21T19:30:00").toISOString() }, shop, evening)).toBe(true);
    expect(mayDialNow({ kind: "report", scheduledAt: evening.toISOString() }, shop, evening)).toBe(true);
  });

  it("makes the evening summary call within an hour after the chosen time", () => {
    expect(reportDue("20:00", at("2026-10-21T19:59:00"))).toBe(false);
    expect(reportDue("20:00", at("2026-10-21T20:00:00"))).toBe(true);
    expect(reportDue("20:00", at("2026-10-21T20:59:00"))).toBe(true);
    expect(reportDue("20:00", at("2026-10-21T21:00:00"))).toBe(false);
  });
});
