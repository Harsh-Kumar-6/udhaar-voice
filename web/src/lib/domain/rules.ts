import type {
  CallingHours,
  CustomerStatus,
  Dispute,
  LedgerEntry,
  Note,
  Payment,
  PaymentPromise,
} from "./types";

/**
 * Business rules. Pure functions only: no I/O, no clock reads (callers pass `now`),
 * so the same code runs in the browser today and on the server later.
 */

/** Rupees still owed. Never negative: overpayments count as fully paid. */
export function balanceOf(entries: Pick<LedgerEntry, "amount">[], payments: Pick<Payment, "amount">[]): number {
  const owed = entries.reduce((sum, e) => sum + e.amount, 0);
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  return Math.max(0, owed - paid);
}

/** Local calendar date as YYYY-MM-DD. */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** A promise is broken once its due date has passed while it is still open. */
export function isPromiseBroken(p: Pick<PaymentPromise, "status" | "dueDate">, now: Date): boolean {
  if (p.status === "broken") return true;
  return p.status === "open" && p.dueDate < toDateKey(now);
}

/**
 * The single status chip for a customer. Precedence matters:
 * nothing owed beats everything; an opt-out stops calls; an open dispute must be resolved before
 * chasing money; then overdue promises, upcoming promises, and plain dues.
 */
export function customerStatus(
  input: {
    balance: number;
    optedOut: boolean;
    promises: Pick<PaymentPromise, "status" | "dueDate">[];
    disputes: Pick<Dispute, "status">[];
  },
  now: Date,
): CustomerStatus {
  if (input.balance <= 0) return "paid";
  if (input.optedOut) return "opted_out";
  if (input.disputes.some((d) => d.status === "open")) return "disputed";
  const open = input.promises.filter((p) => p.status === "open");
  if (open.some((p) => isPromiseBroken(p, now))) return "overdue";
  if (open.length > 0) return "promised";
  return "due";
}

/** True if `at` falls inside the shop's calling window (start inclusive, end exclusive). */
export function isWithinCallingHours(at: Date, hours: CallingHours): boolean {
  const h = at.getHours() + at.getMinutes() / 60;
  return h >= hours.start && h < hours.end;
}

/** The earliest moment at or after `at` that is inside calling hours. */
export function nextAllowedTime(at: Date, hours: CallingHours): Date {
  if (isWithinCallingHours(at, hours)) return at;
  const next = new Date(at);
  if (at.getHours() >= hours.end) next.setDate(next.getDate() + 1);
  next.setHours(hours.start, 0, 0, 0);
  return next;
}

/** Customers are reminded at most once every `gapDays` days. */
export function canRemind(lastReminderAt: Date | undefined, gapDays: number, now: Date): boolean {
  if (!lastReminderAt) return true;
  const elapsedMs = now.getTime() - lastReminderAt.getTime();
  return elapsedMs >= gapDays * 24 * 60 * 60 * 1000;
}

/** When the customer becomes eligible for the next reminder. */
export function nextReminderDate(lastReminderAt: Date, gapDays: number): Date {
  return new Date(lastReminderAt.getTime() + gapDays * 24 * 60 * 60 * 1000);
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** ₹1,240 — Indian digit grouping (₹1,24,000 for lakhs). */
export function formatINR(rupees: number): string {
  return inr.format(rupees);
}

/** +91 ••••• •0012 — phone numbers are never shown in full in screenshots or demos. */
export function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  const cc = digits.length > 10 ? `+${digits.slice(0, digits.length - 10)} ` : "";
  return `${cc}••••• •${last4.slice(-4)}`;
}

/** Accepts 10-digit Indian mobiles with or without +91 / 0; returns E.164 or null. */
export function normalizeIndianMobile(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  return /^[6-9]\d{9}$/.test(local) ? `+91${local}` : null;
}

/** Bolna's confidence labels. */
export function confidenceLabel(c: number): "High" | "Medium" | "Low" {
  if (c >= 0.8) return "High";
  if (c >= 0.5) return "Medium";
  return "Low";
}

/** UPI deep link that any UPI app understands. */
export function upiLink(input: { upiId: string; payeeName: string; amount: number; note: string }): string {
  const params = new URLSearchParams({ pa: input.upiId, pn: input.payeeName, am: String(input.amount), cu: "INR", tn: input.note });
  return `upi://pay?${params.toString()}`;
}

/** WhatsApp share link with a prefilled message. Works without any API. */
export function whatsappShareLink(e164: string, message: string): string {
  return `https://wa.me/${e164.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

/**
 * The 2–3 line memory passed into the next reminder call as a variable, so the agent can say
 * "last week you said Friday". Built from history; the real system will let an LLM write it.
 */
export function buildMemory(
  input: {
    promises: PaymentPromise[];
    disputes: Dispute[];
    notes: Note[];
  },
  now: Date,
  fmtDate: (isoDate: string) => string,
): string {
  const lines: string[] = [];
  const byNewest = <T extends { createdAt: string }>(xs: T[]) => [...xs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const promises = byNewest(input.promises);
  const latest = promises[0];
  if (latest) {
    const broken = promises.filter((p) => isPromiseBroken(p, now)).length;
    if (latest.status === "open" && !isPromiseBroken(latest, now)) {
      lines.push(`Promised ${formatINR(latest.amount)} by ${fmtDate(latest.dueDate)}.`);
    } else if (isPromiseBroken(latest, now)) {
      lines.push(`Missed the promise of ${formatINR(latest.amount)} due ${fmtDate(latest.dueDate)}.`);
    } else if (latest.status === "kept") {
      lines.push(`Kept the last promise (${formatINR(latest.amount)}).`);
    }
    if (broken >= 2) lines.push(`Has missed ${broken} promises; ask for a firm date.`);
  }

  const openDispute = byNewest(input.disputes).find((d) => d.status === "open");
  if (openDispute) lines.push(`Open dispute: ${openDispute.reason}. Do not ask for the disputed amount.`);

  const note = byNewest(input.notes).find((n) => n.kind === "life_event" || n.kind === "request" || n.kind === "relationship");
  if (note) lines.push(note.text);

  return lines.slice(0, 3).join(" ") || "No previous calls.";
}
