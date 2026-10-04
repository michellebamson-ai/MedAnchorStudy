/**
 * AI provider checks that do not need an API key.
 *
 * Covers the things most likely to break silently in production: choosing the
 * wrong provider, mis-parsing a model reply, and a malformed reply reaching a
 * feature instead of the fallback. The live path itself needs a real key.
 */
import { ClaudeProvider, readClaudeConfig } from "../src/lib/ai/claude";
import { SimulatedProvider } from "../src/lib/ai/simulated";
import { getProvider } from "../src/lib/ai/provider";
import { extractJson } from "../src/lib/ai/json";
import { kindSpec } from "../src/lib/ai/kinds";
import type { GenerateRequest } from "../src/lib/ai/types";

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
  getProvider({
    ANTHROPIC_API_KEY: "k",
    ANTHROPIC_MODEL: "m",
    AI_FALLBACK_PROVIDER: "simulated",
  }) instanceof SimulatedProvider
);
check("config reader rejects missing model", readClaudeConfig({ ANTHROPIC_API_KEY: "k" }) === null);
check(
  "config reader accepts both",
  readClaudeConfig({ ANTHROPIC_API_KEY: "k", ANTHROPIC_MODEL: "m" })?.model === "m"
);

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

  if (failures) {
    console.error(`\nFAILED: ${failures} check(s)`);
    process.exit(1);
  }
  console.log("\nAI PROVIDER CHECKS PASSED");
}

main();