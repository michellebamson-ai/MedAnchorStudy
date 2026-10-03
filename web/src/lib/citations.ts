/**
 * Deterministic citation formatters (RESEARCH_SPEC.md §4). Built only from
 * stored metadata — never invented — so every style stays consistent.
 */

export interface Citable {
  title: string;
  authors?: string | null;
  year?: number | null;
  publisher?: string | null;
  url?: string | null;
  identifier?: string | null;
}

export type CitationStyle = "apa" | "vancouver" | "harvard";

function authorsOf(s: Citable): string {
  return (s.authors ?? "").trim() || (s.publisher ?? "").trim() || "Unknown author";
}

export function formatCitation(s: Citable, style: CitationStyle): string {
  const authors = authorsOf(s);
  const year = s.year ? String(s.year) : "n.d.";
  const title = s.title.trim();
  const publisher = (s.publisher ?? "").trim();
  const url = (s.url ?? "").trim();

  switch (style) {
    case "apa": {
      // Authors (Year). Title. Publisher. URL
      const parts = [`${authors} (${year}).`, `${title}.`];
      if (publisher && publisher !== authors) parts.push(`${publisher}.`);
      if (url) parts.push(url);
      return parts.join(" ");
    }
    case "vancouver": {
      // Authors. Title. Publisher; Year. Available from: URL
      const head = publisher && publisher !== authors ? `${publisher}; ${year}.` : `${year}.`;
      const parts = [`${authors}.`, `${title}.`, head];
      if (url) parts.push(`Available from: ${url}`);
      return parts.join(" ");
    }
    case "harvard": {
      // Authors Year, 'Title', Publisher. Available at: URL
      const parts = [`${authors} ${year},`, `'${title}',`];
      if (publisher && publisher !== authors) parts.push(`${publisher}.`);
      if (url) parts.push(`Available at: ${url}`);
      return parts.join(" ");
    }
  }
}

export const STYLE_LABEL: Record<CitationStyle, string> = {
  apa: "APA",
  vancouver: "Vancouver",
  harvard: "Harvard",
};
