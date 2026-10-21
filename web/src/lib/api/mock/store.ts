import { createSeed, DB_VERSION } from "./seed";
import type { MockDb } from "./types";

/**
 * MOCK ONLY. The demo database lives in localStorage, one copy per browser.
 * Writes go through `updateDb`, which saves and notifies listeners (including other tabs).
 */

const STORAGE_KEY = "udhaar-voice-demo";

let memory: MockDb | null = null;
const listeners = new Set<() => void>();
let storageListenerAttached = false;

function persist() {
  if (!memory || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Private windows or full storage: the demo still works for this session.
  }
}

function load(): MockDb {
  if (memory) return memory;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MockDb;
        if (parsed.version === DB_VERSION) {
          memory = parsed;
          return memory;
        }
      }
    } catch {
      // Corrupt or blocked storage: fall through to a fresh seed.
    }
  }
  memory = createSeed(new Date());
  persist();
  return memory;
}

function notify() {
  for (const listener of listeners) listener();
}

/** Read-only access. Callers must not mutate the result; use `updateDb` for writes. */
export function readDb(): MockDb {
  return load();
}

/** Applies a change, saves it and tells every subscriber. */
export function updateDb<T>(change: (db: MockDb) => T, options: { silent?: boolean } = {}): T {
  const db = load();
  const result = change(db);
  persist();
  if (!options.silent) notify();
  return result;
}

/** Saves and notifies after a change made directly on `readDb()` (used by the simulator's tick). */
export function commit() {
  persist();
  notify();
}

export function resetDb() {
  memory = createSeed(new Date());
  persist();
  notify();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!storageListenerAttached && typeof window !== "undefined") {
    storageListenerAttached = true;
    window.addEventListener("storage", (e) => {
      if (e.key !== STORAGE_KEY) return;
      memory = null; // another tab changed the data; reload on next read
      notify();
    });
  }
  return () => {
    listeners.delete(listener);
  };
}
