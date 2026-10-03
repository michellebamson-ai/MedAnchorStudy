# AI Tutor — Design Description
## Study it. Practice it. Anchor it.

> Saved from the provided paste. The AI Tutor guides the student toward
> understanding — asking, waiting, giving feedback — never just handing over
> the answer. Small tabs: **Teach Me** · **Assignment & Project Support**.
> A History tab (past chat sessions) is wanted later but parked: it will not
> live inside the AI Tutor tab and its location is still undecided.

---

## 1. Teach Me

**Purpose.** Teach Me Mode. The tutor guides the student toward understanding.
It asks questions and waits for answers, and it doesn't just give the answer.

### Start screen (top to bottom)

- **Header:** Title "Teach Me."
- **Big box:** "What do you want to learn?" The student types any topic or taps
  the microphone to say it.
- **From your materials:** A row of tap cards for topics found in Analyze Docs.
  Weak topics are marked "Needs review."
- **Last time:** A small line, like "Last time: regression needed work," with a
  button to continue it.
- **Teaching style:** Gentle guidance, Rapid-fire, Exam-style, Step-by-step.
  Starts on Gentle guidance.
- **Depth:** Brief, Standard, Deep.
- **Difficulty:** Easy, Medium, Hard. Starts on Medium, then adapts.
- **A bold "Start" button.**
- **First time:** "Pick a topic to begin. Add a material in Materials and the
  tutor can teach from it."
- All choices are rows of tap buttons, with no dropdowns.

### Chat screen

The chat uses floating bubbles. Colors will be set later.

**Top bar.** A back arrow on the left. "MedAnchor Tutor" with a small green dot
and the word "Online." The topic and teaching style under the name. A voice
button on the right.

**Messages, as floating bubbles.**

- Student bubbles: on the right. Rounded corners, with the lower right corner
  less round.
- Tutor bubbles: on the left, in a clearly different tone from the student's.
  Rounded corners, with the lower left corner less round.
- Floating effect: each bubble has a very soft shadow, so it seems to lift off
  the page. No outlines. Generous space between bubbles.
- Small tutor icon: a tiny round anchor icon beside the tutor's first bubble in
  each turn.
- Inside a tutor bubble: plain explanation first; a "Key points" list when it
  helps; diagrams, formulas in their own boxes, and worked steps; a small label:
  From your material, AI example, or Outside source.
- Typing: three small dots pulse in a tutor bubble while it writes.
- Appearing: each new bubble fades in and rises slightly. Quiet and quick.

**Quick buttons.** A row of small rounded pills floating just above the input
bar: Hint, I don't know, Explain differently, Show a diagram, Give an example,
Practice question. The row scrolls sideways.

**Input bar.** A rounded bar that floats at the bottom, with a soft shadow and
space around it. It doesn't touch the screen edges. Inside: a text box ("Type
your answer..."), a microphone button, and a round bold send button. When the
keyboard opens, the bar stays above it.

### How the conversation goes

1. The tutor explains the idea at the student's level, in plain words first.
2. It asks a question and waits.
3. The student answers by typing or speaking.
4. The tutor checks the answer, says what is right, finds any misunderstanding,
   and explains the mistake.
5. It asks a deeper question, step by step.

The tutor can use: examples, analogies, diagrams, step-by-step explanations,
and practice questions.

**Teaching styles.**

- Gentle guidance: patient hints, with praise for good thinking.
- Rapid-fire: short questions, one after another.
- Exam-style: patient hints OFF — timed questions with little help, like a real exam.
- Step-by-step: one small part at a time, with a check before moving on.

### Source of knowledge

- The student's uploaded materials come first.
- A small "Check the evidence" button opens outside sources, found through
  Research.
- Every answer is labeled: From your material (with the page or slide), AI
  example, or Outside source (with a link).
- When the tutor isn't sure, it says so.

### Voice

Voice conversation, spoken explanations, captions, and a transcript. The
student can switch between voice and typing at any time.

### On a computer

The chat sits in a centered column. A side panel on the right shows the
material the tutor is using and the key points so far.

### Adapting

- Difficulty goes up or down based on the student's answers.
- Past results and weak spots from Progress shape what the tutor asks.
- Topics for an upcoming exam come first.
- The tutor uses the student's course and level from their profile.

### End of a session

A summary card floats in the chat: what the student got right, what to work
on, next steps like "Review regression basics, do 5 practice questions, review
again in 3 days." Bold buttons: "Practice this" and "Add review to my plan."
Results go to Progress. Review times go to Study Plan and Home.

**The closed loop (from the PRD):** student struggles with regression →
weakness found → targeted explanation → practice questions → review in 3 days
→ Progress updates.

### Messages

- No topic yet: "Type a topic or pick one from your materials."
- Tutor couldn't answer: "I'm not sure about this one. Try Check the evidence."
- Voice failed: "Voice isn't working right now. You can keep typing."
- Failed: "Something went wrong. Try again."

---

## 2. Assignment & Project Support

**Purpose.** Help the student with assignments and projects while they do the
thinking. It guides, checks, and gives feedback. **It does not write work for
the student to copy and submit.**

### Start screen (top to bottom)

