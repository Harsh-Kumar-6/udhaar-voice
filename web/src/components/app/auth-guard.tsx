"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/api/hooks";
import { useT } from "@/lib/i18n";

/**
 * Client-side gate for /app routes. Redirects to /login when no one is signed in.
 * Real auth will replace this with a server-side cookie check once Supabase lands.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const session = useSession();
  const t = useT().auth;

  useEffect(() => {
    if (!session.isPending && !session.data) router.replace("/login");
  }, [session.isPending, session.data, router]);

  if (session.isPending) {
    return (
      <div className="grid min-h-dvh place-items-center px-4 text-sm text-muted-foreground">{t.loading}</div>
    );
  }
  if (!session.data) {
    return (
      <div className="grid min-h-dvh place-items-center px-4 text-sm text-muted-foreground">{t.gate}</div>
    );
  }
  return <>{children}</>;
}
