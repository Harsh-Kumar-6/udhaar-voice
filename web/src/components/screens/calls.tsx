"use client";

import { format, isToday, parseISO } from "date-fns";
import { BookOpenCheck, PhoneCall } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  CallStatusPill,
  CustomerName,
  EmptyState,
  ErrorBlock,
  LanguageTag,
  LoadingBlock,
  OutcomeBadge,
  PageHeader,
  Stat,
} from "@/components/app/bits";
import { useCalls } from "@/lib/api/hooks";
import type { CallKind } from "@/lib/domain/types";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function formatDuration(seconds?: number) {
  if (!seconds) return "—";
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const formatUsd = (usd?: number) => (usd === undefined ? "—" : `$${usd.toFixed(usd < 0.1 ? 3 : 2)}`);

export function CallsScreen() {
  const t = useT();
  const c = t.calls;
  const q = useCalls();
  const [kind, setKind] = useState<CallKind | "all">("all");

  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock onRetry={() => q.refetch()} />;

  const items = q.data.filter((x) => kind === "all" || x.call.kind === kind);
  const today = q.data.filter((x) => x.call.startedAt && isToday(parseISO(x.call.startedAt)));
  const seconds = today.reduce((s, x) => s + (x.call.durationSec ?? 0), 0);
  const cost = today.reduce((s, x) => s + (x.call.costUsd ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader title={c.title} description={c.description} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={c.stats.today} value={today.length} />
        <Stat label={c.stats.answered} value={today.filter((x) => x.call.status === "completed").length} />
        <Stat label={c.stats.minutes} value={(seconds / 60).toFixed(1)} />
        <Stat label={c.stats.credits} value={formatUsd(cost)} hint={c.stats.creditsHint} />
      </div>

      <div className="flex gap-2" role="group" aria-label="Filter calls">
        {(["all", "reminder", "report"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={cn(
              "h-8 rounded-full border px-3 text-sm font-medium transition-colors",
              kind === k ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
            )}
          >
            {c.filters[k]}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState title={c.empty} />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {items.map(({ call, customer }) => (
            <li key={call.id}>
              <Link href={`/app/calls/${call.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/40">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  {call.kind === "report" ? <BookOpenCheck className="size-4" /> : <PhoneCall className="size-4" />}
                </span>
                <CustomerName className="min-w-40 flex-1" name={customer?.name ?? c.shopkeeper} nativeName={customer?.nameNative} language={customer?.language} />
                <LanguageTag language={call.language} />
                {call.extraction && call.status === "completed" ? <OutcomeBadge outcome={call.extraction.outcome} /> : <CallStatusPill status={call.status} />}
                <span className="w-14 text-right font-mono text-xs text-muted-foreground tabular">{formatDuration(call.durationSec)}</span>
                <span className="w-16 text-right font-mono text-xs text-muted-foreground tabular">{formatUsd(call.costUsd)}</span>
                <span className="w-32 text-right text-xs text-muted-foreground">{format(parseISO(call.startedAt ?? call.scheduledAt), "EEE d MMM, h:mm a")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
