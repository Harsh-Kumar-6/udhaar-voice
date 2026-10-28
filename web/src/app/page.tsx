import {
  ArrowRight,
  BellRing,
  BookOpenCheck,
  Brain,
  Camera,
  Clock,
  Languages,
  MessagesSquare,
  PhoneCall,
  PhoneOff,
  ShieldCheck,
  Sparkles,
  UserX,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SampleKhataPage } from "@/components/app/sample-khata";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: { absolute: "Udhaar Voice: your khata, collected by voice" },
};

const steps = [
  { icon: Camera, title: "Snap the khata", body: "Photograph a page of the credit book. Names, amounts and dates are read for you, and you fix anything it wasn't sure about." },
  { icon: BellRing, title: "Schedule reminders", body: "Pick customers and a time. Calls go out in batches, only inside calling hours, and never twice within the gap you set." },
  { icon: PhoneCall, title: "Asha makes the call", body: "A polite AI assistant calls in the customer's own language, reminds them of the amount, and asks when they can pay." },
  { icon: Brain, title: "Every call is remembered", body: "Promises, disputes and what customers said go into the shop's memory, so the next call can say “last week you said Friday”." },
  { icon: Sparkles, title: "Ask your khata", body: "Ask “Kaun is hafte dega?” and hear the answer. Every evening, Asha calls the shopkeeper with the day's summary." },
];

const rules = [
  { icon: MessagesSquare, text: "Says it's an AI assistant calling for the shop." },
  { icon: Clock, text: "Calls only between 8 AM and 7 PM, and never twice within a few days." },
  { icon: UserX, text: "“Don't call me again” goes on an opt-out list straight away." },
  { icon: PhoneOff, text: "Never re-dials a wrong number, and leaves people alone after a refusal." },
  { icon: ShieldCheck, text: "Never tells anyone else what a customer owes." },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <MessagesSquare className="size-5" />
            </span>
            <span className="font-heading text-lg font-bold">Udhaar Voice</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <a href="#how">How it works</a>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/try">Try a call</Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/app">Open the app</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div className="space-y-6">
            <p className="font-mono text-xs font-semibold tracking-wider text-primary uppercase">For neighbourhood shops that sell on credit</p>
            <h1 className="text-4xl leading-[1.05] font-extrabold sm:text-5xl lg:text-6xl">Your khata, collected by voice.</h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Photograph a shop&apos;s credit ledger. Udhaar Voice calls each customer in Bengali or Hindi, records promises to pay, and lets the shopkeeper ask the khata anything by voice.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 px-5 text-base">
                <Link href="/try">
                  <PhoneCall /> Try a reminder call
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-5 text-base">
                <Link href="/app">
                  Open the shop app <ArrowRight />
                </Link>
              </Button>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <Languages className="size-4 text-primary" /> Bengali, Hindi, English
              </li>
              <li className="flex items-center gap-1.5">
                <Clock className="size-4 text-primary" /> Calls 8 AM–7 PM only
              </li>
              <li className="flex items-center gap-1.5">
                <BookOpenCheck className="size-4 text-primary" /> Daily report call
              </li>
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <SampleKhataPage className="rotate-[-2deg]" />
            <div className="absolute -right-2 -bottom-10 w-[85%] rotate-[1.5deg] rounded-2xl border bg-card p-4 shadow-xl sm:-right-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-paid opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-paid" />
                  </span>
                  Asha · calling Imran
                </span>
                <span className="font-mono text-xs text-muted-foreground">0:21</span>
              </div>
              <div className="space-y-2 text-sm">
                <p lang="bn" className="rounded-xl rounded-tl-sm bg-accent px-3 py-2">
                  আপনার খাতায় ৪৩০ টাকা বাকি আছে। কবে নাগাদ দিতে পারবেন?
                </p>
                <p lang="bn" className="ml-auto w-fit rounded-xl rounded-tr-sm bg-muted px-3 py-2">
                  রবিবার দিয়ে দেব।
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t pt-3 text-xs">
                <span className="rounded-full bg-promised-soft px-2.5 py-1 font-semibold text-promised">Promised ₹430 · Sunday</span>
                <span className="rounded-full bg-callback-soft px-2.5 py-1 font-semibold text-callback">Asked for Maggi</span>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="scroll-mt-20 border-t bg-card/50">
          <div className="mx-auto max-w-6xl space-y-10 px-4 py-16 sm:px-6">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-3xl font-bold">How it works</h2>
              <p className="text-muted-foreground">From a photo of the khata to money back in the drawer, without the shopkeeper making a single awkward call.</p>
            </div>
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {steps.map((s, i) => (
                <li key={s.title} className="space-y-3 rounded-xl border bg-background p-5">
                  <div className="flex items-center justify-between">
                    <span className="grid size-10 place-items-center rounded-lg bg-accent text-primary">
                      <s.icon className="size-5" />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                  </div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold">Polite by design</h2>
            <p className="text-muted-foreground">
              Credit at a local shop runs on trust. Udhaar Voice reminds people the way a good shopkeeper would, and knows when to stop.
            </p>
          </div>
          <ul className="space-y-3">
            {rules.map((r) => (
              <li key={r.text} className="flex items-start gap-3 rounded-xl border p-4">
                <r.icon className="mt-0.5 size-5 shrink-0 text-primary" />
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-3xl font-bold">Hear it for yourself</h2>
              <p className="text-primary-foreground/80">
                Play a customer of our demo shop who owes ₹350, and see what the shopkeeper sees afterwards. Built on Bolna voice agents for the Bolna Buildathon 2026.
              </p>
            </div>
            <Button asChild size="lg" variant="secondary" className="h-11 px-5 text-base">
              <Link href="/try">
                <PhoneCall /> Try a reminder call
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <span>Udhaar Voice · Bolna Buildathon 2026</span>
          <span>Voice agents by Bolna · Speech by Sarvam and ElevenLabs · Khata reading by Gemini</span>
        </div>
      </footer>
    </div>
  );
}
