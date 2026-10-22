import { describe, expect, it } from "vitest";
import { mockApi } from "./index";
import { SAMPLE_TRANSCRIPTIONS } from "./voice-sample";

describe("voice questions (mock speech-to-text)", () => {
  it("returns the sample questions in turn, whatever was recorded", async () => {
    const clip = new Blob(["not really audio"], { type: "audio/webm" });
    const heard = [await mockApi.transcribe(clip), await mockApi.transcribe(clip)];
    expect(heard).toEqual(SAMPLE_TRANSCRIPTIONS.slice(0, 2));
  });

  it("hears something the assistant can answer", async () => {
    const { text } = SAMPLE_TRANSCRIPTIONS[0];
    expect((await mockApi.ask(text)).tool).not.toBe("none");
  });
});
