import { en } from "./en";

/**
 * All shopkeeper-facing text. English today; Bengali and Hindi become extra dictionaries with
 * the same shape, and `useT` picks one from the shop's language setting.
 */
export type Dictionary = typeof en;

export function useT(): Dictionary {
  return en;
}

export { en };
