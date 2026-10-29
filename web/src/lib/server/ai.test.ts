import { describe, expect, it, vi } from "vitest";
import { step, type Provider } from "./ai";
import { fakeProvider } from "./fake-provider";

describe("model fallback", () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const ok = (p: Provider) => Promise.resolve(p.name);
  const busy = () => Promise.reject(new Error("503 high demand"));

  it("answers from the first provider when it works", async () => {
    expect(await step([fakeProvider("gemini"), fakeProvider("meta")], undefined, "test", ok)).toEqual({ result: "gemini" });
  });

  it("names the next provider when the first fails, and runs the one asked for", async () => {
    const providers = [fakeProvider("gemini"), fakeProvider("meta")];
    expect(await step(providers, undefined, "test", busy)).toEqual({ next: "meta" });
    expect(await step(providers, "meta", "test", ok)).toEqual({ result: "meta" });
  });

  it("throws when the last provider fails", async () => {
    await expect(step([fakeProvider("gemini"), fakeProvider("meta")], "meta", "test", busy)).rejects.toThrow(/503/);
  });

  it("skips providers without a key", async () => {
    const providers = [fakeProvider("gemini", { configured: () => false }), fakeProvider("meta")];
    expect(await step(providers, undefined, "test", ok)).toEqual({ result: "meta" });
    await expect(step(providers, undefined, "test", busy)).rejects.toThrow();
    await expect(step([], undefined, "test", ok)).rejects.toThrow(/No AI provider/);
  });
});
