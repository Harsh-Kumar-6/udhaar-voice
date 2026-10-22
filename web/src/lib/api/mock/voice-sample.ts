import type { Transcription } from "../contract";

/**
 * MOCK ONLY. What the dummy speech-to-text "hears". The clip is recorded but not sent anywhere;
 * each recording returns the next of these. The real version sends the audio to Gemini or Sarvam.
 */
export const SAMPLE_TRANSCRIPTIONS: Transcription[] = [
  { text: "Kaun is hafte dega?", language: "hi" },
  { text: "এই সপ্তাহে কে দেবে?", language: "bn" },
  { text: "Ramesh ka kitna baaki hai?", language: "hi" },
  { text: "আজ কত টাকা এল?", language: "bn" },
  { text: "Who broke a promise?", language: "en" },
];
