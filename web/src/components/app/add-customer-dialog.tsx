"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api";
import { attempt, useApiMutation, useShop } from "@/lib/api/hooks";
import type { Language } from "@/lib/domain/types";
import { useT } from "@/lib/i18n";

/** Adds a customer by hand, then opens their page to add what they owe. */
export function AddCustomerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useT();
  const a = t.customers.add;
  const router = useRouter();
  const shop = useShop();
  const [name, setName] = useState("");
  const [nameNative, setNameNative] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState<Language | null>(null);
  const [error, setError] = useState<string | null>(null);
  const add = useApiMutation(api.addCustomer);
  const chosen = language ?? shop.data?.defaultCustomerLanguage ?? "bn";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(a.invalid);
    const done = await attempt(add.mutateAsync({ name, nameNative, phone, language: chosen }));
    if (!done) return;
    toast.success(a.saved(done.value.name));
    onOpenChange(false);
    router.push(`/app/customers/${done.value.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{a.title}</DialogTitle>
            <DialogDescription>{a.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-customer-name">{a.name}</Label>
            <Input id="new-customer-name" value={name} autoComplete="off" onChange={(e) => { setName(e.target.value); setError(null); }} aria-invalid={!!error} />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-customer-native">{a.nameNative}</Label>
            <Input id="new-customer-native" value={nameNative} autoComplete="off" onChange={(e) => setNameNative(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-customer-phone">{a.phone}</Label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">+91</span>
              <Input id="new-customer-phone" inputMode="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{a.language}</Label>
            <ToggleGroup type="single" variant="outline" value={chosen} onValueChange={(v) => v && setLanguage(v as Language)}>
              {(["bn", "hi", "en"] as const).map((l) => (
                <ToggleGroupItem key={l} value={l}>
                  {t.common.language[l]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <DialogFooter>
            <Button type="submit" size="lg" disabled={add.isPending}>
              {a.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
