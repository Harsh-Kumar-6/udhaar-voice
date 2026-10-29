"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/app/password-input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { ProfileInput, Session } from "@/lib/api/contract";
import { useApiMutation, useSession } from "@/lib/api/hooks";
import { useT } from "@/lib/i18n";


export function ProfileScreen() {
  const t = useT().profile;
  const q = useSession();
  if (q.isPending) return <LoadingBlock />;
  if (q.isError || !q.data) return <ErrorBlock onRetry={() => q.refetch()} />;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={t.title} description={t.description} />
      <ProfileForm key={JSON.stringify(q.data)} session={q.data} />
      <ChangePassword />
    </div>
  );
}

/** Shows a stored +91 number as the 10 digits people type. */
const localPhone = (e164: string) => e164.replace(/^\+91/, "");

function ProfileForm({ session: { user, shop } }: { session: Session }) {
  const { profile: t } = useT();
  const save = useApiMutation(api.updateProfile, { quiet: true });
  const [draft, setDraft] = useState<ProfileInput>({
    name: user.name,
    phone: localPhone(user.phone),
    email: user.email ?? "",
    shopName: shop.name,
    upiId: shop.upiId,
  });
  const set = (key: keyof ProfileInput, value: string) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save.mutateAsync(draft);
      toast.success(t.saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const field = (key: keyof ProfileInput, label: string, hint?: string, props?: React.ComponentProps<typeof Input>) => (
    <div className="space-y-1.5">
      <Label htmlFor={`profile-${key}`}>{label}</Label>
      <Input id={`profile-${key}`} value={draft[key] ?? ""} onChange={(e) => set(key, e.target.value)} className="h-11 sm:h-10" {...props} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t.you.title}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {field("name", t.you.name, undefined, { autoComplete: "name", required: true })}
          {field("phone", t.you.phone, t.you.phoneHint, { inputMode: "tel", autoComplete: "tel-national", required: true })}
          {field("email", t.you.email, t.you.emailHint, { type: "email", autoComplete: "email", required: true })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.shop.title}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {field("shopName", t.shop.name, undefined, { autoComplete: "organization", required: true })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.payments.title}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {field("upiId", t.payments.upi, t.payments.upiHint, { autoCapitalize: "none", spellCheck: false })}
        </CardContent>
      </Card>

      <div className="sticky bottom-20 z-10 flex justify-end lg:static">
        <Button type="submit" size="lg" className="w-full shadow-lg sm:w-auto lg:shadow-none" disabled={save.isPending}>
          {t.save}
        </Button>
      </div>
    </form>
  );
}

function ChangePassword() {
  const t = useT().profile.account;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const change = useApiMutation(api.changePassword, { quiet: true });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== again) return setError(t.mismatch);
    setError(null);
    try {
      await change.mutateAsync({ current, next });
      toast.success(t.changed);
      setCurrent("");
      setNext("");
      setAgain("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <form onSubmit={submit}>
      <Card>
        <CardHeader>
          <CardTitle>{t.title}</CardTitle>
          <CardDescription>{t.password}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="password-current">{t.current}</Label>
            <PasswordInput id="password-current" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="h-11 sm:h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password-new">{t.next}</Label>
            <PasswordInput id="password-new" autoComplete="new-password" required minLength={6} value={next} onChange={(e) => setNext(e.target.value)} className="h-11 sm:h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password-again">{t.confirm}</Label>
            <PasswordInput id="password-again" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} className="h-11 sm:h-10" />
          </div>
          {error ? <p className="text-sm text-destructive sm:col-span-3">{error}</p> : null}
          <div className="sm:col-span-3">
            <Button type="submit" variant="outline" disabled={change.isPending}>
              {t.change}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
