# Progress Tab — Full Builder Specification

> Saved from the provided specification. The Progress tab is the brain of
> MedAnchor's closed-loop learning system. It is deliberately **not** a
> conventional analytics dashboard. Aligned with PRD §3.8 (Connected Progress
> Tracking).

---

## 1. Philosophy

Four non-negotiable jobs:

1. Collect performance signals from every major feature.
2. Turn those signals into clear topic statuses — Strong / Needs Review / Needs
   Attention.
3. Immediately convert every status into a concrete sequence of next actions.
4. Feed those actions back into the Study Plan and the Home dashboard.

Any design that only shows graphs or percentages without driving the next study
action is incomplete.

---

## 2. Layout

- Sidebar: Home, Materials, AI Tutor, Practice, Research, Study Plan,
  **Progress** (active), profile at the bottom.
- Top bar: search, notification bell, bookmark.
- Header: title "Progress", subtitle "See how your learning is compounding — and
  what to do next", optional course filter (All Courses / specific course).

---

## 3. Top Summary Row

1. **Overall Mastery** — circular or semi-circular ring with a percentage.
2. **Topic Health** — Strong / Needs Review / Needs Attention counts, using the
   exact PRD status language.
3. **Learning Consistency** — current streak or days studied this week, with
   short supporting text.

---

## 4. Focus Areas (the heart)

Never a plain list of weak topics. Each Focus Area card contains:

- Topic name and course / subject.
- Short signal explanation — why it needs attention (e.g. "Struggled in Case
  Simulator + low accuracy in recent practice questions").
- A complete recommended learning path, e.g.
  Review basics → Teach Me session → 5 practice questions → Spaced review in 3
  days.
- A single primary button, **Start this path**, which launches the first step and
  keeps the remaining steps available so the loop continues.

---

## 5. Topic Mastery Overview

- Filter chips: All · Strong · Needs Review · Needs Attention.
- List or responsive card grid; each row shows topic name + course, status badge,
  mastery indicator, last activity date, and a one-click recommended next action.
- Statuses come from **multiple signals**, never a single quiz score: AI Tutor
  performance and misconception patterns, case decision quality, practice accuracy
  and speed, flashcard retention, and time since last successful demonstration.

---

## 6. Learning Loop Feed

A chronological or prioritized feed that makes the closed loop visible:

- "Case Simulator identified weakness in outbreak investigation"
- "→ Teach Me session completed"
- "→ 8 practice questions done (6/8 correct)"
- "→ Spaced review scheduled for Thursday"
- "→ Study Plan updated"

---

## 7. Course-Level View

Switch between "All Courses" and any individual course; progress by course, by
topic and by skill area.

---

## 8. Recommended Next Steps

A dedicated section (near the top, or just below Focus Areas) surfacing 2–4
high-priority learning sequences. Each is a short **path**, not a single task,
with one Start button that begins the first step.

---

## 9. Empty / Early State

"Your learning loop is just starting. Complete a few sessions in AI Tutor,
Practice, or Materials and this page will begin showing personalized insights and
next steps." Primary button: Go to Today's Plan. Secondary: Start AI Tutor.

---

## 10. Non-Negotiable Behaviors

- Statuses derive from multiple signals, never a single score.
- Every status leads to a concrete, multi-step recommendation.
- Performance in any feature updates the learning profile in near real time.
- Weaknesses automatically influence the Study Plan and Home "Today's Plan".
- Tone is encouraging and forward-looking, never shaming.
- The student always leaves knowing exactly what to do next.

---

## 11. Connections

- Receives from: AI Tutor, Practice (cases, questions, communication), Materials,
  Research, Study Plan activity.
- Sends prioritized actions to: Home and Study Plan.
- Deep-links into the correct next activity in any other tab.

---

## 12. Design Notes

- Actionable over analytical; every element drives a next step.
- Calm, encouraging tone.
- Hierarchy: Summary → Focus Areas → Topic Mastery → Learning Loop Feed.
- Consistent status colours and labels with the Dashboard.
- Generous whitespace, strong teal accents, fully responsive, fast loading.

---

## Build Notes

- Path generation is pure and deterministic in `web/src/lib/paths.ts`; persisted
  `LearningPath` rows let a started path be resumed and keep its remaining steps.
- Signals are computed by the existing `web/src/lib/mastery.ts` multi-signal
  engine; this tab renders and acts on them rather than re-deriving scores.