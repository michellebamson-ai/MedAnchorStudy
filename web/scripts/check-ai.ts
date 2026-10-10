/**
 * AI provider checks that do not need an API key.
 *
 * Covers the things most likely to break silently in production: choosing the
 * wrong provider, mis-parsing a model reply, and a malformed reply reaching a
 * feature instead of the fallback. The live path itself needs a real key.
 */
import { ClaudeProvider, readClaudeConfig } from "../src/lib/ai/claude";
import { GeminiProvider, readGeminiConfig } from "../src/lib/ai/gemini";
import { GroqProvider, readGroqConfig, RoutedProvider, describeProvider } from "../src/lib/ai/provider";
import { SimulatedProvider } from "../src/lib/ai/simulated";
import { getProvider } from "../src/lib/ai/provider";
import { extractJson } from "../src/lib/ai/json";
import { kindSpec } from "../src/lib/ai/kinds";
import type { AIProvider, GenerateRequest } from "../src/lib/ai/types";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
}

const baseConfig = { apiKey: "test-key", model: "test-model", timeoutMs: 50, maxRetries: 0 };

// ---------------------------------------------------------------- extraction

const fence = extractJson<{ a: number }>('```json\n{"a":1}\n```');
check("parses fenced json", fence?.a === 1);

const prose = extractJson<{ b: string }>('Here you go:\n{"b":"ok"}\nHope that helps!');
check("parses json wrapped in prose", prose?.b === "ok");

const braceInString = extractJson<{ text: string }>('{"text":"a } brace inside a string"}');
check("brace inside a string does not truncate", braceInString?.text === "a } brace inside a string");

const array = extractJson<Array<{ stem: string }>>('[{"stem":"q1"},{"stem":"q2"}]');
check("parses a bare array", Array.isArray(array) && array.length === 2);

check("garbage returns null", extractJson("not json at all") === null);
check("empty string returns null", extractJson("") === null);

// --------------------------------------------------------------- selection

check("no config -> deterministic", getProvider({}) instanceof SimulatedProvider);
check(
  "key without model -> deterministic",
  getProvider({ ANTHROPIC_API_KEY: "k" }) instanceof SimulatedProvider
);
check(
  "key + model -> claude",
  getProvider({ ANTHROPIC_API_KEY: "k", ANTHROPIC_MODEL: "m" }) instanceof
    ClaudeProvider
);
check(
  "forced offline -> deterministic",
  getProvider({ ANTHROPIC_API_KEY: "k", ANTHROPIC_MODEL: "m", AI_PROVIDER: "simulated" }) instanceof SimulatedProvider
);
check("config reader rejects missing model", readClaudeConfig({ ANTHROPIC_API_KEY: "k" }) === null);
check("config reader accepts both", readClaudeConfig({ ANTHROPIC_API_KEY: "k", ANTHROPIC_MODEL: "m" })?.model === "m");

// --- Gemini selection ---
check(
  "gemini key without model -> deterministic",
  getProvider({ GEMINI_API_KEY: "k" }) instanceof SimulatedProvider
);
check(
  "gemini key + model -> gemini",
  getProvider({ GEMINI_API_KEY: "k", GEMINI_MODEL: "m" }) instanceof GeminiProvider
);
check(
  "claude wins when both configured",
  getProvider({ ANTHROPIC_API_KEY: "k", ANTHROPIC_MODEL: "m", GEMINI_API_KEY: "g", GEMINI_MODEL: "n" }) instanceof
    ClaudeProvider
);
check(
  "AI_PROVIDER=simulated overrides a configured key",
  getProvider({ GEMINI_API_KEY: "k", GEMINI_MODEL: "m", AI_PROVIDER: "simulated" }) instanceof SimulatedProvider
);
check("gemini config rejects missing model", readGeminiConfig({ GEMINI_API_KEY: "k" }) === null);
check("gemini config accepts both", readGeminiConfig({ GEMINI_API_KEY: "k", GEMINI_MODEL: "m" })?.model === "m");

// --- Groq selection ---
check("groq key without model -> deterministic", getProvider({ GROQ_API_KEY: "k" }) instanceof SimulatedProvider);
check("groq key + model -> groq", getProvider({ GROQ_API_KEY: "k", GROQ_MODEL: "m" }) instanceof GroqProvider);
check("groq config rejects missing model", readGroqConfig({ GROQ_API_KEY: "k" }) === null);
check("groq config accepts both", readGroqConfig({ GROQ_API_KEY: "k", GROQ_MODEL: "m" })?.model === "m");

