import { GoogleGenAI, type Content, type FunctionDeclaration, type GenerateContentConfig, type GenerateContentResponse } from "@google/genai";
import type { Language } from "@/lib/domain/types";

/**
 * Gemini, for what the app reads and understands: khata photos, spoken questions, and the "Ask your
 * khata" assistant. Server only: it carries our API key. Every answer is checked against a schema.
 */

export const geminiConfigured = () => Boolean(process.env.GEMINI_API_KEY);
export const geminiModel = () => process.env.GEMINI_MODEL || "gemini-3.8-flash";

/**
 * The model to try when the main one is busy: in testing, gemini-3.8-flash often answered 503
 * ("high demand"), and the SDK's default five retries with back-off took minutes.
 */
const fallbackModel = () => process.env.GEMINI_FALLBACK_MODEL || "gemini-3.6-flash";
const models = () => [...new Set([geminiModel(), fallbackModel()])];

let client: GoogleGenAI | undefined;
function ai(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set (web/.env.local).");
  // One attempt per model (the SDK would otherwise retry five times with back-off); each call sets its own timeout.
  client ??= new GoogleGenAI({ apiKey, httpOptions: { retryOptions: { attempts: 1 } } });
  return client;
}

/**
 * Runs `attempt` with the main model, then with the fallback if the main one fails, each within its
 * time budget (ms). The budgets add up to well under the 60 s a server request may take.
 */
async function withFallback<T>(label: string, budgets: [number, number], attempt: (model: string, timeout: number) => Promise<T>): Promise<T> {
  let last: unknown;
  for (const [i, model] of models().entries()) {
    try {
      return await attempt(model, budgets[Math.min(i, 1)]);
    } catch (err) {
      last = err;
      console.warn(`[gemini] ${label} failed on ${model}:`, err instanceof Error ? err.message.slice(0, 200) : err);
    }
  }
  throw last;
}

const generate = (model: string, timeout: number, contents: Content[], config: GenerateContentConfig): Promise<GenerateContentResponse> =>
  ai().models.generateContent({ model, contents, config: { ...config, httpOptions: { timeout, retryOptions: { attempts: 1 } } } });

/** "audio/webm;codecs=opus" → "audio/webm". */
const baseMime = (mime: string) => mime.split(";")[0].trim().toLowerCase();

async function json<T>(label: string, budgets: [number, number], contents: Content[], schema: unknown, systemInstruction: string): Promise<T> {
  return withFallback(label, budgets, async (model, timeout) => {
    const res = await generate(model, timeout, contents, { systemInstruction, responseMimeType: "application/json", responseJsonSchema: schema, temperature: 0 });
    if (!res.text) throw new Error("Gemini returned nothing.");
    return JSON.parse(res.text) as T;
  });
}

/* ---------------------------------------------------------------- khata photos */

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

const confidence = { type: "number", minimum: 0, maximum: 1 };
const KHATA_SCHEMA = {
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

const KHATA_INSTRUCTION = `You read photos of handwritten credit ledgers (khata) from small Indian shops. Pages are usually in Bengali, sometimes Hindi or English, often mixed, with Bengali or Devanagari digits.
Return one row per entry: who took goods on credit, what, how much and when.
- Skip headings, totals, page numbers and lines that are payments received ("jama", "জমা", "जमा").
- Read Bengali and Devanagari digits as numbers. "৳" or "/-" after a number marks rupees.
- If a number is crossed out and another written beside it, amount is the new one and struck_amount the crossed-out one.
- Dates are usually day/month. Use the year of today's date, or last year if that would put the date in the future.
- Confidence is how sure you are of each field: below 0.8 means the shopkeeper should check it. Never guess silently.`;

export async function readKhataPhoto(image: Uint8Array, mime: string, today: string): Promise<ReadLine[]> {
  const result = await json<{ rows: ReadLine[] }>(
    "khata photo",
    [30_000, 20_000],
    [
      {
        role: "user",
        parts: [{ inlineData: { mimeType: baseMime(mime) || "image/jpeg", data: Buffer.from(image).toString("base64") } }, { text: `Today is ${today}. Read every entry on this page.` }],
      },
    ],
    KHATA_SCHEMA,
    KHATA_INSTRUCTION,
  );
  return result.rows.filter((r) => r.name?.trim() && Number.isFinite(r.amount) && r.amount > 0);
}

/* ---------------------------------------------------------------- spoken questions */

const TRANSCRIPT_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string", description: "Exactly what was said, in the script of the language spoken. Empty if nothing was said." },
    language: { type: "string", enum: ["bn", "hi", "en"] },
  },
  required: ["text", "language"],
};

export async function transcribeQuestion(audio: Uint8Array, mime: string): Promise<{ text: string; language: Language }> {
  return json(
    "transcription",
    [15_000, 12_000],
    [
      {
        role: "user",
        parts: [{ inlineData: { mimeType: baseMime(mime) || "audio/webm", data: Buffer.from(audio).toString("base64") } }, { text: "Transcribe this question." }],
      },
    ],
    TRANSCRIPT_SCHEMA,
    `You transcribe short questions a shopkeeper in India asks their credit book app, in Bengali, Hindi, English or a mix (Hinglish).
Write Bengali in Bengali script and Hindi in Devanagari, except words said in English, which stay in English. Write Hinglish as spoken, in Latin letters.
Don't translate, answer or add anything. language is the main language spoken.`,
  );
}

/* ---------------------------------------------------------------- the assistant */

export type ToolRun = (name: string, args: Record<string, unknown>) => Promise<unknown>;

/**
 * Answers a question by letting Gemini call our tools on the shop's data, a few rounds at most.
 * Returns the final answer and the calls made, in order.
 */
export async function answerWithTools(
  question: string,
  tools: FunctionDeclaration[],
  run: ToolRun,
  systemInstruction: string,
): Promise<{ answer: string; calls: { name: string; args: Record<string, unknown> }[] }> {
  // A conversation stays on one model: thought signatures only mean something to the model that made them.
  // The whole answer must arrive within ~40 s; after that the keyword assistant answers instead.
  const deadline = Date.now() + 40_000;
  return withFallback("ask", [12_000, 12_000], (model, timeout) => converse(model, timeout, deadline, question, tools, run, systemInstruction));
}

async function converse(model: string, timeout: number, deadline: number, question: string, tools: FunctionDeclaration[], run: ToolRun, systemInstruction: string) {
  const contents: Content[] = [{ role: "user", parts: [{ text: question }] }];
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  for (let round = 0; round < 4; round++) {
    const left = deadline - Date.now();
    if (left < 3_000) throw new Error("Out of time");
    const res = await generate(model, Math.min(timeout, left), contents, { systemInstruction, tools: [{ functionDeclarations: tools }], temperature: 0.2 });
    const wanted = res.functionCalls ?? [];
    if (wanted.length === 0) return { answer: (res.text ?? "").trim(), calls };
    // The model's turn goes back as it came, so its thought signatures stay attached.
    const turn = res.candidates?.[0]?.content;
    if (turn) contents.push(turn);
    const parts = [];
    for (const fc of wanted) {
      const name = fc.name ?? "";
      const args = (fc.args ?? {}) as Record<string, unknown>;
      calls.push({ name, args });
      let response: unknown;
      try {
        response = await run(name, args);
      } catch (err) {
        response = { error: err instanceof Error ? err.message : String(err) };
      }
      parts.push({ functionResponse: { id: fc.id, name, response: { result: response } } });
    }
    contents.push({ role: "user", parts });
  }
  return { answer: "", calls };
}
