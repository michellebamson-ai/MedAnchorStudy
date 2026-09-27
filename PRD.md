# Product Requirements Document: MedAnchor Study

## 1. Executive Summary

MedAnchor Study is an AI-powered, all-in-one learning platform built specifically for healthcare students and learners.

It bridges the gap between passive memorization and active clinical, research, and public-health application. The platform transforms uploaded study materials—including lectures, slides, PDFs, audio, images, and other course resources—into an integrated learning ecosystem.

MedAnchor Study combines Socratic tutoring, intelligent document analysis, personalized study materials, clinical and public-health case simulations, biostatistics and research support, evidence-based health information, clinical communication practice, smart study planning, and connected progress tracking.

The goal is to make studying easier, faster, more personalized, and more effective, while helping students move from simply consuming information to understanding, applying, practicing, and retaining it.

The platform should continuously learn from the student's study activity and performance so that one learning activity can improve the next.

---

## 2. Target Audience

### 2.1 Primary Users

Healthcare students and learners, including:

- Medical students
- Nursing students
- Public health students
- Pharmacy students
- Allied health students
- Other undergraduate and postgraduate students in health sciences

The platform should support learners across different academic levels, courses, institutions, and learning styles.

### 2.2 Key Pain Points

Students commonly experience:

- Overwhelming amounts of dense academic material.
- Difficulty understanding complex concepts, formulas, and research methods.
- Difficulty translating theory into practical clinical or public-health application.
- Lack of personalized explanations, feedback, and guidance.
- Difficulty organizing study time, assignments, deadlines, and exam preparation.
- Difficulty retaining information over time.
- Difficulty finding, evaluating, and understanding reliable research evidence.
- Difficulty applying classroom knowledge to realistic scenarios.
- Academic burnout and study fatigue.

---

## 3. Core Features & Functional Requirements

### 3.1 Teach Me Mode — Socratic Tutoring

An interactive conversational learning environment where MedAnchor guides the student toward understanding rather than simply providing answers.

**Core capabilities**

- Student can enter any topic or concept they want to learn.
- AI explains concepts at the student's academic level.
- AI asks questions and waits for the student's response.
- AI evaluates the response, identifies misconceptions, and explains mistakes.
- AI asks progressively deeper questions to test understanding.
- AI can use examples, analogies, diagrams, step-by-step explanations, and practice questions.
- Teaching styles can include:
  - Gentle guidance
  - Rapid-fire questioning
  - Exam-style pressure
  - Step-by-step teaching
- Difficulty adapts based on the student's knowledge and performance.
- Previous performance and learning history influence future tutoring.
- Can use the student's uploaded course materials as the primary learning context.
- Can connect to external evidence when appropriate through the Research & Evidence Engine.

**Closed-loop learning**

Performance in Teach Me Mode should contribute to the student's overall learning profile.

For example:

«Student struggles with regression → weakness identified → targeted explanation → practice questions → spaced review → progress updated.»

---

### 3.2 Analyze Docs & Study Material Generator

A central system for understanding and transforming the student's own learning materials.

Students can upload:

- PDFs
- Lecture slides
- Textbooks or textbook sections
- Audio notes
- Images
- Course notes
- Other supported study resources

**Analyze Docs**

The system analyzes uploaded material and identifies:

- Topics and subtopics
- Key concepts
- Important definitions
- Formulas
- Tables
- Diagrams
- Important facts
- Relationships between concepts
- Potential areas of difficulty
- Course-specific terminology

**Generated learning resources**

From the analyzed material, students can generate:

- Detailed topic breakdowns
- High-yield summaries
- Revision notes
- Flashcards
- Practice questions
- Concept explanations
- Formula walkthroughs
- Diagram/image-labeling exercises
- Quick-review material
- Application questions
- Case scenarios

Students should be able to control:

- Level of detail
- Explanation style
- Output format
- Difficulty
- Learning objective

**Personalization**

Generated resources should reflect:

- The student's academic level
- Current course
- Uploaded materials
- Previous performance
- Known weaknesses
- Upcoming assessments

**Integration**

Analyze Docs should feed directly into other features.

For example:

«Upload lecture → Analyze Docs → identify weak topic → Teach Me → generate practice questions → Case Simulation → schedule spaced review.»

---

### 3.3 Clinical & Public-Health Case Simulators

Interactive scenarios that allow students to apply what they have learned.

**Clinical scenarios**

Cases may involve:

- History-taking
- Symptom analysis
- Differential diagnosis
- Choosing investigations
- Interpreting findings
- Clinical decision-making
- Developing management or intervention plans

