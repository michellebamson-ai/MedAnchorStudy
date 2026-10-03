/**
 * Biostatistics domain constants and pure helpers (RESEARCH_SPEC.md §3).
 * Plain module — never a "use server" file — so clients can import freely.
 */

export interface StatTopic {
  slug: string;
  title: string;
  category: string;
  moduleSlug: string | null;
}

/** Statistics library. moduleSlug = seeded deep content. */
export const STAT_LIBRARY: StatTopic[] = [
  { slug: "mean-median-mode", title: "Mean, median, mode", category: "Descriptive", moduleSlug: "bs1" },
  { slug: "standard-deviation", title: "Standard deviation", category: "Descriptive", moduleSlug: "bs1" },
  { slug: "range", title: "Range", category: "Descriptive", moduleSlug: "bs1" },
  { slug: "p-value", title: "P-value", category: "Hypothesis Testing", moduleSlug: "bs6" },
  { slug: "significance", title: "Significance", category: "Hypothesis Testing", moduleSlug: "bs6" },
  { slug: "type-i-ii", title: "Type I & II errors", category: "Hypothesis Testing", moduleSlug: "bs6" },
  { slug: "confidence-intervals", title: "Confidence intervals", category: "Hypothesis Testing", moduleSlug: "bs5" },
  { slug: "t-test", title: "T-test", category: "Comparative Tests", moduleSlug: null },
  { slug: "chi-square", title: "Chi-square", category: "Comparative Tests", moduleSlug: null },
  { slug: "anova", title: "ANOVA", category: "Comparative Tests", moduleSlug: null },
  { slug: "correlation", title: "Correlation", category: "Relationships", moduleSlug: null },
  { slug: "regression", title: "Regression", category: "Relationships", moduleSlug: null },
  { slug: "relative-risk", title: "Relative risk", category: "Epidemiological Measures", moduleSlug: "bs4" },
  { slug: "odds-ratio", title: "Odds ratio", category: "Epidemiological Measures", moduleSlug: "bs4" },
  { slug: "sens-spec", title: "Sensitivity & specificity", category: "Epidemiological Measures", moduleSlug: "bs3" },
  { slug: "incidence-prevalence", title: "Incidence & prevalence", category: "Epidemiological Measures", moduleSlug: "bs9" },
  { slug: "probability", title: "Probability basics", category: "Study Designs", moduleSlug: "bs2" },
  { slug: "rct", title: "Randomized controlled trials", category: "Study Designs", moduleSlug: "bs7" },
  { slug: "observational", title: "Observational studies", category: "Study Designs", moduleSlug: "bs7" },
  { slug: "cohort", title: "Cohort studies", category: "Study Designs", moduleSlug: "bs7" },
  { slug: "case-study", title: "Case studies & series", category: "Study Designs", moduleSlug: "bs7" },
  { slug: "bias-confounding", title: "Bias & confounding", category: "Study Designs", moduleSlug: "bs8" },
];

export interface TableAnalysis {
  columns: string[];
  rows: number;
  numeric: Record<string, { n: number; mean: number; median: number; sd: number; min: number; max: number }>;
  preview: string[][];
  chart: { labels: string[]; values: number[]; label: string } | null;
}

/** Parse CSV or pasted tables (tabs, commas or pipes). */
export function parseTable(text: string): { columns: string[]; rows: string[][] } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 201);
  if (lines.length < 2) return { columns: [], rows: [] };
  const split = (line: string): string[] => {
    if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
    if (line.includes("|")) return line.split("|").map((c) => c.replace(/^\||\|$/g, "").trim());
    // CSV with minimal quote handling.
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (ch === "," && !quoted) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const columns = split(lines[0]);
  const rows = lines.slice(1).map(split).filter((r) => r.length === columns.length);
  return { columns, rows };
}

export function descriptives(values: number[]) {
  const n = values.length;
  const mean = values.reduce((s, x) => s + x, 0) / Math.max(1, n);
  const sorted = [...values].sort((a, b) => a - b);
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const sd = Math.sqrt(values.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, n - 1)) || 0;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return { n, mean: r2(mean), median: r2(median), sd: r2(sd), min: r2(sorted[0] ?? 0), max: r2(sorted[n - 1] ?? 0) };
}
