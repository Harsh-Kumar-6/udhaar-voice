"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useNow } from "@/hooks/use-now";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Shows that a model is still working: a ticking clock, and a line that changes as time passes and
 * when a second model takes over, so a long wait doesn't look like a stuck page.
 * The clock starts when this appears, or at `since` (for a read that carried on after a reload).
 * With `usual`, how long it usually takes is shown at first; after `slowAfter` seconds, a reassurance instead.
 */
export function AiProgress({
  label,
  since,
  backup,
  slowAfter,
  usual,
  className,
}: {
  label: string;
  since?: number;
  backup: boolean;
  slowAfter: number;
  usual?: boolean;
  className?: string;
}) {
  const t = useT().common.ai;
  // It only appears after the shopkeeper does something, so the clock is never read during prerender.
  const [shown] = useState(() => Date.now());
  const now = useNow(1000);
  const seconds = Math.max(0, Math.floor((now - (since ?? shown)) / 1000));
  const hint = backup ? t.backup : seconds >= slowAfter ? t.slow : usual ? t.usual : undefined;
  return (
    <div className={cn("space-y-1", className)}>
      <p className="flex items-center gap-2 font-medium">
        <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
        <span>{label}</span>
        <span className="tabular font-mono text-xs font-normal text-muted-foreground">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </span>
      </p>
      {hint ? (
        <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
