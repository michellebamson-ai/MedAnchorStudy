# MedAnchor Study — Onboarding & Dashboard Specification
## Welcome flow (Pages 1–3), study-plan prompt, and dashboard layout

> Saved from the provided paste. This spec is newer than DESIGN_SPEC.md and
> deliberately differs from it in places (dark teal brand screens, left sidebar
> navigation, card-based dashboard). Open conflicts are listed at the bottom.

---

## Page 1: Welcome Screen

**Purpose.** The first screen a new student sees. It shows the brand and leads
to one action: "Get Started."

**Background.** Deep teal that blends into darker teal from top to bottom. Soft,
flowing wave lines run across the lower half of the screen. The waves are faint
and calm. They never make the text hard to read. The background fills the whole
screen, with no borders or edges.

**Elements (these four only).**

1. **Anchor logo.** The anchor with the snake and medical staff, from the image
   chosen. Centered, in the upper part of the screen. Larger than a normal
   icon, so it feels like a brand mark. Glowing teal and blue shading, with a
   soft glow around it. It stands alone, with plenty of empty space around it.
   Use the original image file with a see-through background. Do not redraw it.
2. **App name.** "MedAnchor" on the first line in white. "Study" on the second
   line in bright teal. Large, clean, and plain letters, with slightly wide
   spacing between them. Centered, directly under the logo.
3. **Slogan.** "Study it. Practice it. Anchor it." Directly under the name.
   Small, light letters in a pale color, lighter than the name. Keep all three
   periods, so each part reads as its own step. It stays on one line. On a very
   small screen, it can wrap after "Practice it."
4. **"Get Started" button.** Wide and bold, in a bright teal pill shape with
   fully rounded ends. Dark text, bold. Tall enough to tap easily with a thumb.
   Does not touch the screen edges. There is space on both sides. It is the only
   action on the screen. Sits in the lower third of the screen.

**Page dots.** Three small dots at the very bottom, centered. The first dot is
bright. The other two are dim. They show this is page 1 of 3. Quiet and easy to
ignore.

**Layout.** One centered column, from top to bottom: logo, name, slogan, then a
gap, then the button, then the dots. Lots of empty space between the logo, the
name, and the slogan, so it feels open and calm. A bigger gap between the slogan
and the button, so the upper area stays focused on the brand.

**What is not on this screen.** No menu, no search, and no bottom bar. No
"Sign in" line (login belongs on page 2). No pictures except the logo. Nothing
that competes with the "Get Started" button.

**Behavior.** Tapping "Get Started" opens page 2: Login and setup. The page
does not scroll.

**Screen sizes.** This is one design. On a small screen, the column fills the
width and the button stays wide. On a big screen, the same column stays
centered, and the background fills the whole screen.

---

## Page 2: Login and Setup

**Purpose.** Let the student create an account or sign in. Most students are
new, so creating an account comes first.

**Background.** The same deep teal gradient as Page 1. The wave lines are even
fainter, so the forms stay easy to read.

**Elements.**

1. **Back arrow.** Small, top left. Goes back to the welcome screen.
2. **Small logo.** The same anchor logo, much smaller than on Page 1. Centered
   at the top. It is a quiet reminder of the brand.
3. **Heading.** "Create your account" in large, clean letters. A short line
   under it in pale, light letters: "Start studying in a minute." This changes
   to "Welcome back" when the student picks Sign in.
4. **Switch.** A pill-shaped switch with two choices: Create account and Sign
   in. Create account is the main choice. It is selected by default, in bold
   bright teal. Sign in is the quieter choice, in dim, lighter letters.
5. **Create account form.**
   - First name: "What should we call you?" This name is used in the greeting.
   - Email
   - Password:
     - A "Show" toggle (an eye icon) on the right side of the field.
     - A light strength meter under the field: a thin bar that fills as the
       password gets stronger, with one word beside it ("Weak," "Okay," or
       "Strong").
     - A short hint: "At least 8 characters."
   - Each field has a clear label above it.
   - Fields have a soft, slightly lighter teal fill and rounded corners. A thin
     bright teal edge appears when the student taps one.
