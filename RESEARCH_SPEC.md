# Research Tab — Full Builder Specification

> Saved from the provided paste. The Research tab helps students find reliable
> health evidence, master biostatistics, analyze data, and complete research
> projects. Two sub-tabs: **Evidence** · **Biostatistics**, sharing the design
> system, floating tutor chat, source transparency, and links to Study Plan, AI
> Tutor, Practice and Progress.

---

## 1. Overview

- **Evidence** — Find, evaluate, and understand health information and research
  findings.
- **Biostatistics** — Core home for the Biostatistics & Research Companion
  (concepts, data analysis, study design, projects).

---

## 2. Evidence Sub-tab

**Purpose.** Find, evaluate, understand, and save reliable health information
and research.

### 2.1 Start screen

- Large search bar: "Search topics, papers, or guidelines"
- Source filter buttons: PubMed · Google Scholar · Guidelines · News ·
  Textbooks · All Sources
- Recent searches list (each with a clear X button)
- Empty state: 4 tappable example chips ("Hypertension guidelines", "Vaccine
  efficacy", "Hand hygiene evidence", "Public health communication")

### 2.2 Search results

Vertical list of result cards. Each card: title (tappable), authors +
publication date, source-type badge (Peer-reviewed, Clinical Guideline, News,
Textbook, Other), short preview/snippet, buttons: Read · Add to my sources.

### 2.3 Source detail page

Opened on Read. Header (title, authors, date, source type). Plain-language
quality label + reliability explanation. Full text or long excerpt. Key
Takeaways (bullets). Where it fits (relation to current studies). How to use
it (practical suggestions). Evaluation (funding, limitations, conflicts,
agreement/disagreement with other sources). Action buttons: Add to my sources
· Explain the statistics in this paper (high-priority) · Ask the Tutor · Use
in my assignment · Compare with similar · Copy citation (APA / Vancouver /
Harvard) · More by this author.

### 2.4 My Sources

List of all saved sources. Filters: By topic · By type · By date added · All
sources. Three-dot menu per item (Remove, Move to project, Mark important,
View). Button: Generate evidence summary (student chooses focus → tutor
returns plain-language summary with citations).

### 2.5 Develop Research Question tool

Button: "Develop a research question." Student enters a topic → tutor suggests
evidence-based research questions. Option to save the question directly into
the Biostatistics sub-tab.

---

## 3. Biostatistics Sub-tab

**Purpose.** Core home for the Biostatistics & Research Companion: concept
learning, test selection, data analysis, study design, full projects.

### 3.1 Top of screen (always visible)

- Persistent search/button: "Explain a statistical concept..."
- Two large entry cards: Start a Research Project · Analyze Data or a Paper.

### 3.2 Quick Topics — Statistics Library

Browsable reference by category:

- Descriptive (Mean, median, mode; Standard deviation; Range)
- Hypothesis Testing (P-value, Significance, Type I/II errors, Confidence
  intervals)
- Comparative Tests (T-test, Chi-square, ANOVA)
- Relationships (Correlation, Regression)
- Epidemiological Measures (Relative risk, Odds ratio,
  Sensitivity/specificity, Incidence/prevalence)
- Study Designs (RCT, Observational, Case study, Cohort)

Each concept page: plain-language definition, when to use it, formula + simple
explanation (if relevant), healthcare example, common student mistakes,
practice question with immediate feedback.

### 3.3 Research Project Flows

Student chooses a project type → short form (topic, academic level, linked
materials, optional deadline) → guided experience:

- **A. Designing a Study.** Conversational guidance: goal, population,
  measurements, designs, sample size, data collection, analysis plan, ethics.
  Ends with a downloadable/shareable Study Plan document.
- **B. Analyzing Data.** Upload zone (CSV, Excel table, photo of data, pasted
  table). Tutor asks research question and variables, suggests tests with
  reasoning, gives step-by-step interpretation, shows tables/charts, explains
  results in plain language.
- **C. Reviewing a Paper.** Upload PDF or paste DOI/link. Tutor returns study
  summary, methodology breakdown, main findings, author-noted limitations,
  strengths & weaknesses, relation to other research, overall quality. Follow-ups
  or save to My Sources.
- **D. Writing Methodology.** Chat-based. Student describes their plan. Tutor
  reviews, flags missing parts, suggests improvements, produces a clean
  methodology section.
- **E. Planning a Research Question.** Chat-based refinement on evidence gaps,
  feasibility, level, course context. Final question can be saved.

### 3.4 From My Materials

Select uploaded lectures/notes. The system surfaces relevant statistical or
research-method concepts from those materials and offers explanations or
practice questions.

### 3.5 Light History / Progress

- "Recently viewed concepts" horizontal strip
- "Statistics you've studied" summary (closed-loop support)

---

## 4. Shared Elements (both sub-tabs)

- Floating tutor chat (student right, tutor left with anchor icon)
- Citations on every source and claim (one-click copy APA / Vancouver /
  Harvard)
- "Ask the Tutor" button on almost every screen
- Compare sources (side-by-side with agreement/disagreement explanation)
- Export paths: Save to Study Plan · Send to AI Tutor · Link to Practice ·
  Update Progress
- Future-ready: Export to Zotero / Mendeley / EndNote (greyed out in early
  versions)

---

## 5. Empty States

- Evidence: example chips + "Try searching for guidelines or key topics in
  your course"
- Biostatistics: "I need to choose a statistical test" · "Help me understand
  p-values" · "Review a research paper" · "Explain regression"

---

## 6. Design Notes

Clean text-first interface, generous whitespace, strong teal primary actions,
plain-language quality labels, large tap targets over dropdowns, fully
responsive, fast perceived performance, consistent with the MedAnchor design
system.

## Open items

1. **Live retrieval** (PubMed / Scholar / guidelines APIs) is Phase 6 — the
   build searches a curated, honestly-labelled seed library first (§4.3).
2. **Photo/Excel parsing** — CSV and pasted tables fully work; photos fall
   back to paste with an honest message.
3. **Full reference-manager export** — Zotero/Mendeley/EndNote buttons render
   greyed-out as specified.
