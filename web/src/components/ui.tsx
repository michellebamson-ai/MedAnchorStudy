import type { ReactNode } from "react";

/** Presentational primitives reused across every feature (Phase 1 inventory). */

export function PageHead({
  eyebrow,
  title,
  lede,
  action,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-head row-between">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {lede ? <p>{lede}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}

export type Status = "strong" | "needs_review" | "needs_attention";

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  strong: { label: "Strong", cls: "badge-strong" },
  needs_review: { label: "Needs Review", cls: "badge-review" },
  needs_attention: { label: "Needs Attention", cls: "badge-attention" },
};

export function StatusBadge({ status }: { status: Status }) {
  const meta = STATUS_META[status] ?? STATUS_META.needs_attention;
  return <span className={`badge ${meta.cls}`}>{meta.label}</span>;
}

export function Bar({ pct, status }: { pct: number; status?: Status }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const cls =
    status === "strong" ? "bar-strong" : status === "needs_review" ? "bar-review" : status === "needs_attention" ? "bar-attention" : "";
  return (
    <div className={`bar ${cls}`} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function Ring({ pct, label }: { pct: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: 84, height: 84 }}>
      <svg width="84" height="84" aria-hidden="true">
        <circle className="ring-track" cx="42" cy="42" r={r} fill="none" strokeWidth="7" />
        <circle
          className="ring-fill"
          cx="42"
          cy="42"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeDasharray={c}
          strokeDashoffset={c - (c * clamped) / 100}
        />
      </svg>
      <span className="ring-label">{label ?? `${clamped}%`}</span>
    </div>
  );
}

export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {children ? <div>{children}</div> : null}
      {action ? <div style={{ marginTop: "var(--sp-4)" }}>{action}</div> : null}
    </div>
  );
}

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "danger" | "ok";
  children: ReactNode;
}) {
  return (
    <div className={`alert alert-${tone}`} role={tone === "danger" ? "alert" : undefined}>
      {children}
    </div>
  );
}

/** Honest labelling of where information came from (PRD §4.3). */
export function SourceTag({ kind }: { kind: "uploaded" | "external" | "ai" }) {
  const label = kind === "uploaded" ? "Your material" : kind === "external" ? "External source" : "AI generated";
  return <span className={`source-tag source-${kind}`}>{label}</span>;
}

export function Steps({ current, total }: { current: number; total: number }) {
  return (
    <div className="steps" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="step-pip"
          data-state={i < current ? "done" : i === current ? "current" : "todo"}
        />
      ))}
    </div>
  );
}
