"use client";

import { useState } from "react";
import { CommSetup } from "@/components/practice/comm-setup";
import { CommSession, SoapPractice, type CommSessionConfig } from "@/components/practice/comm-session";
import type { CommScenarioInfo } from "@/app/practice/comm-actions";

/** Communication tab: setup ⇄ session, plus standalone SOAP practice. */
export function CommTab({
  scenarios,
  suggested,
  documents,
  past,
  soapOnly,
  soapScenario,
}: {
  scenarios: CommScenarioInfo[];
  suggested: CommScenarioInfo[];
  documents: Array<{ id: string; title: string }>;
  past: Array<{ id: string; title: string; date: string; overall: number | null }>;
  soapOnly: boolean;
  soapScenario: { scenarioId: string } | null;
}) {
  const [open, setOpen] = useState<CommSessionConfig | null>(null);

  if (open) {
    return <CommSession config={open} onExit={() => setOpen(null)} />;
  }

  if (soapOnly) {
    if (!soapScenario) {
      return <p className="card-sub">No history-taking scenario is available yet.</p>;
    }
    return (
      <div style={{ maxWidth: 720 }}>
        <SoapPractice scenarioId={soapScenario.scenarioId} />
      </div>
    );
  }

  return (
    <CommSetup
      scenarios={scenarios}
      suggested={suggested}
      documents={documents}
      past={past}
      onOpen={setOpen}
    />
  );
}
