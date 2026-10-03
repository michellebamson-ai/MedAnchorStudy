import Link from "next/link";
import { Shell } from "@/components/shell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

/**
 * Placeholder for destinations whose full experience is still being built.
 * Never a dead end: explains what will live here and links to working areas.
 * Each placeholder is replaced by the real page as its spec lands.
 */
export async function Placeholder({
  title,
  lede,
  points,
  links,
}: {
  title: string;
  lede: string;
  points: string[];
  links: Array<{ href: string; label: string }>;
}) {
  const user = await getCurrentUser().catch(() => null);
  const topics = await prisma.topic.findMany({ orderBy: { order: "asc" } });

  return (
    <Shell
      section=""
      name={user?.name ?? "Student"}
      topics={topics.map((t) => ({ slug: t.slug, title: t.title }))}
    >
      <div className="page-head">
        <span className="eyebrow">Coming next</span>
        <h1 className="display">{title}</h1>
        <p className="lede">{lede}</p>
      </div>
      <div className="stack-sm" style={{ maxWidth: 640 }}>
        {points.map((p) => (
          <div key={p} className="surface-tight">
            <span className="list-title">{p}</span>
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: "var(--sp-8)" }}>
        {links.map((l) => (
          <Link key={l.href} className="btn" href={l.href}>
            {l.label}
          </Link>
        ))}
        <Link className="btn btn-primary" href="/dashboard">
          Dashboard
        </Link>
      </div>
    </Shell>
  );
}