**Public-health scenarios**

Cases may involve:

- Outbreak investigations
- Environmental health hazards
- Health-promotion planning
- Community interventions
- Epidemiological investigation
- Population-level decision-making

**Core behavior**

Students work through cases step-by-step.

The system should:

- Present realistic information progressively.
- Require the student to make decisions.
- Ask the student to explain their reasoning.
- Provide feedback after decisions.
- Identify knowledge gaps.
- Adapt case difficulty.
- Connect performance back to the student's learning profile.

**Course-material alignment**

Cases should be capable of being generated from the student's uploaded study materials.

This allows students to practice exactly what they are currently learning.

Example:

«Upload lecture on waterborne diseases → Analyze Docs → generate cholera outbreak scenario → student investigates outbreak → weaknesses are identified → Teach Me and revision activities are recommended.»

---

### 3.4 Biostatistics & Research Companion

A specialized learning and research environment for quantitative analysis, epidemiology, research methods, and academic research work.

**Biostatistics**

Support should include:

- Descriptive statistics
- Hypothesis testing
- Chi-square
- Relative risk
- Odds ratio
- Sensitivity and specificity
- Confidence intervals
- Correlation
- Regression
- Epidemiological measures
- Other relevant statistical methods

The system should:

- Explain statistical concepts clearly.
- Explain formulas.
- Guide calculations step-by-step.
- Explain why a particular test or method is appropriate.
- Help students identify variables and study designs.
- Interpret tables, graphs, statistical outputs, and research findings.
- Help students understand rather than simply provide a final answer.

**Research support**

Students can receive assistance with:

- Developing research questions
- Research objectives
- Study designs
- Variables
- Methodology
- Literature exploration
- Data interpretation
- Project planning
- Statistical analysis
- Research findings
- Referencing
- Reviewing research work

The system can analyze:

- Uploaded datasets
- Research papers
- Lecture materials
- Course notes
- Other relevant documents

**Academic-level adaptation**

Explanations and guidance should adapt to the student's current level of understanding.

---

### 3.5 Health Knowledge & Evidence Support

A specialized evidence and knowledge layer that helps students find and understand reliable health information.

It supports learning across:

- Medicine
- Nursing
- Public health
- Pharmacy
- Allied health
- Other health sciences

**Core capabilities**

Students can:

- Research health topics.
- Explore evidence.
- Ask complex health questions.
- Find relevant literature.
- Compare evidence.
- Understand research findings.
- Identify limitations in evidence.
- Develop research questions.
- Generate evidence summaries.
- Receive cited explanations.

**Sources**

Where appropriate, the system should prioritize:

- Peer-reviewed research
- Systematic reviews
- Clinical guidelines
- Public-health guidelines
- Government sources
- Recognized health organizations
- Relevant textbooks and academic references

**Source transparency**

The system should:

- Provide citations and source links.
- Distinguish uploaded course material from external evidence.
- Help students evaluate source quality.
- Identify disagreements between sources.
- Explain relevant limitations or uncertainty.

---

### 3.4 & 3.5 Shared Foundation — Research & Evidence Engine

The Biostatistics & Research Companion and Health Knowledge & Evidence Support should not operate as completely separate research systems.

They share a common underlying Research & Evidence Engine.

The engine provides:

- Source retrieval
- Evidence discovery
- Citation management
- Source comparison
- Evidence evaluation
- Literature exploration
- Research-context understanding
- Plain-language explanation
- Academic-level adaptation
- Conversational follow-up
- Uploaded-document versus external-evidence comparison

The specialized features then build on this shared foundation.

3.4 uses the engine for:

«"Help me DO the research."»

Examples:

- Choose a study design.
- Select an appropriate statistical test.
- Analyze data.
- Interpret results.
- Develop methodology.
- Work through a research project.

3.5 uses the engine for:

«"Help me FIND and UNDERSTAND the evidence."»

Examples:

- Find research.
- Compare sources.
- Understand guidelines.
- Explore a health topic.
- Summarize evidence.
- Evaluate limitations.

This shared architecture avoids duplicating citation, retrieval, and source-evaluation systems.

---

### Assignment & Project Support

Assignment and project assistance is a cross-feature capability, rather than a separate standalone feature.

Students can use MedAnchor Study to:

- Understand assignment questions.
- Research topics.
- Find and evaluate reliable sources.
- Develop research questions.
- Create outlines.
- Develop arguments.
- Compare evidence.
- Work through calculations.
- Plan research projects.
- Review methodology.
- Interpret data.
- Improve drafts.
- Check citations and references.
- Identify weaknesses in their reasoning.

