# MedAnchor Study — Design & Experience Specification
## Dashboard, Start Learning & Teach Me

> Note: this document was provided as a single paste containing a duplicated
> section (the "Overall MedAnchor Design Direction" through "Final Experience
> Relationship" block appeared twice). The duplicate has been merged; no content
> was dropped.

---

## 1. Overall MedAnchor Design Direction

MedAnchor Study should feel modern, premium, intelligent, calm, human, and
healthcare-aware.

It should feel like a next-generation learning environment rather than a
traditional university LMS.

The visual language should combine the sophistication of premium educational
technology, modern productivity software, intelligent AI interaction, and
healthcare technology — while developing a distinctive MedAnchor identity
rather than copying any existing product.

### Core visual principles

**Modern, not old-fashioned**

- Avoid traditional LMS aesthetics.
- Avoid dense dashboards and excessive navigation.
- Avoid tiny typography and information overload.
- Avoid making every feature a card.
- Avoid generic SaaS layouts.
- Avoid making the product look like a medical administration portal.

**Premium and calm**

- Strong typography
- Generous whitespace
- Clear hierarchy
- Restrained visual noise
- Soft depth
- Subtle surfaces
- Purposeful motion

**Distinctive**

- MedAnchor should not look like ChatGPT, Notion, Canvas, Duolingo, or a
  conventional medical learning platform.
- The interface should develop its own visual identity and interaction language.

**Learning-first**

- The interface should support comprehension rather than simply displaying
  information.
- Important learning content should receive visual priority.
- The system should reduce cognitive load rather than add to it.

---

## 2. Shared Product Experience

The three experiences form a natural progression:

**Dashboard — "Orient me."**
The student understands what matters now, what needs attention, and what they
should do next.

**Start Learning — "Help me choose how to learn."**
The student chooses the appropriate learning path based on their goals,
materials, weaknesses, and available time.

**Teach Me — "Teach me."**
The student enters an immersive adaptive learning experience where they think,
answer, receive feedback, and improve.

---

## 3. Dashboard

### Purpose

The Dashboard is the student's home and base of operations. It should answer:

> «What do I need to do now, and what do I need to know?»

It is **not** a feature directory. Individual capabilities such as Teach Me,
Clinical Cases, Research, Biostatistics, and Communication Practice should have
their own dedicated spaces.

### Dashboard content

**Header**

- MedAnchor identity
- Global search
- Notifications
- Profile/account

**Today**

- Today's study time
- Today's goals
- Daily-plan progress
- Continue current session

**Recommended Next**

- Personalized next activity
- Why it is recommended
- Clear primary action

**Continue Learning**

- Current unfinished session
- Recently studied content
- Recently accessed materials

**Needs Attention**

- Topics needing attention
- Topics needing review
- Missed study activities
- Overdue activities
- Recommended actions

**Upcoming**

- Exams
- Assignments
- Projects
- Presentations
- Deadlines
- Time remaining

**Spaced Reviews**

- Reviews due
- Overdue reviews
- Upcoming reviews
- Review progress

**Course Progress**

- Course progress
- Topic progress
- Mastery status
- Strong areas
- Areas needing review
- Areas needing attention

**Learning Progress**

- Study time
- Study consistency
- Completed learning activities
- Mastery progression
- Overall learning progress

### Dashboard layout

**Top navigation** — logo/identity on the left, global search centrally
available, notifications/profile on the right.

**Main experience**

```
Today
  ↓
Recommended Next + Continue Learning
  ↓
Needs Attention + Upcoming
  ↓
Spaced Reviews
  ↓
Course Progress + Learning Progress
```

On mobile, the experience becomes a focused vertical flow:

```
Header → Today → Recommended Next → Continue Learning → Needs Attention
      → Upcoming → Spaced Reviews → Course Progress → Learning Progress
```

### Dashboard design direction

The Dashboard should feel like a calm command center, not a traditional LMS.

Use:

- Strong hierarchy
- Spacious composition
- Selective surfaces
- Prominent primary actions
- Quiet secondary information
- Subtle progress visualization
- Personalized recommendations
- Minimal visual clutter

**Do not turn every section into an identical card.** The Dashboard should
communicate priority through scale, spacing, typography, and placement — not by
putting borders around everything.

**Dashboard principle:** «Dashboard = what should I do and what do I need to
know?»

---

## 4. Start Learning

### Purpose

Start Learning is the student's central learning studio. Unlike the Dashboard,
it can expose the broader ways students can learn. It should answer:

> «How do I want to learn this?»

### Learning context

At the beginning of the experience, establish the student's context:

- Current course
- Current topic
- Academic level
- Learning goal
- Available study time

This allows the rest of the experience to feel personalized rather than generic.

### Continue Learning

Show in-progress learning, recent sessions, and resume actions. The student
should be able to return to learning without having to reconstruct where they
stopped.

### Recommended for You

Recommendations can respond to weak areas, upcoming assessments, performance,
study plan, spaced-repetition requirements, recent activity, and mastery
signals. **Recommendations should explain why something is being suggested.**

### Learn a Topic

Provide an intentional path into Teach Me:

- Topic
- Course
- Difficulty
- Teaching style
- Learning objective
- Start Teach Me

The student should feel that they are **configuring a learning experience**
rather than simply opening a chatbot.

### Study Materials

Students can upload materials, browse materials, analyze materials, and
generate learning resources. This connects directly to the Analyze Docs &
Study Material Generator capabilities from the original PRD.

### Practice

Provide access to practice questions, flashcards, application questions, and
review sessions. Practice should connect back into the student's learning
profile and mastery system.

### Apply Knowledge

Provide access to clinical cases, public-health cases, clinical communication,
and scenario practice. This moves the student from passive understanding into
application.

### Research & Statistics

Provide access to biostatistics, research methods, evidence exploration, and
dataset/research analysis. These connect to the shared Research & Evidence
Engine.

### Learning Progress

Show mastery, strengths, weaknesses, and recent performance so the student
understands where they currently stand.

### Start Learning design direction

Start Learning should feel like a **learning studio, not a feature
marketplace**. It should communicate:

> «Here are the different ways you can learn.»

Not:

> «Here are 15 features.»

Use grouping, hierarchy, typography, whitespace, and contextual actions to
organize the experience. Cards can be used selectively, but the page should not
become a wall of identical feature cards. The experience should feel
**exploratory but focused**.

---

## 5. Teach Me

### Purpose

Teach Me is the student's focused adaptive learning environment. This is where
MedAnchor's learning philosophy becomes most visible.

The core experience is:

```
AI asks → Student thinks → Student answers → MedAnchor evaluates
→ Misconception identified → Explanation → Deeper question
→ Difficulty adapts → Learning profile updates
```

The goal is not simply to provide answers. The goal is to help the student
understand, reason, apply, and retain knowledge.

### Teach Me — top context

Provide back/navigation, course, topic, session progress, and learning
controls. Establish context without creating visual clutter.

### Teach Me — learning setup

The student can establish topic/concept, academic level, difficulty, teaching
style, learning objective, and relevant study material/context. Teaching styles
include the original PRD's approaches: Gentle, Rapid-fire, Exam-style,
Step-by-step. The system adapts the teaching experience to the selected context.

### Teach Me — main teaching experience

The central teaching environment can contain AI explanation, Socratic
questions, student response, follow-up questions, examples, analogies,
diagrams, step-by-step explanations, and practice questions.

**The actual learning content should dominate the interface.** The interface
should not make the student feel like they are simply messaging an AI assistant.

### Teach Me — understanding & feedback

MedAnchor should evaluate the student's response and provide correctness
feedback, identification of misconceptions, explanation of the underlying
concept, clarification of mistakes, targeted follow-up questions, understanding
checks, and adaptive difficulty.

Feedback should help the student understand **why** their thinking was right or
wrong.

### Teach Me — learning progress

Show topic progress, questions completed, understanding/mastery signals, and
session progress. **Progress should remain subtle** — supporting motivation and
orientation without distracting from learning.

### Teach Me — contextual actions

Instead of permanently displaying a large toolbar, relevant actions should
appear naturally when useful:

- Explain differently
- Give an example
- Simplify
- Go deeper
- Practice
- Review
- End session

This creates a cleaner and more intelligent interaction model.

### Teach Me — end of session

The session should conclude with what the student learned, strengths, knowledge
gaps, topics to review, recommended next activity, and a spaced-review
recommendation.

A weakness discovered in Teach Me can later influence:

```
Practice → Spaced Review → Study Plan → Dashboard Recommendations → Mastery
```

### Teach Me design direction

Teach Me should be one of the most distinctive experiences in MedAnchor.

**It should not look like: Sidebar + Chat Window + Right Information Panel** —
that would make it feel like another generic AI assistant.

Instead it should feel like a **focused learning canvas**:

- Large readable typography
- Generous whitespace
- Strong content hierarchy
- Minimal interface chrome
- Subtle progress
- Contextual controls
- Selective surfaces
- Fluid transitions
- Focused response areas
- Educational AI interaction

The student should feel:

> «I'm inside a lesson.»

Not:

> «I'm chatting with a bot.»

---

## 6. Shared Visual Language

All three experiences share the same underlying design system.

**Typography** — strong display hierarchy, highly readable body text,
comfortable line height, clear distinction between primary and secondary
information.

**Spacing** — use generous spacing to create focus, calm, separation, and
comprehension.

**Surfaces** — prefer soft tonal separation, subtle elevation, layered
surfaces, restrained borders. **Avoid heavy outlines around every element.**

**Cards** — cards are a tool, not the visual identity. Use them when they
provide meaningful grouping, separation, interaction, or context.

**Motion** — motion should communicate state and intelligence: learning-state
changes, progress updates, expanding explanations, feedback, recommendations,
mastery changes, navigation. Purposeful rather than decorative.

---

## 7. AI Interaction Standard

Across all three experiences, AI should:

- Understand learning context
- Use uploaded materials appropriately
- Adapt to academic level
- Adapt difficulty
- Ask meaningful follow-up questions
- Identify misconceptions
- Explain reasoning
- Provide actionable feedback
- Make uncertainty clear
- Distinguish generated information from sourced evidence
- Avoid pretending certainty
- Preserve student agency

AI should feel intelligent because of its **behavior**, not because the
interface looks like an AI product.

---

## 8. Learning UX Standard

Every learning experience should support the larger MedAnchor loop:

```
Learn → Understand → Practice → Apply → Receive Feedback → Review → Track Mastery
```

The system should continuously connect learning activities instead of treating
each feature as an isolated tool.

---

## 9. Accessibility & Responsive Standard

The three experiences should be designed intentionally for mobile, tablet,
laptop, and desktop.

Accessibility built in from the beginning: keyboard navigation, screen-reader
compatibility, focus states, contrast, text scaling, touch targets, reduced
motion, captions/transcripts, clear errors, cognitive load, readability.

---

## 10. Trust & Healthcare Learning Standard

Because MedAnchor is designed for healthcare education, the experience should
clearly distinguish:

- Educational simulation
- Evidence-based information
- External research
- Uploaded course material
- AI-generated explanations
- Clinical guidance

Research and evidence should provide appropriate source transparency. Clinical
experiences should emphasize reasoning and learning rather than presenting AI
output as unquestionable clinical truth.

---

## 11. Final Experience Relationship

The three experiences should feel like one continuous ecosystem.

**Dashboard — "Orient me."**
Shows: what matters · what needs attention · what is coming · what I should do
next

↓

**Start Learning — "Help me choose."**
Provides: learning context · learning paths · materials · practice · application
· research · personalized recommendations

↓

**Teach Me — "Help me understand."**
Provides: adaptive teaching · Socratic questioning · student reasoning ·
feedback · misconception correction · deeper understanding · progress · review
recommendations

↓

**MedAnchor Learning System**

```
Dashboard → Start Learning → Learn → Practice → Apply → Feedback
          → Mastery → Review → Dashboard
```

This is the foundation we should preserve as we move into the remaining
MedAnchor features.
