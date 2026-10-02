"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Doc = {
  id: string;
  title: string;
  kind: string;
  subject: string | null;
  status: string;
  error: string | null;
  createdAt: Date | string;
};

type Pending = { name: string; pct: number; state: "uploading" | "done" | "error"; message?: string };

const KIND_ICON: Record<string, string> = {
  pdf: "❐",
  slides: "▦",
  text: "≡",
  image: "◫",
  audio: "♫",
  other: "□",
};

const STATUS_LABEL: Record<string, { text: string; tone: "ok" | "warn" | "bad" | "" }> = {
  uploaded: { text: "Ready to analyze", tone: "" },
  extracting: { text: "Reading…", tone: "warn" },
  analyzing: { text: "Analyzing…", tone: "warn" },
  analyzed: { text: "Done", tone: "ok" },
};

function statusFor(d: Doc): { text: string; tone: "ok" | "warn" | "bad" | "" } {
  if (d.status === "analyzed") return STATUS_LABEL.analyzed;
  if (d.status === "analyzing" || d.status === "extracting") return STATUS_LABEL.analyzing;
  if (d.error === "unreadable") return { text: "Needs attention", tone: "warn" };
  if (d.error) return { text: "Needs attention", tone: "bad" };
  return STATUS_LABEL.uploaded;
}

/**
 * Upload tab (MATERIALS_SPEC.md §1). Real per-file progress bars via XHR —
 * the bar reflects bytes actually sent, not a guess.
 */
