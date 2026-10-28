import type { SupabaseClient } from "@supabase/supabase-js";
import type { CallStatus, Extraction } from "@/lib/domain/types";
import type { Execution } from "./bolna/client";
import { isFinal, parseTranscript, planCallResult, toCallStatus, toExtraction } from "./bolna/results";
import { toDispute, toNote, toPromises, type DisputeRow, type NoteRow, type PromiseRow } from "./data";
import { check, maybe } from "./supabase";

/**
 * Applies what Bolna reports about a call: status, timings, cost, transcript, and once it ends, what
 * the customer said (promises, disputes, notes, opt-out). Safe to run any number of times per update.
 */

type CallRowLite = {
  id: string;
  shop_id: string;
  kind: "reminder" | "report";
  customer_id: string | null;
  status: CallStatus;
  started_at: string | null;
  answered_at: string | null;
  extraction: Extraction | null;
};

export async function applyExecution(admin: SupabaseClient, e: Execution, now: Date): Promise<"applied" | "unknown_call" | "unchanged"> {
  const call = maybe(
    await admin
      .from("calls")
      .select("id, shop_id, kind, customer_id, status, started_at, answered_at, extraction")
      .eq("bolna_execution_id", e.id)
      .maybeSingle<CallRowLite>(),
  );
  if (!call) return "unknown_call";
  // A finished call keeps its result; a late or repeated update can't undo it.
  if (isFinal(call.status) && call.extraction) return "unchanged";

  const status = toCallStatus(e);
  const at = now.toISOString();
  const final = isFinal(status);
  const duration = e.conversation_duration ?? Number(e.telephony_data?.duration ?? 0);
  const update: Record<string, unknown> = { status };
  if (!call.started_at) update.started_at = e.created_at ?? at;
  if (status === "in_progress" && !call.answered_at) update.answered_at = at;
  if (final) {
    update.ended_at = e.updated_at ?? at;
    update.duration_sec = Math.max(0, Math.round(duration || 0));
    if (typeof e.total_cost === "number") update.cost_usd = Math.round(e.total_cost) / 100;
    if (e.telephony_data?.recording_url) update.recording_url = e.telephony_data.recording_url;
    update.transcript = parseTranscript(e.transcript, call.kind, duration || 0);
    if (status === "failed") update.error = e.error_message ?? e.termination_reason ?? e.telephony_data?.hangup_reason ?? "The call failed.";
  }
  check(await admin.from("calls").update(update).eq("id", call.id).select("id"));
  if (status !== call.status) {
    check(
      await admin.from("call_events").insert({ call_id: call.id, shop_id: call.shop_id, status, detail: eventDetail(status, e), at }).select("id"),
    );
  }
  if (!final) return "applied";

  const extraction: Extraction =
    call.kind === "report"
      ? { outcome: status === "completed" ? "report_delivered" : "no_answer", promises: [], notes: [], sentiment: "neutral", confidence: 1, summary: status === "completed" ? "Evening summary delivered." : "The shopkeeper didn't answer." }
      : toExtraction(e, status);
  // Only the first update to claim the result writes it to the khata.
  const claimed = check(
    await admin.from("calls").update({ extraction, outcome: extraction.outcome }).eq("id", call.id).is("extraction", null).select("id"),
  );
  if (claimed.length === 0 || call.kind !== "reminder" || !call.customer_id) return "applied";
  await writeToKhata(admin, { id: call.id, shopId: call.shop_id, customerId: call.customer_id }, extraction, now);
  return "applied";
}

function eventDetail(status: CallStatus, e: Execution): string | undefined {
  if (status === "in_progress") return "Answered";
  if (status === "completed") return "Call ended. Transcript and results received from Bolna.";
  if (status === "no_answer") return e.answered_by_voice_mail ? "Reached voicemail" : "No answer";
  if (status === "busy") return "The line was busy";
  if (status === "failed") return e.error_message ?? e.termination_reason ?? undefined;
  return undefined;
}

async function writeToKhata(admin: SupabaseClient, call: { id: string; shopId: string; customerId: string }, ex: Extraction, now: Date) {
  const [promises, disputes, notes] = await Promise.all([
    admin.from("promises").select("*").eq("customer_id", call.customerId).returns<PromiseRow[]>(),
    admin.from("disputes").select("*").eq("customer_id", call.customerId).returns<DisputeRow[]>(),
    admin.from("notes").select("*").eq("customer_id", call.customerId).returns<NoteRow[]>(),
  ]);
  const plan = planCallResult({ id: call.id, customerId: call.customerId }, ex, {
    promises: toPromises(check(promises), now),
    disputes: check(disputes).map(toDispute),
    notes: check(notes).map(toNote),
  });
  const own = { shop_id: call.shopId, customer_id: call.customerId, call_id: call.id };
  if (plan.promises.length) check(await admin.from("promises").insert(plan.promises.map((p) => ({ ...own, amount: p.amount, due_date: p.dueDate }))).select("id"));
  if (plan.dispute) check(await admin.from("disputes").insert({ ...own, kind: plan.dispute.kind, reason: plan.dispute.reason, amount: plan.dispute.amount ?? null }).select("id"));
  if (plan.notes.length) check(await admin.from("notes").insert(plan.notes.map((n) => ({ ...own, kind: n.kind, text: n.text, product: n.product ?? null }))).select("id"));
  if (plan.optOut) check(await admin.from("customers").update({ opted_out_at: now.toISOString() }).eq("id", call.customerId).is("opted_out_at", null).select("id"));
}
