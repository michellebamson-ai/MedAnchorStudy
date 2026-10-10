/**
 * Live literature search.
 *
 * The Evidence tab used to search a hand-picked shelf of twelve sources and
 * say so. That is honest but not useful to a student who wants to know what
 * was published this year. This module queries three open bibliographic APIs
 * that need no credentials, and normalises them into one shape.
 *
 * Priorities, in order:
 *  1. Never block the student. Every provider has a timeout, and a provider
 *     that fails is reported by name instead of being hidden.
 *  2. Never invent a citation. Fields we did not receive stay empty.
 *  3. Respect the free APIs. Results are cached, and NCBI's 3-requests-per-
 *     second limit is respected.
 *
 * These are metadata services. They return titles, authors and abstracts — not
 * full text. Nothing here should be presented as a paper the app has read.
 */

export type LiteratureProvider = "pubmed" | "crossref" | "openalex";

export interface LiteratureHit {
  provider: LiteratureProvider;
  /** Stable-ish identifier: DOI when present, else the provider's own id. */
  identifier: string;
  title: string;
  authors: string | null;
  year: number | null;
  venue: string | null;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  /** Mapped onto the app's existing Source.sourceType vocabulary. */
  sourceType: string;
  citationCount: number | null;
}

export interface LiteratureResult {
  hits: LiteratureHit[];
  /** Providers that answered. */
  ok: LiteratureProvider[];
  /** Providers that failed, with the reason — shown to the student. */
  failed: { provider: LiteratureProvider; reason: string }[];
}

const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 100;

// ---------------------------------------------------------------------------
// Cache. A student retyping a query should not re-hit three public APIs.
// ---------------------------------------------------------------------------

const cache = new Map<string, { at: number; result: LiteratureResult }>();

function cacheKey(q: string, limit: number) {
  return `${q.toLowerCase().trim()}::${limit}`;
}

function readCache(key: string): LiteratureResult | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.result;
}

function writeCache(key: string, result: LiteratureResult) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), result });
}

/** Test seam, and useful when debugging rate limits. */
export function clearLiteratureCache() {
  cache.clear();
}

// ---------------------------------------------------------------------------

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "application/json", "User-Agent": "MedAnchorStudy/1.0 (student study tool)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Query every provider concurrently and merge.
 *
 * A provider that throws is recorded, not rethrown — three dead APIs should
 * degrade to two results, not to an error page.
 */
export async function searchLiterature(
  query: string,
  limit = 8
): Promise<LiteratureResult> {
  const q = query.trim().slice(0, 300);
  if (!q) return { hits: [], ok: [], failed: [] };

  const key = cacheKey(q, limit);
  const cached = readCache(key);
  if (cached) return cached;

  const per = Math.max(3, Math.min(limit, 25));
  const providers: LiteratureProvider[] = ["pubmed", "crossref", "openalex"];

  const settled = await Promise.allSettled(
    providers.map((p) => fetchProvider(p, q, per))
  );

  const ok: LiteratureProvider[] = [];
  const failed: { provider: LiteratureProvider; reason: string }[] = [];
  let all: LiteratureHit[] = [];

  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      ok.push(providers[i]);
      all = all.concat(r.value);
    } else {
      failed.push({ provider: providers[i], reason: shortReason(r.reason) });
    }
  });

  const result: LiteratureResult = {
    hits: interleave(dedupe(all), limit),
    ok,
    failed,
  };
  writeCache(key, result);
  return result;
}

async function fetchProvider(provider: LiteratureProvider, q: string, per: number): Promise<LiteratureHit[]> {
  switch (provider) {
    case "pubmed":
      return fromPubMed(q, per);
    case "crossref":
      return fromCrossref(q, per);
    case "openalex":
      return fromOpenAlex(q, per);
  }
}

// ---------------------------------------------------------------------------
// PubMed (NCBI E-utilities). Free, no key, 3 req/s without one.
// ---------------------------------------------------------------------------

async function fromPubMed(q: string, per: number): Promise<LiteratureHit[]> {
  const base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
  const search = (await getJson(
    `${base}/esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=${per}&term=${encodeURIComponent(q)}`
  )) as { esearchresult?: { idlist?: string[] } };

  const ids = search.esearchresult?.idlist ?? [];
  if (!ids.length) return [];

  // esummary is a separate request; give NCBI a beat to respect its rate limit.
  await new Promise((r) => setTimeout(r, 350));

  const summary = (await getJson(
    `${base}/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`
  )) as { result?: Record<string, PubMedRecord> };

  const hits: LiteratureHit[] = [];
  for (const id of ids) {
    const r = summary.result?.[id];
    if (!r?.title) continue;
    const doi = r.articleids?.find((a) => a.idtype === "doi")?.value ?? null;
    hits.push({
      provider: "pubmed",
      identifier: doi ? `pmid:${id}` : `pmid:${id}`,
      title: cleanTitle(r.title),
      authors: formatPubMedAuthors(r),
      year: parseYear(r.pubdate ?? r.sortpubdate),
      venue: r.fulljournalname || r.source || null,
      doi,
      url: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      abstract: null,
      sourceType: mapPubMedType(r.pubtype),
      citationCount: null,
    });
  }
  return hits;
}

