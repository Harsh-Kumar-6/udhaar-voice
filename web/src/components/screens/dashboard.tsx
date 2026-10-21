"use client";

import { format, isToday, isTomorrow, parseISO } from "date-fns";
import {
  ArrowRight,
  BellRing,
  Camera,
  CircleAlert,
  HandCoins,
  PhoneCall,
  PhoneOff,
  Scale,
  SearchCheck,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
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
  Stat,
  TimeAgo,
} from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import type { AttentionItem } from "@/lib/api/contract";
import { useApiMutation, useDashboard, useShop } from "@/lib/api/hooks";
import { formatINR } from "@/lib/domain/rules";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ATTENTION_ICON: Record<AttentionItem["kind"], typeof CircleAlert> = {
  overdue: HandCoins,
  dispute: Scale,
  callback: Undo2,
  wrong_number: PhoneOff,
  refused: CircleAlert,
  low_confidence: SearchCheck,
};

const ATTENTION_TONE: Record<AttentionItem["kind"], string> = {
  overdue: "bg-overdue-soft text-overdue",
  dispute: "bg-disputed-soft text-disputed",
  callback: "bg-callback-soft text-callback",
  wrong_number: "bg-due-soft text-due",
  refused: "bg-muted text-muted-foreground",
  low_confidence: "bg-promised-soft text-promised",
};

