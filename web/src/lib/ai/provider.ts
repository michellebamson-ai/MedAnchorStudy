import { ClaudeProvider, readClaudeConfig, type EnvLike } from "./claude";
import { SimulatedProvider } from "./simulated";
import type { AIProvider } from "./types";

/**
 * Which provider serves a request.
 *
 * Claude is used only when it is *fully* configured — key and model id. Anything
 * missing and we serve the deterministic provider, so a half-finished environment
 * degrades to today's behaviour instead of failing every request.
 *
 * `AI_FALLBACK_PROVIDER=simulated` forces the deterministic path, which is how
 * you A/B the two and how the offline smoke tests run.
 */
export function getProvider(env: EnvLike = process.env): AIProvider {
  const forced = (env.AI_FALLBACK_PROVIDER ?? "").trim().toLowerCase();
  if (forced === "simulated" || forced === "rules" || forced === "offline") {
    return new SimulatedProvider();
  }

  const config = readClaudeConfig(env);
  if (!config) return new SimulatedProvider();

  // The deterministic provider stays wired as the safety net, so one failed call
  // or malformed reply still returns something usable.
  return new ClaudeProvider(config, new SimulatedProvider());
}

/** True when a real model is serving requests. Surfaced in the UI copy. */
export function isLiveProvider(provider: AIProvider = getProvider()): boolean {
  return provider.isLive;
}

export { ClaudeProvider, readClaudeConfig, SimulatedProvider };