The system should personalize assistance using:

- Course materials
- Academic level
- Student context
- Previous interactions
- Research topic
- Learning history

**Academic integrity**

The system should prioritize learning and original student work.

It should help students:

- Understand concepts.
- Research effectively.
- Evaluate evidence.
- Develop their own reasoning.
- Improve their drafts.

It should avoid positioning itself primarily as a tool for copying and submitting AI-generated assignments as the student's own work.

---

### 3.6 Exam Preparation & Smart Study Planning

A personalized academic command center that helps students organize and execute their study workload.

**Inputs**

Students can provide:

- Exam dates
- Courses
- Syllabi
- Assignments
- Deadlines
- Presentations
- Study goals
- Available study time

Where supported, information can also be imported through Connectors.

**Planning**

The system should:

- Build personalized study schedules.
- Break large workloads into manageable daily goals.
- Prioritize topics based on:
  - Exam proximity
  - Difficulty
  - Weaknesses
  - Mastery
  - Outstanding work
- Schedule spaced reviews.
- Track completed study activities.
- Track study time.
- Adjust plans based on performance.

**Time-aware planning**

Students should be able to say:

«"I have two hours tonight. What should I study?"»

The system determines the most useful activities based on urgency, weaknesses, upcoming deadlines, and available time.

**Schedule recovery**

If a student misses a study session, the system should:

- Detect the missed activity.
- Recalculate the remaining workload.
- Reschedule appropriately.
- Avoid creating an unrealistic catch-up workload.

**Workload balancing**

The planner should balance multiple responsibilities, such as:

- Upcoming exam
- Assignment
- Presentation
- Research project
- Revision

**Study modes**

Possible modes include:

- Quick Session
- Deep Study
- Exam Cram
- Revision Only
- Catch-Up

**Progress forecasting**

The system may show:

- How much material has been covered.
- What remains.
- Which topics need attention.
- Current study progress relative to upcoming deadlines.

It should avoid presenting uncertain predictions as guarantees of exam readiness.

**Calendar and tracking**

The planner should provide:

- Study calendar
- Assignment tracker
- Deadline tracker
- Exam tracker
- Study-time tracking
- Daily goals
- Progress overview

---

### 3.7 Clinical Communication Practice

A focused role-play environment for practicing interpersonal healthcare and public-health communication skills.

MedAnchor can act as:

- Patient
- Caregiver
- Community member
- Colleague
- Other relevant characters

**Practice scenarios**

Students can practice:

- History-taking
- Patient interviews
- Health education
- Motivational interviewing
- Breaking bad news
- Public-health communication
- Community engagement

**Interaction**

The system should support:

- Text-based role-play
- Voice-based role-play
- Different realistic scenarios
- Beginner-to-advanced difficulty
- Dynamic responses based on what the student says

**Feedback**

After a session, the system can provide feedback on:

- Communication clarity
- Questioning
- Empathy/professionalism
- Important information that was missed
- Overall interaction
- Areas for improvement

**Documentation practice**

Where appropriate, students can practice:

- SOAP notes
- Structured documentation

Performance should feed back into the student's overall learning profile.

---

### 3.8 Connected Progress Tracking

A cross-feature system that turns student activity into actionable learning recommendations.

It tracks performance across:

- Teach Me Mode
- Analyze Docs
- Case Simulators
- Biostatistics & Research
- Clinical Communication
- Practice questions
- Study activities

**Learning profile**

The system identifies:

- Strengths
- Weaknesses
- Topics needing review
- Topics approaching mastery
- Study consistency
- Progress over time

**Course-level progress**

Students should be able to see progress by:

- Course
- Topic
- Skill
- Assessment area

**Topic mastery**

Topics can have simple statuses such as:

- Strong
- Needs Review
- Needs Attention

These statuses should be based on multiple signals rather than a single quiz score.

**Actionable recommendations**

Progress tracking should lead to action.

Instead of:

«"You are weak in regression."»

MedAnchor might recommend:

«Review regression basics → Teach Me session → complete 5 practice questions → review again in 3 days.»

**Cross-feature learning loop**

Performance in one feature should influence another.

Example:

«Case Simulator identifies weakness → Teach Me explains it → Practice questions test it → Spaced Repetition schedules review → Study Planner adds it to the student's schedule → Progress Tracking updates mastery.»

The objective is a closed-loop learning system, not simply a dashboard of graphs.

---

### 3.9 Shared Platform Capabilities

These are cross-feature systems that make the core features work together. They should not necessarily be treated as separate major student-facing products.

