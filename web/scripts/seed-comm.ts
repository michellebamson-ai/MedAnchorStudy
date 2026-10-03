/** Seeds communication scenarios (PRACTICE_SPEC.md). Upsert by slug — safe to rerun. */
import { prisma } from "../src/lib/prisma";

const scenarios = [
  {
    slug: "chest-pain-history",
    title: "Chest pain in clinic",
    character: "patient",
    kind: "history-taking",
    difficulty: 2,
    brief:
      "You are in a clinic. A 45-year-old has had chest pain for two days. Take a focused history.",
    opening: "chest-pain",
    rubric: {
      hiddenFacts: [
        "The pain comes on climbing stairs and eases with rest.",
        "There is a family history: father had a heart attack at 52.",
        "The patient smokes about ten cigarettes a day.",
        "There was one episode of sweating and nausea yesterday evening.",
        "Blood pressure medication was stopped two months ago because of cost.",
      ],
      keyQuestions: [
        "Onset, character and timing of the pain",
        "What brings it on and what eases it",
        "Associated symptoms (sweating, nausea, breathlessness)",
        "Cardiac risk factors and family history",
        "Current medications and adherence",
      ],
      osce: [
        "Introduces self and confirms identity",
        "Establishes presenting complaint in open words",
        "Explores onset, character, radiation, timing",
        "Asks about associated symptoms",
        "Covers cardiac risk factors",
        "Asks about medications and adherence",
        "Summarises and checks understanding",
        "Shows empathy at least once",
      ],
    },
    soapRubric: {
      subjective: ["Chest pain for two days", "Exertional pattern", "Risk factors incl. smoking, family history", "Stopped BP medication"],
      objective: ["Vitals and examination findings as given", "ECG and troponin results as given"],
      assessment: ["Likely cardiac chest pain — needs urgent workup"],
      plan: ["ECG now, troponin, cardiology referral, restart secondary prevention discussion"],
    },
  },
  {
    slug: "diabetes-education",
    title: "New diabetes diagnosis",
    character: "patient",
    kind: "health-education",
    difficulty: 2,
    brief:
      "A 58-year-old was told yesterday they have type 2 diabetes. They are confused and frightened. Explain what it means and what changes matter.",
    opening: "diabetes",
    rubric: {
      hiddenFacts: [
        "The patient thinks diabetes means daily injections starting tomorrow.",
        "They drink three sugary sodas a day and did not know it mattered.",
        "Their mother lost vision to diabetes and they fear the same.",
        "They cannot read small print well, so leaflets alone will not work.",
      ],
      keyQuestions: [
        "What the patient already believes about diabetes",
        "Daily habits: food, drink, activity",
        "Specific fears and misconceptions",
        "What support and follow-up they need",
      ],
      osce: [
        "Checks current understanding first",
        "Uses plain language, no jargon",
        "Corrects the injection misconception",
        "Addresses diet with one achievable change",
        "Acknowledges the fear about their mother",
        "Agrees a concrete follow-up",
      ],
    },
    soapRubric: null,
  },
  {
    slug: "bad-news-biopsy",
    title: "Breaking difficult news",
    character: "patient",
    kind: "bad-news",
    difficulty: 4,
    brief:
      "A 60-year-old is here for biopsy results. The result shows cancer. Break the news with honesty and care.",
    opening: "biopsy",
    rubric: {
      hiddenFacts: [
        "The patient suspects bad news already but has not said so.",
        "Their spouse died last year and they live alone.",
        "Their biggest fear is being a burden on their children.",
        "They want to know what happens next, not statistics.",
      ],
      keyQuestions: [
        "Warning shot before the news",
        "Clear, honest statement without jargon",
        "Space and silence after the news",
        "Explores feelings and support at home",
        "Concrete next steps, not statistics",
      ],
      osce: [
        "Sets up a private, unhurried setting",
        "Gives a warning shot",
        "States the diagnosis plainly",
        "Pauses and allows silence",
        "Responds to emotion with empathy",
        "Explores support and next steps",
      ],
    },
    soapRubric: null,
  },
  {
    slug: "child-fever-caregiver",
    title: "Worried parent, feverish child",
    character: "caregiver",
    kind: "interview",
    difficulty: 2,
    brief:
      "A mother brings her 3-year-old with two days of fever. She is anxious and has already tried antibiotics from a neighbour.",
    opening: "fever",
    rubric: {
      hiddenFacts: [
        "The child had one brief febrile seizure this morning — the real reason for panic.",
        "Antibiotics were given yesterday without prescription.",
        "The child is still drinking fluids and passing urine.",
        "The mother works nights and has not slept in two days.",
      ],
      keyQuestions: [
        "Fever pattern and exact timeline",
        "Seizure, rash, breathing, fluid intake, urine",
        "What has already been given",
        "Red-flag explanation and safety netting",
      ],
      osce: [
        "Calms without dismissing",
        "Takes a full fever history",
        "Asks about seizures, rash, breathing, fluids",
        "Addresses the unprescribed antibiotics kindly",
        "Gives clear safety-net advice",
      ],
    },
    soapRubric: null,
  },
  {
    slug: "cholera-community",
    title: "Explaining a cholera outbreak",
    character: "community_leader",
    kind: "outbreak-explaining",
    difficulty: 3,
    brief:
      "Three cholera cases in a riverside settlement. The community leader distrusts outsiders after a past campaign polluted the well. Explain the situation and agree on action.",
    opening: "cholera",
    rubric: {
      hiddenFacts: [
        "Two more households have diarrhoea but are hiding it from officials.",
        "The community believes the river water is safe because it looks clear.",
        "A funeral gathering is planned for Saturday with shared food and water.",
        "The leader will cooperate if chlorination is demonstrated openly, not imposed.",
      ],
      keyQuestions: [
        "Listens to the past grievance first",
        "Explains transmission in plain words",
        "Asks about hidden cases without blame",
        "Addresses the funeral gathering risk",
        "Agrees visible, joint action on water",
      ],
      osce: [
        "Acknowledges past harm before any advice",
        "Explains cholera transmission plainly",
        "Seeks hidden cases sensitively",
        "Negotiates funeral precautions respectfully",
        "Agrees a concrete joint water-safety step",
      ],
    },
    soapRubric: null,
  },
  {
    slug: "smoking-motivational",
    title: "Helping someone consider quitting",
    character: "patient",
    kind: "motivational-interviewing",
    difficulty: 3,
    brief:
      "A 38-year-old smoker with a new baby at home. They are not ready to quit. Use motivational interviewing — no lectures.",
    opening: "smoking",
    rubric: {
      hiddenFacts: [
        "They already feel guilty smoking near the baby.",
        "A previous quit attempt lasted three weeks and ended at a party.",
        "Their partner smokes too, which makes quitting harder.",
        "They would consider cutting down before quitting fully.",
      ],
      keyQuestions: [
        "Open questions about their own view of smoking",
        "Reflects back without judging",
        "Explores ambivalence, not just risks",
        "Affirms strengths and past effort",
        "Agrees a small next step they chose",
      ],
      osce: [
        "Asks permission before advising",
        "Uses open questions throughout",
        "Reflects rather than lectures",
        "Affirms the three-week attempt",
        "Negotiates a patient-chosen next step",
      ],
    },
    soapRubric: null,
  },
];

async function main() {
  for (const s of scenarios) {
    await prisma.commScenario.upsert({
      where: { slug: s.slug },
      create: {
        slug: s.slug,
        title: s.title,
        character: s.character,
        kind: s.kind,
        difficulty: s.difficulty,
        brief: s.brief,
        opening: s.opening,
        rubric: s.rubric as never,
        soapRubric: s.soapRubric as never,
      },
      update: {
        title: s.title,
        character: s.character,
        kind: s.kind,
        difficulty: s.difficulty,
        brief: s.brief,
        opening: s.opening,
        rubric: s.rubric as never,
        soapRubric: s.soapRubric as never,
      },
    });
    console.log("upserted", s.slug);
  }
  console.log("scenarios:", await prisma.commScenario.count());
}

main()
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
