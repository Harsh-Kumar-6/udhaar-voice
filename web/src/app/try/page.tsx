import { MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TryCallScreen } from "@/components/screens/try-call";

export const metadata: Metadata = { title: "Try a reminder call" };

export default function TryPage() {
  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <MessagesSquare className="size-5" />
            </span>
            <span className="font-heading text-lg font-bold">Udhaar Voice</span>
          </Link>
          <Link href="/app" className="text-sm font-medium text-primary hover:underline">
            Open the shop app
          </Link>
        </div>
      </header>
      <main className="px-4 py-10 sm:px-6">
        <TryCallScreen />
      </main>
    </div>
  );
}