6. **Main button.** "Create account": a wide, bold, bright teal pill with dark
   text, matching the "Get Started" button on Page 1.
7. **Google option.** A thin line with the word "or" in the middle. Below it, a
   wide "Continue with Google" button with a soft outline and light text. With
   Google, the student's first name comes from their Google account.
8. **Fine print.** One small line at the bottom: "By continuing, you agree to
   the Terms and Privacy Policy." The two names are links.
9. **Page dots.** Three small dots at the very bottom. The second dot is
   bright. The other two are dim.

**Welcome confirmation (new).** After a successful sign-up, by email or Google,
a short confirmation shows before Page 3. It is a quiet moment on the same teal
background with the logo and one line: "Welcome, Sarah." The student's own
first name is used. It stays for about 2 seconds and then moves on by itself.
No button is needed. It is not a fourth page. The dots stay at three, and they
show the second dot while it is on screen.

**When the student picks Sign in.**

- Heading: "Welcome back."
- Fields: Email and Password, with the same "Show" toggle. There is no
  strength meter here.
- A small "Forgot password?" link under the password field, on the right.
- Main button: "Sign in."
- The Google option stays the same.
- The first name field disappears.
- A returning student skips the welcome confirmation and goes straight to the
  dashboard.

**Messages.** Plain, short, and shown right under the field:

- Empty email: "Enter your email."
- Wrong email format: "Check your email address."
- Short password: "Use at least 8 characters."
- Wrong password on sign in: "That email or password doesn't match. Try again."

**What is not on this screen.** No menu, no search, and no bottom bar. No
study questions (those belong on Page 3). Nothing that competes with the main
button.

**Behavior.**

- Create account shows the welcome confirmation, then opens Page 3: Set up
  your study plan.
- Sign in goes straight to the dashboard, because a returning student has
  already set up.
- When the keyboard opens, the screen scrolls so the main button stays visible.

**Screen sizes.** This is one design. On a small screen, the form fills the
width. On a big screen, the same form stays centered in a narrower column, and
the background fills the whole screen.

---

## Page 3: Your Profile

**Purpose.** Collect the few facts that make the app feel personal. It also
puts the course and year in the profile.

**Background.** The same deep teal gradient as Pages 1 and 2, with the faint
wave lines.

**Elements.**

1. **Back arrow.** Small, top left. It goes back to Page 2.
2. **Heading.** "Tell us about your studies" in large, clean letters. A short
   line under it in pale, light letters: "This helps us fit MedAnchor to you."
3. **Course or program.** A required field, labeled "Course or program." The
   student picks from a short list: Medicine, Nursing, Public Health, Pharmacy,
   Dentistry, Biomedical Science, and Other. Choosing "Other" opens a small box
   to type their own.
4. **Year or level.** A required field, labeled "Year or level." Choices: Year
   1, Year 2, Year 3, Year 4, Year 5 or higher, and Postgraduate. Shown as a row
   of tap buttons, not a dropdown. The chosen one is bright teal.
5. **School or country (optional).** A small field labeled "School or country
   (optional)." It is clearly marked optional, and it can stay empty.
6. **Main button.** "Finish": a wide, bold, bright teal pill with dark text,
   matching the buttons on Pages 1 and 2. It is active only after the course
   and year are chosen.
7. **Skip link.** A small "Skip for now" link under the button. A skipped
   student can fill this in later from the profile.
8. **Page dots.** Three small dots at the very bottom. The third is bright, and
   the other two are dim.

**What is not on this screen.** No questions about exams or study hours. No
upload, no menu, no search, and no bottom bar. No "what you find hardest"
question.

**Behavior.**

- "Finish" saves the profile and opens the dashboard.
- "Skip for now" opens the dashboard too.
- The course and year appear in the student's profile, not on the dashboard.

---

## After Page 3: The Study Plan Card (on the Dashboard)

**Purpose.** Ask for the exam and study hours only after the student has seen
the app.

