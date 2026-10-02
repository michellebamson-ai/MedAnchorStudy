import { SourceTag } from "@/components/ui";

/**
 * Shared rendering for generated notes and summaries (MATERIALS_SPEC.md §3/§4).
 * Book-style serif headings, plain text, formulas in highlighted boxes.
 */

type Body = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function arr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x : "")).filter(Boolean);
}

/** Where this came from — every item carries its label (spec: Shared). */
export function SourceLabel({ body, examNote }: { body: Body; examNote?: string | null }) {
  const source = body.source as { type?: string; title?: string; url?: string } | undefined;
  return (
    <span className="row" style={{ gap: "var(--sp-2)" }}>
      {source?.type === "uploaded" ? (
        <span className="source-tag source-uploaded">From your material{source.title ? `: ${source.title}` : ""}</span>
      ) : source?.type === "external" ? (
        <a className="source-tag source-external" href={source.url ?? "#"}>
          Outside source{source.title ? `: ${source.title}` : ""}
        </a>
      ) : (
        <span className="source-tag source-ai">AI example</span>
      )}
      {examNote ? <span className="tag tag-exam">{examNote}</span> : null}
    </span>
  );
}

export function plainTextOf(body: Body): string {
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string") parts.push(v);
    else if (Array.isArray(v)) v.forEach(push);
  };
  for (const [k, v] of Object.entries(body)) {
    if (k === "source" || k === "examNote") continue;
    push(v);
  }
  return parts.join("\n");
}

/** Split a body into display sections: headings, points, formulas, watch-outs. */
export function ArtifactBody({ body }: { body: Body }) {
  const overview = str(body.overview) || str(body.content);
  const keyPoints = arr(body.keyPoints).length ? arr(body.keyPoints) : arr(body.points);
  const misconceptions = arr(body.misconceptions);
  const relevance = str(body.clinicalRelevance);
  const formulas = keyPoints.filter((p) => /=|±|×|÷|∑|√|π/.test(p) && p.length < 140);
  const points = keyPoints.filter((p) => !formulas.includes(p));

  return (
    <div className="note-body">
      {overview ? <p>{overview}</p> : null}

      {points.length > 0 ? (
        <>
          <h4>Main points</h4>
          <ul>
            {points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </>
      ) : null}

      {formulas.length > 0 ? (
        <>
          <h4>Formulas</h4>
          {formulas.map((f, i) => (
            <div key={i} className="formula-box">
              {f}
            </div>
          ))}
        </>
      ) : null}

      {misconceptions.length > 0 ? (
        <>
          <h4>
            Watch out <span className="tag tag-review">Common mistakes</span>
          </h4>
          <ul>
            {misconceptions.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </>
      ) : null}

      {relevance ? (
        <>
          <h4>Why it matters</h4>
          <p>{relevance}</p>
        </>
      ) : null}

      {!overview && !points.length && !formulas.length ? (
        <p className="card-sub">This note is empty — try generating it again from Analyze Docs.</p>
      ) : null}
    </div>
  );
}

/** Manual notes are plain text with blank lines between paragraphs. */
export function ManualNoteBody({ text }: { text: string }) {
  const paras = text.split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="note-body">
      {paras.map((p, i) =>
        p.startsWith("#") ? (
          <h4 key={i}>{p.replace(/^#+\s*/, "")}</h4>
        ) : (
          <p key={i}>{p}</p>
        )
      )}
    </div>
  );
}
