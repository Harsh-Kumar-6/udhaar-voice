"use client";

import { useEffect } from "react";

/** While `active`, reloading or closing the tab asks first, so a long read isn't thrown away by mistake. */
export function useLeaveWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
}
