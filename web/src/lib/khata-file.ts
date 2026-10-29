import type { KhataLineInput } from "@/lib/api/contract";

/**
 * Turns a spreadsheet (CSV or Excel rows) into khata lines. Columns are found by their header in
 * English, Hindi or Bengali; without a header row, the order is name, amount, items, date, phone.
 */

type Field = keyof KhataLineInput;

const HEADERS: Record<Exclude<Field, "nameNative">, RegExp> = {
  name: /^(name|customer|customer name|naam|नाम|ग्राहक|নাম|খদ্দের)$/i,
  amount: /^(amount|amt|rupees|rs\.?|₹|due|dues|baki|baaki|बाकी|रकम|টাকা|বাকি)$/i,
  items: /^(items?|details?|goods|saman|सामान|माल|জিনিস|মাল)$/i,
  date: /^(date|day|tarikh|तारीख|তারিখ)$/i,
  phone: /^(phone|mobile|number|phone number|फ़ोन|फोन|मोबाइल|ফোন|মোবাইল)$/i,
};

const DEFAULT_ORDER: Exclude<Field, "nameNative">[] = ["name", "amount", "items", "date", "phone"];

/** Parses CSV text: quoted fields, commas and new lines inside quotes, and "" for a quote. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A cell as a YYYY-MM-DD date: Excel dates, 2026-10-28, 28/10/2026, 28-10-26 or 28/10 (this year). */
export function toDate(cell: unknown, today: string): string | undefined {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) return `${cell.getFullYear()}-${pad(cell.getMonth() + 1)}-${pad(cell.getDate())}`;
  const s = String(cell ?? "").trim();
  if (!s) return undefined;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(s);
  if (m) {
    const year = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : today.slice(0, 4);
    const day = +m[1];
    const month = +m[2];
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return `${year}-${pad(month)}-${pad(day)}`;
  }
  return undefined;
}

const toAmount = (cell: unknown) => {
  const n = typeof cell === "number" ? cell : Number(String(cell ?? "").replace(/[₹,\s/-]+$/g, "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
};

export type FileResult = { lines: KhataLineInput[]; skipped: number };

/** Rows (first may be headers) as khata lines. Rows without a name or a positive amount are skipped. */
export function rowsToLines(rows: unknown[][], today: string): FileResult {
  if (rows.length === 0) return { lines: [], skipped: 0 };
  const header = rows[0].map((c) => String(c ?? "").trim());
  const columns = new Map<Field, number>();
  header.forEach((h, i) => {
    for (const [field, re] of Object.entries(HEADERS) as [Field, RegExp][]) if (re.test(h) && !columns.has(field)) columns.set(field, i);
  });
  const hasHeader = columns.has("name") && columns.has("amount");
  if (!hasHeader) DEFAULT_ORDER.forEach((f, i) => columns.set(f, i));
  const lines: KhataLineInput[] = [];
  let skipped = 0;
  for (const row of hasHeader ? rows.slice(1) : rows) {
    const cell = (f: Field) => (columns.has(f) ? row[columns.get(f)!] : undefined);
    const name = String(cell("name") ?? "").trim();
    const amount = toAmount(cell("amount"));
    if (!name || !amount) {
      skipped++;
      continue;
    }
    const phone = String(cell("phone") ?? "").trim();
    lines.push({ name, amount, items: String(cell("items") ?? "").trim(), date: toDate(cell("date"), today) ?? today, phone: phone || undefined });
  }
  return { lines, skipped };
}
