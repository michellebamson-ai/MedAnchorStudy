# MedAnchor Study

**An AI-powered learning platform for healthcare & health-sciences students.**

MedAnchor Study turns dense, passive reading into a continuous, personalized learning loop: **Study Material → Understand → Explain → Apply → Practice → Feedback → Retain → Identify Weaknesses → Review → Exam Prep → Improve.**

It is built for students of medicine, nursing, public health, pharmacy, anatomy, physiotherapy, biomedical sciences, and related programmes — anyone drowning in lecture slides, dense textbooks, research papers, and terminology who wants *understanding*, not just hours read.

---

## The problem it solves

Healthcare students face some of the densest material in higher education. Reading and re-reading feels productive but often fails: concepts stay shallow, explanations fall apart under pressure, and students can't tell what they actually know from what they've merely *seen*.

Students struggle to:

- understand difficult concepts **deeply**
- **explain** ideas clearly in their own words
- **connect** topics together
- **apply** knowledge to clinical and public-health situations
- **interpret** research and statistics
- **spot gaps** in their understanding
- **remember** under exam pressure
- **know what to study next**
- keep a consistent **study routine**

MedAnchor Study is a learning companion, not a Q&A chatbot. It continuously adapts to the student's performance and weak areas.

---

## The complete learning journey

1. **Start Learning — Upload or Ask.** Students upload lecture slides, PDF chapters, notes, research papers, or study guides — or just ask about any health topic.
2. **Teach Me Mode.** A Socratic tutor breaks concepts into chunks, asks questions, checks prior knowledge, gives hints, identifies misconceptions, and pushes difficulty up only when the student is ready.
3. **Explain It Back.** The student explains the concept in their own words. The system evaluates accuracy, missing concepts, misconceptions, clarity, terminology, and cause–effect reasoning — then asks for an improved explanation.
4. **Clinical & Public-Health Case Practice.** Realistic cases (clinical, epidemiological, pharmacological, anatomical, research-methods) require reasoning — *what matters, what do you conclude, what next, why, what evidence, what else could it be?*
5. **Adaptive Practice.** Repeated failure → re-teach, simpler scaffolding, targeted questions. Mastery → harder cases, concept connections, less repetition.
6. **Adaptive Flashcards & Active Recall.** Cards generated from real material and learning history, prioritising what the student gets wrong, finds hard, or hasn't seen recently.
7. **High-Yield Summaries.** Concise, re-organised digests emphasising mechanisms, relationships, high-yield facts, misconceptions, clinical relevance, and formulas — never a mere shortening.
8. **Biostatistics & Research Methods Coach.** Step-by-step, reasoning-first coaching for sensitivity/specificity, predictive values, risk ratios, odds ratios, confidence intervals, hypothesis testing, p-values, study designs, bias, and confounding.
9. **Personalized Exam Preparation.** Model-exam sessions with annotated feedback, exam blueprints, and coverage-gap targeting.
10. **Progress Tracking & Learning Dashboard.** Answers: *what have I learned, what am I struggling with, what should I review today, how is my performance?*
11. **Intelligent Study Plan.** A dynamic schedule that rebalances toward weak topics, adapts to missed sessions, and reduces repetition once mastery is demonstrated.

### The core learning loop

Upload a cardiovascular lecture → concepts are identified → Teach Me Mode → Explain It Back with targeted feedback → clinical case practice → weaknesses extracted from the responses → targeted flashcards + extra practice generated → high-yield summaries reviewed → weak areas added to the study plan → spaced review and new application questions later → dashboard updates and names the next priority.

---

## Main features in the prototype

| Feature | What it does in the initial version |
|---|---|
| **Dashboard** | Today's focus, weekly practice volume, weakest anchors, quick actions, recent activity, coverage summary |
| **Start Learning** | Upload materials (drag & drop, realistic processing flow + concept map) or ask about any topic (topic matching) |
| **Teach Me Mode** | Interactive Socratic tutoring on 5 realistic anchor topics (RAAS, sensitivity & specificity, brachial plexus, incidence vs prevalence, heart failure) with adaptive keyword-graded answers, hints, and follow-ups |
| **Explain It Back** | Real-time explanation grading with tracked anchor terms, missing-concept feedback, and model answers |
| **Case Practice** | 4 field-realistic reasoning cases (ACE-inhibitor hyperkalaemia, screening-programme design, plexus localisation, school outbreak) with expert feedback per step |
| **Adaptive Flashcards** | 14 high-yield cards, flip interaction, prioritisation of missed cards, progress tracking |
| **High-Yield Summaries** | Structured re-organised digests with mechanisms, misconceptions, exam facts, formulas, print/export |
| **Biostatistics Coach** | 9 modules with step-by-step worked examples (reveal-one-step-at-a-time) and self-check questions |
| **Exam Prep** | Editable exam goal, exam blueprint, randomised mock exams with annotated feedback, custom-topic exams |
| **Progress Dashboard** | Per-topic mastery, strength/weakness mapping, practice-type performance, demo-data reset |
| **Study Plan** | Dynamic session plan generated from exam date/time and topic mastery, with re-balancing |

All interactions update localStorage-backed state (mastery, history, streak, plan, library), so the whole loop genuinely fires: answer a flashcard wrong and your topic mastery dips, the plan prioritises it, and the dashboard reflects the change.

---

## How to run

No build step, no dependencies. Serve the folder over HTTP (localStorage and `file://` both work, but a simple static server is cleanest):

```bash
# any one of these from the project folder:
python -m http.server 8000
npx serve .
```

Then open <http://localhost:8000> in any modern browser (Chrome, Edge, Firefox, Safari).

Alternatively, double-click `index.html` — the app also runs directly from the filesystem.

> The prototype ships with realistic **demo data** pre-loaded so the dashboard and plan look alive on first launch. Use **Reset demo data** (sidebar) or **Clear all data** (Progress page) to wipe or reload it.

## Technologies used

- **HTML5 + CSS3** — responsive app shell, cards, chat, flashcards, charts
- **Vanilla JavaScript (ES2020)** — hash-based single-page router, state management, and simulated AI engines (tutor, case grader, quiz, flashcard scheduler, biostat coach)
- **localStorage** — persistent progress, adaptive plan, and learning history
- No external runtime libraries — runs anywhere browsers run

## What the initial prototype demonstrates

A complete, working slice of the MedAnchor Study loop in pure front-end code. The simulated AI engines demonstrate the *experience*: Socratic questioning with adaptive responses, explanation evaluation, clinical case reasoning, adaptive flashcard prioritisation, personalised exam sessions, and a plan that rebalances from your actual performance. The production product would connect these same interaction patterns to real language models and document parsing.

---

© MedAnchor Study. Built as an initial prototype for healthcare-education innovation.