**How it looks.** A bottom sheet on a phone, or a card near the top of the
dashboard on a big screen. Light and friendly, with a soft teal edge, so it
feels like help and not like a form.

**Contents.**

- Title: "Set up your study plan"
- One line: "Add your next exam so we can count the days with you."
- Next exam: A name field (for example, "Pharmacology midterm") and a date
  picker.
- Study hours per week: A row of tap buttons: 5, 10, 15, 20 or more.
- Main button: "Save plan"
- Dismiss: A small "Not now" link, and a close mark at the top.

**Behavior.**

- It shows once, right after the student first lands on the dashboard.
- "Save plan" fills in the Next exam card and the Today's plan section.
- "Not now" closes it. The Next exam card then shows "Add your next exam,"
  with a button that opens the same card again.
- If the student closes it twice, it stops showing by itself. They can always
  add the exam later from the Plan tab.

---

## Dashboard

### Left Sidebar (dark teal)

- Top: Anchor logo + **MedAnchor Study**
- Vertical navigation:
  - Home (active)
  - Study Plan
  - AI Tutor
  - Flashcards
  - Notes
  - Progress
  - Resources
- Bottom: User avatar + Name + Role

### Top Bar

- Centered search bar: "Search topics, questions, or ask MedAnchor..."
- Right side: Notification bell + Bookmark icon

### Main Area

**Top header.**

- Left: large greeting ("Good morning, [Name]") + sun emoji. Subtitle:
  "Here's what needs your attention today."
- Right: soft card with robot icon. "MedAnchor Tutor" — "Let's make today
  count." + arrow button.

**Today's Study Block.**

- Header: Calendar icon + "Today's Study". Subtext: number of topics + total
  time. "View All →"
- Horizontal row of study cards. Each card contains: icon + title, duration,
  subtle progress indicator (e.g. thin progress bar or "2/5 sessions done"),
  stronger, higher-contrast **Start** button.

**Quick Access Row.** Four equal cards: Flashcards, Practice Questions, AI
Tutor, Study Planner (each with a short supporting line).

### Right Column

**Your Progress Card.**

- Large circular progress ring with percentage
- Label: Overall Completion
- Colored legend: Strong, Needs Review, Needs Attention (with topic counts)
- **Weak topic call-out** directly below the legend: "Focus area: [Topic Name]"
  + quick action link

**Continue Learning Card.**

- Header + "View All →"
- List of continue items (icon + title + subject)

### Bottom Banner

Full-width teal bar:

- Robot icon + "Need help with a concept?"
- Supporting text
- **Chat Now** button
- Far right: "Small steps. Big progress." + heartbeat line

### Responsive Behavior

- Desktop: Sidebar + two-column main layout (content + right column)
- Mobile: Sidebar collapses into bottom navigation or hamburger menu. Right
  column stacks below the main content.

---

## Open conflicts with earlier specs

1. **Navigation model.** DESIGN_SPEC.md built a 5-item top nav (Dashboard, Learn,
   Teach Me, Progress, Explore) with specialised spaces grouped under Explore.
   This spec uses a 7-item dark-teal left sidebar (Home, Study Plan, AI Tutor,
   Flashcards, Notes, Progress, Resources). Needs a decision before building.
2. **Dashboard philosophy.** DESIGN_SPEC.md says the dashboard is not a feature
   directory and forbids boxing every section. This spec's dashboard is
   card-based with a Quick Access feature row and a bottom help banner.
   Needs a decision on which dashboard wins.
3. **Missing brand asset.** Pages 1–3 centre on an anchor-with-snake-and-staff
   image ("use the original image file, do not redraw"). No such file exists in
   the repo — it must be supplied, or a stand-in used.
4. **New destinations.** "Notes" and "Resources" do not exist in the product or
   the database. They need a definition, or placeholder pages.
5. **Google sign-in.** Page 2 specifies "Continue with Google". Better Auth is
   configured for email/password only; Google OAuth needs a client ID/secret
   and provider wiring before it works.
