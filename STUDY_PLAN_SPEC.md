# Study Plan Tab — Full Builder Specification

> Saved from the provided specification. The Study Plan tab is the student's
> personalized academic command center: it turns exam dates, deadlines,
> available study time, weaknesses and progress data into a realistic, adaptive
> schedule. It is the organizer of the closed-loop learning system (PRD §3.6).

---

## 1. Overview

- Builds and adjusts study schedules.
- Prioritizes by urgency and weakness.
- Schedules spaced reviews as first-class work.
- Recovers from missed sessions without piling on.
- Balances multiple responsibilities (exams, assignments, presentations, research).
- Design tone: calm, organized, low-stress. Today's Plan is the hero, then
  Upcoming, then Exams & Deadlines. Strong teal accent for primary actions and
  important numbers (days left, hours).

---

## 2. Layout

- Left sidebar: Home, Materials, AI Tutor, Practice, Research, **Study Plan**
  (active), Progress; profile at the bottom.
- Top bar: search ("Search topics, questions, or ask MedAnchor…"), notification
  bell, bookmark.
- Page header: title "Study Plan", subtitle "Your personalized schedule,
  deadlines, and daily goals", primary button "+ Add Exam / Deadline".

---

## 3. Top Summary Row (three cards, stacked on mobile)

1. **Next Exam** — exam name, large days-remaining number ("USMLE Step 1 · 18
   days"). Tapping opens the edit view.
2. **This Week** — total planned study hours for the current week, hours
   completed, completion percentage/progress bar ("12h planned · 7h done").
3. **Focus Area** — highest-priority topic pulled from Progress Tracking, short
   label, quick action "Study now".

---

## 4. Today's Plan (hero)

- Section title "Today" + total estimated time.
- Generated activity rows: name, type label (Teach Me, Practice Questions,
  Case, Flashcards, Review…), estimated duration, status (Not started / In
  progress / Done), clear Start button.
- Completed items visually distinct (checked, muted, struck through).
- "Regenerate today's plan" button at the bottom.

---

## 5. Upcoming

- Next 7 days as a clear list; each day shows date ("Mon 6 Oct"), number of
  tasks, total estimated time, and a short preview of the main activities.
- Tapping a day expands the full activity list.

---

## 6. Exams & Deadlines

- Clean list of exams, assignments, presentations and other deadlines: title,
  date, days remaining (highlighted when close), related course/subject.
- Edit and Delete actions per item; "+ Add Exam / Deadline" is the primary
  action.
- Empty state: "Add your next exam or deadline to get a smarter plan" with a
  clear call-to-action.

---

## 7. Study Modes

Selectable chips that change the planner's emphasis:

- **Quick Session** — short, high-impact activities.
- **Deep Study** — longer focused blocks.
- **Exam Cram** — prioritizes upcoming exam topics aggressively.
- **Revision Only** — focused on spaced reviews and weak areas.
- **Catch-Up** — redistributes missed work realistically.

Selecting a mode immediately updates Today's Plan.

---

## 8. Smart Capabilities

- **Time-aware planning** — "I have 2 hours tonight" returns the
  highest-impact activities that fit, weighing urgency, weakness and deadlines.
- **Schedule recovery** — missed sessions are detected, remaining workload
  recalculated and redistributed without an unrealistic catch-up burden.
- **Workload balancing** — exams, assignments, presentations, research and
  ongoing revision are considered together; no day is overloaded.
- **Spaced-repetition integration** — reviews due from the shared
  Spaced-Repetition System appear in the plan on the right days.
- **Progress forecasting (cautious)** — high-level indicators only (material
  covered vs remaining, topics needing attention). No predictions presented as
  guarantees of exam readiness.

---

## 9. Student Inputs the Planner Uses

Exam dates/names, courses, assignments/deadlines, available study hours
(weekly or daily), goals and preferred mode, Progress data (strengths,
weaknesses, mastery), activity from Materials/Tutor/Practice/Research, and
optional future connectors (Google Calendar, LMS deadlines).

---

## 10. First-Time State

- "Tell us your next exam and available study time so we can build your plan."
- Primary button "Set up my study plan"; secondary link "I'll do it later".
- Once at least one exam/deadline **and** a study-hour preference exist, the
  full planner appears.

---

## 11. Connections

Receives weakness/mastery data from Progress; pushes daily recommendations to
Home; deep-links into AI Tutor, Practice, Materials and Research when an
activity starts; incorporates spaced-review items from the shared
Spaced-Repetition System.

---

## Build Notes

- Planner logic lives in `web/src/lib/planner.ts` (pure, testable) and
  `web/src/app/plan/actions.ts` (server actions).
- Storage: `ExamGoal` (with kind: exam | assignment | presentation | project |
  revision), `Assignment` (open deadlines shown read-only from the planner),
  `PlanItem` (with deep-link target and reason), `Profile` (mode, weekly hours,
  per-weekday availability).