"use client";

import { CheckCircle2, FlaskConical, RotateCcw } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api, subscribeToDataChanges } from "@/lib/api";
import { useApiMutation, useShop } from "@/lib/api/hooks";
import { getSimulationSpeed, setSimulationSpeed, SPEEDS } from "@/lib/api/mock/controls";
import { Shop as ShopSchema, type Language, type Shop } from "@/lib/domain/types";
import { setAppLanguage, useAppLanguage, useT } from "@/lib/i18n";

const HOURS = Array.from({ length: 25 }, (_, h) => h);
const hourLabel = (h: number) => (h === 0 || h === 24 ? "12 AM" : h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`);
const LANGS: Language[] = ["bn", "hi", "en"];
/** Each language's name in its own script, so anyone can find theirs. */
const LANGUAGE_NAMES: Record<Language, string> = { en: "English", bn: "বাংলা", hi: "हिन्दी" };

export function SettingsScreen() {
  const t = useT().settings;
  const q = useShop();
  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock onRetry={() => q.refetch()} />;
  return (
    <div className="space-y-6">
      <PageHeader title={t.title} description={t.description} />
      <AppLanguage />
      <ShopForm key={JSON.stringify(q.data)} shop={q.data} />
      <PrototypeControls shop={q.data} />
      <About />
    </div>
  );
}

function ShopForm({ shop }: { shop: Shop }) {
  const t = useT();
  const s = t.settings;
  const [draft, setDraft] = useState<Shop>(shop);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const save = useApiMutation(api.updateShop);
  const set = <K extends keyof Shop>(key: K, value: Shop[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = ShopSchema.safeParse(draft);
    if (!parsed.success) {
      setInvalid(new Set(parsed.error.issues.map((i) => String(i.path[0]))));
      return toast.error(s.invalid);
    }
    setInvalid(new Set());
    await save.mutateAsync(parsed.data);
    toast.success(s.saved);
  };

  const field = (key: keyof Shop, label: string, hint?: string, props?: React.ComponentProps<typeof Input>) => (
    <div className="space-y-1.5">
      <Label htmlFor={`shop-${key}`}>{label}</Label>
      <Input id={`shop-${key}`} value={String(draft[key] ?? "")} onChange={(e) => set(key, e.target.value as never)} aria-invalid={invalid.has(key) || undefined} {...props} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{s.shop.title}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {field("name", s.shop.name)}
          {field("ownerName", s.shop.owner)}
          {field("ownerNameNative", s.shop.ownerNative, s.shop.ownerNativeHint, { lang: "bn" })}
          {field("area", s.shop.area)}
          {field("upiId", s.shop.upi, s.shop.upiHint)}
          {field("ownerPhone", s.shop.ownerPhone, undefined, { inputMode: "tel" })}
        </CardContent>
      </Card>

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
            <Input id="shop-gap" type="number" min={1} max={14} value={draft.reminderGapDays} onChange={(e) => set("reminderGapDays", Number(e.target.value))} aria-invalid={invalid.has("reminderGapDays") || undefined} />
            <p className="text-xs text-muted-foreground">{s.calling.gapHint}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shop-max">{s.calling.maxMinutes}</Label>
            <Input id="shop-max" type="number" min={1} max={10} value={draft.maxCallMinutes} onChange={(e) => set("maxCallMinutes", Number(e.target.value))} aria-invalid={invalid.has("maxCallMinutes") || undefined} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shop-report">{s.calling.reportTime}</Label>
            <Input id="shop-report" type="time" value={draft.reportTime} onChange={(e) => set("reportTime", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{s.languages.title}</CardTitle>
          <CardDescription>{s.languages.hint}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-5">
          {LANGS.map((lang) => (
            <label key={lang} className="flex items-center gap-2 text-sm">
              <Checkbox
                id={`lang-${lang}`}
                checked={draft.languages.includes(lang)}
                onCheckedChange={(on) => set("languages", on ? [...draft.languages, lang] : draft.languages.filter((l) => l !== lang))}
              />
              {t.common.language[lang]}
            </label>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={save.isPending}>
          {s.save}
        </Button>
      </div>
    </form>
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
        <ToggleGroup type="single" variant="outline" value={language} onValueChange={(v) => v && setAppLanguage(v as Language)}>
          {(["en", "bn", "hi"] as const).map((l) => (
            <ToggleGroupItem key={l} value={l} lang={l} id={`app-language-${l}`}>
              {LANGUAGE_NAMES[l]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardContent>
    </Card>
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
  const dict = useT();
  const t = dict.settings.prototype;
  const update = useApiMutation(api.updateShop);
  const reset = useApiMutation(api.resetDemo);
  const [confirming, setConfirming] = useState(false);
  // The speed lives in this browser's demo data; re-read it whenever that data changes.
  const speed = useSyncExternalStore(subscribeToDataChanges, getSimulationSpeed, () => null);

  return (
    <Card className="border-promised/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-5 text-promised" /> {t.title}
        </CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>{t.speed}</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            value={speed ? String(speed) : undefined}
            onValueChange={(v) => {
              if (v) setSimulationSpeed(Number(v));
            }}
          >
            {SPEEDS.map((s) => (
              <ToggleGroupItem key={s} value={String(s)}>
                {s}×
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">{t.speedHint}</p>
        </div>

        <label className="flex items-start gap-3">
          <Switch id="demo-bypass" checked={shop.demoBypassHours} onCheckedChange={(on) => update.mutate({ demoBypassHours: on })} />
          <span>
            <span className="text-sm font-medium">{t.bypass}</span>
            <span className="block text-xs text-muted-foreground">{t.bypassHint}</span>
          </span>
        </label>

        <div className="space-y-3 border-t pt-5">
          {!confirming ? (
            <Button variant="outline" onClick={() => setConfirming(true)}>
              <RotateCcw /> {t.reset}
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm">{t.resetConfirm}</p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  disabled={reset.isPending}
                  onClick={async () => {
                    await reset.mutateAsync(undefined);
                    setConfirming(false);
                    toast.success(t.resetDone);
                  }}
                >
                  {t.resetYes}
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>
                  {dict.common.actions.cancel}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function About() {
  const t = useT().settings.about;
  return (
    <Card id="about" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <FlaskConical className="size-4 text-promised" /> {t.simulatedTitle}
          </h3>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            {t.simulated.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="size-4 text-paid" /> {t.realTitle}
          </h3>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            {t.real.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