interface PubMedRecord {
  title?: string;
  pubdate?: string;
  sortpubdate?: string;
  source?: string;
  fulljournalname?: string;
  pubtype?: string[];
  authors?: { name?: string }[];
  articleids?: { idtype?: string; value?: string }[];
}

function formatPubMedAuthors(r: PubMedRecord): string | null {
  const names = (r.authors ?? []).map((a) => a.name).filter(Boolean) as string[];
  if (!names.length) return null;
  // Keep it short enough for a card without inventing or truncating mid-initial.
  return names.length > 8 ? `${names.slice(0, 8).join(", ")} et al.` : names.join(", ");
}

function mapPubMedType(pubtypes?: string[]): string {
  const joined = (pubtypes ?? []).join(" ").toLowerCase();
  if (joined.includes("systematic review") || joined.includes("meta-analysis")) return "systematic_review";
  if (joined.includes("practice guideline") || joined.includes("guideline")) return "clinical_guideline";
  if (joined.includes("review")) return "peer_reviewed";
  return "peer_reviewed";
}

// ---------------------------------------------------------------------------
// Crossref. Free, no key. Broadest coverage, no abstracts.
// ---------------------------------------------------------------------------

async function fromCrossref(q: string, per: number): Promise<LiteratureHit[]> {
  const params = new URLSearchParams({
    "query.bibliographic": q,
    rows: String(per),
    select: "DOI,title,author,issued,container-title,abstract,type,publisher,is-referenced-by-count,URL",
    sort: "relevance",
  });
  const data = (await getJson(`https://api.crossref.org/works?${params}`)) as {
    message?: { items?: CrossrefItem[] };
  };

  return (data.message?.items ?? [])
    .filter((it) => it.title?.[0])
    .map((it) => ({
      provider: "crossref" as const,
      identifier: `doi:${it.DOI}`,
      title: cleanTitle(it.title![0]),
      authors: formatCrossrefAuthors(it.author),
      year: it.issued?.["date-parts"]?.[0]?.[0] ?? null,
      venue: it["container-title"]?.[0] ?? null,
      doi: it.DOI ?? null,
      url: it.URL ?? (it.DOI ? `https://doi.org/${it.DOI}` : null),
      abstract: stripJats(it.abstract),
      sourceType: mapCrossrefType(it.type),
      citationCount: it["is-referenced-by-count"] ?? null,
    }));
}

interface CrossrefItem {
  DOI?: string;
  title?: string[];
  author?: { given?: string; family?: string; name?: string }[];
  issued?: { "date-parts"?: number[][] };
  "container-title"?: string[];
  abstract?: string;
  type?: string;
  publisher?: string;
  "is-referenced-by-count"?: number;
  URL?: string;
}

function formatCrossrefAuthors(a?: CrossrefItem["author"]): string | null {
  const names = (a ?? [])
    .map((x) => (x.family ? `${x.family}${x.given ? ` ${x.given}` : ""}` : x.name))
    .filter(Boolean) as string[];
  if (!names.length) return null;
  return names.length > 8 ? `${names.slice(0, 8).join(", ")} et al.` : names.join(", ");
}

function mapCrossrefType(type?: string): string {
  const t = (type ?? "").toLowerCase();
  if (t.includes("book") || t.includes("monograph")) return "textbook";
  if (t.includes("posted-content") || t.includes("component")) return "preprint";
  return "peer_reviewed";
}

// ---------------------------------------------------------------------------
// OpenAlex. Free, no key, but includes citation counts and abstracts.
// ---------------------------------------------------------------------------

async function fromOpenAlex(q: string, per: number): Promise<LiteratureHit[]> {
  const params = new URLSearchParams({ search: q, "per-page": String(per) });
  const mailto = process.env.LITERA_MAILTO;
  if (mailto) params.set("mailto", mailto);

  const data = (await getJson(`https://api.openalex.org/works?${params}`)) as {
    results?: OpenAlexWork[];
  };

  return (data.results ?? [])
    .filter((w) => w.title)
    .map((w) => ({
      provider: "openalex" as const,
      identifier: w.doi ? `doi:${w.doi.replace(/^https?:\/\/doi\.org\//, "")}` : `openalex:${w.id}`,
      title: cleanTitle(w.title!),
      authors: formatOpenAlexAuthors(w),
      year: w.publication_year ?? null,
      venue: w.primary_location?.source?.display_name ?? null,
      doi: w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//, "") : null,
      url: w.doi ?? w.id ?? null,
      abstract: fromInvertedIndex(w.abstract_inverted_index),
      sourceType: mapOpenAlexType(w.type),
      citationCount: w.cited_by_count ?? null,
    }));
}

