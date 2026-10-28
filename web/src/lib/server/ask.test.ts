import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/demo/seed";
import type { ScheduleInput } from "@/lib/api/contract";
import type { ShopData } from "./data";
import { runTool, TOOLS } from "./ask";

const NOW = new Date("2026-10-21T11:00:00");
const fresh = (): ShopData => ({ ...createSeed(NOW), imports: [], lines: { lines: 2, onLine: [], waiting: [] } });
const noSchedule = async () => ({ skipped: [] as { customer: never; reason: string }[] });

describe("assistant tools", () => {
  it("declares every tool it can run", async () => {
    for (const t of TOOLS) {
      const args = t.name === "find_customer" || t.name === "schedule_call" ? { name: "Ramesh", when: "now" } : t.name === "list_promises" ? { range: "this_week" } : t.name === "list_collections" ? { period: "today" } : {};
      await expect(runTool(fresh(), NOW, t.name!, args, noSchedule)).resolves.toBeDefined();
    }
    await expect(runTool(fresh(), NOW, "drop_tables", {}, noSchedule)).rejects.toThrow(/Unknown tool/);
  });

  it("totals the shop", async () => {
    const r = await runTool(fresh(), NOW, "get_summary", {}, noSchedule);
    expect(r.data).toMatchObject({ pending: "₹9,560", customers_owing: 14, open_disputes: 1 });
  });

  it("finds a customer by first name and links to their page", async () => {
    const r = await runTool(fresh(), NOW, "find_customer", { name: "ramesh" }, noSchedule);
    expect(r.data).toMatchObject({ found: true, name: "Ramesh Yadav", owes: "₹350" });
    expect(r.action?.href).toBe("/app/customers/c01");
    expect((await runTool(fresh(), NOW, "find_customer", { name: "Nobody" }, noSchedule)).data).toEqual({ found: false });
  });

  it("lists open promises by range, and missed ones as overdue", async () => {
    const week = await runTool(fresh(), NOW, "list_promises", { range: "this_week" }, noSchedule);
    const overdue = await runTool(fresh(), NOW, "list_promises", { range: "overdue" }, noSchedule);
    expect(week.items?.every((i) => i.href?.startsWith("/app/customers/"))).toBe(true);
    expect(overdue.items?.map((i) => i.label)).toContain("Deepak Kumar");
  });

  it("lists the open dispute", async () => {
    const r = await runTool(fresh(), NOW, "list_disputes", {}, noSchedule);
    expect(r.items?.map((i) => i.label)).toEqual(["Priya Sharma"]);
  });

  it("won't schedule someone who can't be called, and says why", async () => {
    let asked = false;
    const r = await runTool(fresh(), NOW, "schedule_call", { name: "Anjali", when: "now" }, async () => {
      asked = true;
      return { skipped: [] };
    });
    expect(r.data).toEqual({ scheduled: false, reason: "Asked not to be called" });
    expect(asked).toBe(false);
  });

  it("schedules tomorrow morning inside calling hours", async () => {
    let input: ScheduleInput | undefined;
    await runTool(fresh(), NOW, "schedule_call", { name: "Ramesh", when: "tomorrow_morning" }, async (i) => {
      input = i;
      return { skipped: [] };
    });
    expect(new Date(input!.at).getHours()).toBe(10);
    expect(input!.customerIds).toEqual(["c01"]);
  });
});