export function UploadTab({
  signedIn,
  documents,
  subjects,
  q,
}: {
  signedIn: boolean;
  documents: Doc[];
  subjects: string[];
  q: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [subject, setSubject] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [analyzeAfter, setAnalyzeAfter] = useState(true);
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState(q);
  const [pasting, setPasting] = useState(false);

  const activeSubject = customSubject.trim() || subject;

  function send(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setError("");

    list.forEach((file) => {
      setPending((p) => [...p, { name: file.name, pct: 0, state: "uploading" }]);

      const form = new FormData();
      form.append("files", file);
      if (activeSubject) form.append("subject", activeSubject);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/materials/upload");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setPending((p) => p.map((x) => (x.name === file.name && x.state === "uploading" ? { ...x, pct } : x)));
        }
      };
      xhr.onload = () => {
        let body: { ok: boolean; message: string } = { ok: false, message: "Upload stopped. Tap to try again." };
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          /* keep default */
        }
        setPending((p) =>
          p.map((x) =>
            x.name === file.name
              ? { ...x, state: body.ok ? "done" : "error", pct: 100, message: body.ok ? undefined : body.message }
              : x
          )
        );
        if (body.ok) router.refresh();
        else setError(body.message);
      };
      xhr.onerror = () => {
        setPending((p) =>
          p.map((x) =>
            x.name === file.name ? { ...x, state: "error", message: "Upload stopped. Tap to try again." } : x
          )
        );
      };
      xhr.send(form);
    });
  }

  const visible = documents.filter((d) =>
    filter.trim() ? d.title.toLowerCase().includes(filter.trim().toLowerCase()) : true
  );

  if (!signedIn) {
    return (
      <div className="surface" style={{ maxWidth: 560 }}>
        <h2 className="display-lg">Your materials live here</h2>
        <p className="card-sub" style={{ marginTop: "var(--sp-3)" }}>
          Sign in so uploads, analyses and everything made from them are private to you.
        </p>
        <div style={{ marginTop: "var(--sp-5)" }}>
          <a className="btn btn-primary" href="/login">
            Sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <section>
        <div className="row-between" style={{ marginBottom: "var(--sp-4)" }}>
          <h2 className="display-lg">Upload</h2>
          <input
            className="input"
            style={{ maxWidth: 260 }}
            placeholder="Find a material by name…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Find a material by name"
          />
        </div>

        <div
          className="dropzone"
          data-over={over}
          role="button"
          tabIndex={0}
          aria-label="Drop files here or activate to choose files"
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            send(e.dataTransfer.files);
          }}
        >
          <div className="dropzone-title">Drop files here or tap to choose</div>
          <div className="dropzone-sub">PDF, slides, textbook pages, audio, images, and notes.</div>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) send(e.target.files);
              e.target.value = "";
            }}
            aria-label="Choose files"
          />
        </div>

        <div className="row" style={{ marginTop: "var(--sp-4)" }}>
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()} type="button">
            Add material
          </button>
          <button className="btn btn-sm" type="button" onClick={() => setPasting((p) => !p)}>
            Paste text
          </button>
          <span className="hint">Photos and audio recording arrive with the mobile apps.</span>
        </div>

        {pasting ? <PasteBox subject={activeSubject} onDone={() => { setPasting(false); router.refresh(); }} /> : null}

        <div className="stack-sm" style={{ marginTop: "var(--sp-5)" }}>
          <span className="label">Subject (optional)</span>
          <div className="chips" role="group" aria-label="Subject">
            {subjects.map((s) => (
              <button
                key={s}
                className="chip chip-sm"
                aria-pressed={subject === s && !customSubject}
                onClick={() => {
                  setSubject(s);
                  setCustomSubject("");
                }}
                type="button"
              >
                {s}
              </button>
            ))}
            <input
              className="input"
              style={{ maxWidth: 200 }}
              placeholder="Or add one…"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              aria-label="New subject"
            />
          </div>
          <label className="row" style={{ gap: "var(--sp-2)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={analyzeAfter}
              onChange={(e) => setAnalyzeAfter(e.target.checked)}
            />
            <span className="hint">Analyze right after upload</span>
          </label>
          <p className="hint">Your files are private and only you can see them.</p>
        </div>

        {pending.length > 0 ? (
          <div className="stack-sm" style={{ marginTop: "var(--sp-5)" }} aria-live="polite">
            {pending.map((p) => (
              <div key={p.name} className="doc-row">
                <span className="doc-icon" aria-hidden="true">
                  ⇪
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="list-title">{p.name}</span>
                  <span className="progress-line" style={{ marginTop: 6 }}>
                    <i style={{ width: `${p.pct}%` }} />
                  </span>
                  {p.state === "error" ? <span className="doc-status" data-tone="bad">{p.message}</span> : null}
                </span>
                <span className="doc-status">{p.state === "done" ? "Added" : `${p.pct}%`}</span>
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="alert alert-danger" style={{ marginTop: "var(--sp-4)" }}>
            {error}
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="display-lg" style={{ marginBottom: "var(--sp-4)" }}>
          Your materials
        </h2>
        {documents.length === 0 ? (
          <div className="surface" style={{ textAlign: "center" }}>
            <h3 className="display-lg">Add your first lecture</h3>
            <p className="card-sub" style={{ marginTop: "var(--sp-2)" }}>
              We’ll turn it into notes, flashcards, a summary, and practice questions.
            </p>
            <div style={{ marginTop: "var(--sp-4)" }}>
              <button className="btn btn-primary" onClick={() => fileRef.current?.click()} type="button">
                Add material
              </button>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <p className="card-sub">Nothing matches “{filter}”.</p>
        ) : (
          <div className="stack-sm">
            {visible.map((d) => {
              const st = statusFor(d);
              return (
                <div key={d.id} className="doc-row">
                  <span className="doc-icon" aria-hidden="true">
                    {KIND_ICON[d.kind] ?? "□"}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="list-title">{d.title}</span>
                    <span className="list-sub" style={{ display: "block" }}>
                      {[d.subject, d.kind, new Date(d.createdAt).toLocaleDateString()]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="doc-status" data-tone={st.tone}>
                    {st.text}
                  </span>
                  <a className="btn btn-sm" href={`/materials?tab=analyze&doc=${d.id}`}>
                    {d.status === "analyzed" ? "Open" : "Analyze"}
                  </a>
                </div>
              );
            })}
          </div>
        )}

        <p className="fineprint">
          <a href="/settings">What we collect and why</a>
        </p>
      </section>
    </div>
  );
}

function PasteBox({ subject, onDone }: { subject: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    setBusy(true);
    setMessage("");
    const form = new FormData();
    form.append("title", title || "Pasted notes");
    form.append("subject", subject);
    form.append("text", text);
    form.append("analyzeAfter", "1");
    const { pasteTextMaterial } = await import("@/app/materials/actions");
    const res = await pasteTextMaterial(form);
    setBusy(false);
    if (res.ok) {
      onDone();
    } else {
      setMessage(res.message);
    }
  }

  return (
    <div className="surface" style={{ marginTop: "var(--sp-4)" }}>
      <h3 className="card-title">Paste text</h3>
      <div className="stack-sm" style={{ marginTop: "var(--sp-3)" }}>
        <input
          className="input"
          placeholder="Title — e.g. Cardiology lecture 4"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Pasted text title"
        />
        <textarea
          className="textarea"
          style={{ minHeight: 140 }}
          placeholder="Paste the material here — at least a paragraph."
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Pasted text"
        />
        {message ? <div className="alert alert-danger">{message}</div> : null}
        <div className="row">
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy} type="button">
            {busy ? "Adding…" : "Add and analyze"}
          </button>
        </div>
      </div>
    </div>
  );
}
