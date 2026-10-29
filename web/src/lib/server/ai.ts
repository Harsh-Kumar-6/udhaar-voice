import type { AiProvider, AiStep } from "@/lib/api/contract";
import type { Language } from "@/lib/domain/types";

/**
 * What the app reads and understands (khata photos, spoken questions, the "Ask your khata"
 * assistant), with the same prompts and answer schemas for every model provider. Gemini is tried
 * first and Meta's Muse Spark after it. Each provider is one request from the browser, so each
 * gets a full server request's time, and the screen can say which one is working.
 */

/** One line of a khata page as read. Confidence is 0–1 per field. */
export type ReadLine = {
  name: string;
  name_native: string;
  amount: number;
  struck_amount: number | null;
  date: string | null;
  items: string;
  confidence: { name: number; amount: number; date: number; items: number };
};

/** A tool the assistant may call: a name, what it does, and its arguments as JSON Schema. */
export type ToolSpec = { name: string; description: string; parametersJsonSchema?: Record<string, unknown> };
export type ToolRun = (name: string, args: Record<string, unknown>) => Promise<unknown>;
export type ToolAnswer = { answer: string; calls: { name: string; args: Record<string, unknown> }[] };

export type Provider = {
  name: AiProvider;
  configured: () => boolean;
  /** The model that reads photos, saved with each import. */
  model: () => string;
  readKhataPhoto: (image: Uint8Array, mime: string, today: string) => Promise<ReadLine[]>;
  transcribeQuestion: (audio: Uint8Array, mime: string) => Promise<{ text: string; language: Language }>;
  answerWithTools: (question: string, tools: ToolSpec[], run: ToolRun, instruction: string) => Promise<ToolAnswer>;
};

/**
 * Runs one step on `requested` (or the first provider). If it fails and another provider comes
 * after it, the answer names that one for the browser to ask next; if none is left, the error is
 * thrown. `AI_TEST_FAIL=gemini` makes a provider fail on purpose, to try the fallback locally;
 * it is ignored on Vercel.
 */
export async function step<T>(providers: Provider[], requested: AiProvider | undefined, label: string, run: (p: Provider) => Promise<T>): Promise<AiStep<T>> {
  const ready = providers.filter((p) => p.configured());
  const index = Math.max(0, ready.findIndex((p) => p.name === requested));
  const provider = ready[index];
  if (!provider) throw new Error("No AI provider is set up (GEMINI_API_KEY or META_API_KEY).");
  try {
    if (failsOnPurpose(provider.name)) throw new Error(`${provider.name} failed on purpose (AI_TEST_FAIL)`);
    return { result: await run(provider) };
  } catch (err) {
    console.warn(`[ai] ${label} failed on ${provider.name}:`, err instanceof Error ? err.message.slice(0, 300) : err);
    const next = ready[index + 1];
    if (next) return { next: next.name };
    throw err;
  }
}

const failsOnPurpose = (name: AiProvider) =>
  !process.env.VERCEL &&
  (process.env.AI_TEST_FAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .includes(name);

/** "audio/webm;codecs=opus" → "audio/webm". */
export const baseMime = (mime: string) => mime.split(";")[0].trim().toLowerCase();

/* ---------------------------------------------------------------- khata photos */

const confidence = { type: "number", minimum: 0, maximum: 1 };
export const KHATA_SCHEMA = {
  type: "object",
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "The customer's name in Latin letters, e.g. Ramesh." },
          name_native: { type: "string", description: "The name exactly as written, in its own script. Empty if written in Latin letters." },
          amount: { type: "integer", description: "The amount owed in whole rupees, as finally written." },
          struck_amount: { type: ["integer", "null"], description: "An amount crossed out and written over, if any." },
          date: { type: ["string", "null"], description: "The entry's date as YYYY-MM-DD, or null if the line has none." },
          items: { type: "string", description: "What was bought, in short English, e.g. Rice 2 kg." },
          confidence: {
            type: "object",
            properties: { name: confidence, amount: confidence, date: confidence, items: confidence },
            required: ["name", "amount", "date", "items"],
          },
        },
        required: ["name", "name_native", "amount", "struck_amount", "date", "items", "confidence"],
      },
    },
  },
  required: ["rows"],
};

export const KHATA_INSTRUCTION = `You read photos of handwritten credit ledgers (khata) from small Indian shops. Pages may be in Bengali, Hindi, Odia, Marathi or English, often mixed, with Bengali, Devanagari, Odia or Latin digits.
Return one row per entry: who took goods on credit, what, how much and when.
- Skip headings, totals, page numbers and lines that are payments received ("jama", "জমা", "जमा").
- Read Bengali, Devanagari and Odia digits as numbers. "৳" or "/-" after a number marks rupees.
- If a number is crossed out and another written beside it, amount is the new one and struck_amount the crossed-out one.
- Dates are usually day/month. Use the year of today's date, or last year if that would put the date in the future.
- Confidence is how sure you are of each field: below 0.8 means the shopkeeper should check it. Never guess silently.`;

export const khataPrompt = (today: string) => `Today is ${today}. Read every entry on this page.`;

/** Rows without a name or a positive amount aren't entries. */
export const usableLines = (rows: ReadLine[]) => rows.filter((r) => r.name?.trim() && Number.isFinite(r.amount) && r.amount > 0);

/* ---------------------------------------------------------------- spoken questions */

export const TRANSCRIPT_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string", description: "Exactly what was said, in the script of the language spoken. Empty if nothing was said." },
    language: { type: "string", enum: ["en", "hi", "or", "bn", "mr"] },
  },
  required: ["text", "language"],
};

export const TRANSCRIPT_INSTRUCTION = `You transcribe short questions a shopkeeper in India asks their credit book app, in English, Hindi, Odia, Bengali, Marathi or a mix.
Write each language in its own script: Hindi and Marathi in Devanagari, Odia in Odia, Bengali in Bengali. Names of people and shops go in that script too; English words said in the middle of a sentence stay in English.
Use Latin letters only for Hinglish: Hindi spoken mostly with English words, as people type it in chats.
Don't translate, answer or add anything. language is the main language spoken; Hinglish is hi.`;

export const TRANSCRIPT_PROMPT = "Transcribe this question.";
