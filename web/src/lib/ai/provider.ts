import { ClaudeProvider, readClaudeConfig, type EnvLike } from "./claude";
import { GeminiProvider, readGeminiConfig } from "./gemini";
import { GroqProvider, readGroqConfig } from "./groq";
import { SimulatedProvider } from "./simulated";
import type {
  AIProvider,
  GradeRequest,
  GradeResult,
  GenerateRequest,
  GeneratedArtifact,
  RoleplayRequest,
  RoleplayTurn,
  TeachRequest,
  TeachTurn,
} from "./types";

export type ProviderId = "claude" | "gemini" | "groq" | "simulated";

/**
 * Which provider serves a request.
 *
 * A provider is used only when it is *fully* configured — key and model id.
 * Anything missing and we serve the deterministic provider, so a half-finished
 * environment degrades to today's behaviour instead of failing every request.
 *
 * Chat and content are routed separately, because they have opposite
 * requirements. Tutor turns and role-play are latency-bound: a student waits on
 * a loading dot, so they go wherever the model is fastest. Generating study
 * material and grading are accuracy-bound, because a confident wrong medical
 * fact is the worst failure this product can have — so those go to the strongest
 * model configured.
 *
 * Precedence per lane:
 *   chat    — Groq, then Claude, then Gemini, then deterministic
 *   content — Claude, then Gemini, then Groq, then deterministic
 *
 * Override with AI_CHAT_PROVIDER / AI_CONTENT_PROVIDER, or force everything
 * offline with AI_PROVIDER=simulated.
 */
export function getProvider(env: EnvLike = process.env): AIProvider {
  const forced = (env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (["simulated", "rules", "offline"].includes(forced)) {
    return new SimulatedProvider();
  }

  // One shared instance, so an unconfigured environment resolves both lanes to
  // the same object and is returned directly instead of being wrapped in a
  // router that routes to itself.
  const safe = new SimulatedProvider();
  const chat = resolveProvider(env, "AI_CHAT_PROVIDER", ["groq", "claude", "gemini"], safe);
  const content = resolveProvider(env, "AI_CONTENT_PROVIDER", ["claude", "gemini", "groq"], safe);

  // Compare the resolved *id*, not object identity: two lanes configured the
  // same way should collapse to one provider rather than a pointless router.
  if (chat.id === content.id) return chat.provider;
  return new RoutedProvider(chat.provider, content.provider);
}

interface Resolved {
  id: ProviderId;
  provider: AIProvider;
}

function resolveProvider(
  env: EnvLike,
  overrideKey: string,
  order: ProviderId[],
  safe: AIProvider
): Resolved {
  const override = (env[overrideKey] ?? "").trim().toLowerCase() as ProviderId;
  const build = (id: ProviderId): Resolved | null => {
    switch (id) {
      case "groq": {
        const c = readGroqConfig(env);
        return c ? { id, provider: new GroqProvider(c, safe) } : null;
      }
      case "claude": {
        const c = readClaudeConfig(env);
        return c ? { id, provider: new ClaudeProvider(c, safe) } : null;
      }
      case "gemini": {
        const c = readGeminiConfig(env);
        return c ? { id, provider: new GeminiProvider(c, safe) } : null;
      }
      default:
        return null;
    }
  };

  const sequence = override ? [override, ...order] : order;
  for (const id of sequence) {
    const resolved = build(id);
    if (resolved) return resolved;
  }
  return { id: "simulated", provider: safe };
}

/**
 * Sends latency-bound work to one provider and accuracy-bound work to another.
 *
 * Each delegate already falls back to the deterministic provider internally, so
 * this only decides routing — it never has to recover from a failed call itself.
 */
export class RoutedProvider implements AIProvider {
  readonly name: string;
  readonly isLive: boolean;

  constructor(
    private readonly chat: AIProvider,
    private readonly content: AIProvider
  ) {
    this.name = chat === content ? chat.name : `${chat.name}+${content.name}`;
    this.isLive = chat.isLive || content.isLive;
  }

  /** Interactive, student is waiting. */
  teach(req: TeachRequest): Promise<TeachTurn> {
    return this.chat.teach(req);
  }

  roleplay(req: RoleplayRequest): Promise<RoleplayTurn> {
    return this.chat.roleplay(req);
  }

  /** Accuracy-bound: a wrong medical fact here is the worst failure we have. */
  generate(req: GenerateRequest): Promise<GeneratedArtifact> {
    return this.content.generate(req);
  }

  grade(req: GradeRequest): Promise<GradeResult> {
    return this.content.grade(req);
  }
}

/** What is live right now, for honest labelling in the UI and in logs. */
export function describeProvider(env: EnvLike = process.env): ProviderId[] {
  const safe = new SimulatedProvider();
  const chat = resolveProvider(env, "AI_CHAT_PROVIDER", ["groq", "claude", "gemini"], safe);
  const content = resolveProvider(env, "AI_CONTENT_PROVIDER", ["claude", "gemini", "groq"], safe);
  return chat.id === content.id ? [chat.id] : [chat.id, content.id];
}

export {
  ClaudeProvider,
  readClaudeConfig,
  GeminiProvider,
  readGeminiConfig,
  GroqProvider,
  readGroqConfig,
  SimulatedProvider,
};
export type { EnvLike };