- **Header:** Title "Assignment & Project Support."
- **Add an assignment:** A big box: "Paste your assignment question or brief."
  Below it, small buttons: Upload a file, Take a photo, Import from Moodle,
  Canvas, or Blackboard.
- **Details (all tap buttons, no dropdowns):** Type (Essay, Report, Research
  project, Presentation, Calculation task, Case write-up); Course (picks from
  the student's courses); Deadline (a date picker — the date goes to Study
  Plan); Materials to use (a row of tap cards for the student's materials — the
  student picks which ones the tutor should use).
- **Your assignments:** A list of assignments already started. Each row shows
  the title, course, deadline, and a progress line like "3 of 6 steps done."
- **A bold "Start" button.**
- **First time:** "Add an assignment to begin. I'll help you work through it
  step by step."

### Assignment workspace

- **Top bar:** Back arrow, the assignment title, and its deadline.
- **Steps (a row across the top):** Understand, Research, Plan, Build, Check,
  Improve. The student can open any step in any order. Done steps get a
  checkmark.
- **Chat with the tutor:** The same floating bubbles as Teach Me. The tutor
  asks questions and gives feedback in the chat.

**Step 1: Understand.** Explains what the assignment is asking, in plain words.
Picks out the key words, like "discuss," "compare," or "evaluate," and says
what each one asks for. Lists what the assignment needs: length, parts, and
marking points if the student has them. Asks the student to say it back in
their own words, then checks it.

**Step 2: Research.** Helps the student explore the topic and develop a
research question. Finds reliable sources through Research, and helps the
student judge them (who wrote it, how recent, how strong the evidence is).
Compares sources and points out where they disagree. Saves the chosen sources
in a list for this assignment.

**Step 3: Plan.** Helps make an outline, one part at a time. Helps plan a
research project: question, aims, design, variables, and methods. Reviews the
methodology and points out gaps. Milestones go to Study Plan, so the work is
spread out before the deadline.

**Step 4: Build.** Helps the student build arguments. It asks questions like
"What is your main point?" and "What evidence supports it?" Compares evidence
for and against. Works through calculations step by step, and explains why a
method is right. Larger statistics help opens in Research. The student writes
their own text. The tutor reacts to it.

**Step 5: Check.** Reasoning check: finds weak points, gaps, and claims
without evidence in the student's thinking. Citations and references: the
student picks a style with tap buttons (APA, Harvard, Vancouver, and others).
The tutor checks the citations and the reference list for missing parts and
format mistakes. It also flags sources that look unreliable or can't be found.

**Step 6: Improve.** The student pastes a draft. The tutor gives feedback on
structure, clarity, evidence, and reasoning. Feedback comes as comments on
parts of the draft, with a short suggestion for each. The tutor shows how to
fix one example and asks the student to fix the rest. The student rewrites,
and the tutor checks again.

**Quick buttons under the box.** Hint, Explain this, Show an example, Check my
reasoning, Find a source, Check my citations.

### Rules (from the PRD) — learning first

- The tutor helps the student understand, research, judge evidence, and build
  their own reasoning.
- If a student asks "write it for me," the tutor says it will build it
  together and asks the first question.
- Examples are about a different topic from the student's own assignment, so
  they can't be copied.
- **Unique to each student:** two classmates on the same assignment get
  different responses, based on their own materials, ideas, and drafts.
- **Personal:** uses the student's course materials, level, earlier chats,
  research topic, and learning history.

### Adapting

- The tutor adjusts to the student's level from their profile.
- Weak spots from Progress shape the questions. For example, if regression is
  weak, it gives extra help on the calculation step.

### Finishing an assignment

A short summary card floats in the chat: what went well, what to work on, and
next steps. Bold buttons: "Practice this" and "Add review to my plan."

### Messages

- Nothing added: "Paste your assignment or upload a file to begin."
- Can't read the file: "We couldn't read this file. Try a clearer photo or
  paste the text."
- Import failed: "We couldn't connect to Moodle. Try again."
- Asked for finished work: "I'll help you build this yourself. Let's start
  with your main point. What do you want to say?"
- Failed: "Something went wrong. Try again."

---

## Shared across AI Tutor

**Honest labels.** From your material (with the page or slide), AI example,
Outside source (with a link). When the tutor isn't sure, it says so.

**Connections.** Materials (the tutor teaches from the student's own
materials); Research (sources, evidence, statistics help); Study Plan
(deadlines, milestones, review times); Practice (questions and cases for weak
topics); Progress (records performance, sends weak topics back).

**Style.** Floating bubbles with soft shadows, no outlines, generous space.
Book-style headings and plain text for everything else. Colors to be decided
later.

**Not on any AI Tutor screen.** No dropdowns, streaks, or badges. History
(past chats) is parked for later.

## Open items

1. **Bubble colors** explicitly deferred ("Colors will be set later") — the
   build uses clearly different neutral tones for student vs tutor.
2. **History tab** parked — past sessions surface only as "Last time" for now.
3. **Google Drive / Moodle / Canvas / Blackboard imports** — connectors are
   Phase 6; the buttons show the spec's honest failure messages.
4. **Full voice conversation** — mic-to-text plus read-aloud ship now; the
   spec's failure message covers unsupported browsers.
5. **Diagram rendering** — described in text boxes until image generation
   exists; formulas use the existing formula-box style.
