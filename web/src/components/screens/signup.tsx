"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/app/password-input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api";
import type { Session, SignUpInput } from "@/lib/api/contract";
import { useApiMutation } from "@/lib/api/hooks";
import { LANGUAGES, type Language } from "@/lib/domain/types";
import { useT } from "@/lib/i18n";


export function SignupScreen() {
  const t = useT().auth;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState<Language>("bn");
  const [error, setError] = useState<string | null>(null);
  /** Set once a code has been emailed; the form then asks for it. */
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const signUp = useApiMutation((input: SignUpInput) => api.signUp(input), { quiet: true });
  const verify = useApiMutation((input: { email: string; code: string }) => api.verifySignUp(input), { quiet: true });
  const resend = useApiMutation((input: { email: string }) => api.resendSignUpCode(input), { quiet: true });

  const done = (session: Session) => {
    queryClient.setQueryData(["session"], session);
    toast.success(t.signup.created);
    router.push("/app");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const result = await signUp.mutateAsync({ shopName, ownerName, phone, email, password, language });
      if ("session" in result) done(result.session);
      else setVerifyEmail(result.verifyEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your khata.");
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyEmail) return;
    setError(null);
    try {
      done(await verify.mutateAsync({ email: verifyEmail, code }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (verifyEmail) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">{t.signup.codeTitle}</CardTitle>
            <CardDescription>{t.signup.codeSent(verifyEmail)}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-code">{t.signup.code}</Label>
                <Input
                  id="signup-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="text-center font-mono text-xl tracking-[0.4em]"
                  aria-invalid={!!error}
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" size="lg" className="w-full" disabled={verify.isPending}>
                {t.signup.verify}
              </Button>
            </form>
            <Button
              variant="ghost"
              className="mt-2 w-full"
              disabled={resend.isPending}
              onClick={async () => {
                try {
                  await resend.mutateAsync({ email: verifyEmail });
                  toast.success(t.signup.codeResent);
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                }
              }}
            >
              {t.signup.resend}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">{t.signup.title}</CardTitle>
          <CardDescription>{t.signup.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shop">{t.signup.shopName}</Label>
              <Input id="shop" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder={t.signup.shopNamePlaceholder} aria-invalid={!!error} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner">{t.signup.ownerName}</Label>
              <Input id="owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder={t.signup.ownerNamePlaceholder} aria-invalid={!!error} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-phone">{t.signup.phone}</Label>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">+91</span>
                <Input id="signup-phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!error} />
              </div>
              <p className="text-xs text-muted-foreground">{t.signup.phoneHint}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">{t.signup.email}</Label>
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                required
                placeholder={t.signup.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!error}
              />
              <p className="text-xs text-muted-foreground">{t.signup.emailHint}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">{t.signup.password}</Label>
              <PasswordInput id="signup-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!error} />
            </div>
            <div className="space-y-2">
              <Label>{t.signup.language}</Label>
              <ToggleGroup type="single" variant="outline" className="flex-wrap" value={language} onValueChange={(v) => v && setLanguage(v as Language)}>
                {LANGUAGES.map((l) => (
                  <ToggleGroupItem key={l} value={l}>
                    {t.signup.languageOptions[l]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" size="lg" className="w-full" disabled={signUp.isPending}>
              {t.signup.submit}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t.signup.hasAccount}{" "}
            <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              {t.signup.signInLink}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
