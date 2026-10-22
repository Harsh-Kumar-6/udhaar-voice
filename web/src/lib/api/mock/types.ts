import type {
  Call,
  Customer,
  Dispute,
  Extraction,
  KhataImport,
  LedgerEntry,
  Note,
  Payment,
  PaymentPromise,
  ReminderBatch,
  Shop,
  Turn,
} from "@/lib/domain/types";
import type { Persona } from "./scripts";

/** MOCK ONLY. How the simulator will play out a call that has been scheduled. */
export type SimPlan = {
  answered: boolean;
  turns: Turn[];
  extraction: Extraction;
  /** Real-world length of the conversation, used for duration and cost. */
  talkSeconds: number;
};

/** MOCK ONLY. The whole demo database, stored in localStorage. */
export type MockDb = {
  version: number;
  seededAt: string;
  shop: Shop;
  customers: Customer[];
  entries: LedgerEntry[];
  payments: Payment[];
  promises: PaymentPromise[];
  disputes: Dispute[];
  notes: Note[];
  calls: Call[];
  batches: ReminderBatch[];
  imports: KhataImport[];
  /** How each sample customer behaves on a call. */
  personas: Record<string, Persona>;
  /** Pre-generated outcomes for calls that have not finished yet. */
  plans: Record<string, SimPlan>;
  demo: {
    /** Simulator speed multiplier (2 = calls play twice as fast as real time). */
    speed: number;
    /** Phone numbers that used the public demo page, with the date, to rate-limit it. */
    tryCalls: Record<string, string>;
  };
};
