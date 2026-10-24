"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/api/hooks";
import { useT } from "@/lib/i18n";

/**
 * Client-side gate for /app routes. Redirects to /login when no one is signed in.
 * While the session is still loading (always the case when the server prerenders), the app
 * renders as normal: screens fetch their own data and show their own loading states, and
 * Next.js can validate every page for instant navigation. Only a confirmed "signed out"
 * hides the app. Real auth will replace this with a server-side cookie check once Supabase lands.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const session = useSession();
  const t = useT().auth;
  const signedOut = !session.isPending && !session.data;

  useEffect(() => {
    if (signedOut) router.replace("/login");
  }, [signedOut, router]);

  if (signedOut) {
    return (
      <div className="grid min-h-dvh place-items-center px-4 text-sm text-muted-foreground">{t.gate}</div>
    );
  }
  return <>{children}</>;
}