#### 3.9.1 Research & Evidence Engine

Shared foundation for:

- Biostatistics & Research Companion
- Health Knowledge & Evidence Support
- Assignment/project research support

Provides common research retrieval, source evaluation, citation, evidence comparison, and explanation capabilities.

#### 3.9.2 Personalization & Customization

A shared personalization layer that allows MedAnchor to adapt to each student.

It should consider:

- Academic level
- Courses
- Learning preferences
- Preferred explanation style
- Study goals
- Previous interactions
- Performance history
- Known strengths and weaknesses
- Upcoming assessments

Students should also be able to customize preferences such as:

- Explanation depth
- Question difficulty
- Teaching style
- Study format
- Reminder preferences

The system should not assume that every student should learn in exactly the same way.

#### 3.9.3 Voice & Audio Learning

Voice and audio should function across multiple features rather than as an isolated feature.

Potential uses include:

- Voice conversations in Teach Me Mode
- Spoken explanations
- Audio revision
- Voice-based case simulations
- Clinical communication role-play
- Audio notes
- Captions and transcripts

#### 3.9.4 Connectors & Integrations

Connectors allow MedAnchor to interact with external academic tools where supported.

Potential integrations include:

- Google Calendar
- Google Drive
- Microsoft OneDrive
- Learning management systems such as Moodle, Canvas, and Blackboard
- Notion
- Other useful academic platforms in future

Connectors may allow MedAnchor to retrieve:

- Classes
- Assignments
- Deadlines
- Exams
- Study materials
- Calendar events

Integration availability and permissions should always be controlled by the student.

#### 3.9.5 Spaced-Repetition System

A shared system used by Study Materials, Study Planning, and Progress Tracking.

It should:

- Schedule reviews at appropriate intervals.
- Increase or decrease review frequency based on performance.
- Prioritize weak or forgotten material.
- Consider upcoming exams.
- Allow students to review material at intervals such as two days, one week, and later intervals.
- Feed scheduled reviews into the Study Planner.

---

## 4. Non-Functional Requirements

### 4.1 Accessibility & Usability

MedAnchor Study should be designed for students who may spend long periods studying while tired, stressed, or using different devices.

Requirements:

- Clean, intuitive interface.
- Mobile-first experience.
- Responsive across screen sizes.
- Simple, consistent navigation.
- Fast loading where possible.
- Good performance on slow internet connections.
- Low-bandwidth functionality where practical.
- Offline functionality where practical.
- Dark mode.
- Readable typography and clear information hierarchy.
- Captions and transcripts for audio.
- Support for relevant assistive technologies.
- Important information should be easy to find.

The interface should reduce cognitive load rather than add to it.

---

### 4.2 Data Privacy & Security

Student data and academic materials should be treated as private and sensitive.

The system should provide:

- Secure storage of uploaded materials.
- Secure transmission of data.
- Appropriate protection of conversations and personal information.
- Student control over uploaded files and personal data.
- Clear explanations of what data is collected and why.
- Data deletion and account-management controls.
- Appropriate access controls.
- Protection of sensitive information.
- Security for connected third-party services.
- Compliance with applicable privacy and data-protection requirements.

Health-related information requires appropriate additional safeguards where applicable.

---

### 4.3 Accuracy, Trust & Academic Integrity

Because MedAnchor is designed for healthcare education, accuracy and transparency are critical.

The system should:

- Prefer reliable evidence-based sources for health information.
- Provide citations and source links for important externally supported claims.
- Distinguish between:
  - Student-uploaded material
  - External sources
  - AI-generated explanations or examples
- Clearly communicate uncertainty when evidence is incomplete or conflicting.
- Avoid presenting uncertain information as established fact.
- Check statistical calculations and research outputs where technically possible.
- Encourage students to verify and critically evaluate information.
- Show relevant disagreements between sources rather than hiding them.
- Support learning and original academic work rather than simply producing copy-and-submit assignments.

---

## 5. Product Architecture Principles

The product should follow several core architectural principles.

### 5.1 One Learning System, Not a Collection of Separate Tools

Features should share information where appropriate.

A student's activity in one feature should improve their experience in another.

### 5.2 Uploaded Materials as a Core Context

The student's own course materials should be central to the learning experience.

The platform should be able to transform the same material into:

«Explanation → Flashcards → Questions → Case → Communication scenario → Revision → Spaced review.»

### 5.3 Shared Systems Instead of Duplicate Features

Where multiple features require the same underlying capability, MedAnchor should use a shared system.

Examples:

