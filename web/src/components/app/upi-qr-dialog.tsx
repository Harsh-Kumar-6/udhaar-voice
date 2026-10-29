"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";

/** A UPI QR code for the amount due, for a customer paying at the counter with any UPI app. */
export function UpiQrDialog({ open, onOpenChange, link, amount }: { open: boolean; onOpenChange: (v: boolean) => void; link: string; amount: string }) {
  const t = useT().customers.detail.qr;
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    QRCode.toDataURL(link, { width: 320, margin: 1, errorCorrectionLevel: "M" }).then((url) => {
      if (!cancelled) setImage(url);
    });
    return () => {
      cancelled = true;
    };
  }, [open, link]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.title(amount)}</DialogTitle>
          <DialogDescription>{t.hint}</DialogDescription>
        </DialogHeader>
        {image ? (
          // A data URL generated here; next/image can't optimise it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={t.title(amount)} className="mx-auto aspect-square w-full max-w-72 rounded-lg bg-white p-2" />
        ) : (
          <div className="mx-auto aspect-square w-full max-w-72 animate-pulse rounded-lg bg-muted" />
        )}
      </DialogContent>
    </Dialog>
  );
}
