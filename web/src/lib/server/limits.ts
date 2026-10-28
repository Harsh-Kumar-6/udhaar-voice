import { adminClient } from "./supabase";

/**
 * Slows down password guessing: after too many failed sign-ins for one phone or email, or from one
 * network address, sign-in pauses for a while. Kept in sign_in_attempts (0006); until that migration
 * runs, nothing is limited.
 */

export const WINDOW_MINUTES = 15;

/** Failed attempts allowed per key within the window. */
export const LIMITS = { account: 5, network: 20, signUp: 10 } as const;

export const TOO_MANY = `Too many tries. Wait ${WINDOW_MINUTES} minutes and try again.`;

export type AttemptKey = { key: string; max: number };

/** The keys a sign-in attempt counts against. The network address is shared by everyone behind it. */
export function signInKeys(identifier: string, ip: string | undefined): AttemptKey[] {
  const keys: AttemptKey[] = [{ key: `account:${identifier.trim().toLowerCase()}`, max: LIMITS.account }];
  if (ip) keys.push({ key: `ip:${ip}`, max: LIMITS.network });
  return keys;
}

export const signUpKeys = (ip: string | undefined): AttemptKey[] => (ip ? [{ key: `signup:${ip}`, max: LIMITS.signUp }] : []);

/** True when any key has reached its limit. Pure. */
export function isLimited(counts: Map<string, number>, keys: AttemptKey[]): boolean {
  return keys.some((k) => (counts.get(k.key) ?? 0) >= k.max);
}

const missingTable = (code?: string) => code === "PGRST205" || code === "42P01";

export async function limited(keys: AttemptKey[], now: Date): Promise<boolean> {
  if (keys.length === 0) return false;
  const since = new Date(now.getTime() - WINDOW_MINUTES * 60_000).toISOString();
  const counts = new Map<string, number>();
  for (const { key } of keys) {
    const { count, error } = await adminClient().from("sign_in_attempts").select("id", { count: "exact", head: true }).eq("key", key).gte("at", since);
    if (error) {
      if (!missingTable(error.code)) console.error("[limits]", error.message);
      return false;
    }
    counts.set(key, count ?? 0);
  }
  return isLimited(counts, keys);
}

export async function recordFailure(keys: AttemptKey[]): Promise<void> {
  if (keys.length === 0) return;
  const { error } = await adminClient().from("sign_in_attempts").insert(keys.map(({ key }) => ({ key })));
  if (error && !missingTable(error.code)) console.error("[limits]", error.message);
}

/** A successful sign-in clears that account's count; the network's stays. */
export async function clearAccount(keys: AttemptKey[]): Promise<void> {
  const account = keys.find((k) => k.key.startsWith("account:"));
  if (!account) return;
  const { error } = await adminClient().from("sign_in_attempts").delete().eq("key", account.key);
  if (error && !missingTable(error.code)) console.error("[limits]", error.message);
}
