"use client";

import { Camera } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";

/** Takes a photo with a laptop or tablet camera, where the file picker can't open the camera. */
export function CameraDialog({ open, onOpenChange, onPhoto }: { open: boolean; onOpenChange: (v: boolean) => void; onPhoto: (photo: File) => void }) {
  const t = useT().khata.camera;
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | undefined;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((track) => track.stop());
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => setError(t.denied));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [open, t.denied]);

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onPhoto(new File([blob], "khata.jpg", { type: "image/jpeg" }));
        onOpenChange(false);
      },
      "image/jpeg",
      0.9,
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setError(null); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{error ?? t.hint}</DialogDescription>
        </DialogHeader>
        {!error ? <video ref={video} autoPlay playsInline muted className="aspect-[4/3] w-full rounded-lg bg-black object-contain" /> : null}
        <DialogFooter>
          <Button size="lg" onClick={capture} disabled={!!error}>
            <Camera /> {t.capture}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
