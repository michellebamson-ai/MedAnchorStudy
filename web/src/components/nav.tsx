import Link from "next/link";

/**
 * Single source of truth for navigation (ADR-1). Adding a route here adds it
 * to the sidebar; the prototype's `buildNav` becomes this list.
 */
export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "◈" },
  { href: "/learn", label: "Start Learning", icon: "↥" },
  { href: "/teach", label: "Teach Me", icon: "◆" },
  { href: "/cases", label: "Case Practice", icon: "⚑" },
  { href: "/flashcards", label: "Flashcards", icon: "▤" },
  { href: "/biostats", label: "Biostatistics", icon: "∑" },
  { href: "/evidence", label: "Evidence", icon: "❑" },
  { href: "/communicate", label: "Communication", icon: "☏" },
  { href: "/exam", label: "Exam Prep", icon: "✎" },
  { href: "/plan", label: "Study Plan", icon: "☷" },
  { href: "/progress", label: "Progress", icon: "◔" },
  { href: "/settings", label: "Settings", icon: "⚙" },
] as const;

export function Brand() {
  return (
    <Link href="/dashboard" className="brand" aria-label="MedAnchor Study dashboard">
      <span className="brand-mark" aria-hidden="true">
        M
      </span>
      <span className="brand-text">
        <span className="brand-name">MedAnchor</span>
        <span className="brand-sub">Study Workspace</span>
      </span>
    </Link>
  );
}

export function Nav({ current }: { current: string }) {
  return (
    <nav className="nav" aria-label="Study workspace">
      {NAV.map((item) => {
        const active = current === item.href || current.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="nav-link"
            aria-current={active ? "page" : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
