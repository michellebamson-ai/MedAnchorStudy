/**
 * Analyze Docs engine (MATERIALS_SPEC.md §2).
 *
 * Honest, dependency-free text analysis. It finds what is really there —
 * topics, concepts, definitions, formulas, tables, diagrams, facts, links,
 * hard areas and course words — and says so when it finds nothing, instead of
 * inventing content. Generation (making new study tools) is a separate step
 * handled by the AI provider.
 */

export interface AnalysisFinding {
  kind:
    | "topic"
    | "concept"
    | "definition"
    | "formula"
    | "table"
    | "diagram"
    | "fact"
    | "link"
    | "hard"
    | "term";
  label: string;
  detail?: string;
  confidence: number;
}

export interface AnalysisResult {
  topics: AnalysisFinding[];
  concepts: AnalysisFinding[];
  definitions: AnalysisFinding[];
  formulas: AnalysisFinding[];
  tables: AnalysisFinding[];
  diagrams: AnalysisFinding[];
  facts: AnalysisFinding[];
  links: AnalysisFinding[];
  hardAreas: AnalysisFinding[];
  courseWords: AnalysisFinding[];
  counts: Record<string, number>;
  charCount: number;
  sentenceCount: number;
}

const STOP = new Set(
  (
    "the,a,an,and,or,but,if,then,else,when,while,of,at,by,for,with,about,into," +
    "through,during,before,after,above,below,to,from,up,down,in,out,on,off,over," +
    "under,again,further,once,here,there,all,any,both,each,few,more,most,other," +
    "some,such,no,nor,not,only,own,same,so,than,too,very,can,will,just,should," +
    "now,this,that,these,those,they,them,their,there,what,which,who,whom,whose," +
    "how,why,because,until,as,also,between,among,within,without,however," +
    "therefore,thus,hence,although,though,since,despite,towards,upon,patient," +
    "patients,study,studies,using,use,used,often,many,much,may,might,must," +
    "shall,being,been,does,did,doing,have,has,had,having,would,could,ought," +
    "one,two,three,first,second,new,including,includes,e,g,i,e,per,via,etc"
  ).split(",")
);

function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z\-']{2,}/g) ?? []).filter((w) => !STOP.has(w));
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\r/g, "\n")
    .split(/(?<=[.!?])\s+|\n{2,}|\n(?=[A-Z0-9•\-])/)
    .map((s) => s.replace(/^[•\-\d.)\s]+/, "").trim())
    .filter((s) => s.length > 24 && s.length < 600);
}

/** Plain-text extraction. Returns null for binary formats we cannot read. */
export function extractText(buffer: Buffer, mimeType: string, ext: string): string | null {
  const textKinds = ["text/", "application/json", "application/xml"];
  const textExts = ["txt", "md", "markdown", "csv", "text", "log"];
  if (textKinds.some((t) => mimeType.startsWith(t)) || textExts.includes(ext)) {
    // Strip a UTF-8 BOM if present.
    const raw = buffer.toString("utf8").replace(/^﻿/, "");
    // Reject binary masquerading as text.
    const nul = raw.indexOf("");
    const sample = nul === -1 ? raw : raw.slice(0, nul);
    if (sample.length < 20) return null;
    return raw.replace(/\0/g, "").trim() || null;
  }
  return null;
}

