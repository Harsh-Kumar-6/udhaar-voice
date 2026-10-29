import type { AiProvider, AiStep } from "./contract";

/**
 * Asks each model provider in turn until one answers: `run` is called with no provider first (the
 * server picks the first), then with whichever the server names next. `onNext` hears each switch,
 * so the screen can say a second model is trying.
 */
export async function untilAnswered<T>(run: (provider?: AiProvider) => Promise<AiStep<T>>, onNext?: (provider: AiProvider) => void, start?: AiProvider): Promise<T> {
  let provider = start;
  for (let i = 0; i < 4; i++) {
    const step = await run(provider);
    if ("result" in step) return step.result;
    provider = step.next;
    onNext?.(provider);
  }
  throw new Error("Couldn't get an answer. Try again in a minute.");
}
