import { describe, expect, it } from "vitest";
import { parseCsv, rowsToLines, toDate } from "./khata-file";

const TODAY = "2026-10-29";

describe("CSV", () => {
  it("reads quoted fields with commas, quotes and new lines", () => {
    expect(parseCsv('name,items\r\n"Ramesh, Jr","rice ""5kg""\nand dal"\n\n')).toEqual([
      ["name", "items"],
      ["Ramesh, Jr", 'rice "5kg"\nand dal'],
    ]);
  });
});

describe("spreadsheet dates", () => {
  it("reads the common Indian forms", () => {
    expect(toDate("2026-10-5", TODAY)).toBe("2026-10-05");
    expect(toDate("28/10/2026", TODAY)).toBe("2026-10-28");
    expect(toDate("28-10-26", TODAY)).toBe("2026-10-28");
    expect(toDate("3.9", TODAY)).toBe("2026-09-03");
    expect(toDate(new Date(2026, 9, 1), TODAY)).toBe("2026-10-01");
  });
  it("gives up on anything else", () => {
    expect(toDate("yesterday", TODAY)).toBeUndefined();
    expect(toDate("10/13/2026", TODAY)).toBeUndefined();
  });
});

describe("spreadsheet rows", () => {
  it("finds columns by their header, in any order and language", () => {
    const { lines, skipped } = rowsToLines(
      [
        ["फोन", "तारीख", "नाम", "बाकी"],
        ["9876543210", "27/10/2026", "Ramesh", "₹1,250"],
        ["", "", "No amount", ""],
      ],
      TODAY,
    );
    expect(lines).toEqual([{ name: "Ramesh", amount: 1250, items: "", date: "2026-10-27", phone: "9876543210" }]);
    expect(skipped).toBe(1);
  });
  it("without a header, reads name, amount, items, date, phone", () => {
    expect(rowsToLines([["Haru Kaka", 300, "oil"]], TODAY).lines).toEqual([{ name: "Haru Kaka", amount: 300, items: "oil", date: TODAY, phone: undefined }]);
  });
});
