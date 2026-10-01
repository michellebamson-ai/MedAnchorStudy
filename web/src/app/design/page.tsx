import { Alert, Bar, Empty, PageHead, Ring, Stat, StatusBadge, Steps } from "@/components/ui";
import { NAV } from "@/components/nav";
import { ChatDemo, FlipCardDemo, QuizDemo, ThemeToggle } from "@/components/design/demos";

export const metadata = { title: "Design System" };

/**
 * Phase 1 gallery — dev-only reference. Every component in the product is
 * built from these tokens and blocks; if something isn't here, it doesn't ship.
 */
export default async function DesignPage({ searchParams }: PageProps<"/design">) {
  // `?theme=light` renders the gallery in light mode so both themes can be
  // reviewed (and linked to) without clicking. Everything is a token swap.
  const params = await searchParams;
  const forced = Array.isArray(params.theme) ? params.theme[0] : params.theme;
  const theme = forced === "light" ? "light" : "dark";

  return (
    <div className="content" style={{ maxWidth: 1180 }}>
      <PageHead
        eyebrow="Phase 1 · Design system"
        title="MedAnchor component gallery"
        lede="Token-driven, dark by default, light by token swap. Mobile-first, keyboard-operable, screen-reader labelled."
        action={<ThemeToggle initial={theme} />}
      />

      <div className="stack" style={{ gap: "var(--sp-8)" }}>
        {/* ---------- Brand & semantic colour ---------- */}
        <section className="card">
          <h2 className="card-title">Colour</h2>
          <p className="card-sub">
            Brand ramp and semantic tokens. Both themes are defined purely by variable overrides, so no
            component changes between them.
          </p>

          <h3 style={{ marginTop: "var(--sp-5)", fontSize: "var(--fs-sm)" }}>Brand</h3>
          <div className="grid grid-4" style={{ marginTop: "var(--sp-3)" }}>
            {[
              ["--brand-900", "#04342C"],
              ["--brand-800", "#064E42"],
              ["--brand-700", "#0A6B5C"],
              ["--brand-600", "#0E7490"],
              ["--brand-500", "#14919B"],
              ["--brand-400", "#2BB3BA"],
              ["--brand-300", "#6FD3D6"],
            ].map(([token, hex]) => (
              <div key={token} className="list-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                <span
                  style={{
                    height: 52,
                    borderRadius: "var(--r-md)",
                    background: `var(${token})`,
                    border: "1px solid var(--line)",
                  }}
                />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)" }}>{token}</span>
                <span className="list-sub">{hex}</span>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: "var(--sp-6)", fontSize: "var(--fs-sm)" }}>Semantic</h3>
          <div className="grid grid-4" style={{ marginTop: "var(--sp-3)" }}>
            {[
              ["--ok", "Strong / correct"],
              ["--warn", "Needs review"],
              ["--danger", "Needs attention"],
              ["--info", "Informational"],
            ].map(([token, label]) => (
              <div key={token} className="list-row" style={{ gap: "var(--sp-3)" }}>
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "var(--r-sm)",
                    background: `var(${token})`,
                    flex: "none",
                  }}
                />
                <span style={{ minWidth: 0 }}>
                  <span className="list-title" style={{ display: "block" }}>{label}</span>
                  <span className="list-sub" style={{ fontFamily: "var(--font-mono)" }}>{token}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Typography ---------- */}
        <section className="card">
          <h2 className="card-title">Typography</h2>
          <p className="card-sub">
            Scale from <code>--fs-xs</code> to <code>--fs-3xl</code>; line heights <code>--lh-tight</code>{" "}
            (1.25), <code>--lh-normal</code> (1.55), <code>--lh-loose</code> (1.75).
          </p>
          <div className="stack-sm" style={{ marginTop: "var(--sp-4)" }}>
            {[
              ["--fs-3xl", "Display", "Dashboard heading"],
              ["--fs-2xl", "Page title", "Today's focus"],
              ["--fs-xl", "Section", "Do this next"],
              ["--fs-lg", "Card title", "Topic mastery"],
              ["--fs-md", "Lead", "Body copy at reading size"],
              ["--fs-base", "Body", "Default paragraph text for dense study material"],
              ["--fs-sm", "UI", "Buttons, list rows, chat bubbles"],
              ["--fs-xs", "Meta", "Hints, badges, table headers"],
            ].map(([token, name, sample]) => (
              <div key={token} className="list-row" style={{ alignItems: "baseline" }}>
                <span style={{ width: 88, flex: "none", fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "var(--text-3)" }}>
                  {token}
                </span>
                <span style={{ width: 96, flex: "none" }} className="list-sub">
                  {name}
                </span>
                <span style={{ fontSize: `var(${token})` }}>{sample}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Buttons ---------- */}
        <section className="card">
          <h2 className="card-title">Buttons</h2>
          <p className="card-sub">
            <code>.btn-primary</code> is the Task-2 canonical treatment: gradient shifts deep teal → highlight
            blue on hover, lifts 2px, and glows on hover and focus.
          </p>

          <h3 style={{ marginTop: "var(--sp-5)", fontSize: "var(--fs-sm)" }}>Variants</h3>
          <div className="row" style={{ marginTop: "var(--sp-3)" }}>
            <button className="btn btn-primary" type="button">Primary</button>
            <button className="btn btn-secondary" type="button">Secondary</button>
            <button className="btn" type="button">Default</button>
            <button className="btn btn-ghost" type="button">Ghost</button>
            <button className="btn btn-danger" type="button">Danger</button>
            <button className="btn btn-primary" type="button" disabled>Disabled</button>
          </div>

          <h3 style={{ marginTop: "var(--sp-6)", fontSize: "var(--fs-sm)" }}>Sizes & full width</h3>
          <div className="row" style={{ marginTop: "var(--sp-3)" }}>
            <button className="btn btn-primary btn-sm" type="button">Small</button>
            <button className="btn btn-primary" type="button">Default</button>
            <button className="btn btn-primary" style={{ minHeight: 52, paddingInline: "var(--sp-6)" }} type="button">
              Large
            </button>
          </div>
          <button className="btn btn-primary btn-block" style={{ marginTop: "var(--sp-3)" }} type="button">
            Block
          </button>
        </section>

        {/* ---------- Mastery statuses ---------- */}
        <section className="card">
          <h2 className="card-title">Mastery statuses</h2>
          <p className="card-sub">
            PRD §3.8 — <code>Strong</code>, <code>Needs Review</code>, <code>Needs Attention</code>. Always
            derived from multiple signals, never a single quiz score.
          </p>
          <div className="stack-sm" style={{ marginTop: "var(--sp-4)" }}>
            {([
              ["strong", "Renin–Angiotensin–Aldosterone System", 92],
              ["needs_review", "Sensitivity & Specificity", 58],
              ["needs_attention", "Brachial Plexus", 18],
            ] as const).map(([status, title, pct]) => (
              <div key={status} className="list-row">
                <span style={{ width: 130, flex: "none" }} className="list-title">{title}</span>
                <span style={{ flex: 1 }}>
                  <Bar pct={pct} status={status} />
                </span>
                <span style={{ width: 120, flex: "none", textAlign: "right" }}>
                  <StatusBadge status={status} />
                </span>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: "var(--sp-4)" }}>
            <span className="badge badge-strong">Strong</span>
            <span className="badge badge-review">Needs Review</span>
            <span className="badge badge-attention">Needs Attention</span>
            <span className="badge badge-neutral">Neutral</span>
            <span className="badge badge-info">Recommended</span>
          </div>
        </section>

        {/* ---------- Stats & progress ---------- */}
        <section className="card">
          <h2 className="card-title">Stats &amp; progress</h2>
          <div className="grid grid-4" style={{ marginTop: "var(--sp-4)" }}>
            <Stat label="Topics covered" value="3/5" hint="with recorded activity" />
            <Stat label="Strong topics" value={1} hint="multi-signal" />
            <Stat label="Average mastery" value="58%" hint="across all topics" />
            <div className="stat row" style={{ gap: "var(--sp-3)" }}>
              <Ring pct={58} />
              <div>
                <div className="stat-label">Daily goal</div>
                <div className="stat-value" style={{ fontSize: "var(--fs-lg)" }}>60m</div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Forms ---------- */}
        <section className="card">
          <h2 className="card-title">Forms</h2>
          <p className="card-sub">Labels, hints and errors; 40px minimum touch target; visible focus ring.</p>
          <div className="grid grid-2" style={{ marginTop: "var(--sp-4)" }}>
            <div className="stack">
              <div className="field">
                <label className="label" htmlFor="d-input">Input</label>
                <input className="input" id="d-input" placeholder="e.g. Sensitivity &amp; Specificity" />
              </div>
              <div className="field">
                <label className="label" htmlFor="d-select">Select</label>
                <select className="select" id="d-select" defaultValue="step">
                  <option value="gentle">Gentle guidance</option>
                  <option value="rapid">Rapid-fire questioning</option>
                  <option value="exam">Exam-style pressure</option>
                  <option value="step">Step-by-step teaching</option>
                </select>
                <span className="hint">Teaching style — PRD §3.1.</span>
              </div>
            </div>
            <div className="stack">
              <div className="field">
                <label className="label" htmlFor="d-text">Textarea</label>
                <textarea className="textarea" id="d-text" defaultValue="Explain the RAAS cascade as if teaching a peer…" />
              </div>
              <div className="field">
                <label className="label" htmlFor="d-range">Explanation depth — <code>--fs-xs</code> to exhaustive</label>
                <input id="d-range" type="range" min="1" max="5" defaultValue="3" />
                <span className="hint">Personalization control (PRD §3.9.2).</span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Alerts ---------- */}
        <section className="card">
          <h2 className="card-title">Alerts &amp; source labelling</h2>
          <div className="stack-sm" style={{ marginTop: "var(--sp-4)" }}>
            <Alert tone="info">Evidence coverage is currently limited to the seeded source library.</Alert>
            <Alert tone="ok">Mastery updated — RAAS is now Strong.</Alert>
            <Alert tone="warn">This plan is heavier than your available time today.</Alert>
            <Alert tone="danger">Could not reach the database. Your work is saved locally.</Alert>
          </div>

          <h3 style={{ marginTop: "var(--sp-6)", fontSize: "var(--fs-sm)" }}>Where information came from</h3>
          <p className="card-sub" style={{ marginTop: 4 }}>
            PRD §4.3 — never blur uploaded material, external evidence, and AI-generated text.
          </p>
          <div className="row" style={{ marginTop: "var(--sp-3)" }}>
            <span className="source-tag source-uploaded">Your material</span>
            <span className="source-tag source-external">External source</span>
            <span className="source-tag source-ai">AI generated</span>
          </div>
        </section>

        {/* ---------- Flashcard ---------- */}
        <section className="card">
          <h2 className="card-title">Flashcard — 3D flip</h2>
          <p className="card-sub">Active recall with a real 3D transform; operable by keyboard.</p>
          <div style={{ marginTop: "var(--sp-4)", maxWidth: 520 }}>
            <FlipCardDemo />
          </div>
        </section>

        {/* ---------- Chat ---------- */}
        <section className="card">
          <h2 className="card-title">Tutor chat</h2>
          <p className="card-sub">
            Bubbles for the Socratic dialogue; <code>aria-live</code> so answers are announced. Enter sends,
            Shift+Enter newlines.
          </p>
          <div style={{ marginTop: "var(--sp-4)", maxWidth: 620 }}>
            <ChatDemo />
          </div>
        </section>

        {/* ---------- Quiz ---------- */}
        <section className="card">
          <h2 className="card-title">Question with annotated feedback</h2>
          <p className="card-sub">
            Options lock on selection and every option explains itself — including the wrong ones (PRD §4.3).
          </p>
          <div style={{ marginTop: "var(--sp-4)", maxWidth: 620 }}>
            <p style={{ fontWeight: 600 }}>Where does aldosterone exert its main effect?</p>
            <div style={{ marginTop: "var(--sp-3)" }}>
              <QuizDemo />
            </div>
          </div>
        </section>

        {/* ---------- Case steps ---------- */}
        <section className="card">
          <h2 className="card-title">Case progress &amp; steps</h2>
          <p className="card-sub">Progressive disclosure — information arrives one decision at a time.</p>
          <div style={{ marginTop: "var(--sp-4)" }}>
            <Steps current={2} total={5} />
            <div className="list-row">
              <div style={{ flex: 1 }}>
                <div className="list-title">Step 2 of 5 — What physiological triggers turned on her RAAS?</div>
                <div className="list-sub">Intermediate · Clinical Medicine · est. 12 min</div>
              </div>
              <button className="btn btn-primary btn-sm" type="button">Continue</button>
            </div>
          </div>
        </section>

        {/* ---------- Data display ---------- */}
        <section className="card">
          <h2 className="card-title">Lists &amp; tables</h2>
          <div className="grid grid-2" style={{ marginTop: "var(--sp-4)" }}>
            <div className="list">
              {[
                ["Teach Me session", "raas · 8 min"],
                ["Case: ACE inhibitor hyperkalaemia", "clinical · 12 min"],
                ["Spaced review: aldosterone", "revision · 10 min"],
              ].map(([t, s]) => (
                <div key={t} className="list-row">
                  <div style={{ flex: 1 }}>
                    <div className="list-title">{t}</div>
                    <div className="list-sub">{s}</div>
                  </div>
                  <span className="badge badge-neutral">P2</span>
                </div>
              ))}
            </div>
            <table>
              <thead>
                <tr><th>Topic</th><th>Mastery</th><th>Status</th></tr>
              </thead>
              <tbody>
                <tr><td>RAAS</td><td>92%</td><td><StatusBadge status="strong" /></td></tr>
                <tr><td>Sensitivity</td><td>58%</td><td><StatusBadge status="needs_review" /></td></tr>
                <tr><td>Brachial plexus</td><td>18%</td><td><StatusBadge status="needs_attention" /></td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------- States ---------- */}
        <section className="card">
          <h2 className="card-title">Empty, loading &amp; toast</h2>
          <div className="grid grid-2" style={{ marginTop: "var(--sp-4)" }}>
            <Empty title="No weak topics yet" action={<button className="btn btn-primary btn-sm" type="button">Start a session</button>}>
              Run a Teach Me session or a case to begin building your profile.
            </Empty>
            <div className="stack">
              <div>
                <div className="label" style={{ marginBottom: 6 }}>Skeleton</div>
                <div className="stack-sm">
                  <div className="skeleton" style={{ height: 14, width: "70%" }} />
                  <div className="skeleton" style={{ height: 14, width: "90%" }} />
                  <div className="skeleton" style={{ height: 14, width: "45%" }} />
                </div>
              </div>
              <div>
                <div className="label" style={{ marginBottom: 6 }}>Toast</div>
                <div className="toast-wrap" style={{ position: "static" }}>
                  <div className="toast toast-ok">Mastery updated — RAAS is now Strong.</div>
                  <div className="toast toast-error">Could not reach the database.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Navigation ---------- */}
        <section className="card">
          <h2 className="card-title">Navigation</h2>
          <p className="card-sub">
            One source of truth (<code>src/components/nav.tsx</code>, ADR-1). Current page is marked with{" "}
            <code>aria-current</code> and an inset rail.
          </p>
          <nav className="nav" style={{ marginTop: "var(--sp-4)", maxWidth: 300 }}>
            {NAV.map((item, i) => (
              <a
                key={item.href}
                href={item.href}
                className="nav-link"
                aria-current={i === 2 ? "page" : undefined}
              >
                <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                {item.label}
              </a>
            ))}
          </nav>
        </section>

        {/* ---------- Spacing & radius ---------- */}
        <section className="card">
          <h2 className="card-title">Spacing, radii &amp; elevation</h2>
          <div className="grid grid-2" style={{ marginTop: "var(--sp-4)" }}>
            <div>
              <div className="label" style={{ marginBottom: 6 }}>Spacing — 4px base</div>
              <div className="row" style={{ alignItems: "flex-end", gap: 6 }}>
                {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((n) => (
                  <div key={n} style={{ textAlign: "center" }}>
                    <div
                      style={{
                        width: 26,
                        height: `var(--sp-${n})`,
                        background: "var(--brand-600)",
                        borderRadius: 3,
                      }}
                    />
                    <span style={{ fontSize: 10, color: "var(--text-3)" }}>{n}</span>
                  </div>
                ))}
              </div>

              <div className="label" style={{ margin: "var(--sp-5) 0 6px" }}>Radii</div>
              <div className="row">
                {["--r-sm", "--r-md", "--r-lg", "--r-xl", "--r-full"].map((r) => (
                  <div key={r} style={{ textAlign: "center" }}>
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        background: "var(--panel-2)",
                        border: "1px solid var(--line-strong)",
                        borderRadius: `var(${r})`,
                      }}
                    />
                    <span style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
                      {r.replace("--r-", "")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="label" style={{ marginBottom: 6 }}>Elevation</div>
              <div className="row">
                {["--sh-1", "--sh-2", "--sh-3", "--sh-glow"].map((s) => (
                  <div key={s} style={{ textAlign: "center" }}>
                    <div
                      style={{
                        width: 60,
                        height: 52,
                        background: "var(--panel)",
                        border: "1px solid var(--line)",
                        borderRadius: "var(--r-md)",
                        boxShadow: `var(${s})`,
                      }}
                    />
                    <span style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
                      {s.replace("--sh-", "")}
                    </span>
                  </div>
                ))}
              </div>

              <div className="label" style={{ margin: "var(--sp-5) 0 6px" }}>Motion</div>
              <div className="stack-sm">
                <div className="hint"><code>--dur-1</code> 120ms · <code>--dur-2</code> 200ms · <code>--dur-3</code> 320ms</div>
                <div className="hint"><code>--ease</code> standard · <code>--ease-out</code> expressive</div>
                <Alert tone="info">
                  <code>prefers-reduced-motion</code> collapses all animation and transition durations — the
                  accessibility baseline in <code>tokens.css</code>.
                </Alert>
              </div>
            </div>
          </div>
        </section>

        <Alert tone="ok">
          Every block above is defined once in <code>src/app/components.css</code> or{" "}
          <code>tokens.css</code>. If a screen needs something not in this gallery, the component is missing —
          add it here first.
        </Alert>
      </div>
    </div>
  );
}