// --- Routing: chat is latency-bound, content is accuracy-bound ---
const bothConfigured = { GROQ_API_KEY: "g", GROQ_MODEL: "gm", GEMINI_API_KEY: "e", GEMINI_MODEL: "em" };
check("groq + gemini -> routed provider", getProvider(bothConfigured) instanceof RoutedProvider);
check(
  "chat lane picks groq, content lane picks gemini",
  JSON.stringify(describeProvider(bothConfigured)) === JSON.stringify(["groq", "gemini"]),
  JSON.stringify(describeProvider(bothConfigured))
);
check(
  "with claude too, chat stays on groq but content moves to claude",
  JSON.stringify(
    describeProvider({ ...bothConfigured, ANTHROPIC_API_KEY: "c", ANTHROPIC_MODEL: "cm" })
  ) === JSON.stringify(["groq", "claude"]),
  JSON.stringify(describeProvider({ ...bothConfigured, ANTHROPIC_API_KEY: "c", ANTHROPIC_MODEL: "cm" }))
);
check(
  "AI_CHAT_PROVIDER override moves chat off groq onto gemini",
  JSON.stringify(describeProvider({ ...bothConfigured, AI_CHAT_PROVIDER: "gemini" })) ===
    JSON.stringify(["gemini"]),
  JSON.stringify(describeProvider({ ...bothConfigured, AI_CHAT_PROVIDER: "gemini" }))
);
check(
  "AI_CONTENT_PROVIDER override moves content off gemini onto groq",
  JSON.stringify(
    describeProvider({ ...bothConfigured, AI_CONTENT_PROVIDER: "groq" })
  ) === JSON.stringify(["groq"]),
  JSON.stringify(describeProvider({ ...bothConfigured, AI_CONTENT_PROVIDER: "groq" }))
);
check(
  "single provider is not wrapped in a router",
  !(getProvider({ GEMINI_API_KEY: "k", GEMINI_MODEL: "m" }) instanceof RoutedProvider)
);
check("nothing configured -> deterministic", !(getProvider({}) instanceof RoutedProvider) && describeProvider({}).length === 1);

// ------------------------------------------------- malformed replies fall back

const sim = new SimulatedProvider();
const claude = new ClaudeProvider(baseConfig, sim);

/** Stub global fetch so no request leaves the machine. */
function withStubbedFetch<T>(handler: () => Promise<Response>, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = handler as unknown as typeof fetch;
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ content: [{ type: "text", text: JSON.stringify(body) }] }),
    text: async () => "",
  } as unknown as Response;
}

const genReq: GenerateRequest = {
  kind: "questions",
  sourceText: "Systolic pressure falls with treatment.",
  topic: "hypertension",
  level: "student",
  detailLevel: 3,
  style: "simple",
  format: "markdown",
  difficulty: 3,
};

