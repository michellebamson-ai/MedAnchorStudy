"use client";

import { useState } from "react";
import type { PlayCase } from "@/app/practice/case-actions";
import { CaseSetup } from "@/components/practice/case-setup";
import { CaseRunner } from "@/components/practice/case-runner";

export interface CasesData {
  suggested: PlayCase[];
  all: PlayCase[];
  documents: Array<{ id: string; title: string }>;
  unfinished: { attemptId: string; caseId: string; title: string; atStep: number; total: number } | null;
}

/** Cases tab: setup ⇄ runner, kept client-side so progress never reloads. */
export function CasesTab({ data }: { data: CasesData }) {
  const [open, setOpen] = useState<{ attemptId: string; play: PlayCase; fromStep: number } | null>(null);

  if (open) {
    return (
      <CaseRunner
        attemptId={open.attemptId}
        play={open.play}
        fromStep={open.fromStep}
        onExit={() => setOpen(null)}
      />
    );
  }

  return (
    <CaseSetup
      suggested={data.suggested}
      all={data.all}
      documents={data.documents}
      unfinished={data.unfinished}
      onOpen={(attemptId, play, fromStep) => setOpen({ attemptId, play, fromStep })}
    />
  );
}
