"use client";

import Link from "next/link";
import type { FeedChain } from "@/lib/paths";

/**
 * Learning loop feed (PROGRESS_SPEC.md §6). Events grouped per topic so the
 * closed loop is visible as a chain — what was flagged, what the student did,
 * and what got scheduled next — rather than a flat list of timestamps.
 */
export function LoopFeed({ chains, planAhead }: { chains: FeedChain[]; planAhead: number }) {
  return (
    <section className="plan-feed" aria-labelledby="feed-heading">
      <div className="row-between" style={{ marginBottom: "var(--sp-4)" }}>
        <h2 id="feed-heading" className="section-title" style={{ margin: 0 }}>
          Learning loop
        </h2>
        <span className="list-sub">Everything you do feeds the next step</span>
      </div>

      {chains.length === 0 ? (
        <div className="surface">
          <p className="card-sub" style={{ margin: 0 }}>
            Your loop starts with your first session. Anything you do in the Tutor, Practice, Materials or
            Research appears here, and shows what it changed.
          </p>
          <div style={{ marginTop: "var(--sp-4)" }}>
            <Link className="btn btn-primary btn-sm" href="/teach">
              Start a Teach Me session
            </Link>
          </div>
        </div>
      ) : (
        <div className="feed-list">
          {chains.map((chain) => (
            <article key={chain.topicSlug ?? "_general"} className="surface-tight feed-chain">
              <div className="feed-chain-head">
                <span className="list-title">{chain.topicTitle ?? "Across your studies"}</span>
                <span className="list-sub">
                  {chain.entries.length} step{chain.entries.length === 1 ? "" : "s"}
                </span>
              </div>
              <ol className="feed-steps">
                {chain.entries.slice(0, 5).map((e, i) => (
                  <li key={e.id} data-first={i === 0 ? "yes" : undefined}>
                    <span className="feed-dot" aria-hidden="true" />
                    <span className="feed-text">
                      <span className="feed-label">
                        {i === 0 ? e.label : `→ ${e.label}`}
                        {e.topicTitle && chain.topicSlug ? "" : ""}
                      </span>
                      {e.detail ? <span className="feed-detail">{e.detail}</span> : null}
                    </span>
                    <span className="feed-time">
                      {e.at.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      {" · "}
                      {e.at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      )}

      {planAhead > 0 ? (
        <p className="hint" style={{ marginTop: "var(--sp-4)" }}>
          Your Study Plan holds {planAhead} task{planAhead === 1 ? "" : "s"} built from these signals.{" "}
          <Link href="/plan">Open the plan →</Link>
        </p>
      ) : null}
    </section>
  );
}