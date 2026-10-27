"use client";

import { format, parseISO } from "date-fns";
import { ArrowLeft, AudioLines, CalendarClock, CircleDot, Layers, PhoneCall, Scale, StickyNote, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  CallStatusPill,
  ConfidenceBadge,
  EmptyState,
  ErrorBlock,
  hourLabel,
  LanguageTag,
  LoadingBlock,
  Money,
  OutcomeBadge,
} from "@/components/app/bits";
import { ScheduleDialog } from "@/components/app/schedule-dialog";
import { Transcript } from "@/components/app/transcript";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { attempt, useApiMutation, useCall, useShop } from "@/lib/api/hooks";
import type { CallDetail, QueueSpot } from "@/lib/api/contract";
import type { Call } from "@/lib/domain/types";
import { useNow } from "@/hooks/use-now";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatDuration, formatUsd } from "./calls";

export function CallDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const c = useT().calls.detail;
  const q = useCall(id);
  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock onRetry={() => q.refetch()} />;
  if (!q.data) return <EmptyState title={c.notFound} action={<Button asChild variant="outline"><Link href="/app/calls">{c.back}</Link></Button>} />;
  return <CallView d={q.data} />;
}

const LIVE = new Set<Call["status"]>(["scheduled", "queued", "ringing", "in_progress"]);

