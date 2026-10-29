import { describe, expect, it } from "vitest";
import type { AiProvider, AiStep } from "./contract";
import { untilAnswered } from "./steps";

describe("asking each provider in turn", () => {
  it("follows the server to the next provider and reports the switch", async () => {
    const asked: (AiProvider | undefined)[] = [];
    const switched: AiProvider[] = [];
    const result = await untilAnswered(
      async (provider): Promise<AiStep<string>> => {
        asked.push(provider);
        return provider === "meta" ? { result: "read by meta" } : { next: "meta" };
      },
      (p) => switched.push(p),
    );
    expect(result).toBe("read by meta");
    expect(asked).toEqual([undefined, "meta"]);
    expect(switched).toEqual(["meta"]);
  });

  it("carries on from where it was, after a reload", async () => {
    const asked: (AiProvider | undefined)[] = [];
    await untilAnswered(async (p) => (asked.push(p), { result: 1 }), undefined, "meta");
    expect(asked).toEqual(["meta"]);
  });

  it("stops instead of looping when the server keeps saying try again", async () => {
    await expect(untilAnswered(async () => ({ next: "meta" as const }))).rejects.toThrow();
  });
});