export function analyzeText(text: string): AnalysisResult {
  const sentences = splitSentences(text);

  // ---- Term frequencies (concepts + course words) ----
  const freq = new Map<string, number>();
  for (const s of sentences) {
    for (const w of words(s)) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const ranked = [...freq.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1]);

  const concepts: AnalysisFinding[] = ranked.slice(0, 24).map(([term, n]) => ({
    kind: "concept",
    label: term,
    detail: `mentioned ${n} times`,
    confidence: Math.min(0.95, 0.4 + n * 0.08),
  }));

  // Course words: frequent multi-word terms (bigrams) the course itself uses.
  const bigrams = new Map<string, number>();
  for (const s of sentences) {
    const ws = words(s);
    for (let i = 0; i < ws.length - 1; i++) {
      const b = `${ws[i]} ${ws[i + 1]}`;
      bigrams.set(b, (bigrams.get(b) ?? 0) + 1);
    }
  }
  const courseWords: AnalysisFinding[] = [...bigrams.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([label, n]) => ({
      kind: "term",
      label,
      detail: `used ${n} times in this material`,
      confidence: 0.7,
    }));

  // ---- Definitions: "X is/are/means/refers to Y" ----
  const definitions: AnalysisFinding[] = [];
  const defRe = /^(.{3,60}?)\s+(is|are|means?|refers? to|is defined as)\s+(.{10,220})$/i;
  for (const s of sentences) {
    const m = defRe.exec(s.replace(/\.$/, ""));
    if (m && definitions.length < 20) {
      definitions.push({
        kind: "definition",
        label: m[1].trim(),
        detail: m[3].trim().slice(0, 220),
        confidence: 0.75,
      });
    }
  }

  // ---- Formulas: equations on their own line ----
  const formulas: AnalysisFinding[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.length > 3 && t.length < 400 && /=|±|×|÷|∑|√|π|α|β|Δ|λ|μ/.test(t) && /[a-zA-Z]/.test(t)) {
      // Long prose that merely contains "=" is trimmed to the equation itself.
      const eqAt = t.indexOf("=");
      const label = t.length > 140 && eqAt > 0 ? t.slice(Math.max(0, eqAt - 60), eqAt + 60).trim() : t;
      formulas.push({ kind: "formula", label, confidence: 0.85 });
      if (formulas.length >= 12) break;
    }
  }

  // ---- Tables & diagrams (mentions) ----
  const tables: AnalysisFinding[] = [];
  const diagrams: AnalysisFinding[] = [];
  const tableRe = /\btable\s+\d+[^.]{0,90}/gi;
  const figRe = /\b(fig(?:ure)?\.?\s*\d+|diagram|image|chart|graph)[^.]{0,90}/gi;
  for (const s of sentences) {
    const tm = s.match(tableRe);
    if (tm && tables.length < 10)
      tables.push({ kind: "table", label: tm[0].trim(), detail: s.slice(0, 160), confidence: 0.7 });
    const fm = s.match(figRe);
    if (fm && diagrams.length < 10)
      diagrams.push({ kind: "diagram", label: fm[0].trim(), detail: s.slice(0, 160), confidence: 0.7 });
  }

  // ---- Important facts: sentences carrying numbers ----
  const facts: AnalysisFinding[] = sentences
    .filter((s) => /\d+(\.\d+)?\s*(%|mg|mmol|mmHg|bpm|ml|years?|days?|times|fold)?/i.test(s))
    .slice(0, 16)
    .map((s) => ({ kind: "fact", label: s.slice(0, 140), confidence: 0.6 }));

  // ---- Links: cause-and-effect language ----
  const links: AnalysisFinding[] = sentences
    .filter((s) => /\b(because|therefore|leads? to|causes?|results? in|due to|triggers?|inhibits?|increases?|decreases?|reduces?)\b/i.test(s))
    .slice(0, 12)
    .map((s) => ({ kind: "link", label: s.slice(0, 160), confidence: 0.6 }));

  // ---- Hard areas: long, dense sentences ----
  const hardAreas: AnalysisFinding[] = sentences
    .filter((s) => s.split(/\s+/).length >= 26)
    .slice(0, 8)
    .map((s) => ({
      kind: "hard",
      label: s.slice(0, 120) + "…",
      detail: "Dense passage — worth a slow read or a Teach Me session.",
      confidence: 0.55,
    }));

  // ---- Topics: cluster sentences around the strongest terms ----
  // Generic words never become topics on their own — they stay as concepts.
  const TOPIC_STOP = new Set([
    "true", "false", "positive", "positives", "negative", "negatives",
    "test", "tests", "result", "results", "value", "values", "rate", "rates",
    "ratio", "number", "numbers", "level", "levels", "group", "groups",
  ]);
  const topicTerms = ranked.filter(([term]) => term.length >= 5 && !TOPIC_STOP.has(term));
  const topics: AnalysisFinding[] = topicTerms.slice(0, 6).map(([term], i) => {
    const related = sentences.filter((s) => s.toLowerCase().includes(term)).slice(0, 3);
    const subs = related
      .slice(1)
      .map((s) => s.split(/[,;:]/)[0].trim().slice(0, 70))
      .filter(Boolean);
    return {
      kind: "topic",
      label: term.replace(/\b\w/g, (c) => c.toUpperCase()),
      detail: subs.length ? `Includes: ${subs.join(" · ")}` : related[0]?.slice(0, 120),
      confidence: 0.65 - i * 0.03,
    };
  });

  const counts = {
    topics: topics.length,
    concepts: concepts.length,
    definitions: definitions.length,
    formulas: formulas.length,
    tables: tables.length,
    diagrams: diagrams.length,
    facts: facts.length,
    links: links.length,
    hardAreas: hardAreas.length,
    courseWords: courseWords.length,
  };

  return {
    topics,
    concepts,
    definitions,
    formulas,
    tables,
    diagrams,
    facts,
    links,
    hardAreas,
    courseWords,
    counts,
    charCount: text.length,
    sentenceCount: sentences.length,
  };
}

/** Weak-topic signal for generation: slugs the student struggles with. */
export function weakTopicSlugs(
  mastery: Array<{ topicSlug: string; status: string }>
): string[] {
  return mastery.filter((m) => m.status !== "strong").map((m) => m.topicSlug);
}
