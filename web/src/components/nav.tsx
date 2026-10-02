import Link from "next/link";

/**
 * Navigation model (ONBOARDING_SPEC.md): seven main tabs in a dark-teal left
 * sidebar — Home, Materials, AI Tutor, Practice, Research, Study Plan and
 * Progress. This replaces the earlier five-item top nav.
 */
export const SIDEBAR_NAV = [
  { href: "/dashboard", label: "Home", icon: "◈", role: "What I need to know and do now" },
  { href: "/materials", label: "Materials", icon: "▤", role: "Study materials, notes and resources" },
  { href: "/teach", label: "AI Tutor", icon: "◆", role: "Adaptive tutoring" },
  { href: "/practice", label: "Practice", icon: "✎", role: "Questions, flashcards, cases and review" },
  { href: "/research", label: "Research", icon: "❑", role: "Biostatistics, methods and evidence" },
  { href: "/plan", label: "Study Plan", icon: "☷", role: "Schedule, exams and recovery" },
  { href: "/progress", label: "Progress", icon: "◔", role: "How I'm developing" },
] as const;

export interface HubItem {
  href: string;
  label: string;
  blurb: string;
}

export interface HubGroup {
  group: string;
  blurb: string;
  items: HubItem[];
}

/** Specialised spaces, grouped for search and the Practice/Research hubs. */
export const PRACTICE_GROUPS: HubGroup[] = [
  {
    group: "Retrieve",
    blurb: "Pull knowledge out — that is how it sticks.",
    items: [
      { href: "/flashcards", label: "Flashcards", blurb: "Adaptive active recall and spaced review." },
      { href: "/exam", label: "Practice Questions", blurb: "Annotated answers, not just marks." },
    ],
  },
  {
    group: "Apply",
    blurb: "Use knowledge the way the wards and the field demand.",
    items: [
      { href: "/cases", label: "Clinical Cases", blurb: "Clinical, epidemiological and outbreak scenarios." },
      { href: "/communicate", label: "Communication", blurb: "Histories, education and difficult conversations." },
    ],
  },
];

export const RESEARCH_GROUPS: HubGroup[] = [
  {
    group: "Methods",
    blurb: "Understand the numbers behind the evidence.",
    items: [
      { href: "/biostats", label: "Biostatistics", blurb: "Step-by-step coaching through statistical method." },
      { href: "/explore", label: "Research Methods", blurb: "Designs, variables and methodology help." },
    ],
  },
  {
    group: "Evidence",
    blurb: "Find it, compare it, cite it — and know its limits.",
    items: [
      { href: "/evidence", label: "Evidence Explorer", blurb: "Discovery, comparison and source transparency." },
      { href: "/assignments", label: "Assignments & Projects", blurb: "Research support with integrity built in." },
    ],
  },
];

/** Flat list for the global search palette. */
export const ALL_DESTINATIONS: Array<{ href: string; label: string; role?: string; blurb?: string }> =
  [
    ...SIDEBAR_NAV.map((n) => ({ href: n.href, label: n.label, role: n.role })),
    ...PRACTICE_GROUPS.flatMap((g) => g.items),
    ...RESEARCH_GROUPS.flatMap((g) => g.items),
    { href: "/settings", label: "Settings", role: "Preferences and account" },
  ];

export function Brand() {
  return (
    <a href="/dashboard" className="brand" aria-label="MedAnchor Study home">
      <span className="brand-mark" aria-hidden="true">
        M
      </span>
      <span className="brand-text">
        <span className="brand-name">MedAnchor</span>
        <span className="brand-sub">Study</span>
      </span>
    </a>
  );
}
