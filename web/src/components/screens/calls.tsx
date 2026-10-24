"use client";

import { format, isToday, parseISO } from "date-fns";
import { BookOpenCheck, PhoneCall, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  CallStatusPill,
  CustomerName,
  EmptyState,
  ErrorBlock,
  hourLabel,
  LanguageTag,
  LoadingBlock,
  OutcomeBadge,
  PageHeader,
  Stat,
} from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useBatches, useCalls, useShop } from "@/lib/api/hooks";
import type { CallListItem } from "@/lib/api/contract";
import type { CallKind } from "@/lib/domain/types";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { BatchCard, NewBatchForm } from "./batches";

export function formatDuration(seconds?: number) {
  if (!seconds) return "—";
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const formatUsd = (usd?: number) => (usd === undefined ? "—" : `$${usd.toFixed(usd < 0.1 ? 3 : 2)}`);

/** Calls and reminder batches on one page: schedule a batch, follow it live, then read every call. */
export function CallsScreen() {
  const t = useT();
  const c = t.calls;
  const q = useCalls();

  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock onRetry={() => q.refetch()} />;

  const today = q.data.filter((x) => x.call.startedAt && isToday(parseISO(x.call.startedAt)));
  const seconds = today.reduce((s, x) => s + (x.call.durationSec ?? 0), 0);
  const cost = today.reduce((s, x) => s + (x.call.costUsd ?? 0), 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title={c.title}
        description={c.description}
        actions={
          <Suspense fallback={<NewBatchButton onClick={() => {}} />}>
            <NewBatch />
          </Suspense>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={c.stats.today} value={today.length} />
        <Stat label={c.stats.answered} value={today.filter((x) => x.call.status === "completed").length} />
        <Stat label={c.stats.minutes} value={(seconds / 60).toFixed(1)} />
        <Stat label={c.stats.credits} value={formatUsd(cost)} hint={c.stats.creditsHint} />
      </div>
      <Batches />
      <CallHistory items={q.data} />
    </div>
  );
}

function NewBatchButton({ onClick }: { onClick: () => void }) {
  const t = useT().batches;
  return (
    <Button size="lg" onClick={onClick}>
      <Plus /> {t.newBatch}
    </Button>
  );
}

/** The "New batch" button and sheet. Links elsewhere open it with `?new=1`, so it reads the URL (in Suspense). */
function NewBatch() {
  const t = useT().batches;
  const shop = useShop();
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("new") === "1");
  const hours = shop.data?.callingHours ?? { start: 8, end: 19 };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && params.has("new")) router.replace("/app/calls", { scroll: false });
  };

  return (
    <>
      <NewBatchButton onClick={() => setOpen(true)} />
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
          <SheetHeader className="pr-12">
            <SheetTitle>{t.sheetTitle}</SheetTitle>
            <SheetDescription>{t.description(hourLabel(hours.start), hourLabel(hours.end))}</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <NewBatchForm onScheduled={() => onOpenChange(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Batches() {
  const t = useT().batches;
  const q = useBatches();
  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock onRetry={() => q.refetch()} />;

  const current = q.data.filter((b) => b.batch.status === "scheduled" || b.batch.status === "running");
  const past = q.data.filter((b) => b.batch.status === "completed" || b.batch.status === "cancelled");

  return (
    <section className="space-y-3" aria-labelledby="batches-current">
      <h2 id="batches-current" className="text-lg font-semibold">
        {t.current}
      </h2>
      {current.length === 0 ? (
        <EmptyState icon={<PhoneCall className="size-6" />} title={t.noCurrent}>
          {t.noCurrentHint}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {current.map((b) => (
            <BatchCard key={b.batch.id} b={b} />
          ))}
        </ul>
      )}
      {past.length ? (
        <details className="group">
          <summary className="cursor-pointer py-2 text-sm font-medium text-muted-foreground hover:text-foreground">{t.past(past.length)}</summary>
          <ul className="mt-2 grid gap-4 md:grid-cols-2">
            {past.map((b) => (
              <BatchCard key={b.batch.id} b={b} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function CallHistory({ items: all }: { items: CallListItem[] }) {
  const c = useT().calls;
  const [kind, setKind] = useState<CallKind | "all">("all");
  const items = all.filter((x) => kind === "all" || x.call.kind === kind);

  return (
    <section className="space-y-3" aria-labelledby="calls-history">
      <h2 id="calls-history" className="text-lg font-semibold">
        {c.history}
      </h2>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter calls">
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
    </section>
  );
}
