"use client";

import { addDays, format, parseISO } from "date-fns";
import { AlertTriangle, ChevronDown, Info, PhoneCall } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  CallStatusPill,
  CustomerName,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Money,
  OutcomeBadge,
  PageHeader,
  StatusChip,
} from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import type { BatchSummary, EligibleCustomer } from "@/lib/api/contract";
import { useApiMutation, useBatches, useReminderCandidates, useShop } from "@/lib/api/hooks";
import { isWithinCallingHours, nextAllowedTime, toDateKey } from "@/lib/domain/rules";
import type { CallOutcome } from "@/lib/domain/types";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const MINUTES_PER_CALL = 2;
const USD_PER_MINUTE = 0.06;
const hourLabel = (h: number) => format(new Date(2026, 0, 1, h), "h a");

export function RemindersScreen() {
  const t = useT().reminders;
  const shop = useShop();
  const hours = shop.data?.callingHours ?? { start: 8, end: 19 };
  return (
    <div className="space-y-6">
      <PageHeader title={t.title} description={t.description(hourLabel(hours.start), hourLabel(hours.end))} />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <NewBatch />
        </div>
        <div className="lg:col-span-2">
          <Batches />
        </div>
      </div>
    </div>
  );
}

function NewBatch() {
  const t = useT().reminders;
  const shop = useShop();
  const q = useReminderCandidates();
  const schedule = useApiMutation(api.scheduleReminders);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"now" | "later">("now");
  // Filled in when "Later" is picked. Reading the clock during render would freeze the build day's date.
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [bypass, setBypass] = useState(false);

  if (q.isPending || shop.isPending) return <LoadingBlock />;
  if (q.isError || shop.isError) return <ErrorBlock onRetry={() => q.refetch()} />;

  const hours = shop.data.callingHours;
  const eligible = q.data.filter((c) => c.eligible);
  const requested = mode === "now" ? new Date() : new Date(`${date}T${time}`);
  const outside = !isWithinCallingHours(requested, hours);
  const movedTo = outside && !bypass ? nextAllowedTime(requested, hours) : null;
  const count = [...selected].filter((id) => eligible.some((c) => c.customer.id === id)).length;
  const minutes = count * MINUTES_PER_CALL;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    const r = await schedule.mutateAsync({
      customerIds: [...selected],
      at: mode === "now" ? "now" : requested.toISOString(),
      language: "auto",
      bypassHours: bypass,
    });
    if (r.batch) toast.success(t.scheduled(r.batch.callIds.length), { description: r.skipped.length ? t.skipped(r.skipped.length) : undefined });
    else toast.error(r.skipped[0]?.reason ?? "Nothing scheduled");
    setSelected(new Set());
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>{t.newBatch}</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t.selected(count)}</span>
          {selected.size ? (
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              {t.clear}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <Button variant="outline" size="sm" onClick={() => setSelected(new Set(eligible.map((c) => c.customer.id)))} disabled={eligible.length === 0}>
          {t.selectAll(eligible.length)}
        </Button>

        <ul className="max-h-[26rem] divide-y overflow-y-auto rounded-lg border">
          {q.data
            .filter((c) => c.balance > 0)
            .map((c) => (
              <CandidateRow key={c.customer.id} c={c} checked={selected.has(c.customer.id)} onToggle={() => toggle(c.customer.id)} />
            ))}
        </ul>

        <div className="space-y-3">
          <Label>{t.when}</Label>
          <RadioGroup
            value={mode}
            onValueChange={(v) => {
              setMode(v as "now" | "later");
              if (v === "later" && !date) setDate(toDateKey(addDays(new Date(), 1)));
            }}
            className="flex gap-6"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="now" id="when-now" /> {t.now}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="later" id="when-later" /> {t.later}
            </label>
          </RadioGroup>
          {mode === "later" ? (
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="batch-date" className="text-xs text-muted-foreground">
                  {t.date}
                </Label>
                <Input id="batch-date" type="date" value={date} min={toDateKey(new Date())} onChange={(e) => setDate(e.target.value)} className="h-10 w-44" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="batch-time" className="text-xs text-muted-foreground">
                  {t.time}
                </Label>
                <Input id="batch-time" type="time" step={1800} value={time} onChange={(e) => setTime(e.target.value)} className="h-10 w-32" />
              </div>
            </div>
          ) : null}
          {outside ? (
            <div className="space-y-3 rounded-lg border border-promised/40 bg-promised-soft/60 p-3 text-sm">
              {movedTo ? (
                <p className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-promised" />
                  {t.outsideHours(format(movedTo, "EEE d MMM, h:mm a"))}
                </p>
              ) : null}
              <label className="flex items-start gap-3">
                <Switch checked={bypass} onCheckedChange={setBypass} id="bypass-hours" />
                <span>
                  <span className="font-medium">{t.bypass}</span>
                  <span className="block text-xs text-muted-foreground">{t.bypassHint}</span>
                </span>
              </label>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="font-medium">{t.estimate(count, minutes, `$${(minutes * USD_PER_MINUTE).toFixed(2)}`)}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Info className="size-3.5" /> {t.estimateHint}
            </p>
          </div>
          <Button size="lg" onClick={submit} disabled={count === 0 || schedule.isPending}>
            <PhoneCall /> {t.schedule(count)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CandidateRow({ c, checked, onToggle }: { c: EligibleCustomer; checked: boolean; onToggle: () => void }) {
  const id = `pick-${c.customer.id}`;
  return (
    <li className={cn("flex items-start gap-3 px-3 py-2.5", !c.eligible && "opacity-60")}>
      <Checkbox id={id} checked={checked && c.eligible} disabled={!c.eligible} onCheckedChange={onToggle} className="mt-1" />
      <label htmlFor={id} className={cn("flex min-w-0 flex-1 flex-col gap-1", c.eligible && "cursor-pointer")}>
        <span className="flex items-center justify-between gap-3">
          <CustomerName name={c.customer.name} nativeName={c.customer.nameNative} language={c.customer.language} />
          <span className="flex shrink-0 items-center gap-2">
            <StatusChip status={c.status} className="hidden sm:inline-flex" />
            <Money amount={c.balance} className="font-semibold" />
          </span>
        </span>
        {c.reason ? <span className="text-xs text-muted-foreground">{c.reason}</span> : null}
        {c.note ? <span className="text-xs font-medium text-promised">{c.note}</span> : null}
      </label>
    </li>
  );
}

function Batches() {
  const t = useT().reminders;
  const q = useBatches();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.batches}</CardTitle>
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <LoadingBlock />
        ) : q.isError ? (
          <ErrorBlock onRetry={() => q.refetch()} />
        ) : q.data.length === 0 ? (
          <EmptyState title={t.noBatches} />
        ) : (
          <ul className="space-y-4">
            {q.data.map((b) => (
              <BatchCard key={b.batch.id} b={b} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function BatchCard({ b }: { b: BatchSummary }) {
  const t = useT().reminders;
  const cancel = useApiMutation(api.cancelBatch);
  const active = b.batch.status === "scheduled" || b.batch.status === "running";
  const [open, setOpen] = useState(active);
  const total = b.calls.length;
  const statusTone =
    b.batch.status === "running" ? "bg-paid-soft text-paid" : b.batch.status === "scheduled" ? "bg-callback-soft text-callback" : "bg-muted text-muted-foreground";

  return (
    <li className={cn("space-y-3 rounded-xl border p-4", active && "border-primary/40")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{t.batchTitle(format(parseISO(b.batch.scheduledAt), "EEE d MMM, h:mm a"))}</p>
          <p className="text-xs text-muted-foreground">{t.counts(b.counts.waiting, b.counts.active, b.counts.done)}</p>
        </div>
        <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold", statusTone)}>{t.batchStatus[b.batch.status]}</span>
      </div>
      <Progress value={(b.counts.done / Math.max(1, total)) * 100} />
      {Object.keys(b.outcomes).length ? (
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(b.outcomes) as [CallOutcome, number][]).map(([outcome, n]) => (
            <span key={outcome} className="inline-flex items-center gap-1">
              <OutcomeBadge outcome={outcome} />
              <span className="text-xs text-muted-foreground tabular">×{n}</span>
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} /> {open ? t.hideCalls : t.showCalls(total)}
        </Button>
        {active && b.counts.waiting > 0 ? (
          <Button
            variant="outline"
            size="sm"
            disabled={cancel.isPending}
            onClick={async () => {
              await cancel.mutateAsync(b.batch.id);
              toast.success(t.cancelled);
            }}
          >
            {t.cancel}
          </Button>
        ) : null}
      </div>
      {open ? (
        <ul className="divide-y rounded-lg border">
          {b.calls.map(({ call, customer }) => (
            <li key={call.id}>
              <Link href={`/app/calls/${call.id}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-muted/40">
                <span className="truncate">{customer?.name ?? "Shopkeeper"}</span>
                {call.status === "completed" && call.extraction ? <OutcomeBadge outcome={call.extraction.outcome} /> : <CallStatusPill status={call.status} />}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
