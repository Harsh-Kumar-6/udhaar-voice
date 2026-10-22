import { setDefaultOptions } from "date-fns";
import { bn as bnDates, enIN, hi as hiDates } from "date-fns/locale";
import { useSyncExternalStore } from "react";
import type { Language } from "@/lib/domain/types";
import { bn } from "./bn";
import { en } from "./en";
import { hi } from "./hi";

/**
 * All shopkeeper-facing text, in English, Bengali and Hindi. The app language is a per-device
 * choice (Settings), stored in this browser so it applies before sign-in too. English is the default.
 * Month and day names follow it through date-fns; digits stay 0–9, as on most Indian apps.
 */
export type Dictionary = typeof en;

const DICTIONARIES: Record<Language, Dictionary> = { en, bn, hi };
const DATE_LOCALES = { en: enIN, bn: bnDates, hi: hiDates };
const STORAGE_KEY = "udhaar-voice-language";
const listeners = new Set<() => void>();

function stored(): Language {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === "bn" || value === "hi" || value === "en") return value;
  } catch {
    // Blocked storage: fall back to English.
  }
  return "en";
}

function apply(language: Language) {
  setDefaultOptions({ locale: DATE_LOCALES[language] });
  document.documentElement.lang = language;
}

// Screens render their data (and its dates) only in the browser, after loading, so the date
// locale can be set as soon as this module loads.
if (typeof window !== "undefined") apply(stored());

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    apply(stored());
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAppLanguage(): Language {
  return useSyncExternalStore(subscribe, stored, () => "en");
}

export function setAppLanguage(language: Language) {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Blocked storage (some private windows): the app stays in English.
  }
  apply(language);
  for (const listener of listeners) listener();
}

export function useT(): Dictionary {
  return DICTIONARIES[useAppLanguage()];
}

export { en };
