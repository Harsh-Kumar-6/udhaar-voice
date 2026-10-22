"use client";

import { useEffect, useRef, useState } from "react";

/** Longest clip we record. A question to the khata is a sentence or two. */
const MAX_SECONDS = 30;

export type RecorderStartResult = "recording" | "denied" | "unsupported";

/**
 * Records one voice clip with the browser's MediaRecorder: `start` asks for the microphone and
 * begins, `stop` ends it (it also stops itself after MAX_SECONDS) and hands the clip to `onClip`.
 */
export function useVoiceRecorder() {
  const [recordingSince, setRecordingSince] = useState<number | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const stop = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const start = async (onClip: (audio: Blob) => void): Promise<RecorderStartResult> => {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return "unsupported";
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return "denied";
    }
    const chunks: Blob[] = [];
    const r = new MediaRecorder(stream);
    r.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    r.onstop = () => {
      for (const track of stream.getTracks()) track.stop();
      window.clearTimeout(timer.current);
      recorder.current = null;
      setRecordingSince(null);
      if (chunks.length > 0) onClip(new Blob(chunks, { type: r.mimeType }));
    };
    r.start();
    recorder.current = r;
    setRecordingSince(Date.now());
    timer.current = window.setTimeout(stop, MAX_SECONDS * 1000);
    return "recording";
  };

  // Leaving the page releases the microphone without sending anything.
  useEffect(
    () => () => {
      const r = recorder.current;
      if (!r) return;
      r.onstop = null;
      if (r.state === "recording") r.stop();
      for (const track of r.stream.getTracks()) track.stop();
      window.clearTimeout(timer.current);
    },
    [],
  );

  return { recordingSince, start, stop, maxSeconds: MAX_SECONDS };
}