function CallView({ d }: { d: CallDetail }) {
  const t = useT();
  const c = t.calls.detail;
  const { call, customer } = d;
  const live = LIVE.has(call.status);
  const name = customer?.name ?? t.calls.shopkeeper;
  // Replay automatically when the call ended while this page was open (or just before),
  // so watching a live call flows straight into its transcript.
  const [openedAt] = useState(() => Date.now());
  const justEnded = !!call.endedAt && openedAt - Date.parse(call.endedAt) < 60_000;

  return (
    <div className="space-y-6">
      <Link href="/app/calls" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {c.back}
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">{t.calls.kind[call.kind]}</div>
          <h1 className="text-2xl font-bold sm:text-3xl">{c.to(name)}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <CallStatusPill status={call.status} />
            <LanguageTag language={call.language} />
            <span>{format(parseISO(call.startedAt ?? call.scheduledAt), "EEEE d MMM, h:mm a")}</span>
            {d.batch ? (
              <span className="inline-flex items-center gap-1">
                <Layers className="size-3.5" /> {c.batch}
              </span>
            ) : null}
          </div>
        </div>
        {customer ? (
          <Button asChild variant="outline" size="lg">
            <Link href={`/app/customers/${customer.id}`}>{c.viewCustomer}</Link>
          </Button>
        ) : null}
      </div>

      {live ? <LivePanel call={call} queue={d.queue} /> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {call.extraction && !live ? <ResultCard call={call} /> : null}
          <Card>
            <CardHeader>
              <CardTitle>{c.transcript}</CardTitle>
            </CardHeader>
            <CardContent>
              {live ? (
                <p className="text-sm text-muted-foreground">{t.common.transcript.pending}</p>
              ) : call.transcript.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.common.transcript.none}</p>
              ) : (
                <Transcript key={call.id + (justEnded ? "-live" : "")} turns={call.transcript} language={call.language} autoPlay={justEnded} />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">{c.duration}</div>
                <div className="font-mono text-lg font-semibold tabular">{formatDuration(call.durationSec)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{c.cost}</div>
                <div className="font-mono text-lg font-semibold tabular">{formatUsd(call.costUsd)}</div>
              </div>
              <div className="col-span-2 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AudioLines className="size-3.5" /> {c.recording}
                </div>
                <div className="flex h-10 items-center gap-0.5 rounded-lg bg-muted px-3" aria-hidden>
                  {Array.from({ length: 48 }, (_, i) => (
                    <span key={i} className="w-1 rounded-full bg-muted-foreground/30" style={{ height: `${20 + ((i * 37) % 60)}%` }} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{c.recordingNote}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{c.events}</CardTitle>
              <CardDescription>{c.eventsHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l pl-5">
                {call.events.map((e, i) => (
                  <li key={i} className="relative">
                    <CircleDot className={cn("absolute top-0.5 -left-[27px] size-3.5 bg-card", i === call.events.length - 1 ? "text-primary" : "text-muted-foreground")} />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <span className="text-sm font-medium">{t.common.callStatus[e.status]}</span>
                      <span className="font-mono text-xs text-muted-foreground tabular">{format(parseISO(e.at), "h:mm:ss a")}</span>
                    </div>
                    {e.detail ? <p className="text-xs text-muted-foreground">{e.detail}</p> : null}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function LivePanel({ call, queue }: { call: Call; queue?: QueueSpot }) {
  const t = useT();
  const c = t.calls.detail.live;
  const d = t.calls.detail;
  const now = useNow(500);
  const since = call.status === "in_progress" ? call.answeredAt : call.startedAt;
  const elapsed = since ? Math.max(0, (now - Date.parse(since)) / 1000) : 0;
  const label =
    call.status === "scheduled"
      ? c.scheduled(format(parseISO(call.scheduledAt), "EEE h:mm a"))
      : call.status === "queued"
        ? c.queued
        : call.status === "ringing"
          ? c.ringing
          : c.in_progress;
  const shop = useShop();
  const reschedule = useApiMutation((at: string) =>
    api.rescheduleCall(call.id, at, shop.data?.demoBypassHours ?? false),
  );
  const cancel = useApiMutation(() => api.cancelCall(call.id));
  const [editOpen, setEditOpen] = useState(false);
  const canEdit = call.status === "scheduled";
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-accent px-6 py-8 text-center">
      <span className="relative grid size-16 place-items-center rounded-full bg-primary text-primary-foreground">
        {call.status === "ringing" || call.status === "in_progress" ? <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" /> : null}
        <PhoneCall className="relative size-7" />
      </span>
      <div className="font-heading text-xl font-bold">{label}</div>
      {call.status === "ringing" || call.status === "in_progress" ? (
        <div className="font-mono text-3xl font-semibold tabular">{formatDuration(Math.floor(elapsed)) === "—" ? "0:00" : formatDuration(Math.floor(elapsed))}</div>
      ) : null}
      {queue ? (
        <div className="space-y-1">
          <p className="font-medium">{c.inLine(queue.position, t.common.wait(queue.waitSeconds))}</p>
          {queue.busyLines >= queue.lines ? <p className="max-w-md text-sm text-muted-foreground">{c.linesBusy(queue.lines)}</p> : null}
        </div>
      ) : null}
      <p className="max-w-md text-sm text-muted-foreground">{c.note}</p>
      {canEdit ? (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <Button variant="outline" size="lg" onClick={() => setEditOpen(true)} disabled={reschedule.isPending || cancel.isPending}>
            <CalendarClock /> {d.reschedule}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={async () => {
              if (!window.confirm(d.cancelConfirm)) return;
              if (await attempt(cancel.mutateAsync())) toast.success(d.cancelled);
            }}
            disabled={reschedule.isPending || cancel.isPending}
          >
            <X /> {d.cancel}
          </Button>
          <ScheduleDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            pending={reschedule.isPending}
            initialAt={call.scheduledAt}
            onSubmit={async (iso) => {
              const done = await attempt(reschedule.mutateAsync(iso));
              if (!done) return;
              const r = done.value;
              if (r.outsideHours) return void toast.error(t.batches.outsideHours(hourLabel(r.outsideHours.start), hourLabel(r.outsideHours.end)));
              toast.success(d.rescheduled(format(parseISO(r.call.scheduledAt), "EEE h:mm a")));
              setEditOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function ResultCard({ call }: { call: Call }) {
  const t = useT();
  const c = t.calls.detail;
  const ex = call.extraction;
  if (!ex) return null;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>{c.result}</CardTitle>
          <CardDescription>{ex.summary}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <OutcomeBadge outcome={ex.outcome} />
          {ex.outcome !== "no_answer" ? <ConfidenceBadge value={ex.confidence} /> : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {ex.promises.length ? (
          <Fact icon={<Wallet className="size-4" />} label={c.promises}>
            <ul className="space-y-1">
              {ex.promises.map((p, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <Money amount={p.amount} className="font-semibold" />
                  <span className="text-sm text-muted-foreground">by {format(parseISO(p.dueDate), "EEE d MMM")}</span>
                </li>
              ))}
            </ul>
          </Fact>
        ) : null}
        {ex.dispute ? (
          <Fact icon={<Scale className="size-4" />} label={c.dispute}>
            <p className="text-sm">{ex.dispute.reason}</p>
          </Fact>
        ) : null}
        {ex.callbackAt ? (
          <Fact icon={<CalendarClock className="size-4" />} label={c.callback}>
            <p className="text-sm">{format(parseISO(ex.callbackAt), "EEEE, h:mm a")}</p>
          </Fact>
        ) : null}
        {ex.notes.length ? (
          <Fact icon={<StickyNote className="size-4" />} label={c.notes}>
            <ul className="space-y-1 text-sm">
              {ex.notes.map((n, i) => (
                <li key={i}>{n.text}</li>
              ))}
            </ul>
          </Fact>
        ) : null}
        {ex.outcome !== "no_answer" ? (
          <Fact icon={<CircleDot className="size-4" />} label={c.sentimentLabel}>
            <p className="text-sm">{c.sentiment[ex.sentiment]}</p>
          </Fact>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Fact({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon} {label}
      </div>
      {children}
    </div>
  );
}
