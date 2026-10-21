"use client";

import { format, parseISO } from "date-fns";
import { PhoneCall, Square, Volume2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

const noSubscription = () => () => {};
import { CustomerName, ErrorBlock, LoadingBlock, Money, PageHeader, Stat } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { DailyReport } from "@/lib/api/contract";
import { useApiMutation, useDailyReport, useShop } from "@/lib/api/hooks";
import { formatINR } from "@/lib/domain/rules";
import { useT } from "@/lib/i18n";

export function ReportScreen() {
  const t = useT().report;
  const q = useDailyReport();
  const shop = useShop();
  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock onRetry={() => q.refetch()} />;
  const r = q.data;
  const reportTime = shop.data ? format(parseISO(`2026-01-01T${shop.data.reportTime}`), "h:mm a") : "8:00 PM";
  const promisedTotal = r.promisesMade.reduce((s, p) => s + p.promise.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={format(parseISO(r.date), "EEEE d MMMM")} title={t.title} description={t.description(reportTime)} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t.stats.collected} value={formatINR(r.collected)} tone="paid" />
        <Stat label={t.stats.promised} value={formatINR(promisedTotal)} tone="promised" />
        <Stat label={t.stats.calls} value={r.callsMade} hint={t.stats.callsHint(r.callsAnswered)} />
        <Stat label={t.stats.disputes} value={r.disputesOpened.length} tone="disputed" />
      </div>

      <SpokenCard r={r} />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <ListCard title={t.sections.payments} rows={r.payments.map((p) => ({ key: p.payment.id, customer: p.customer, right: <Money amount={p.payment.amount} className="font-semibold text-paid" />, sub: p.payment.method.toUpperCase() }))} />
        <ListCard title={t.sections.promises} rows={r.promisesMade.map((p) => ({ key: p.promise.id, customer: p.customer, right: <Money amount={p.promise.amount} className="font-semibold" />, sub: `by ${format(parseISO(p.promise.dueDate), "EEE d MMM")}` }))} />
        <ListCard title={t.sections.dueTomorrow} rows={r.dueTomorrow.map((p) => ({ key: p.promise.id, customer: p.customer, right: <Money amount={p.promise.amount} className="font-semibold" /> }))} />
        <ListCard title={t.sections.disputes} rows={r.disputesOpened.map((d) => ({ key: d.dispute.id, customer: d.customer, sub: d.dispute.reason }))} />
        <ListCard title={t.sections.products} rows={r.productRequests.map((p) => ({ key: p.note.id, customer: p.customer, sub: p.note.product ?? p.note.text }))} />
      </div>
    </div>
  );
}

function ListCard({ title, rows }: { title: string; rows: { key: string; customer: DailyReport["payments"][number]["customer"]; right?: React.ReactNode; sub?: string }[] }) {
  const t = useT().report;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.none}</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.key} className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <CustomerName name={row.customer.name} nativeName={row.customer.nameNative} language={row.customer.language} />
                  {row.sub ? <span className="block text-xs text-muted-foreground">{row.sub}</span> : null}
                </span>
                {row.right}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SpokenCard({ r }: { r: DailyReport }) {
  const t = useT().report.spoken;
  const router = useRouter();
  const send = useApiMutation(api.sendReportCall);
  const [speaking, setSpeaking] = useState(false);
  // Browser-only capability: false on the server, the real answer in the browser, no extra render.
  const canSpeak = useSyncExternalStore(
    noSubscription,
    () => "speechSynthesis" in window,
    () => false,
  );

  // Stop any preview when leaving the page.
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const preview = () => {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(r.spoken.en);
    utterance.lang = "en-IN";
    const voice = synth.getVoices().find((v) => v.lang === "en-IN") ?? synth.getVoices().find((v) => v.lang.startsWith("en"));
    if (voice) utterance.voice = voice;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synth.speak(utterance);
    setSpeaking(true);
  };

  return (
    <Card className="border-primary/25">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <p lang="bn" className="rounded-lg bg-accent px-4 py-3 leading-relaxed">
            {r.spoken.bn}
          </p>
          <p className="rounded-lg border px-4 py-3 text-sm leading-relaxed text-muted-foreground">{r.spoken.en}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="lg"
            disabled={send.isPending}
            onClick={async () => {
              const call = await send.mutateAsync(undefined);
              router.push(`/app/calls/${call.id}`);
            }}
          >
            <PhoneCall /> {send.isPending ? t.sending : t.send}
          </Button>
          <Button size="lg" variant="outline" onClick={preview} disabled={!canSpeak}>
            {speaking ? <Square /> : <Volume2 />} {speaking ? t.stopPreview : t.preview}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{canSpeak ? t.previewNote : t.noVoice}</p>
      </CardContent>
    </Card>
  );
}
