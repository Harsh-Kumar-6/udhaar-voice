import "@/lib/server/timezone";
import { after } from "next/server";
import type { UdhaarApi } from "@/lib/api/contract";
import { NotSignedIn, serverApi } from "@/lib/server/api";
import { nudgeDispatcher } from "@/lib/server/dispatcher";
import { userClient } from "@/lib/server/supabase";

export const maxDuration = 60;

/** Screens that watch calls also keep the dispatcher moving between its once-a-minute runs. */
const WATCHING_CALLS = new Set<keyof UdhaarApi>(["listCalls", "getCall", "listBatches", "getDashboard"]);

/**
 * One endpoint per contract method: POST /api/udhaar/<method> with `{ args: [...] }`, or form data
 * for `transcribe` and photo uploads to `extractKhata`. Answers `{ data }`, or `{ error }` with a message the shopkeeper can read.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/udhaar/[method]">) {
  const { method } = await ctx.params;
  if (!Object.hasOwn(serverApi, method)) return Response.json({ error: "Unknown method" }, { status: 404 });
  const name = method as keyof UdhaarApi;

  let args: unknown[];
  try {
    const multipart = (request.headers.get("content-type") ?? "").startsWith("multipart/form-data");
    if (name === "transcribe") {
      const form = await request.formData();
      args = [form.get("audio"), form.get("provider") ?? undefined];
    } else if (name === "extractKhata" && multipart) {
      const form = await request.formData();
      args = [{ source: form.get("source"), photo: form.get("photo"), scanId: form.get("scanId") ?? undefined, provider: form.get("provider") ?? undefined }];
    } else {
      const body = (await request.json()) as { args?: unknown };
      args = Array.isArray(body.args) ? body.args : [];
    }
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  try {
    // Methods that need a signed-in shopkeeper check the session themselves and throw NotSignedIn.
    const sb = await userClient();
    const handler = serverApi[name] as (c: { sb: typeof sb; now: Date; ip?: string }, ...a: unknown[]) => Promise<unknown>;
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined;
    const data = await handler({ sb, now: new Date(), ip }, ...args);
    if (WATCHING_CALLS.has(name)) after(nudgeDispatcher);
    return Response.json({ data: data ?? null });
  } catch (err) {
    if (err instanceof NotSignedIn) return Response.json({ error: err.message }, { status: 401 });
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api] ${name}:`, message);
    return Response.json({ error: message }, { status: 400 });
  }
}
