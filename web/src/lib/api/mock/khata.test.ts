import { beforeEach, describe, expect, it } from "vitest";
import { mockApi } from "./index";
import { readDb, resetDb } from "./store";

// These run against the mock API and its in-memory store (no localStorage under Node).
beforeEach(() => resetDb());

const scanSample = () => mockApi.extractKhata({ source: "sample" });
const rowFor = async (name: string) => (await scanSample()).rows.find((r) => r.name.value === name)!;

describe("snap khata", () => {
  it("keeps what was crossed out next to the new value", async () => {
    const haru = await rowFor("Haru Kaka");
    expect(haru.amount).toMatchObject({ value: 300, struck: 250 });
    expect(haru.action).toBe("add");
  });

  it("offers to update an entry the shopkeeper wrote over", async () => {
    const ramesh = await rowFor("Ramesh");
    expect(ramesh.saved).toMatchObject({ kind: "changed", amount: 120 });
    expect(ramesh.action).toBe("update");
  });

  it("skips rows saved before when the same page is photographed again", async () => {
    const first = await scanSample();
    await mockApi.saveKhata({ scanId: first.scanId, source: "sample", rows: first.rows });
    const again = await scanSample();
    expect(again.rows.filter((r) => r.matchCustomerId).every((r) => r.saved?.kind === "duplicate" && r.action === "skip")).toBe(true);
  });

  it("undoes a whole import in one go", async () => {
    const before = structuredClone(readDb());
    const scan = await scanSample();
    const saved = await mockApi.saveKhata({ scanId: scan.scanId, source: "sample", rows: scan.rows });
    expect(saved).toMatchObject({ updated: 1, newCustomers: 3 });
    expect((await mockApi.listKhataImports())[0]?.import.id).toBe(saved.importId);

    const undone = await mockApi.undoKhataImport(saved.importId);
    expect(undone).toEqual({ removed: saved.added, restored: 1, customersRemoved: 3 });
    expect(readDb().entries).toEqual(before.entries);
    expect(readDb().customers).toEqual(before.customers);
    expect(await mockApi.listKhataImports()).toEqual([]);
    await expect(mockApi.undoKhataImport(saved.importId)).rejects.toThrow(/already undone/);
  });
});
