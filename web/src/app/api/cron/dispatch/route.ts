import "@/lib/server/timezone";
import { timingSafeEqual } from "node:crypto";
import { cronSecret } from "@/lib/server/bolna/config";
import { runDispatcher } from "@/lib/server/dispatcher";

export const maxDuration = 60;

/** Called every minute by Supabase cron (0005_scheduler.sql) with `Authorization: Bearer <CRON_SECRET>`. */
export async function POST(request: Request) {
  const secret = cronSecret();
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    return Response.json(await runDispatcher());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[dispatcher]", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