async function main() {
  // Well-formed reply is used.
  await withStubbedFetch(
    async () =>
      jsonResponse([
        {
          stem: "Which effect is expected?",
          choices: ["Fall in systolic pressure", "Rise in systolic pressure", "No change", "Tachycardia"],
          answerIndex: 0,
          explanation: "Because the drug lowers pressure.",
        },
      ]),
    async () => {
      const out = await claude.generate(genReq);
      const body = out.body as Array<{ stem: string }>;
      check("valid reply is used", Array.isArray(body) && body[0]?.stem === "Which effect is expected?");
    }
  );

  // Reply with the wrong shape is discarded in favour of the deterministic one.
  await withStubbedFetch(async () => jsonResponse({ totally: "wrong shape" }), async () => {
    const out = await claude.generate(genReq);
    const body = out.body as Array<{ stem: string }>;
    check(
      "wrong-shaped reply falls back",
      Array.isArray(body) && typeof body[0]?.stem === "string" && body[0].stem !== "totally"
    );
  });

  // Transport failure falls back rather than throwing at the feature.
  await withStubbedFetch(
    async () => {
      throw new Error("network down");
    },
    async () => {
      const out = await claude.generate(genReq);
      check("network failure falls back", !!(out.body as unknown[] | undefined));
    }
  );

  // Non-JSON prose reply falls back.
  await withStubbedFetch(async () => jsonResponse("I am afraid I cannot help with that."), async () => {
    const out = await claude.generate(genReq);
    check("prose-only reply falls back", !!(out.body as unknown[] | undefined));
  });

  // Unknown kinds still produce something usable.
  await withStubbedFetch(async () => jsonResponse(["a point", "another point"]), async () => {
    const spec = kindSpec("brand_new_kind_nobody_wrote_down");
    const coerced = spec.coerce(["a point", "another point"], { difficulty: 3, detailLevel: 3 });
    check("unknown kind coerces", Array.isArray(coerced) && coerced.length === 2);
    void (await claude.generate({ ...genReq, kind: "brand_new_kind_nobody_wrote_down" }));
  });

  // Every kind the app requests must have a usable contract.
  const kinds = [
    "analyze", "breakdown", "case_scenario", "exam", "flashcard", "flashcards", "generate", "plan",
    "questions", "quiz", "revision_notes", "summary", "teach_me", "assignment", "biostat",
    "explanation", "methodology", "study_plan_doc", "case", "communicate", "evidence", "research_question",
  ];
  let allOk = true;
  for (const k of kinds) {
    const spec = kindSpec(k);
    const sample =
      spec.family === "questions"
        ? [{ stem: "s", choices: ["a", "b"], answerIndex: 0, explanation: "e" }]
        : spec.family === "flashcards"
          ? [{ front: "f", back: "b" }]
          : spec.family === "case"
            ? { opening: "o", steps: [{ prompt: "p", choices: ["a", "b"], answerIndex: 0, feedback: "f" }] }
            : spec.family === "points"
              ? ["p"]
              : { overview: "o", keyPoints: ["k"] };
    if (spec.coerce(sample, { difficulty: 3, detailLevel: 3 }) === null) {
      allOk = false;
      console.log(`   kind "${k}" rejected its own sample`);
    }
  }
  check(`all ${kinds.length} in-use kinds coerce their own sample`, allOk);

  // ---- Gemini behaves identically to Claude on the same stubs ----
  const gem = new GeminiProvider(baseConfig, sim);

  function geminiResponse(body: unknown): Response {
    return {
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] }, finishReason: "STOP" }] }),
      text: async () => "",
    } as unknown as Response;
  }

  await withStubbedFetch(
    async () =>
      geminiResponse([
        {
          stem: "Which effect is expected?",
          choices: ["Fall", "Rise", "None", "Tachycardia"],
          answerIndex: 0,
          explanation: "Because the drug lowers pressure.",
        },
      ]),
    async () => {
      const out = await gem.generate(genReq);
      const body = out.body as Array<{ stem: string }>;
      check("gemini: valid reply is used", Array.isArray(body) && body[0]?.stem === "Which effect is expected?");
    }
  );

  await withStubbedFetch(async () => geminiResponse({ wrong: "shape" }), async () => {
    const out = await gem.generate(genReq);
    const body = out.body as Array<{ stem: string }>;
    check("gemini: wrong-shaped reply falls back", Array.isArray(body) && body[0]?.stem !== "wrong");
  });

  await withStubbedFetch(
    async () => {
      throw new Error("network down");
    },
    async () => {
      const out = await gem.generate(genReq);
      check("gemini: network failure falls back", !!(out.body as unknown[] | undefined));
    }
  );

  // A safety block returns 200 with no text — must degrade, not crash.
  await withStubbedFetch(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [] }, finishReason: "SAFETY" }] }),
        text: async () => "",
      }) as unknown as Response,
    async () => {
      const out = await gem.generate(genReq);
      check("gemini: empty safety-blocked reply falls back", !!(out.body as unknown[] | undefined));
    }
  );

  // Both providers must send the same JSON, so a parse failure cannot be
  // provider-specific.
  await withStubbedFetch(async () => geminiResponse("plain prose"), async () => {
    const out = await gem.teach({
      topic: "sensitivity",
      level: "student",
      teachingStyle: "gentle",
      turn: 1,
      transcript: [],
    });
    check("gemini: teach falls back when prose", !!(out.text && out.text.length > 0));
  });

  // ---- Routing sends the right operation to the right provider ----
  const calls: string[] = [];
  function spy(name: string): AIProvider {
    return {
      name,
      isLive: true,
      async teach() {
        calls.push(`${name}:teach`);
        return { text: "t", question: "q" };
      },
      async roleplay() {
        calls.push(`${name}:roleplay`);
        return { text: "r", rapportDelta: 0, newlyRevealed: [], empathy: 0.5, questioning: 0.5, clarity: 0.5, notes: [] };
      },
      async generate() {
        calls.push(`${name}:generate`);
        return { title: "t", body: { points: ["p"] } };
      },
      async grade() {
        calls.push(`${name}:grade`);
        return { score: 1, hit: [], missing: [], misconceptions: [], feedback: "good" };
      },
    };
  }

  const routed = new RoutedProvider(spy("chat-provider"), spy("content-provider"));
  await routed.teach({ topic: "t", level: "student", teachingStyle: "gentle", turn: 1, transcript: [] });
  await routed.roleplay({
    character: "patient",
    personality: "anxious",
    scenario: "history-taking",
    brief: "b",
    hiddenFacts: [],
    alreadyRevealed: [],
    rapport: 0,
    transcript: [],
    level: "student",
    examMode: false,
  });
  await routed.generate(genReq);
  await routed.grade({ prompt: "p", answer: "a", expectedTerms: [] });
  check(
    "teach + roleplay go to the chat lane",
    calls.slice(0, 2).every((c) => c.startsWith("chat-provider")),
    calls.join(", ")
  );
  check(
    "generate + grade go to the content lane",
    calls.slice(2).every((c) => c.startsWith("content-provider")),
    calls.join(", ")
  );

  if (failures) {
    console.error(`\nFAILED: ${failures} check(s)`);
    process.exit(1);
  }
  console.log("\nAI PROVIDER CHECKS PASSED");
}

main();