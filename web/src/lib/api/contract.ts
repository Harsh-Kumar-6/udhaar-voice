import type {
  Call,
  CallOutcome,
  Customer,
  CustomerStatus,
  Dispute,
  Language,
  LedgerEntry,
  Note,
  Payment,
  PaymentPromise,
  ReminderBatch,
  Shop,
} from "@/lib/domain/types";

/**
 * The API every screen talks to. Today it is implemented by the in-browser mock (lib/api/mock);
 * later by HTTP routes backed by Supabase and Bolna. Screens must only depend on this file.
 */

export type CustomerSummary = {
  customer: Customer;
  balance: number;
  status: CustomerStatus;
  lastCall?: { id: string; at: string; status: Call["status"]; outcome?: CallOutcome };
  lastReminderAt?: string;
  /** Earliest open promise. */
  nextPromise?: PaymentPromise;
  openDispute?: Dispute;
};

export type CustomerDetail = CustomerSummary & {
  entries: LedgerEntry[];
  payments: Payment[];
  promises: PaymentPromise[];
  disputes: Dispute[];
  notes: Note[];
  calls: Call[];
  /** What the agent will be told at the start of the next call. */
  memory: string;
  paysThrough?: Customer;
  paysFor: Customer[];
};

export type CallListItem = { call: Call; customer?: Customer };
export type CallDetail = CallListItem & { batch?: ReminderBatch };

export type BatchSummary = {
  batch: ReminderBatch;
  calls: CallListItem[];
  counts: { waiting: number; active: number; done: number };
  outcomes: Partial<Record<CallOutcome, number>>;
};

export type AttentionItem = {
  kind: "overdue" | "dispute" | "callback" | "wrong_number" | "refused" | "low_confidence";
  customer: Customer;
  text: string;
  callId?: string;
};

export type DashboardData = {
  totalPending: number;
  customersOwing: number;
  promisedThisWeek: { amount: number; count: number };
  collectedThisWeek: number;
  collectedToday: number;
  openDisputes: number;
  attention: AttentionItem[];
  upcoming: { promise: PaymentPromise; customer: Customer }[];
  recentCalls: CallListItem[];
  /** Last 7 days, oldest first. */
  byDay: { date: string; collected: number; promised: number }[];
  activeBatch?: BatchSummary;
};

export type DailyReport = {
  date: string;
  collected: number;
  payments: { customer: Customer; payment: Payment }[];
  promisesMade: { customer: Customer; promise: PaymentPromise }[];
  dueTomorrow: { customer: Customer; promise: PaymentPromise }[];
  disputesOpened: { customer: Customer; dispute: Dispute }[];
  callsMade: number;
  callsAnswered: number;
  productRequests: { customer: Customer; note: Note }[];
  /** The spoken summary the evening call reads out. */
  spoken: { bn: string; en: string };
};

export type GraphNodeType = "shop" | "customer" | "promise" | "dispute" | "note" | "product";
export type GraphNode = {
  id: string;
  type: GraphNodeType;
  label: string;
  /** Customer status, promise status, etc. Used for colour. */
  state?: string;
  /** Rupees for customers and promises; drives node size. */
  amount?: number;
  customerId?: string;
  detail?: string;
};
export type GraphEdgeKind = "owes" | "promised" | "disputed" | "said" | "asked_for" | "pays_through";
export type GraphEdge = { id: string; source: string; target: string; kind: GraphEdgeKind };
export type GraphData = { nodes: GraphNode[]; edges: GraphEdge[] };

export type KhataField<T> = { value: T; confidence: number };
export type KhataRow = {
  id: string;
  name: KhataField<string>;
  nameNative?: string;
  amount: KhataField<number>;
  date: KhataField<string>;
  items: KhataField<string>;
  /** Existing customer this row was matched to, if any. */
  matchCustomerId?: string;
  phone?: string;
  language: Language;
  include: boolean;
};
export type KhataExtraction = { scanId: string; source: "sample" | "upload"; rows: KhataRow[] };

export type AskAnswer = {
  question: string;
  answer: string;
  /** The tool the assistant called, shown to make the function-calling visible. */
  tool: string;
  items?: { label: string; value?: string; href?: string }[];
  action?: { label: string; href: string };
};

export type ScheduleInput = {
  customerIds: string[];
  /** ISO timestamp, or "now". */
  at: string;
  language: "auto" | Language;
  bypassHours: boolean;
};
export type ScheduleResult = {
  batch?: ReminderBatch;
  skipped: { customer: Customer; reason: string }[];
  /** Set when the requested time was outside calling hours and the batch was moved. */
  movedTo?: string;
};

export type EligibleCustomer = CustomerSummary & {
  eligible: boolean;
  /** Why the customer cannot be called right now. */
  reason?: string;
  /** Something the shopkeeper should know before calling (e.g. an open dispute). */
  note?: string;
};

export type DemoCallResult =
  | { allowed: true; language: Language; turns: Call["transcript"]; extraction: NonNullable<Call["extraction"]> }
  | { allowed: false; reason: string };

export interface UdhaarApi {
  getShop(): Promise<Shop>;
  updateShop(patch: Partial<Omit<Shop, "id">>): Promise<Shop>;

  listCustomers(): Promise<CustomerSummary[]>;
  listReminderCandidates(): Promise<EligibleCustomer[]>;
  getCustomer(id: string): Promise<CustomerDetail | null>;
  updateCustomer(id: string, patch: Partial<Pick<Customer, "name" | "nameNative" | "phone" | "language" | "optedOut">>): Promise<Customer>;
  addEntry(input: { customerId: string; amount: number; items: string; date: string; source: LedgerEntry["source"] }): Promise<LedgerEntry>;
  recordPayment(input: { customerId: string; amount: number; method: Payment["method"]; date: string }): Promise<Payment>;
  resolveDispute(id: string): Promise<void>;

  listCalls(): Promise<CallListItem[]>;
  getCall(id: string): Promise<CallDetail | null>;
  scheduleReminders(input: ScheduleInput): Promise<ScheduleResult>;
  listBatches(): Promise<BatchSummary[]>;
  cancelBatch(id: string): Promise<void>;

  extractKhata(input: { source: "sample" | "upload"; fileName?: string }): Promise<KhataExtraction>;
  saveKhata(rows: KhataRow[]): Promise<{ entries: number; newCustomers: number }>;

  ask(question: string): Promise<AskAnswer>;
  getDashboard(): Promise<DashboardData>;
  getDailyReport(): Promise<DailyReport>;
  sendReportCall(): Promise<Call>;
  getGraph(): Promise<GraphData>;

  /** Public demo page: a reminder call to the visitor, playing a customer of the demo shop. */
  startDemoCall(input: { phone: string; language: Language; name?: string }): Promise<DemoCallResult>;

  resetDemo(): Promise<void>;
}
