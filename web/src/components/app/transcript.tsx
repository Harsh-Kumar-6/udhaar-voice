"use client";

import { Languages, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Language, Turn } from "@/lib/domain/types";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * A call transcript as chat bubbles: the original Bengali/Hindi line with an English gloss.
 * "Replay" plays the lines back at the pace they were spoken.
 */
export function Transcript({
  turns,
  language,
  autoPlay = false,
  className,
}: {
  turns: Turn[];
  language: Language;
  autoPlay?: boolean;
  className?: string;
}) {
  const t = useT().common.transcript;
  const [showGloss, setShowGloss] = useState(true);
  // null = show everything; a number = replaying, showing turns up to that index
  const [cursor, setCursor] = useState<number | null>(autoPlay && turns.length ? 0 : null);

  useEffect(() => {
    if (cursor === null) return;
    if (cursor >= turns.length - 1) {
      const done = window.setTimeout(() => setCursor(null), 1200);
      return () => window.clearTimeout(done);
    }
    const gap = Math.min(7000, Math.max(900, (turns[cursor + 1].at - turns[cursor].at) * 1000));
    const id = window.setTimeout(() => setCursor((c) => (c === null ? null : c + 1)), gap);
    return () => window.clearTimeout(id);
  }, [cursor, turns]);

  const visible = cursor === null ? turns : turns.slice(0, cursor + 1);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setShowGloss((v) => !v)} aria-pressed={showGloss}>
          <Languages /> {showGloss ? t.hideEnglish : t.showEnglish}
        </Button>
        {turns.length > 0 ? (
          cursor === null ? (
            <Button variant="outline" size="sm" onClick={() => setCursor(0)}>
              <Play /> {t.replay}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setCursor(null)}>
              <Square /> {t.stop}
            </Button>
          )
        ) : null}
      </div>
      <ol className="space-y-3" aria-live={cursor !== null ? "polite" : undefined}>
        {visible.map((turn, i) => {
          const agent = turn.speaker === "agent";
          const speaker = agent ? t.agent : turn.speaker === "shopkeeper" ? t.shopkeeper : t.customer;
          return (
            <li key={i} className={cn("flex", agent ? "justify-start" : "justify-end")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 sm:max-w-[75%]",
                  agent ? "rounded-tl-sm bg-accent text-accent-foreground" : "rounded-tr-sm bg-muted",
                  cursor === i && "ring-2 ring-primary/40 animate-in fade-in-0 slide-in-from-bottom-1",
                )}
              >
                <div className="mb-0.5 flex items-center gap-2 font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {speaker}
                  <span className="tabular font-normal">{formatAt(turn.at)}</span>
                </div>
                <p lang={language} className="leading-relaxed">
                  {turn.text}
                </p>
                {showGloss && turn.gloss && turn.gloss !== turn.text ? (
                  <p className="mt-1 border-t border-foreground/10 pt-1 text-sm text-muted-foreground">{turn.gloss}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function formatAt(seconds: number) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
