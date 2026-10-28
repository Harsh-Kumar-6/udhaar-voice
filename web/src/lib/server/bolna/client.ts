/** Bolna's REST API (https://www.bolna.ai/docs/api-reference). Server only: it carries our API key. */

const BASE = "https://api.bolna.ai";

function apiKey(): string {
  const key = process.env.BOLNA_API_KEY;
  if (!key) throw new Error("BOLNA_API_KEY is not set (web/.env.local).");
  return key;
}

async function request<T>(method: "GET" | "POST" | "PUT" | "PATCH", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { authorization: `Bearer ${apiKey()}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text.slice(0, 300) };
  }
  if (!res.ok) {
    const message = (json as { message?: string } | null)?.message ?? JSON.stringify(json) ?? res.statusText;
    throw new BolnaError(res.status, `Bolna ${method} ${path} failed (${res.status}): ${message}`);
  }
  return json as T;
}

export class BolnaError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type MakeCallInput = {
  agent_id: string;
  recipient_phone_number: string;
  user_data?: Record<string, string | number | boolean>;
  /** Starts a multilingual agent in this language. Bolna answers 400 if the agent doesn't have it. */
  agent_data?: { language: string };
  bypass_call_guardrails?: boolean;
};

export const makeCall = (input: MakeCallInput) =>
  request<{ message: string; status: string; execution_id: string }>("POST", "/call", input);

/** Bolna's execution statuses. */
export type ExecutionStatus =
  | "scheduled"
  | "queued"
  | "rescheduled"
  | "initiated"
  | "ringing"
  | "in-progress"
  | "call-disconnected"
  | "completed"
  | "balance-low"
  | "busy"
  | "no-answer"
  | "canceled"
  | "failed"
  | "stopped"
  | "error";

/** The parts of an execution we read. */
export type Execution = {
  id: string;
  agent_id?: string;
  status: ExecutionStatus;
  conversation_duration?: number | null;
  /** In cents. */
  total_cost?: number | null;
  transcript?: string | null;
  summary?: string | null;
  extracted_data?: unknown;
  answered_by_voice_mail?: boolean | null;
  error_message?: string | null;
  termination_reason?: string | null;
  created_at?: string;
  updated_at?: string;
  telephony_data?: {
    duration?: string | number | null;
    to_number?: string | null;
    recording_url?: string | null;
    hangup_reason?: string | null;
  } | null;
};

export const getExecution = (executionId: string) => request<Execution>("GET", `/executions/${encodeURIComponent(executionId)}`);

export const patchAgent = (agentId: string, body: unknown) => request<unknown>("PATCH", `/v2/agent/${encodeURIComponent(agentId)}`, body);

export type Disposition = { id: string; name: string; agent_ids?: string[] };

export const listDispositions = () => request<Disposition[] | { data?: Disposition[]; dispositions?: Disposition[] }>("GET", "/dispositions/");
export const createDisposition = (body: unknown) => request<Disposition>("POST", "/dispositions/", body);
export const updateDisposition = (id: string, body: unknown) => request<Disposition>("PUT", `/dispositions/${encodeURIComponent(id)}`, body);