interface OpenAlexWork {
  id?: string;
  doi?: string | null;
  title?: string;
  publication_year?: number | null;
  cited_by_count?: number | null;
  type?: string | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  authorships?: { author?: { display_name?: string } }[];
  primary_location?: { source?: { display_name?: string } | null } | null;
}

function formatOpenAlexAuthors(w: OpenAlexWork): string | null {
  const names = (w.authorships ?? []).map((a) => a.author?.display_name).filter(Boolean) as string[];
  if (!names.length) return null;
  return names.length > 8 ? `${names.slice(0, 8).join(", ")} et al.` : names.join(", ");
}

function mapOpenAlexType(type?: string | null): string {
  const t = (type ?? "").toLowerCase();
  if (t === "book") return "textbook";
  if (t === "review") return "peer_reviewed";
  if (t === "dataset" || t === "paratext") return "other";
  return "peer_reviewed";
}

/** OpenAlex ships abstracts as an inverted index; rebuild the reading order. */
function fromInvertedIndex(index?: Record<string, number[]> | null): string | null {
  if (!index) return null;
  const slots: { pos: number; word: string }[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) slots.push({ pos, word });
  }
  if (!slots.length) return null;
  slots.sort((a, b) => a.pos - b.pos);
  return slots.map((s) => s.word).join(" ").slice(0, 2000);
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * The same paper routinely appears in all three indexes, so showing it three
 * times looks broken. Merge on DOI (falling back to normalised title) and keep
 * whichever record carries the most fields rather than whichever arrived first.
 */
function dedupe(hits: LiteratureHit[]): LiteratureHit[] {
  const merged = new Map<string, LiteratureHit>();

  for (const h of hits) {
    const doi = h.doi?.toLowerCase().trim();
    const title = h.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const key = doi || title.slice(0, 60);
    if (!key) continue;

    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, h);
      continue;
    }

    merged.set(key, {
      ...prev,
      title: prev.title || h.title,
      abstract: prev.abstract ?? h.abstract,
      citationCount: prev.citationCount ?? h.citationCount,
      year: prev.year ?? h.year,
      venue: prev.venue ?? h.venue,
      authors: prev.authors ?? h.authors,
      doi: prev.doi ?? h.doi,
      url: prev.url ?? h.url,
      sourceType: prev.abstract ? prev.sourceType : h.sourceType,
    });
  }

  return [...merged.values()];
}

/**
 * Deal results round-robin across providers, each keeping its own relevance
 * order. Sorting purely by citation count looked reasonable but in practice
 * buried every PubMed and Crossref hit behind OpenAlex — which is the only
 * provider that returns citation counts — so the student saw one source's
 * view of the literature and the other two badges did nothing.
 *
 * Interleaving keeps all three voices and preserves each API's ranking, which
 * is the ranking we trust. Citation counts are still returned for display.
 */
function interleave(hits: LiteratureHit[], limit: number): LiteratureHit[] {
  const buckets = new Map<LiteratureProvider, LiteratureHit[]>();
  for (const h of hits) {
    const list = buckets.get(h.provider) ?? [];
    list.push(h);
    buckets.set(h.provider, list);
  }

  // Stable provider order so the same query always renders the same way.
  const order: LiteratureProvider[] = ["pubmed", "crossref", "openalex"];
  const queues = order.map((p) => buckets.get(p) ?? []);

  const out: LiteratureHit[] = [];
  let added = true;
  while (added && out.length < limit) {
    added = false;
    for (const q of queues) {
      const next = q.shift();
      if (next) {
        out.push(next);
        added = true;
        if (out.length >= limit) break;
      }
    }
  }
  return out;
}

function cleanTitle(t: string): string {
  // PubMed and Crossref wrap titles in tags; strip rather than show markup.
  return t
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseYear(date?: string): number | null {
  if (!date) return null;
  const m = date.match(/\b(18|19|20)\d{2}\b/);
  return m ? Number(m[0]) : null;
}

/** Crossref abstracts arrive as JATS XML; keep the prose, drop the tags. */
function stripJats(abstract?: string): string | null {
  if (!abstract) return null;
  const text = abstract.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text || null;
}

function shortReason(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "TimeoutError") return "took too long";
    return err.message.slice(0, 80);
  }
  return "unavailable";
}
