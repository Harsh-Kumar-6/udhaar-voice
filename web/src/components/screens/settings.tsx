"use client";

import { FlaskConical } from "lucide-react";
import { useRef, useState } from "react";
import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/app/bits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api";
import { attempt, useApiMutation, useShop } from "@/lib/api/hooks";
import { LANGUAGES, Shop as ShopSchema, type Language, type Shop } from "@/lib/domain/types";
import { setAppLanguage, useAppLanguage, useT } from "@/lib/i18n";

const HOURS = Array.from({ length: 25 }, (_, h) => h);
const hourLabel = (h: number) => (h === 0 || h === 24 ? "12 AM" : h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`);
const LANGS = LANGUAGES;
/** Each language's name in its own script, so anyone can find theirs. */
const LANGUAGE_NAMES: Record<Language, string> = { en: "English", hi: "हिन्दी", or: "ଓଡ଼ିଆ", bn: "বাংলা", mr: "मराठी" };

export function SettingsScreen() {
  const t = useT().settings;
  const q = useShop();
  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock onRetry={() => q.refetch()} />;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={t.title} description={t.description} />
      <AppLanguage />
      <WorkflowForm key={q.data.id} shop={q.data} />
      <PrototypeControls shop={q.data} />
    </div>
  );
}

const GAP_DAYS = Array.from({ length: 14 }, (_, i) => i + 1);
/** Bolna's agents end every call at 3 minutes, so a longer limit would never apply. */
const CALL_MINUTES = [1, 2, 3];

/**
 * Shop-wide settings for how calls work, saved as they change. Only the changed fields are sent, so a
 * switch saved elsewhere (the demo controls) isn't overwritten. The owner's details live on Profile.
 */
function WorkflowForm({ shop }: { shop: Shop }) {
  const t = useT();
  const s = t.settings;
  const [draft, setDraft] = useState<Shop>(shop);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const save = useApiMutation(api.updateShop);
  const pending = useRef<Partial<Shop>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const set = <K extends keyof Shop>(key: K, value: Shop[K]) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    const parsed = ShopSchema.safeParse(next);
    if (!parsed.success) {
      setInvalid(new Set(parsed.error.issues.map((i) => String(i.path[0]))));
      return;
    }
    setInvalid(new Set());
    pending.current = { ...pending.current, [key]: value };
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const patch = pending.current;
      pending.current = {};
      setStatus("saving");
      setStatus((await attempt(save.mutateAsync(patch))) ? "saved" : "idle");
    }, 600);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        {status === "saving" ? s.saving : status === "saved" ? s.saved : s.autosave}
      </p>
      <Card>
        <CardHeader>
          <CardTitle>{s.calling.title}</CardTitle>
          <CardDescription>{s.calling.description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{s.calling.hours}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <HourSelect id="hours-start" label={s.calling.from} value={draft.callingHours.start} onChange={(h) => set("callingHours", { ...draft.callingHours, start: h })} hours={HOURS.slice(0, 24)} />
              <span className="text-muted-foreground">–</span>
              <HourSelect id="hours-end" label={s.calling.to} value={draft.callingHours.end} onChange={(h) => set("callingHours", { ...draft.callingHours, end: h })} hours={HOURS.slice(1)} />
            </div>
            <p className="text-xs text-muted-foreground">{s.calling.hoursHint}</p>
            {invalid.has("callingHours") ? <p className="text-xs text-destructive">Calling hours must end after they start.</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shop-gap">{s.calling.gap}</Label>
            <NumberSelect id="shop-gap" value={draft.reminderGapDays} options={GAP_DAYS} onChange={(n) => set("reminderGapDays", n)} />
            <p className="text-xs text-muted-foreground">{s.calling.gapHint}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shop-max">{s.calling.maxMinutes}</Label>
            <NumberSelect id="shop-max" value={Math.min(draft.maxCallMinutes, 3)} options={CALL_MINUTES} onChange={(n) => set("maxCallMinutes", n)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{s.newCustomers.title}</CardTitle>
          <CardDescription>{s.newCustomers.hint}</CardDescription>
        </CardHeader>
        <CardContent>
          <LanguageSelect id="default-customer-language" label={s.newCustomers.title} value={draft.defaultCustomerLanguage} onChange={(l) => set("defaultCustomerLanguage", l)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{s.summary.title}</CardTitle>
          <CardDescription>{s.summary.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <label className="flex items-center gap-3 text-sm font-medium">
            <Switch id="report-enabled" checked={draft.reportEnabled} onCheckedChange={(on) => set("reportEnabled", on)} />
            {s.summary.enabled}
          </label>
          {draft.reportEnabled ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="report-time">{s.summary.time}</Label>
                <Input id="report-time" type="time" value={draft.reportTime} onChange={(e) => set("reportTime", e.target.value)} className="h-11 sm:h-10" aria-invalid={invalid.has("reportTime") || undefined} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-language">{s.summary.language}</Label>
                <LanguageSelect id="report-language" value={draft.reportLanguage} onChange={(l) => set("reportLanguage", l)} />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

    </div>
  );
}

function NumberSelect({ id, value, options, onChange }: { id: string; value: number; options: number[]; onChange: (n: number) => void }) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger id={id} className="h-11 w-full sm:h-10 sm:w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((n) => (
          <SelectItem key={n} value={String(n)}>
            {n}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AppLanguage() {
  const t = useT().settings.appLanguage;
  const language = useAppLanguage();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.hint}</CardDescription>
      </CardHeader>
      <CardContent>
        <ToggleGroup type="single" variant="outline" className="flex-wrap" value={language} onValueChange={(v) => v && setAppLanguage(v as Language)}>
          {LANGUAGES.map((l) => (
            <ToggleGroupItem key={l} value={l} lang={l} id={`app-language-${l}`}>
              {LANGUAGE_NAMES[l]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardContent>
    </Card>
  );
}

function LanguageSelect({ id, label, value, onChange }: { id: string; label?: string; value: Language; onChange: (l: Language) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Language)}>
      <SelectTrigger id={id} className="h-11 w-full sm:h-10 sm:w-56" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LANGS.map((l) => (
          <SelectItem key={l} value={l} lang={l}>
            {LANGUAGE_NAMES[l]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function HourSelect({ id, label, value, onChange, hours }: { id: string; label: string; value: number; onChange: (h: number) => void; hours: number[] }) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger id={id} className="w-32" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {hours.map((h) => (
          <SelectItem key={h} value={String(h)}>
            {hourLabel(h)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PrototypeControls({ shop }: { shop: Shop }) {
  const t = useT().settings.prototype;
  const update = useApiMutation(api.updateShop);

  return (
    <Card className="border-promised/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-5 text-promised" /> {t.title}
        </CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <label className="flex items-start gap-3">
          <Switch id="demo-bypass" checked={shop.demoBypassHours} onCheckedChange={(on) => update.mutate({ demoBypassHours: on })} />
          <span>
            <span className="text-sm font-medium">{t.bypass}</span>
            <span className="block text-xs text-muted-foreground">{t.bypassHint}</span>
          </span>
        </label>
      </CardContent>
    </Card>
  );
}