export function DashboardScreen() {
  const t = useT();
  const d = t.dashboard;
  const shop = useShop();
  const q = useDashboard();

  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock onRetry={() => q.refetch()} />;
  const data = q.data;
  const firstName = shop.data?.ownerName.split(" ")[0] ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={format(new Date(), "EEEE d MMMM")}
        title={d.greeting(firstName)}
        description={d.description}
        actions={
          <>
            <Button asChild size="lg">
              <Link href="/app/khata">
                <Camera /> {d.actions.snap}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/app/reminders">
                <BellRing /> {d.actions.schedule}
              </Link>
            </Button>
          </>
        }
      />

      {data.activeBatch ? (
        <Link
          href="/app/reminders"
          className="flex items-center gap-4 rounded-xl border border-primary/30 bg-accent px-4 py-3 transition-colors hover:bg-accent/70"
        >
          <PhoneCall className="size-5 shrink-0 animate-pulse text-primary" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
              <span>{d.live.title(data.activeBatch.counts.done, data.activeBatch.calls.length)}</span>
              <span className="text-xs text-muted-foreground">{d.live.waiting(data.activeBatch.counts.waiting)}</span>
            </div>
            <Progress value={(data.activeBatch.counts.done / Math.max(1, data.activeBatch.calls.length)) * 100} />
          </div>
          <span className="hidden items-center gap-1 text-sm font-medium text-primary sm:flex">
            {d.live.watch} <ArrowRight className="size-4" />
          </span>
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={d.stats.pending} value={formatINR(data.totalPending)} hint={d.stats.pendingHint(data.customersOwing)} tone="due" />
        <Stat label={d.stats.promised} value={formatINR(data.promisedThisWeek.amount)} hint={d.stats.promisedHint(data.promisedThisWeek.count)} tone="promised" />
        <Stat label={d.stats.collected} value={formatINR(data.collectedThisWeek)} hint={d.stats.collectedHint(formatINR(data.collectedToday))} tone="paid" />
        <Stat label={d.stats.disputes} value={data.openDisputes} hint={d.stats.disputesHint} tone="disputed" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{d.attention.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.attention.length === 0 ? (
              <EmptyState title={d.attention.empty} />
            ) : (
              <ul className="divide-y">
                {data.attention.map((item, i) => (
                  <AttentionRow key={`${item.kind}-${item.customer.id}-${i}`} item={item} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{d.upcoming.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">{d.upcoming.empty}</p>
              ) : (
                <ul className="space-y-3">
                  {data.upcoming.map(({ promise, customer }) => {
                    const due = parseISO(promise.dueDate);
                    const when = isToday(due) ? d.upcoming.today : isTomorrow(due) ? d.upcoming.tomorrow : format(due, "EEE d MMM");
                    return (
                      <li key={promise.id}>
                        <Link href={`/app/customers/${customer.id}`} className="flex items-center justify-between gap-3 rounded-lg hover:bg-muted/50">
                          <CustomerName name={customer.name} nativeName={customer.nameNative} language={customer.language} />
                          <span className="flex shrink-0 flex-col items-end">
                            <Money amount={promise.amount} className="font-semibold" />
                            <span className="text-xs text-muted-foreground">{when}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <CollectionsChart data={data.byDay} />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{d.recent.title}</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/app/calls">
              {d.recent.all} <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {data.recentCalls.length === 0 ? (
            <EmptyState title={d.recent.empty} />
          ) : (
            <ul className="divide-y">
              {data.recentCalls.map(({ call, customer }) => (
                <li key={call.id}>
                  <Link href={`/app/calls/${call.id}`} className="flex items-center gap-3 py-3 hover:bg-muted/40">
                    <CustomerName className="flex-1" name={customer?.name ?? "Shopkeeper"} nativeName={customer?.nameNative} language={customer?.language} />
                    {call.extraction && call.status !== "no_answer" ? <OutcomeBadge outcome={call.extraction.outcome} /> : <CallStatusPill status={call.status} />}
                    <TimeAgo iso={call.startedAt ?? call.scheduledAt} className="hidden w-24 text-right text-xs text-muted-foreground sm:block" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const d = useT().dashboard;
  const Icon = ATTENTION_ICON[item.kind];
  const schedule = useApiMutation(api.scheduleReminders);

  let action: React.ReactNode;
  if (item.kind === "callback") {
    action = (
      <Button
        size="sm"
        variant="outline"
        disabled={schedule.isPending}
        onClick={async () => {
          const r = await schedule.mutateAsync({ customerIds: [item.customer.id], at: nextMorning(), language: "auto", bypassHours: false });
          if (r.batch) toast.success(d.attention.callbackScheduled(item.customer.name));
          else toast.error(r.skipped[0]?.reason ?? "Couldn't schedule");
        }}
      >
        {d.attention.actions.scheduleCallback}
      </Button>
    );
  } else if (item.kind === "low_confidence" && item.callId) {
    action = (
      <Button asChild size="sm" variant="outline">
        <Link href={`/app/calls/${item.callId}`}>{d.attention.actions.checkCall}</Link>
      </Button>
    );
  } else {
    const label = item.kind === "wrong_number" ? d.attention.actions.updateNumber : item.kind === "dispute" ? d.attention.actions.review : d.attention.actions.open;
    action = (
      <Button asChild size="sm" variant="outline">
        <Link href={`/app/customers/${item.customer.id}${item.kind === "wrong_number" ? "#phone" : ""}`}>{label}</Link>
      </Button>
    );
  }

  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", ATTENTION_TONE[item.kind])}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">{item.customer.name}</span>
          <span className="text-xs font-medium text-muted-foreground">{d.attention.kinds[item.kind]}</span>
        </div>
        <p className="text-sm text-muted-foreground">{item.text}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </li>
  );
}

/** Callbacks are requested for "tomorrow morning"; the extraction says 10 AM. */
function nextMorning(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

function CollectionsChart({ data }: { data: { date: string; collected: number; promised: number }[] }) {
  const c = useT().dashboard.chart;
  const config = {
    collected: { label: c.collected, color: "var(--chart-1)" },
    promised: { label: c.promised, color: "var(--chart-2)" },
  } satisfies ChartConfig;
  const rows = data.map((r) => ({ ...r, day: format(parseISO(r.date), "EEE") }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{c.title}</CardTitle>
        <CardDescription>{c.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-44 w-full">
          <BarChart data={rows} margin={{ left: 0, right: 0, top: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value, name) => `${config[name as keyof typeof config]?.label ?? name}: ${formatINR(Number(value))}`} />} />
            <Bar dataKey="collected" fill="var(--color-collected)" radius={4} isAnimationActive={false} />
            <Bar dataKey="promised" fill="var(--color-promised)" radius={4} isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
