/**
 * Writes Udhaar Voice's prompts, greeting, webhook and extractions onto the two Bolna agents
 * (BOLNA_REMINDER_AGENT_ID and BOLNA_REPORT_AGENT_ID). Voices and languages stay as set on Bolna.
 * Safe to run again after a prompt change: existing extractions are updated, not duplicated.
 *
 * Runs as `npm run bolna:setup`.
 */
import { createDisposition, listDispositions, patchAgent, updateDisposition, type Disposition } from "../src/lib/server/bolna/client";
import { agentIds, appUrl, cronSecret, webhookUrl } from "../src/lib/server/bolna/config";
import { extractionDefinitions, REMINDER_PROMPT, REMINDER_WELCOME, REPORT_PROMPT, REPORT_WELCOME } from "../src/lib/server/bolna/prompts";

async function main() {
  const { reminder, report } = agentIds();
  const missing = [
    ["BOLNA_API_KEY", process.env.BOLNA_API_KEY],
    ["BOLNA_REMINDER_AGENT_ID", reminder],
    ["BOLNA_REPORT_AGENT_ID", report],
    ["APP_URL", appUrl()],
    ["CRON_SECRET", cronSecret()],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) throw new Error(`Set ${missing.join(", ")} in web/.env.local first.`);

  await patchAgent(reminder, {
    agent_config: { agent_name: "Udhaar Voice · Reminder", agent_welcome_message: REMINDER_WELCOME, webhook_url: webhookUrl(), call_summary_enabled: true },
    agent_prompts: { task_1: { system_prompt: REMINDER_PROMPT } },
  });
  console.log("Reminder agent updated.");

  await patchAgent(report, {
    agent_config: { agent_name: "Udhaar Voice · Evening summary", agent_welcome_message: REPORT_WELCOME, webhook_url: webhookUrl(), call_summary_enabled: false },
    agent_prompts: { task_1: { system_prompt: REPORT_PROMPT } },
  });
  console.log("Evening summary agent updated.");

  const listed = await listDispositions();
  const existing: Disposition[] = Array.isArray(listed) ? listed : (listed.data ?? listed.dispositions ?? []);
  for (const definition of extractionDefinitions(reminder)) {
    const found = existing.find((d) => d.name === definition.name);
    if (found) {
      await updateDisposition(found.id, { ...definition, agent_ids: [...new Set([...(found.agent_ids ?? []), reminder])] });
      console.log(`Extraction updated: ${definition.name}`);
    } else {
      await createDisposition(definition);
      console.log(`Extraction created: ${definition.name}`);
    }
  }
  console.log(`Done. Bolna sends call updates to ${appUrl()}/api/bolna/webhook.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
