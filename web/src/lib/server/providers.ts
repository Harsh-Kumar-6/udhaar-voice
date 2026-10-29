import type { Provider } from "./ai";
import { gemini } from "./gemini";
import { meta } from "./meta";

/** The order models are tried in: Gemini, then Meta. Only the ones with a key count. */
export const PROVIDERS: Provider[] = [gemini, meta];

export const aiConfigured = () => PROVIDERS.some((p) => p.configured());
