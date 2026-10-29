import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/demo/seed";
import type { ShopData } from "./data";
import { fromInputLines, fromReadLines, readSamplePage, toRows } from "./khata";

const NOW = new Date("2026-10-21T11:00:00");
const fresh = (): ShopData => ({ ...createSeed(NOW), imports: [], lines: { lines: 2, onLine: [], waiting: [] } });
const rowFor = (name: string, db = fresh()) => readSamplePage(db, NOW).rows.find((r) => r.name.value === name)!;

describe("snap khata", () => {
  it("keeps what was crossed out next to the new value", () => {
    const haru = rowFor("Haru Kaka");
    expect(haru.amount).toMatchObject({ value: 300, struck: 250 });
    expect(haru.action).toBe("add");
  });

  it("offers to update an entry the shopkeeper wrote over", () => {
    const ramesh = rowFor("Ramesh");
    expect(ramesh.saved).toMatchObject({ kind: "changed", amount: 120 });
    expect(ramesh.action).toBe("update");
  });

  it("skips rows saved before when the same page is photographed again", () => {
    const db = fresh();
    for (const row of readSamplePage(db, NOW).rows) {
      if (!row.matchCustomerId) continue;
      const entry = { customerId: row.matchCustomerId, amount: row.amount.value, items: row.items.value, date: row.date.value, source: "photo" as const, createdAt: NOW.toISOString() };
      if (row.saved && row.action === "update") Object.assign(db.entries.find((e) => e.id === row.saved!.entryId)!, entry);
      else db.entries.push({ id: `saved-${row.id}`, ...entry });
    }
    const again = readSamplePage(db, NOW).rows.filter((r) => r.matchCustomerId);
    expect(again.every((r) => r.saved?.kind === "duplicate" && r.action === "skip")).toBe(true);
  });

  it("gives new customers the shop's default language", () => {
    const db = fresh();
    db.shop.defaultCustomerLanguage = "hi";
    expect(rowFor("Haru Kaka", db).language).toBe("hi");
  });
});

describe("photo lines", () => {
  const line = { name: "Bapi", name_native: "বাপি", amount: 95, struck_amount: null, items: "Biscuits", confidence: { name: 0.9, amount: 0.9, date: 0.9, items: 0.9 } };

  it("keeps a valid date, and dates a line without one today, marked unsure", () => {
    const [dated, undated] = fromReadLines([{ ...line, date: "2026-10-19" }, { ...line, date: null }], NOW);
    expect(dated).toMatchObject({ date: "2026-10-19", confidence: { date: 0.9 } });
    expect(undated.date).toBe("2026-10-21");
    expect(undated.confidence.date).toBeLessThan(0.8);
  });

  it("doesn't accept a date in the future", () => {
    expect(fromReadLines([{ ...line, date: "2026-11-30" }], NOW)[0].date).toBe("2026-10-21");
  });

  it("keeps a crossed-out amount only when it differs", () => {
    expect(fromReadLines([{ ...line, date: "2026-10-19", struck_amount: 80 }], NOW)[0].struckAmount).toBe(80);
    expect(fromReadLines([{ ...line, date: "2026-10-19", struck_amount: 95 }], NOW)[0].struckAmount).toBeUndefined();
  });
});

describe("typed and spreadsheet lines", () => {
  it("are fully confident, keep a new customer's number and drop lines without an amount", () => {
    const lines = fromInputLines(
      [
        { name: " Bina Di ", amount: 80.4, items: "soap", date: "2099-01-01", phone: "9876543210" },
        { name: "Nobody", amount: 0, items: "", date: "" },
      ],
      NOW,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ name: "Bina Di", amount: 80, date: "2026-10-21", confidence: { name: 1, amount: 1, date: 1, items: 1 } });
    expect(toRows(fresh(), lines)[0]).toMatchObject({ phone: "9876543210", action: "add" });
  });
});
