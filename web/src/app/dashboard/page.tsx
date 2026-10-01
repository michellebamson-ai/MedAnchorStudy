import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { Bar, Empty, PageHead, Ring, Stat, StatusBadge, Steps } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getStudentContext } from "@/lib/personalization";
import { masteryOverview, recommendNext } from "@/lib/mastery";
import { recentActivity } from "@/lib/activity";

export const metadata = { title: "Dashboard" };

/**
 * Dashboard — answers "what should I do next?" (PRD §5.4), not just
 * "what happened?" (PRD §3.8).
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();

  // Until sign-in exists, fall back to seeded content so the app is usable.
  const [topics, mastery, activity] = await Promise.all([
    prisma.topic.findMany({ orderBy: { order: "asc" }, take: 5 }),
    user ? masteryOverview(user.id) : Promise.resolve([]),
    user ? recentActivity(user.id, 6) : Promise.resolve([]),
  ]);

  if (!user) {
    return (
      <Shell section="dashboard" focus="Sign in to unlock your learning loop">
        <PageHead
          eyebrow="MedAnchor Study"
          title="Your learning workspace"
          lede="Upload a lecture, get taught, apply it in a case, and let the platform decide what to study next."
        />
        <div className="stack">
          <Empty
            title="Sign in to personalise this workspace"
            action={
              <a className="btn btn-primary" href="/login">
                Sign in
              </a>
            }
          >
            The database is seeded with {topics.length} topics, 4 cases, 14 flashcards and 9
            biostatistics modules from your prototype content.
          </Empty>
        </div>
      </Shell>
    );
  }

  const ctx = await getStudentContext(user.id);
  const weak = mastery.filter((m) => m.status !== "strong").slice(0, 3);
  const today = new Date();
  const todaysPlan = await prisma.planItem.findMany({
    where: {
      userId: user.id,
      status: "planned",
      scheduledFor: { gte: new Date(today.getTime() - 86_400_000), lte: new Date(today.getTime() + 86_400_000) },
    },
    orderBy: { priority: "asc" },
    take: 4,
  });

  const avgScore = mastery.length
    ? Math.round((mastery.reduce((s, m) => s + m.score, 0) / mastery.length) * 100)
    : 0;
  const strongCount = mastery.filter((m) => m.status === "strong").length;

  return (
    <Shell
      section="dashboard"
      streak={0}
      initial={(ctx.name ?? "S").slice(0, 1).toUpperCase()}
      focus={todaysPlan[0]?.title ?? "No plan yet — set an exam date to get started"}
    >
      <PageHead
        eyebrow={`Welcome back${ctx.name ? `, ${ctx.name}` : ""}`}
        title="Today's focus"
        lede="One clear next step, drawn from your weakest topics and your upcoming deadlines."
        action={
          <a className="btn btn-primary" href="/plan">
            Open study plan
          </a>
        }
      />

      <div className="stack">
        <div className="grid grid-4">
          <Stat label="Topics covered" value={`${mastery.filter((m) => m.attempts > 0).length}/${mastery.length}`} hint="with recorded activity" />
          <Stat label="Strong topics" value={strongCount} hint="multi-signal, not one quiz" />
          <Stat label="Average mastery" value={`${avgScore}%`} hint="across all topics" />
          <div className="stat row" style={{ gap: "var(--sp-3)" }}>
            <Ring pct={avgScore} />
            <div>
              <div className="stat-label">Daily goal</div>
              <div className="stat-value" style={{ fontSize: "var(--fs-lg)" }}>
                {ctx.dailyGoalMinutes}m
              </div>
            </div>
          </div>
        </div>

        <section className="card">
          <div className="row-between">
            <h2 className="card-title">Do this next</h2>
            <span className="badge badge-info">Recommended</span>
          </div>
          {weak.length === 0 ? (
            <p className="card-sub" style={{ marginTop: "var(--sp-3)" }}>
              No weak topics yet. Start a Teach Me session or run a case to begin building your profile.
            </p>
          ) : (
            <div className="stack-sm" style={{ marginTop: "var(--sp-4)" }}>
              {weak.map((m) => (
                <div key={m.topicSlug} className="list-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row-between">
                      <span className="list-title">{m.title}</span>
                      <StatusBadge status={m.status} />
                    </div>
                    <div className="list-sub" style={{ marginTop: 4 }}>
                      {recommendNext(m).join(" → ")}
                    </div>
                    <div style={{ marginTop: "var(--sp-2)" }}>
                      <Bar pct={m.score * 100} status={m.status} />
                    </div>
                  </div>
                  <a className="btn btn-primary btn-sm" href={`/teach/${m.topicSlug}`}>
                    Start
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-2">
          <section className="card">
            <h2 className="card-title">Today's plan</h2>
            {todaysPlan.length === 0 ? (
              <p className="card-sub" style={{ marginTop: "var(--sp-2)" }}>
                Nothing scheduled. Set an exam date or add an assignment and the planner will build your week.
              </p>
            ) : (
              <div className="stack-sm" style={{ marginTop: "var(--sp-3)" }}>
                {todaysPlan.map((item) => (
                  <div key={item.id} className="list-row">
                    <div style={{ flex: 1 }}>
                      <div className="list-title">{item.title}</div>
                      <div className="list-sub">
                        {item.mode} · {item.estMinutes} min · {item.activity.replace(/_/g, " ")}
                      </div>
                    </div>
                    <span className="badge badge-neutral">P{item.priority}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="card-title">Recent activity</h2>
            {activity.length === 0 ? (
              <p className="card-sub" style={{ marginTop: "var(--sp-2)" }}>
                Your learning activity will appear here. Every feature you use feeds the loop.
              </p>
            ) : (
              <div className="stack-sm" style={{ marginTop: "var(--sp-3)" }}>
                {activity.map((e) => (
                  <div key={e.id} className="list-row">
                    <div style={{ flex: 1 }}>
                      <div className="list-title">{e.activity.replace(/_/g, " ")}</div>
                      <div className="list-sub">
                        {e.topicSlug ?? "general"} · {e.createdAt.toLocaleString()}
                      </div>
                    </div>
                    {e.score != null ? (
                      <span className={`badge ${e.score >= 0.75 ? "badge-strong" : e.score >= 0.45 ? "badge-review" : "badge-attention"}`}>
                        {Math.round(e.score * 100)}%
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {ctx.upcoming.length > 0 && (
          <section className="card">
            <h2 className="card-title">Upcoming</h2>
            <div className="grid grid-3" style={{ marginTop: "var(--sp-3)" }}>
              {ctx.upcoming.map((u) => (
                <div key={u.title} className="list-row">
                  <div>
                    <div className="list-title">{u.title}</div>
                    <div className="list-sub">
                      {u.kind} · {u.date.toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Shell>
  );
}
