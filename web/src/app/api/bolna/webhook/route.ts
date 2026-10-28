import "@/lib/server/timezone";
import { createHash, timingSafeEqual } from "node:crypto";
import { getExecution, type Execution } from "@/lib/server/bolna/client";
import { cronSecret } from "@/lib/server/bolna/config";
import { applyExecution } from "@/lib/server/call-results";
import { adminClient } from "@/lib/server/supabase";

export const maxDuration = 60;

/**
 * Bolna posts here whenever a call's status changes (the URL carries our secret token). Each body is
 * stored first; then the call is read back from Bolna's API, so only what Bolna itself reports is used.
 */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!secretMatches(token)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const raw = await request.text();
  let payload: Partial<Execution> & { execution_id?: string };
  try {
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const executionId = payload.id ?? payload.execution_id;
  const admin = adminClient();
  const hash = createHash("sha256").update(raw).digest("hex");
  const stored = await admin.from("bolna_webhooks").insert({ execution_id: executionId ?? null, payload_hash: hash, payload }).select("id").maybeSingle<{ id: number }>();
  // The same body again is a retry of one already handled.
  if (stored.error?.code === "23505") return Response.json({ ok: true, duplicate: true });
  if (!executionId) return Response.json({ ok: true, ignored: "no execution id" });

  let error: string | null = null;
  try {
    const execution = await getExecution(executionId).catch(() => payload as Execution);
    await applyExecution(admin, { ...execution, id: executionId }, new Date());
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    console.error("[bolna webhook]", executionId, error);
  }
  if (stored.data) await admin.from("bolna_webhooks").update({ processed_at: new Date().toISOString(), error }).eq("id", stored.data.id);
  return Response.json({ ok: !error });
}

function secretMatches(token: string): boolean {
  const secret = cronSecret();
  if (!secret || token.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
}
