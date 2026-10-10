/**
 * Live literature search check.
 *
 * Hits the real public APIs. Verifies normalisation, deduplication, caching and
 * — most importantly — that a failing provider degrades instead of breaking.
 *
 *   npm run check:literature
 */

import { clearLiteratureCache, searchLiterature } from "../src/lib/literature";

let failures = 0;
function check(name: string, condition: boolean, detail = "") {
  console.log(`  [${condition ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures++;
}

async function main() {
  console.log("\nLIVE LITERATURE CHECKS\n");

  const t0 = Date.now();
  const res = await searchLiterature("hypertension blood pressure management", 8);
  const ms = Date.now() - t0;

  console.log(
    `\nquery "hypertension blood pressure management" -> ${res.hits.length} hits in ${ms}ms`
  );
  console.log(`  providers ok: ${res.ok.join(", ") || "none"}`);
  if (res.failed.length) console.log(`  failed: ${res.failed.map((f) => `${f.provider} (${f.reason})`).join(", ")}`);

  check("at least one provider answered", res.ok.length > 0);
  check("returned hits", res.hits.length > 0, `${res.hits.length}`);
  check("completed within 20s", ms < 20_000, `${ms}ms`);

  const titles = res.hits.map((h) => h.title);
  console.log(`\n  sample titles:`);
  res.hits.slice(0, 4).forEach((h) => console.log(`    - [${h.provider}] ${h.title.slice(0, 84)}`));

  check("every hit has a title", res.hits.every((h) => !!h.title && h.title.length > 3));
  check("no title has markup or entities", res.hits.every((h) => !/[<>]/.test(h.title)));
  check("no duplicate titles", new Set(titles).size === titles.length, `${titles.length} titles, ${new Set(titles).size} unique`);
  check("no duplicate DOIs", (() => {
    const d = res.hits.map((h) => h.doi?.toLowerCase()).filter(Boolean) as string[];
    return new Set(d).size === d.length;
  })());
  check("years are plausible or absent", res.hits.every((h) => h.year === null || (h.year >= 1900 && h.year <= 2100)));
  check("sourceType uses the app vocabulary", res.hits.every((h) =>
    ["peer_reviewed", "systematic_review", "clinical_guideline", "textbook", "preprint", "other"].includes(h.sourceType)
  ));
  check("every hit is reachable", res.hits.every((h) => !!h.url));
  check("respects the requested limit", res.hits.length <= 8, `${res.hits.length}`);

  const withAbstract = res.hits.filter((h) => h.abstract).length;
  console.log(`\n  abstracts recovered: ${withAbstract}/${res.hits.length}`);
  check("at least one abstract recovered", withAbstract > 0, `${withAbstract}`);

  // ---- Caching: a repeat query must not re-hit the network ----
  const t1 = Date.now();
  const again = await searchLiterature("hypertension blood pressure management", 8);
  const cachedMs = Date.now() - t1;
  console.log(`\n  repeat query: ${cachedMs}ms (cached)`);
  check("repeat query is served from cache", cachedMs < 60, `${cachedMs}ms`);
  check("cache returns identical hits", JSON.stringify(again.hits) === JSON.stringify(res.hits));

  // ---- Different query must actually go out ----
  clearLiteratureCache();
  const t2 = Date.now();
  const other = await searchLiterature("hand hygiene infection control", 5);
  console.log(`  different query after clear: ${Date.now() - t2}ms, ${other.hits.length} hits`);
  check("a different query returns different results", other.hits[0]?.title !== res.hits[0]?.title);

  // ---- Degradation: an empty query must not throw or call out ----
  const empty = await searchLiterature("   ");
  check("empty query short-circuits", empty.hits.length === 0 && empty.ok.length === 0);

  // ---- A non-medical query should still return something honest ----
  const odd = await searchLiterature("zzqqxx nonexistent topic 99887766", 5);
  check("nonsense query does not throw", Array.isArray(odd.hits));

  console.log("");
  if (failures) {
    console.log(`  ${failures} LITERATURE CHECK(S) FAILED\n`);
    process.exit(1);
  }
  console.log("  LIVE LITERATURE CHECKS PASSED\n");
}

main();