- Research & Evidence Engine → 3.4 + 3.5 + project support
- Personalization → all learning features
- Voice → multiple interactive features
- Spaced Repetition → Study Materials + Planner + Progress Tracking
- Progress data → Planner + Teaching + Practice

### 5.4 Action Over Information

Dashboards and analytics should lead to useful next actions.

The product should answer:

«"What should I do next?"»

not only:

«"What happened?"»

### 5.5 Personalization Without Losing Accuracy

The platform should personalize explanations, examples, difficulty, and learning pathways without changing established facts simply to make an answer feel personalized.

### 5.6 Student Control

Students should remain in control of:

- Their data
- Uploaded materials
- Connected services
- Study plans
- Learning preferences
- Account and deletion settings

---

## 6. Core Learning Loop

The central product experience should connect the major systems into a continuous loop:

Learn → Practice → Apply → Measure → Review → Adapt

For example:

1. Student uploads a lecture.
2. Analyze Docs identifies the important concepts.
3. MedAnchor generates personalized study materials.
4. Student uses Teach Me Mode to understand difficult concepts.
5. Student completes practice questions.
6. Student enters a clinical/public-health case.
7. Performance identifies weaknesses.
8. Progress Tracking updates mastery.
9. Spaced Repetition schedules review.
10. Smart Study Planning places the review into the student's available schedule.
11. The student returns to the material.
12. The system measures improvement and adapts the next learning activity.

This closed-loop experience is a central differentiator of the product.

---

## 7. Feature Relationships & Boundaries

To prevent unnecessary duplication, the product should maintain the following boundaries:

| Area | Primary purpose |
| --- | --- |
| Teach Me Mode | Understand concepts through guided learning |
| Analyze Docs | Understand and transform the student's materials |
| Case Simulators | Apply knowledge to realistic scenarios |
| Biostatistics & Research | Perform and understand research/statistical work |
| Health Knowledge & Evidence | Find and understand external evidence |
| Study Planner | Decide what to study and when |
| Communication Practice | Practice healthcare/public-health communication |
| Progress Tracking | Understand performance and determine what to do next |
| Research & Evidence Engine | Shared research/evidence foundation |
| Personalization | Adapt the experience to the individual student |
| Voice & Audio | Enable spoken/audio learning across features |
| Connectors | Connect external academic systems |
| Spaced Repetition | Determine when material should be reviewed |

---

## 8. Scope Discipline

To keep the initial product focused, MedAnchor should avoid turning every possible capability into a separate feature.

The following should remain supporting capabilities rather than standalone products:

- Assignment/project support
- Voice
- Spaced repetition
- Connectors
- Personalization
- Research & Evidence Engine
- Document analysis

Future enhancements may expand individual areas based on student demand and product validation.

The initial product should prioritize a coherent learning experience over an excessive number of disconnected tools.

---

## 9. Product Vision

MedAnchor Study should function as a personal academic learning system for healthcare students rather than simply another AI chatbot or study-material generator.

The long-term experience is:

«Upload what you are learning → understand it → practice it → apply it → identify what you don't know → study what matters most → review it at the right time → track improvement.»

The product should make the student's existing learning materials more useful while providing the guidance, practice, research support, planning, and feedback needed to turn information into lasting knowledge and practical competence.
## Agent Steering Notes

**Tool decisions (Task 1):**

The AI initially proposed: vanilla JavaScript, SQLite (better-sqlite3), 
and Auth.js for authentication.

I reviewed these and requested changes based on my course's recommended 
stack instead:

- Framework: switched from vanilla JavaScript to Next.js (App Router)
- Database: switched from SQLite to PostgreSQL
- Authentication: switched from Auth.js to Better Auth

The AI explained its original choices, then confirmed the switch. The 
final stack is:
- Framework: Next.js with App Router, TypeScript
- Database: PostgreSQL (running locally via Docker on port 5432)
- Database access: Prisma ORM
- Authentication: Better Auth (email/password, database-backed sessions)
- File storage: local filesystem (data/uploads/)
- Runtime: local Next.js server on http://localhost:3000

Everything currently runs locally — no deployment.
## Design Refinement Notes

### Task 2: Steer Design Improvement
* **Refinement Requested:** Enhanced the visual contrast, feedback indicators, and interactive depth on core primary action inputs.
* **Specific Changes:** Upgraded the `.btn-primary` component styling to incorporate a smooth gradient shifting on hover between the primary deep teal brand color (`#04342C`) and the secondary highlight blue (`#0E7490`). Implemented a 3D elevation movement script (`translateY(-2px)`) coupled with interactive glowing container drop-shadows on focused states to ensure immediate feedback.