/**
 * Curated evidence library (RESEARCH_SPEC.md §2, open item 1).
 *
 * Until live retrieval lands (Phase 6), search runs over these seeded,
 * honestly-labelled entries. Every takeaway below is textbook-level
 * established fact — no invented findings, no fabricated funding details.
 * Each entry carries a scopeNote saying exactly that. Upsert by identifier.
 */
import { prisma } from "../src/lib/prisma";

interface Seed {
  identifier: string;
  title: string;
  authors: string | null;
  year: number | null;
  publisher: string;
  url: string;
  sourceType: string;
  abstract: string;
  takeaways: string[];
  quality: {
    label: string;
    explanation: string;
    funding: string;
    limitations: string;
    agreement: string;
  };
}

const SCOPE =
  "Seeded library entry — key points summarized for study from the source above. Always check the full text through the link before citing in submitted work.";

const LIBRARY: Seed[] = [
  {
    identifier: "seed:who-hand-hygiene-2009",
    title: "WHO Guidelines on Hand Hygiene in Health Care",
    authors: "World Health Organization",
    year: 2009,
    publisher: "World Health Organization",
    url: "https://www.who.int/publications/i/item/9789241597906",
    sourceType: "clinical_guideline",
    abstract:
      "The WHO's global guideline on hand hygiene in healthcare. It establishes when and how healthcare workers should clean their hands, and introduces the Five Moments framework used in hospitals worldwide.",
    takeaways: [
      "Hand hygiene is the single most important measure against healthcare-associated infection.",
      "The Five Moments: before touching a patient, before clean procedures, after body-fluid risk, after touching a patient, after touching surroundings.",
      "Alcohol-based handrub is preferred when hands are not visibly soiled; soap and water when they are, or after caring for patients with Clostridioides difficile.",
    ],
    quality: {
      label: "High — international clinical guideline",
      explanation: "Developed by WHO with systematic evidence review and global expert consensus. The standard reference worldwide.",
      funding: "Issued by the World Health Organization; development methods are published alongside the guideline.",
      limitations: "Implementation research since 2009 has refined compliance strategies; check local hospital policy for current technique details.",
      agreement: "Consistent with CDC, NICE and national infection-control guidance.",
    },
  },
  {
    identifier: "seed:nice-ng136",
    title: "Hypertension in adults: diagnosis and management (NICE guideline NG136)",
    authors: "National Institute for Health and Care Excellence",
    year: 2023,
    publisher: "NICE",
    url: "https://www.nice.org.uk/guidance/ng136",
    sourceType: "clinical_guideline",
    abstract:
      "The UK NICE guideline on diagnosing and managing hypertension in adults, updated in 2023. It sets diagnostic thresholds and a stepped drug-treatment approach used across UK practice.",
    takeaways: [
      "Clinic blood pressure of 140/90 mmHg or higher suggests hypertension; confirm with ambulatory or home monitoring.",
      "Treatment follows a stepped approach: ACE inhibitor or ARB, calcium-channel blocker, then thiazide-like diuretic, with steps added as needed.",
      "Cardiovascular risk assessment guides how aggressively to treat, not blood pressure alone.",
    ],
    quality: {
      label: "High — national clinical guideline",
      explanation: "Evidence-reviewed recommendations with published methods, updated as new trial evidence appears (latest update 2023).",
      funding: "Issued by NICE, the UK's independent guideline body; methods published alongside.",
      limitations: "Written for UK practice — drug availability and thresholds can differ elsewhere. Always check the current version.",
      agreement: "Broadly consistent with ESC and AHA/ACC hypertension guidance on thresholds and stepped care.",
    },
  },
  {
    identifier: "seed:framingham",
    title: "The Framingham Heart Study: design and long-term findings",
    authors: "National Heart, Lung, and Blood Institute",
    year: 1948,
    publisher: "Framingham Heart Study / NHLBI",
    url: "https://www.framinghamheartstudy.org/",
    sourceType: "peer_reviewed",
    abstract:
      "A landmark long-running cohort study, begun in 1948 in Framingham, Massachusetts. By following thousands of residents over decades it identified the major risk factors for cardiovascular disease.",
    takeaways: [
      "Established smoking, high blood cholesterol and high blood pressure as major cardiovascular risk factors.",
      "Demonstrated the cohort design: follow healthy people over time and compare who develops disease.",
      "Later generations added genetics, imaging and lifestyle factors to the same framework.",
    ],
    quality: {
      label: "High — landmark cohort study",
      explanation: "Decades of follow-up in a defined population; the foundation of modern cardiovascular risk prediction.",
      funding: "Supported by the US National Heart, Lung, and Blood Institute with university partners.",
      limitations: "The original cohort was almost entirely white and middle-class — findings needed confirmation in diverse populations.",
      agreement: "Risk factors confirmed by countless later cohorts worldwide.",
    },
  },
  {
    identifier: "seed:sprint-2015",
    title: "A Randomized Trial of Intensive versus Standard Blood-Pressure Control (SPRINT)",
    authors: "The SPRINT Research Group",
    year: 2015,
    publisher: "New England Journal of Medicine",
    url: "https://www.nejm.org/doi/full/10.1056/NEJMoa1511939",
    sourceType: "peer_reviewed",
    abstract:
      "A large randomized controlled trial asking whether targeting systolic pressure below 120 mmHg beats the standard below 140 mmHg in adults at high cardiovascular risk without diabetes.",
    takeaways: [
      "Intensive control reduced the composite of cardiovascular events and death in this high-risk population.",
      "The benefit came with more adverse events such as hypotension and acute kidney injury.",
      "Guidelines cite SPRINT when recommending lower targets for selected high-risk patients — not for everyone.",
    ],
    quality: {
      label: "High — large randomized trial",
      explanation: "Randomization with hard clinical endpoints; one of the most influential hypertension trials ever run.",
      funding: "US National Institutes of Health programme with published protocol and independent monitoring.",
      limitations: "Excluded people with diabetes, prior stroke and the frail elderly — results do not automatically extend to them.",
      agreement: "Direction consistent with meta-analyses of blood-pressure lowering; exact targets still debated by guideline bodies.",
    },
  },
  {
    identifier: "seed:who-cholera-factsheet",
    title: "Cholera — fact sheet",
    authors: "World Health Organization",
    year: 2024,
    publisher: "World Health Organization",
    url: "https://www.who.int/news-room/fact-sheets/detail/cholera",
    sourceType: "organization",
    abstract:
      "WHO's public fact sheet on cholera: an acute diarrhoeal disease caused by Vibrio cholerae, spread through contaminated water and food, preventable and treatable.",
    takeaways: [
      "Most cases are mild or moderate; severe cases cause rapid dehydration that can kill within hours without treatment.",
      "Oral rehydration is the cornerstone of treatment; antibiotics shorten illness in severe cases.",
      "Safe water, sanitation and oral cholera vaccines prevent outbreaks.",
    ],
    quality: {
      label: "High — WHO fact sheet",
      explanation: "Concise, maintained summary of established knowledge, suitable for teaching and rapid reference.",
      funding: "Issued by the World Health Organization.",
      limitations: "A summary, not a guideline — outbreak response follows dedicated WHO operational guidance.",
      agreement: "Consistent with CDC and standard epidemiology teaching worldwide.",
    },
  },
  {
    identifier: "seed:cdc-principles-epi",
    title: "Principles of Epidemiology in Public Health Practice",
    authors: "Centers for Disease Control and Prevention",
    year: 2012,
    publisher: "CDC",
    url: "https://www.cdc.gov/training/publichealth101/epidemiology.html",
    sourceType: "public_health_guideline",
    abstract:
      "CDC's open training text on applied epidemiology: measures of frequency and association, study designs, outbreak investigation steps, and surveillance.",
    takeaways: [
      "Defines the core measures: incidence, prevalence, attack rate, relative risk, odds ratio.",
      "Lays out the standard outbreak-investigation sequence from case definition to control measures.",
      "Distinguishes descriptive, analytic and experimental epidemiology with worked examples.",
    ],
    quality: {
      label: "High — public-health training reference",
      explanation: "The standard free teaching reference for field epidemiology methods.",
      funding: "Issued by the US Centers for Disease Control and Prevention.",
      limitations: "Teaching material, not a substitute for advanced methods texts on specific designs.",
      agreement: "Aligned with standard epidemiology textbooks everywhere.",
    },
  },
  {
    identifier: "seed:kirkwood-sterne",
    title: "Essential Medical Statistics (2nd edition)",
    authors: "Kirkwood B, Sterne J",
    year: 2003,
    publisher: "Blackwell Science",
    url: "https://www.wiley.com/en-us/Essential+Medical+Statistics%2C+2nd+Edition-p-9780865428713",
    sourceType: "textbook",
    abstract:
      "The classic introductory textbook of medical statistics: descriptive methods, probability, hypothesis testing, regression, survival analysis and study design, all with medical examples.",
    takeaways: [
      "The standard first reference for choosing and interpreting common statistical tests.",
      "Explains p-values, confidence intervals and power in plain, medical language.",
      "Covers the methods behind most papers a student will read: t-tests, chi-square, regression, survival.",
    ],
    quality: {
      label: "Reference — core textbook",
      explanation: "Decades of use in medical statistics teaching; methods covered remain current.",
      funding: "Commercial academic textbook; content peer-reviewed through editions.",
      limitations: "Predates modern guidance on reporting (CONSORT, STROBE) and newer methods — pair with current reporting checklists.",
      agreement: "Consistent with Altman, Bland and other standard texts.",
    },
  },
  {
    identifier: "seed:gordis-epi",
    title: "Gordis Epidemiology (7th edition)",
    authors: "Celentano D, Szklo M",
    year: 2024,
    publisher: "Elsevier",
    url: "https://shop.elsevier.com/books/gordis-epidemiology/celentano/978-0-323-87568-1",
    sourceType: "textbook",
    abstract:
      "The standard undergraduate epidemiology textbook: disease occurrence, study designs, bias and confounding, screening, and outbreak investigation.",
    takeaways: [
      "The clearest student-level treatment of bias, confounding and effect modification.",
      "walks through cohort, case-control and trial designs with landmark examples.",
      "The screening chapter is the classic reference for sensitivity, specificity and predictive values.",
    ],
    quality: {
      label: "Reference — core textbook",
      explanation: "The most widely used epidemiology textbook; regularly revised (7th edition 2024).",
      funding: "Commercial academic textbook.",
      limitations: "Introductory by design — advanced methods need specialist texts.",
      agreement: "Consistent with CDC training material and Rothman where they overlap.",
    },
  },
  {
    identifier: "seed:guyton-physio",
    title: "Guyton and Hall Textbook of Medical Physiology (14th edition)",
    authors: "Hall J, Hall M",
    year: 2020,
    publisher: "Elsevier",
    url: "https://shop.elsevier.com/books/guyton-and-hall-textbook-of-medical-physiology/hall/978-0-323-59712-8",
    sourceType: "textbook",
    abstract:
      "The standard physiology reference: cellular physiology through organ systems, including cardiovascular regulation, renal function and endocrinology.",
    takeaways: [
      "Authoritative mechanism-level explanations (e.g. RAAS, cardiac cycle, renal handling).",
      "The reference behind most physiology teaching worldwide.",
      "Use it to check mechanisms before trusting simplified summaries.",
    ],
    quality: {
      label: "Reference — core textbook",
      explanation: "Continuously revised standard reference; mechanisms presented with primary-literature backing.",
      funding: "Commercial academic textbook.",
      limitations: "A reference, not clinical guidance — treatment decisions follow guidelines, not physiology texts.",
      agreement: "Consistent with Boron & Boulpaep and other major physiology texts.",
    },
  },
  {
    identifier: "seed:who-covid-pheic-end",
    title: "WHO declares end to COVID-19 as a public health emergency of international concern",
    authors: "World Health Organization",
    year: 2023,
    publisher: "WHO News",
    url: "https://www.who.int/news/item/05-05-2023-statement-on-the-fifteenth-meeting-of-the-international-health-regulations-(2005)-emergency-committee-regarding-the-coronavirus-disease-(covid-19)-pandemic",
    sourceType: "news",
    abstract:
      "WHO news release (May 2023): following the Emergency Committee's advice, the Director-General declared the end of COVID-19 as a PHEIC while stressing the virus continues to circulate.",
    takeaways: [
      "The emergency declaration ended in May 2023 on expert-committee advice — not because the virus disappeared.",
      "News reports describe events; the underlying evidence lives in surveillance reports and studies.",
      "Always check the date on health news: guidance changes as evidence accumulates.",
    ],
    quality: {
      label: "Medium — news release, check primary sources",
      explanation: "Accurate report of an official decision, but a news item is a starting point, not evidence itself.",
      funding: "Issued by the World Health Organization.",
      limitations: "Summarises a decision without the underlying committee deliberations — follow the linked statement and data.",
      agreement: "The event itself is uncontested and widely reported.",
    },
  },
  {
    identifier: "seed:cochrane-handbook",
    title: "Cochrane Handbook for Systematic Reviews of Interventions",
    authors: "Higgins JPT, Thomas J, Chandler J, et al.",
    year: 2024,
    publisher: "Cochrane",
    url: "https://training.cochrane.org/handbook",
    sourceType: "textbook",
    abstract:
      "The methods manual for Cochrane systematic reviews: asking answerable questions, searching, assessing bias, synthesizing evidence with and without meta-analysis, and grading certainty.",
    takeaways: [
      "Defines how trustworthy reviews are built: protocol first, comprehensive search, duplicate screening.",
      "Risk-of-bias tools and GRADE certainty ratings are the standard for judging evidence quality.",
      "Essential reading before trusting — or writing — any systematic review.",
    ],
    quality: {
      label: "Reference — methods standard",
      explanation: "The global standard for systematic-review methods, continuously updated.",
      funding: "Maintained by Cochrane, the independent review collaboration.",
      limitations: "Methods guidance, not clinical answers — it tells you how to review, not what reviews conclude.",
      agreement: "Consistent with PRISMA reporting guidance and GRADE working-group methods.",
    },
  },
  {
    identifier: "seed:cdc-vaccines-explainer",
    title: "Explaining How Vaccines Work",
    authors: "Centers for Disease Control and Prevention",
    year: 2024,
    publisher: "CDC",
    url: "https://www.cdc.gov/vaccines/basics/explaining-how-vaccines-work.html",
    sourceType: "government",
    abstract:
      "CDC's plain-language explainer of how vaccines train the immune system, why multiple doses and boosters exist, and how community protection works.",
    takeaways: [
      "Vaccines teach the immune system to recognise a pathogen before real exposure.",
      "Multiple doses and boosters strengthen and extend protection as immunity wanes.",
      "High coverage protects those who cannot be vaccinated — community (herd) protection.",
    ],
    quality: {
      label: "High — public-health explainer",
      explanation: "Clear, maintained public communication of settled immunology.",
      funding: "Issued by the US Centers for Disease Control and Prevention.",
      limitations: "Simplified for the public — schedules and recommendations change; check current national guidance.",
      agreement: "Consistent with WHO and every national immunization programme.",
    },
  },
];

async function main() {
  for (const s of LIBRARY) {
    await prisma.source.upsert({
      where: { identifier: s.identifier },
      create: {
        identifier: s.identifier,
        title: s.title,
        authors: s.authors,
        year: s.year,
        publisher: s.publisher,
        url: s.url,
        sourceType: s.sourceType,
        abstract: s.abstract,
        scopeNote: SCOPE,
        quality: {
          takeaways: s.takeaways,
          label: s.quality.label,
          explanation: s.quality.explanation,
          funding: s.quality.funding,
          limitations: s.quality.limitations,
          agreement: s.quality.agreement,
        } as never,
      },
      update: {
        title: s.title,
        authors: s.authors,
        year: s.year,
        publisher: s.publisher,
        url: s.url,
        sourceType: s.sourceType,
        abstract: s.abstract,
        scopeNote: SCOPE,
        quality: {
          takeaways: s.takeaways,
          label: s.quality.label,
          explanation: s.quality.explanation,
          funding: s.quality.funding,
          limitations: s.quality.limitations,
          agreement: s.quality.agreement,
        } as never,
      },
    });
    console.log("upserted", s.identifier);
  }
  console.log("library:", await prisma.source.count({ where: { userId: null } }));
}

main()
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
