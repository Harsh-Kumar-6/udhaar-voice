import { readDb, updateDb } from "./store";

/** MOCK ONLY. Prototype controls that have no place in the real API (simulation speed). */

export const SPEEDS = [1, 2, 4] as const;

export function getSimulationSpeed(): number {
  return readDb().demo.speed;
}

export function setSimulationSpeed(speed: number) {
  updateDb((db) => {
    db.demo.speed = speed;
  });
}
