/** Which Bolna agents make which calls, and where Bolna sends call updates. */

export function bolnaConfigured(): boolean {
  return Boolean(process.env.BOLNA_API_KEY && process.env.BOLNA_REMINDER_AGENT_ID && process.env.BOLNA_REPORT_AGENT_ID);
}

export const agentIds = () => ({
  reminder: process.env.BOLNA_REMINDER_AGENT_ID ?? "",
  report: process.env.BOLNA_REPORT_AGENT_ID ?? "",
});

/** The public site, e.g. https://udhaar-voice.vercel.app. Bolna can only reach a public URL. */
export const appUrl = () => (process.env.APP_URL ?? "").replace(/\/+$/, "");

/** Shared by the scheduler (Supabase cron) and Bolna's webhook, which can't send headers of our own. */
export const cronSecret = () => process.env.CRON_SECRET ?? "";

export const webhookUrl = () => `${appUrl()}/api/bolna/webhook?token=${encodeURIComponent(cronSecret())}`;

/** The /try page dials for real only when this is on: Bolna trial accounts can only call verified numbers. */
export const tryCallsReal = () => process.env.TRY_REAL_CALLS === "true";
