"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearDemoData, resetDemoData } from "@/app/demo/actions";

/**
 * Demo mode banner (see src/lib/bypass.ts).
 *
 * Says plainly what is true: one shared identity, everything here is sample
 * data, and the data itself is inspectable and reversible. The previous version
 * was a static strip telling you to edit a file, which hid the fact that
 * whatever you uploaded was landing in a shared account.
 */
export function DemoBanner({ suppressed }: { suppressed?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; message: string }>) {
    start(async () => {
      const res = await fn();
      setMessage(res.message);
      if (res.ok) router.refresh();
    });
  }

  if (suppressed) {
    return (
      <div className="demo-strip" data-tone="danger" role="status">
        <span className="demo-strip-text">
          <b>Auth enforced.</b> BYPASS_AUTH=1 is set but ignored because NODE_ENV=production — real sign-in is
          active. Remove the flag from web/.env.
        </span>
      </div>
    );
  }

  return (
    <div className="demo-strip" data-tone="warn" role="status">
      <span className="demo-strip-text">
        <b>Demo mode.</b> Sign-in is bypassed, so you are the shared student{" "}
        <code>demo@medanchor.local</code>. Anything you upload or generate here is sample data on one account.
      </span>
      <button className="demo-strip-btn" onClick={() => setOpen((o) => !o)} type="button" aria-expanded={open}>
        {open ? "Hide" : "Demo data"}
      </button>
      {open ? (
        <span className="demo-strip-panel">
          <span className="demo-strip-hint">
            Uploads, plans, mastery and review history all live under the demo account. Reset restores a
            representative state; clear empties it so you can walk the first-run flow.
          </span>
          <span className="demo-strip-actions">
            <button className="btn btn-sm" disabled={pending} onClick={() => run(resetDemoData)} type="button">
              {pending ? "Working…" : "Reset to sample data"}
            </button>
            <button className="btn btn-sm" disabled={pending} onClick={() => run(clearDemoData)} type="button">
              Clear everything
            </button>
          </span>
          {message ? <span className="demo-strip-msg">{message}</span> : null}
        </span>
      ) : null}
    </div>
  );
}
