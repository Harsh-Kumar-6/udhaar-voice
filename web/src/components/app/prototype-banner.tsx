"use client";

import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { useT } from "@/lib/i18n";

/** Shown on every screen until the real engine is connected. */
export function PrototypeBanner() {
  const t = useT().common.prototype;
  return (
    <div className="flex items-center justify-center gap-2 border-b bg-promised-soft px-4 py-1.5 text-center text-xs font-medium text-promised">
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      <span>{t.banner}</span>
      <Link href="/app/settings#about" className="underline underline-offset-2 hover:no-underline">
        {t.learnMore}
      </Link>
    </div>
  );
}
