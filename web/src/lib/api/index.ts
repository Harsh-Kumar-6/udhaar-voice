import type { UdhaarApi } from "./contract";
import { startSimulator } from "./mock/engine";
import { mockApi } from "./mock";
import { subscribe } from "./mock/store";

/**
 * The one place that decides which backend the app talks to.
 * Today: the in-browser mock. Later: an HTTP client for our API routes (Supabase + Bolna),
 * at which point `startSimulator` disappears and `subscribeToDataChanges` listens to Supabase Realtime.
 */
export const api: UdhaarApi = mockApi;
export const subscribeToDataChanges = subscribe;
export { startSimulator };
