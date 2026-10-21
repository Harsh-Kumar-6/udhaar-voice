"use client";

import { useEffect } from "react";
import { startSimulator } from "@/lib/api";

/** MOCK ONLY. Keeps simulated calls moving while any app screen is open. Removed with the real engine. */
export function SimulatorRunner() {
  useEffect(() => startSimulator(), []);
  return null;
}
