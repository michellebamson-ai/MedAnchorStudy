import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ArtifactBody, ManualNoteBody, SourceLabel, plainTextOf } from "@/components/materials/artifact-view";
import { DeriveButtons, StarButton } from "@/components/materials/artifact-actions";
import { ListenButton } from "@/components/materials/listen-button";
import { NoteForm } from "@/components/materials/note-form";

const NOTE_KINDS = ["breakdown", "revision_notes", "formula_walkthrough", "explanation"];

const TYPE_TAG: Record<string, string> = {
  breakdown: "Topic breakdown",
  revision_notes: "Revision notes",
  formula_walkthrough: "Formula walkthrough",
  explanation: "Concept explanation",
};

/**
 * Notes tab (MATERIALS_SPEC.md §3): generated notes grouped by material, plus
 * the student's own notes. Reader shows breakdown, formulas, quick review and
 * actions — never a wall of identical cards.
 */
export async function NotesTab({
  userId,
  q,
  noteId,
  made,
  docId,
}: {
  userId: string | null;
  q: string;
  noteId?: string;
  made?: string;
  docId?: string;
}) {
  if (!userId) {
    return (
      <div className="surface" style={{ maxWidth: 560 }}>
        <h2 className="display-lg">Notes live here</h2>
        <p className="card-sub" style={{ marginTop: "var(--sp-3)" }}>
          Sign in, analyze a material, and your revision notes will appear — alongside any you
          write yourself.
        </p>
        <div style={{ marginTop: "var(--sp-5)" }}>
          <a className="btn btn-primary" href="/login">
            Sign in
          </a>
        </div>
      </div>
    );
  }

  const term = q.trim().toLowerCase();
  const notes = await prisma.artifact.findMany({
    where: {
      userId,
      kind: { in: NOTE_KINDS },
      ...(term ? { title: { contains: term, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { document: { select: { id: true, title: true, subject: true } } },
  });

  const mine = notes.filter((n) => (n.body as { manual?: boolean })?.manual);
  const madeForYou = notes.filter((n) => !(n.body as { manual?: boolean })?.manual);
  const shown = made === "mine" ? mine : madeForYou;

  const open = noteId ? notes.find((n) => n.id === noteId) : null;

  const documents = await prisma.document.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });

  if (open) {
    return <NoteReader note={open} />;
  }

  return (
    <div className="stack-lg">
      <section>
        <div className="row-between" style={{ marginBottom: "var(--sp-4)" }}>
          <h2 className="display-lg">Notes</h2>
          <Link className="btn btn-primary btn-sm" href="/materials?tab=notes&compose=1">
            Add my own note
          </Link>
        </div>
        <div className="row" style={{ marginBottom: "var(--sp-5)" }}>
          <Link
            className="chip chip-sm"
            aria-pressed={made !== "mine"}
            href="/materials?tab=notes"
            style={{ textDecoration: "none" }}
          >
            Made for you ({madeForYou.length})
          </Link>
          <Link
            className="chip chip-sm"
            aria-pressed={made === "mine"}
            href="/materials?tab=notes&made=mine"
            style={{ textDecoration: "none" }}
          >
            My notes ({mine.length})
          </Link>
        </div>

        {shown.length === 0 ? (
          <div className="surface" style={{ textAlign: "center" }}>
            <h3 className="display-lg">
              {made === "mine" ? "No notes written yet" : "No notes yet"}
            </h3>
            <p className="card-sub" style={{ marginTop: "var(--sp-2)" }}>
              {made === "mine"
                ? "Write your first note — headings, lists and all."
                : "Notes show up here after you analyze a material."}
            </p>
            <div style={{ marginTop: "var(--sp-4)" }}>
              {made === "mine" ? (
                <Link className="btn btn-primary btn-sm" href="/materials?tab=notes&compose=1">
                  Write a note
                </Link>
              ) : (
                <Link className="btn btn-primary btn-sm" href="/materials?tab=analyze">
                  Go to Analyze Docs
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="stack-sm">
            {shown.map((n) => {
              const edited = (n.body as { editedFrom?: string })?.editedFrom;
              return (
                <div key={n.id} className="doc-row">
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <Link className="list-title" href={`/materials?tab=notes&note=${n.id}`}>
                      {n.title}
                    </Link>
                    <span className="list-sub" style={{ display: "block" }}>
                      {[n.document?.subject, n.createdAt.toLocaleDateString()].filter(Boolean).join(" · ")}
                    </span>
                    <span className="row" style={{ gap: 6, marginTop: 4 }}>
                      <span className="tag">{TYPE_TAG[n.kind] ?? n.kind}</span>
                      {edited ? <span className="tag">Edited</span> : null}
                    </span>
                  </span>
                  <StarButton artifactId={n.id} favorite={n.favorite} />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <NoteForm documents={documents} preselectedDoc={docId} />
    </div>
  );
}

function NoteReader({
  note,
}: {
  note: {
    id: string;
    title: string;
    kind: string;
    body: unknown;
    favorite: boolean;
    detailLevel: number;
    createdAt: Date;
    document: { id: string; title: string; subject: string | null } | null;
  };
}) {
  const body = (note.body ?? {}) as Record<string, unknown>;
  const manual = body.manual === true;
  return (
    <div style={{ maxWidth: 760 }}>
      <Link className="btn btn-ghost btn-sm" href="/materials?tab=notes" style={{ marginBottom: "var(--sp-4)" }}>
        ← All notes
      </Link>
      <span className="eyebrow">{note.document?.title ?? note.document?.subject ?? "My notes"}</span>
      <h2 className="display-sm" style={{ marginBottom: "var(--sp-2)" }}>
        {note.title}
      </h2>
      <div className="row" style={{ gap: "var(--sp-2)", marginBottom: "var(--sp-6)" }}>
        <SourceLabel body={body} examNote={typeof body.examNote === "string" ? body.examNote : null} />
        <StarButton artifactId={note.id} favorite={note.favorite} />
      </div>

      {manual ? (
        <ManualNoteBody text={String(body.text ?? "")} />
      ) : (
        <ArtifactBody body={body} />
      )}

      <div className="review-box">
        <h4>Quick review</h4>
        <p className="card-sub" style={{ margin: 0 }}>
          Revisit this note in 2 days, then in a week — we’ll remind you from your Study Plan.
        </p>
      </div>

      <div className="stack-sm" style={{ marginTop: "var(--sp-6)" }}>
        <ListenButton text={manual ? String(body.text ?? "") : plainTextOf(body)} />
        <DeriveButtons artifactId={note.id} />
        <Link className="btn btn-ghost btn-sm" href="/teach">
          Ask the tutor →
        </Link>
      </div>
    </div>
  );
}
