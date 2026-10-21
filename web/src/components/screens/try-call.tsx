"use client";

import { ArrowRight, FlaskConical, PhoneCall, PhoneOff, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ConfidenceBadge, Money, OutcomeBadge } from "@/components/app/bits";
import { Transcript } from "@/components/app/transcript";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { api } from "@/lib/api";
import type { DemoCallResult } from "@/lib/api/contract";
import { maskPhone, normalizeIndianMobile } from "@/lib/domain/rules";
import type { Language } from "@/lib/domain/types";
import { format, parseISO } from "date-fns";

type Phase =
  | { kind: "form" }
  | { kind: "ringing"; phone: string; result: Extract<DemoCallResult, { allowed: true }> }
  | { kind: "talking"; phone: string; result: Extract<DemoCallResult, { allowed: true }> }
  | { kind: "done"; phone: string; result: Extract<DemoCallResult, { allowed: true }> };

const LANGS: { value: Language; label: string; sample: string }[] = [
  { value: "bn", label: "Bengali", sample: "নমস্কার" },
  { value: "hi", label: "Hindi", sample: "नमस्ते" },
  { value: "en", label: "English", sample: "Hello" },
];

export function TryCallScreen() {
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState<Language>("bn");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Ring for a few seconds, then "pick up" and play the conversation.
  useEffect(() => {
    if (phase.kind !== "ringing") return;
    const id = window.setTimeout(() => setPhase({ ...phase, kind: "talking" }), 3500);
    return () => window.clearTimeout(id);
  }, [phase]);

  useEffect(() => {
    if (phase.kind !== "talking") return;
    const turns = phase.result.turns;
    const last = turns[turns.length - 1];
    const id = window.setTimeout(() => setPhase({ ...phase, kind: "done" }), ((last?.at ?? 0) + 6) * 1000);
    return () => window.clearTimeout(id);
  }, [phase]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const e164 = normalizeIndianMobile(phone);
    if (!e164) return setError("Enter a 10-digit Indian mobile number.");
    if (!consent) return setError("Tick the box to agree to the demo call.");
    setSubmitting(true);
    const result = await api.startDemoCall({ phone: e164, language, name });
    setSubmitting(false);
    if (!result.allowed) return setError(result.reason);
    setError(null);
    setPhase({ kind: "ringing", phone: e164, result });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">Get a reminder call from a demo shop</h1>
        <p className="text-muted-foreground">
          You play a customer of Maa Tara Variety Stores who owes ₹350. Pick a language and hear how Asha, the shop&apos;s AI assistant, handles it.
        </p>
      </div>

      <p className="flex items-start gap-2 rounded-lg bg-promised-soft px-4 py-3 text-sm text-promised">
        <FlaskConical className="mt-0.5 size-4 shrink-0" />
        Prototype: no real call is placed yet. You&apos;ll see the conversation the call would have, line by line.
      </p>

      {phase.kind === "form" ? (
        <Card>
          <CardContent>
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="try-name">Your first name (optional)</Label>
                <Input id="try-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="So Asha can greet you" autoComplete="given-name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="try-phone">Mobile number</Label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-muted-foreground">+91</span>
                  <Input id="try-phone" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => { setPhone(e.target.value); setError(null); }} placeholder="98765 43210" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <RadioGroup value={language} onValueChange={(v) => setLanguage(v as Language)} className="grid grid-cols-3 gap-2">
                  {LANGS.map((l) => (
                    <label key={l.value} className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent">
                      <RadioGroupItem value={l.value} id={`try-lang-${l.value}`} className="sr-only" />
                      <span lang={l.value} className="text-lg">{l.sample}</span>
                      <span className="text-xs text-muted-foreground">{l.label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox id="try-consent" checked={consent} onCheckedChange={(v) => { setConsent(v === true); setError(null); }} className="mt-0.5" />
                <span>I agree to receive one automated demo call on this number. One call per number per day.</span>
              </label>
              {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
              <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={submitting}>
                <PhoneCall /> Call me
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {phase.kind === "ringing" ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="relative grid size-20 place-items-center rounded-full bg-primary text-primary-foreground">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
              <PhoneCall className="relative size-8" />
            </span>
            <p className="font-heading text-xl font-bold">Calling {maskPhone(phase.phone)}…</p>
            <p className="text-sm text-muted-foreground">From Bolna&apos;s shared +91 number, on behalf of Maa Tara Variety Stores.</p>
          </CardContent>
        </Card>
      ) : null}

      {phase.kind === "talking" || phase.kind === "done" ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              {phase.kind === "talking" ? (
                <>
                  <span className="relative flex size-2.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-paid opacity-60" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-paid" />
                  </span>
                  On the call
                </>
              ) : (
                <>
                  <PhoneOff className="size-4 text-muted-foreground" /> Call ended
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Transcript turns={phase.result.turns} language={phase.result.language} autoPlay />
          </CardContent>
        </Card>
      ) : null}

      {phase.kind === "done" ? (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>What the shopkeeper sees</CardTitle>
            <CardDescription>{phase.result.extraction.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <OutcomeBadge outcome={phase.result.extraction.outcome} />
              <ConfidenceBadge value={phase.result.extraction.confidence} />
            </div>
            {phase.result.extraction.promises.map((p, i) => (
              <p key={i} className="text-sm">
                Promise added to the khata: <Money amount={p.amount} className="font-semibold" /> by {format(parseISO(p.dueDate), "EEEE d MMM")}
              </p>
            ))}
            {phase.result.extraction.notes.map((n, i) => (
              <p key={i} className="text-sm text-muted-foreground">
                Noted: {n.text}
              </p>
            ))}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild size="lg">
                <Link href="/app">
                  Open the shop app <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" onClick={() => setPhase({ kind: "form" })}>
                <RotateCcw /> Start again
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
