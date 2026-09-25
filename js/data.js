const DATA = (function () {

  /* ============================================================
     TOPICS — power Teach Me Mode, Explain It Back, Summaries
  ============================================================ */
  const TOPICS = [
    {
      id: 'raas',
      title: 'Renin–Angiotensin–Aldosterone System',
      field: 'Physiology',
      icon: '🫀',
      blurb: 'The hormonal cascade that controls blood pressure, sodium, and volume.',
      masterySeed: 62,
      points: [
        'The RAAS is a hormonal cascade that regulates blood pressure, fluid balance, and the body\u2019s handling of sodium and potassium.',
        'It is switched on when the kidney senses low perfusion pressure, low sodium in the filtrate, or sympathetic stimulation.',
        'Detecting cells in the juxtaglomerular apparatus release the enzyme RENIN into the blood.',
        'Renin converts angiotensinogen (made by the liver) into angiotensin I.',
        'ACE — found mainly on lung endothelium — converts angiotensin I into angiotensin II.',
        'Angiotensin II is a POWERFUL vasoconstrictor, and it also stimulates release of aldosterone, stimulates thirst and ADH, and boosts sympathetic activity.',
        'Aldosterone acts on the distal tubule and collecting duct: more sodium is reabsorbed, and potassium and hydrogen are secreted. Water follows sodium. Volume and blood pressure rise.',
        'Net effect: the system defends blood pressure. When overactive (kidney disease, heart failure, chronic hypertension) it damages the heart and kidney long-term.'
      ],
      questions: [
        {
          q: 'Before we name drug classes — from the name and the physiology, what do you think angiotensin II does to the diameter of small arteries?',
          keywords: ['vasoconstrict', 'constrict', 'narrow', 'narrowing', 'smaller', 'shrink'],
          hint: 'Think about its second name: angiotensin II is a powerful arteriolar constrictor. What happens to resistance when vessels constrict?',
          followUp: 'Exactly. Constriction raises systemic vascular resistance — that alone raises blood pressure. And that beats in the background is why blocking it lowers BP.'
        },
        {
          q: 'A patient takes a diuretic and loses sodium and water. Kidney perfusion falls. What would the kidney now release, and what is the logic?',
          keywords: ['renin', 'r\u00e9nin'],
          hint: 'The trigger list from earlier: low perfusion pressure, low sodium at the macula densa, sympathetic drive. What single enzyme is the first step of the cascade?',
          followUp: 'Yes — renin release rises. The whole cascade then builds angiotensin II and aldosterone to defend volume and pressure. That is the kidney \u201cfighting back\u201d against the diuretic.'
        },
        {
          q: 'Deep check: In chronic heart failure this cascade is overactive. Give me ONE harmful effect that chronic overactivation has on the heart or kidneys.',
          keywords: ['remodel', 'remodeling', 'fibrosis', 'scar', 'damage', 'hypertroph', 'pressure', 'proteinuria', 'worsen'],
          hint: 'Consider chronic high pressure load, plus growth signals from angiotensin II on cardiac muscle cells and scarring in the kidney.',
          followUp: 'Right — chronic overactivation drives cardiac remodelling, fibrosis, and kidney injury. That is why blocking this system is a cornerstone of heart-failure therapy.'
        }
      ],
      explain: {
        prompt: 'Now the real test. In your own words, walk me through the full RAAS cascade as if teaching a peer — the trigger, each step, and the final effect on the body.',
        keywords: ['renin', 'angiotensin', 'ace', 'angiotensinogen', 'aldosterone', 'sodium', 'potassium', 'vasoconstrict', 'blood pressure', 'distal tubule', 'kidney', 'volume', 'arteriol', 'juxtaglomerular', 'adrenal'],
        minScore: 4,
        misconceptions: [
          { problem: 'Confusing renin with a direct vasoconstrictor', fix: 'Renin is an enzyme that starts a cascade; ANG II does the vasoconstriction.' },
          { problem: 'Saying steroid binds the proximal tubule', fix: 'Aldosterone acts on the distal tubule / collecting duct — not the proximal tubule.' },
          { problem: 'Thinking ACE inhibitors directly relax vessels', fix: 'ACE inhibitors reduce angiotensin II production; that removal of vasoconstriction is what lowers pressure.' },
          { problem: 'Missing the K\u207a / H\u207a trade-off', fix: 'Aldosterone\u2019s sodium retention is coupled to potassium and hydrogen loss — a big exam favourite.' }
        ]
      },
      caseId: 'case-raas',
      summary: {
        core: 'RAAS is a feedback cascade that defends blood pressure and volume. Trigger \u2192 renin \u2192 angiotensin I \u2192 (ACE) \u2192 angiotensin II \u2192 vasoconstriction + aldosterone.',
        relationships: ['Trigger = low renal perfusion / low distal Na\u207a / sympathetic tone', 'Renin = enzyme from juxtaglomerular cells', 'ANG II = main effector: vasoconstriction, aldosterone, ADH, thirst, sympathetic activation', 'Aldosterone = distal tubule/collecting duct: keep Na\u207a, lose K\u207a and H\u207a'],
        mechanisms: [
          { t: 'Blood pressure down \u2192 kidneys sense it \u2192 renin \u00fc', d: 'Restores pressure by vasoconstrictor + volume mechanisms.' },
          { t: 'Blocking the system lowers BP', d: 'ACE inhibitors / ARBs \u2192 less ANG II \u2192 vasodilation, less aldosterone \u2192 pressure falls, K\u207a may rise.' }
        ],
        highYield: ['ACE inhibitors + ARBs cause mild hyperkalaemia (less aldosterone \u2192 less distal K\u207a secretion).', 'ACE inhibitors are teratogenic — contraindicated in pregnancy.', 'ACE inhibitor cough comes from bradykinin accumulation; ARBs do not cause it.'],
        misconceptions: ['Renin is not a vasoconstrictor', 'Aldosterone is distal, not proximal', 'ACE inhibitors work by removing ANG II, not by direct relaxation'],
        clinical: 'Cornerstone therapy in hypertension, heart failure with reduced EF, and diabetic kidney disease (renoprotection). Monitor potassium and creatinine.',
        formulas: ['BP = CO \u00d7 SVR', 'Na\u207a reabsorption \u2192 water follows \u2192 ECV \u00fc']
      }
    },
    {
      id: 'sens-spec',
      title: 'Sensitivity & Specificity',
      field: 'Biostatistics',
      icon: '🎯',
      blurb: 'The two numbers that tell you how trustworthy a test is.',
      masterySeed: 48,
      points: [
        'A diagnostic test result is never judged alone — we compare it against a gold standard inside a 2\u00d72 table.',
        'Four cells:\n  \u2022 True Positive (TP): diseased, test positive\n  \u2022 False Negative (FN): diseased, test negative\n  \u2022 True Negative (TN): disease-free, test negative\n  \u2022 False Positive (FP): disease-free, test positive',
        'SENSITIVITY = probability a DISEASED person tests positive = TP \u00f7 (TP + FN). High sensitivity = few false negatives = the test rarely misses disease.',
        'SPECIFICITY = probability a HEALTHY person tests negative = TN \u00f7 (TN + FP). High specificity = few false positives.',
        'Sensitivity is about not missing disease (excellent for SCREENING, e.g. HIV ELISA). Specificity is about not over-diagnosing (critical for CONFIRMATION).',
        'They trade off against each other: move the diagnostic cut-off and one rises while the other falls — the ROC curve is the map of that trade-off.',
        'Prevalence matters: a test\u2019s intrinsic sensitivity/specificity are fixed, but its PREDICTIVE VALUES depend heavily on how common the disease is in the population being tested.'
      ],
      questions: [
        {
          q: 'A screening test has 98% sensitivity. A student concludes: \u201cA negative result guarantees the patient is healthy.\u201d Is that reasoning sound? Why or why not?',
          keywords: ['no', 'specificity', 'prevalence', 'negative predictive', 'npv', 'false negative', 'not guaranteed', 'depends'],
          hint: 'Sensitivity only tells you about people WITH disease. To trust a negative result you need the test to be specific AND disease rarity — that is the negative predictive value.',
          followUp: 'Correct. A negative result is only reassuring when specificity is high and prevalence is low — that combination drives up the negative predictive value.'
        },
        {
          q: 'Newborn screening tests favour HIGH SENSITIVITY even if it costs specificity. Why is that a sensible public-health trade-off?',
          keywords: ['miss', 'false negative', 'catch', 'detect', 'rare', 'treatable', 'cost of missing', 'harm'],
          hint: 'What is more harmful in a newborn screen — a false negative that lets a treatable disease go undetected, or a false positive that triggers a confirmatory test?',
          followUp: 'Exactly — for newborn screens, missing a treatable disease is worse; false positives can be resolved with confirmatory testing.'
        },
        {
          q: 'Deep check: prevalence in the tested population is 2%. Predictive positive value of our test... higher, lower, or the same as it would be at 30% prevalence?',
          keywords: ['lower', 'falls', 'decreases', 'drops', 'worse', 'less'],
          hint: 'As disease gets rarer, the pool of false positives becomes large relative to true positives. What does Bayes\u2019 rule say about P(disease | positive)?',
          followUp: 'Yes. At very low prevalence, even a good test yields mainly false positives — PPV collapses. That is why we never screen unselected healthy populations with weak tests.'
        }
      ],
      explain: {
        prompt: 'Explain it back: in your own words, define sensitivity and specificity, draw the 2\u00d72 table in your head, and explain why a high-sensitivity test is preferred for screening.',
        keywords: ['sensitivity', 'specificity', 'true positive', 'false negative', 'true negative', 'false positive', 'disease', 'screening', '2', 'table', 'test', 'positive', 'negative'],
        minScore: 4,
        misconceptions: [
          { problem: 'Sensitivity is \u201cchance the test is right overall\u201d', fix: 'It is P(test \u207a | disease \u207a) — conditioned on TRUE disease, not on being right.' },
          { problem: 'Swapping sensitivity and specificity', fix: 'Sens = TP/(TP+FN): starts with diseased people. Spec = TN/(TN+FP): starts with healthy people.' },
          { problem: 'Forgetting prevalence changes predictive values', fix: 'Intrinsic accuracy is fixed; but PPV/NPV shift with prevalence.' }
        ]
      },
      caseId: 'case-screening',
      summary: {
        core: 'Sensitivity and specificity describe test accuracy. Sensitivity guards against missing disease; specificity guards against false alarms.',
        relationships: ['Sens = TP \u00f7 (TP + FN) \u2192 \u201cno false negatives\u201d', 'Spec = TN \u00f7 (TN + FP) \u2192 \u201cno false positives\u201d', 'PPV = TP \u00f7 (TP + FP); NPV = TN \u00f7 (TN + FN); both depend on prevalence', 'Screening prefers high sensitivity; confirmation prefers high specificity'],
        mechanisms: [
          { t: 'Cut-off moves', d: 'Laxer cut-off \u2192 sensitivity up, specificity down. Stricter cut-off \u2192 the reverse. The ROC curve plots this.' },
          { t: 'Prevalence shifts PPV', d: 'Rarer disease \u2192 more FPs relative to TPs \u2192 PPV falls.' }
        ],
        highYield: ['\u201cSnNout\u201d: high Sensitivity, Negative result rules OUT.', '\u201cSpPin\u201d: high Specificity, Positive result rules IN.', 'Sensitivity is NOT P(T test correct) — it is conditional on true disease status.'],
        misconceptions: ['Confusing sensitivity with overall accuracy', 'Assuming PPV is fixed for a test', 'Thinking a negative test always means healthy'],
        clinical: 'Choosing screening tests (mammography, newborn screens, rapid antigen tests) always involves a sensitivity\u2013specificity trade-off tailored to the setting.',
        formulas: ['Sens = TP \u00f7 (TP + FN)', 'Spec = TN \u00f7 (TN + FP)', 'PPV = TP \u00f7 (TP + FP)', 'NPV = TN \u00f7 (TN + FN)']
      }
    },
    {
      id: 'brachial',
      title: 'Brachial Plexus',
      field: 'Anatomy',
      icon: '🦴',
      blurb: 'The root-to-branch highway of arm innervation — C5\u2013T1.',
      masterySeed: 55,
      points: [
        'The brachial plexus provides nearly all motor and sensory innervation of the upper limb. It is formed from the VENTRAL RAMI of C5, C6, C7, C8, and T1.',
        'It has three functional zones you must walk through like a map: ROOTS \u2192 TRUNKS \u2192 DIVISIONS \u2192 CORDS \u2192 BRANCHES.',
        'Mnemonic to lock it in: \u201cRob Taylor Drinks Cold Beer\u201d = Roots, Trunks, Divisions, Cords, Branches.',
        'Roots (C5\u2013T1) join into three trunks: upper (C5\u2013C6), middle (C7), lower (C8\u2013T1).',
        'Each trunk splits into an anterior and a posterior division. Posterior divisions join to form the POSTERIOR cord; anterior divisions split to become the LATERAL and MEDIAL cords.',
        'The posterior cord ends as the AXILLARY and RADIAL nerves (shoulder abduction by deltoid, elbow/wrist/finger extension).',
        'The lateral cord gives the MUSCULOCUTANEOUS nerve and the lateral root of the MEDIAN nerve (elbow flexion, forearm muscles).',
        'The medial cord gives the ULNAR nerve and the medial root of the median nerve (intrinsic hand muscles, medial forearm).',
        'Famous injuries: Erb\u2013Duchenne (upper trunk C5\u2013C6) — \u201cwaiter\u2019s tip\u201d. Klumpke (lower trunk C8\u2013T1) — \u201cclaw hand\u201d, plus Horner syndrome if T1 sympathetic fibres are torn.'
      ],
      questions: [
        {
          q: 'A trauma patient loses shoulder abduction and can\u2019t extend at the wrist or fingers. Which CORD is most likely injured, and which two major nerves are affected?',
          keywords: ['posterior', 'radial', 'axillary', 'deltoid', 'posterior cord', 'shoulder abduction'],
          hint: 'Posterior division fibres all merge into one cord. Which cord contains the fibres for deltoid (axillary) and wrist/finger extension (radial)?',
          followUp: 'Correct — the posterior cord. Axillary nerve (deltoid) for abduction above ~15\u00b0, and radial nerve (brachioradialis, extensors) for extension.'
        },
        {
          q: 'Why is Erb\u2013Duchenne palsy characteristically held in a \u201cwaiter\u2019s-tip\u201d position — adducted, internally rotated arm?',
          keywords: ['abductor', 'deltoid', 'paralysed', 'paralyzed', 'waiter', 'supraspinatus', 'rotator', 'c5', 'c6', 'external rotator'],
          hint: 'C5\u2013C6 innervate the main shoulder abductors and lateral rotators. Which muscle groups dominate when those are paralysed?',
          followUp: 'Exactly — with C5\u2013C6 (deltoid, supraspinatus, infraspinatus) paralysed, the unopposed adductors and medial rotators pull the arm into the waiter\u2019s-tip posture.'
        },
        {
          q: 'Deep check: Klumpke palsy sometimes includes a drooping eyelid and a constricted pupil. Which nerve fibres and which root explain that?',
          keywords: ['t1', 'sympathetic', 'horner', 'cervical', 'preganglionic'],
          hint: 'T1 carries more than motor fibres — the sympathetic outflow to the face exits the cord with these roots.',
          followUp: 'Right — damage to T1 tears the preganglionic sympathetic fibres, giving the ipsilateral Horner triad (ptosis, miosis, anhidrosis).'
        }
      ],
      explain: {
        prompt: 'Explain it back: walk a peer through the plexus from roots to branches, and describe how you would localise an Erb\u2013Duchenne vs a Klumpke lesion from the exam findings.',
        keywords: ['c5', 'c6', 'c7', 'c8', 't1', 'roots', 'trunks', 'divisions', 'cords', 'branches', 'lateral', 'medial', 'posterior', 'radial', 'ulnar', 'median', 'axillary', 'musculocutaneous', 'erb', 'klumpke', 'waiter', 'claw'],
        minScore: 6,
        misconceptions: [
          { problem: 'Skipping the divisions', fix: 'Roots\u2192trunks\u2192divisions\u2192cords\u2192branches — every cord question relies on knowing where divisions lead.' },
          { problem: 'Median nerve origins', fix: 'Median = lateral root + medial root. Ulnar = purely medial cord.' },
          { problem: 'Erb = lower roots', fix: 'Erb\u2013Duchenne = UPPER trunk (C5\u2013C6). Klumpke = LOWER trunk (C8\u2013T1).' }
        ]
      },
      caseId: 'case-plexus',
      summary: {
        core: 'The brachial plexus is the C5\u2013T1 ventral-rami network that innervates the upper limb: Roots \u2192 Trunks \u2192 Divisions \u2192 Cords \u2192 Branches.',
        relationships: ['Lateral cord: musculocutaneous + lateral root of median', 'Medial cord: ulnar + medial root of median', 'Posterior cord: axillary + radial', 'Upper trunk C5\u2013C6 = Erb\u2013Duchenne; Lower trunk C8\u2013T1 = Klumpke'],
        mechanisms: [
          { t: 'Erb\u2013Duchenne', d: 'C5\u2013C6 avulsion (birth, motorcycle) \u2192 paralysed abductors/external rotators \u2192 waiter\u2019s-tip arm.' },
          { t: 'Klumpke', d: 'C8\u2013T1 (gripping fall) \u2192 paralysed intrinsics \u2192 claw hand; T1 sympathetic tear \u2192 Horner.' }
        ],
        highYield: ['\u201cRob Taylor Drinks Cold Beer\u201d', 'T1 = sympathetic outflow \u2192 Horner with lower-trunk lesions.', 'Posterior cord injury: loses radial + axillary functions.'],
        misconceptions: ['Divisions are sometimes forgotten', 'Ulnar is medial cord, not posterior', 'Erb is upper, Klumpke is lower'],
        clinical: 'Localising peripheral nerve lesions from the physical exam is a classic OSCE and board skill for physiotherapy, medicine, and surgery.',
        formulas: []
      }
    },
    {
      id: 'incidence-prev',
      title: 'Incidence vs Prevalence',
      field: 'Epidemiology',
      icon: '🌍',
      blurb: 'Existing cases versus new cases — and why the difference changes everything.',
      masterySeed: 60,
      points: [
        'PREVALENCE = the proportion of EXISTING cases in a population at a given point (or period) in time. It is a snapshot — like a photo of a reservoir.',
        'INCIDENCE = the rate of NEW cases developing in a population over a period of time, among people who are at risk. It is a video of a stream — flow into the reservoir.',
        'Cumulative incidence counts new cases \u00f7 the population at risk at the start; incidence rate uses person-time and accounts for people who leave mid-study.',
        'The key relationship: PREVALENCE \u2248 INCIDENCE \u00d7 AVERAGE DURATION of disease.',
        'So chronic, long-survival diseases (diabetes, hypertension) have high prevalence relative to incidence; acute, rapidly fatal (or rapidly cure) diseases (norovirus) have low prevalence despite high incidence.',
        'Prevalence changes when: new cases appear (incidence \u00fc), patients live longer (duration \u00fc), or patients leave the population (cure, death, out-migration \u2193).',
        'Cross-sectional surveys measure prevalence — they cannot measure incidence, because incidence requires following people over time to catch NEW events.'
      ],
      questions: [
        {
          q: 'A new treatment prolongs survival in a chronic disease but does not change how many people get it. What happens to prevalence — and to incidence?',
          keywords: ['prevalence', 'increase', 'rises', 'up', 'incidence', 'unchanged', 'same', 'no change'],
          hint: 'Prevalence \u2248 incidence \u00d7 duration. Which of the two factors just changed?',
          followUp: 'Exactly. Survival (duration) rises \u2192 prevalence increases; the incidence of new cases is untouched by treatment given after diagnosis.'
        },
        {
          q: 'Why can ordinary cross-sectional surveys measure prevalence but not incidence?',
          keywords: ['follow', 'time', 'new', 'longitudinal', 'cohort', 'over time', 'no follow-up', 'snapshot'],
          hint: 'To count NEW cases you must watch an at-risk population move across time. What does a cross-sectional survey fundamentally lack?',
          followUp: 'Yes — a snapshot has no time dimension, so you cannot see new events develop. That is the job of cohort and incidence studies.'
        },
        {
          q: 'Deep check: same incidence, but one population has much higher prevalence. Name ONE way that could come about.',
          keywords: ['survival', 'duration', 'chronic', 'longer', 'migration', 'immigration', 'disease', 'chronicity'],
          hint: 'Solve the equation for prevalence: P = I \u00d7 D. If I is identical, what must differ?',
          followUp: 'Duration/survival is the lever. Chronicity, better survival, or selective in-migration of cases all raise prevalence without touching incidence.'
        }
      ],
      explain: {
        prompt: 'Explain it back: contrast incidence and prevalence in your own words, give the equation linking them, and predict what happens to prevalence when a cure is discovered.',
        keywords: ['incidence', 'prevalence', 'new', 'existing', 'cases', 'duration', 'time', 'population', 'at risk', 'survival', 'equation'],
        minScore: 4,
        misconceptions: [
          { problem: 'Using them interchangeably', fix: 'Prevalence is a snapshot (existing), incidence is a movie (new over time).' },
          { problem: 'Denominator errors', fix: 'Incidence excludes people who already have the disease — only the population AT RISK.' },
          { problem: 'Ignoring duration', fix: 'Chronicity is a hidden driver of prevalence.' }
        ]
      },
      caseId: 'case-outbreak',
      summary: {
        core: 'Prevalence is a snapshot of existing cases; incidence is the flow of new cases over time. Prevalence \u2248 incidence \u00d7 duration.',
        relationships: ['New cases \u2192 higher incidence and higher prevalence', 'Longer survival \u2192 higher prevalence, incidence unchanged', 'Cures/deaths \u2192 lower prevalence', 'Cross-sectional surveys = prevalence; cohorts = incidence'],
        mechanisms: [
          { t: 'P = I \u00d7 D', d: 'The single most useful equation: prevalence is incidence multiplied by how long disease lasts.' },
          { t: 'Chronic vs acute', d: 'Same incidence; diabetes has huge prevalence, norovirus minuscule — because of duration.' }
        ],
        highYield: ['Incidence answers \u201chow fast is it spreading\u201d; prevalence answers \u201chow big is the burden now\u201d.', 'Case fatality and cure rate both shorten duration \u2192 lower prevalence.'],
        misconceptions: ['Calling a point-in-time proportion an incidence', 'Counting existing cases in the incidence denominator'],
        clinical: 'Used to plan screening (prevalence), to study causes (incidence), and to allocate resources for chronic disease programmes.',
        formulas: ['Prevalence = existing cases \u00f7 total population (at a time point)', 'Cumulative incidence = new cases \u00f7 population at risk (over period)', 'Prevalence \u2248 Incidence \u00d7 Duration']
      }
    },
    {
      id: 'heart-failure',
      title: 'Heart Failure',
      field: 'Clinical Medicine',
      icon: '❤️',
      blurb: 'When the pump can\u2019t meet demand — neurohormonal compensation and the drugs that tame it.',
      masterySeed: 50,
      points: [
        'Heart failure is a clinical syndrome: the heart cannot pump enough blood for the body\u2019s needs (HFrEF: EF \u2264 40%; HFpEF: EF \u2265 50% with elevated filling pressures).',
        'Most common causes: ischaemic heart disease (past MI), hypertension, valvular disease, and cardiomyopathy.',
        'Symptoms: exertional dyspnoea, orthopnoea, paroxysmal nocturnal dyspnoea, fatigue, and peripheral oedema. Signs: raised JVP, crackles, S3, dependent oedema.',
        'Compensation is initially protective: SNS \u00fc (supports inotropy, but raises afterload & arrhythmias) and RAAS \u00fc (retains volume). Chronic activation drives ventricular remodelling and worsening.',
        'On the left, blood backs up \u2192 pulmonary congestion. On the right, it backs up systemically \u2192 ankle, sacral oedema and JVP elevation.',
        'Cornerstone drugs: ACE inhibitor / ARB or ARNI, beta-blocker, mineralocorticoid (spironolactone) antagonist, SGLT2 inhibitor, and loop diuretics for congestion.',
        'BNP / NT-proBNP is an excellent biomarker: raised with wall stretch — helps diagnose, grade severity, and monitor.',
        'The modern triad of care is simple to remember: neurohormonal blockade (EF drugs), volume control (diuretics), and lifestyle / device therapy (CRT, ICD) in selected patients.'
      ],
      questions: [
        {
          q: 'Why does the same failing heart produce both breathlessness AND swollen ankles?',
          keywords: ['left', 'right', 'pulmonary', 'congestion', 'oedema', 'edema', 'pressure', 'backlog', 'back up'],
          hint: 'Separate the two sides of the circulation. What happens downstream of a failing left ventricle versus a failing right ventricle?',
          followUp: 'Exactly — left-sided failure backs pressure into the lungs (dyspnoea, orthopnoea), and right-sided failure backs pressure into the systemic veins (oedema, JVP).'
        },
        {
          q: 'We give beta-blockers to a heart that is ALREADY weak. That sounds counterintuitive. Give the rational physiological argument.',
          keywords: ['sympathetic', 'remodel', 'remodeling', 'afterload', 'workload', 'oxygen', 'energy', 'mortality', 'long term', 'heart rate'],
          hint: 'Short-term an inotrope feels good; chronically, the sympathetic overdrive injures the heart. What is blockaded and which pathological process slows?',
          followUp: 'Right — blocking sympathetic overdrive reduces myocardial oxygen demand, remodelling, and arrhythmic death. The long-term mortality benefit outweighs an early dip in contractile support.'
        },
        {
          q: 'Deep check: someone with HFrEF gets repeated infusions of a strong positive inotrope and feels better each time. Predict the long-term outcome, and explain the mechanism.',
          keywords: ['worse', 'remodel', 'arrythmia', 'arrhythmia', 'mortality', 'energy', 'cost', 'demand', 'damage', 'fails to help'],
          hint: 'More calcium influx and stronger contraction = more oxygen and stress on already failing muscle. What does the remodelling process do in response?',
          followUp: 'Good reasoning — chronic inotrope drive increases energy demand, worsens myocyte injury and remodelling, and raises arrhythmia risk: symptom relief now, harm later.'
        }
      ],
      explain: {
        prompt: 'Explain it back: define heart failure, explain the two heads (HFrEF vs HFpEF), why the sympathetic and RAAS systems are double-edged, and name the four cornerstones of therapy with a one-line rationale each.',
        keywords: ['ejection fraction', 'hfre', 'hfpef', 'dyspnoea', 'dyspnea', 'oedema', 'edema', 'raas', 'sympathetic', 'remodel', 'ace', 'beta-blocker', 'diuretic', 'sglt2', 'spironolactone', 'bnp', 'congest'],
        minScore: 6,
        misconceptions: [
          { problem: 'HFrEF = low output; HFpEF = high output', fix: 'Both are low-output syndromes; the split is EJECTION FRACTION and filling pressures, not output.' },
          { problem: 'Diuretics are the primary disease-modifying drugs', fix: 'Diuretics relieve symptoms; neurohormonal blockers change the disease course.' },
          { problem: 'Beta-blockers never in \u201cweak\u201d hearts', fix: 'Chronic sympathetic blockade is one of the biggest mortality wins in stable HFrEF.' }
        ]
      },
      caseId: 'case-hf',
      summary: {
        core: 'Heart failure = pump unable to meet demand. Left failure \u2192 pulmonary congestion; right failure \u2192 systemic congestion. Neurohormonal overdrive drives progression.',
        relationships: ['HFrEF: EF \u2264 40%', 'HFpEF: EF \u2265 50%, elevated filling pressures', 'BNP rises with wall stretch', 'SNS & RAAS: compensatory short-term, damaging long-term'],
        mechanisms: [
          { t: 'Backward failure', d: 'Pressure backs up behind the failing chamber \u2192 lungs (left) or systemic veins (right).' },
          { t: 'Neurohormonal cascade', d: 'Falling output \u2192 SNS + RAAS \u00fc \u2192 salt/water retention + remodelling \u2192 progressive dysfunction.' }
        ],
        highYield: ['Quadruple therapy (HFrEF): ACEi/ARB/ARNI + BB + MRA + SGLT2i.', 'Loop diuretics treat congestion, not mortality.', 'New-onset HF + broad QRS \u2192 assess for CRT; post-MI scar \u2192 ICD.'],
        misconceptions: ['HFpEF = \u201cnot really HF\u201d', 'Diuretics = disease-modifying', 'Beta-blockers contraindicated in HF'],
        clinical: 'Cornerstone of cardiology practice; recognise decompensation (worsening dyspnoea, rising weight, U&E and BNP changes) and titrate neurohormonal therapy.',
        formulas: ['EF = stroke volume \u00f7 end-diastolic volume \u00d7 100', 'BNP \u00fc with wall stretch']
      }
    }
  ];

  /* ============================================================
     CASES — Clinical & Public-Health Case Practice
  ============================================================ */
  const CASES = [
    {
      id: 'case-raas',
      title: 'The Unwell Caregiver on ACE Inhibitor Therapy',
      field: 'Clinical Medicine',
      icon: '🏥',
      difficulty: 'Intermediate',
      scenario: 'Mrs. Adeyemi, 68, has chronic heart failure and takes lisinopril (ACE inhibitor) plus a loop diuretic. After a bout of vomiting and poor intake for 3 days, she feels weak, confused, and is urinating less. BP 94/62, HR 98, her lips feel tingly, and ECG shows peaked T waves. Her potassium came back at 6.4 mmol/L and creatinine has doubled.',
      steps: [
        {
          q: 'List the physiological triggers in this story that turned on her RAAS.',
          expected: ['Dehydration/lower perfusion → kidney senses low pressure', 'Low sodium delivery to distal nephron', 'Sympathetic activation', 'Diuretic effect ongoing'],
          keywords: ['dehydr', 'volume', 'perfusion', 'pressure', 'diuretic', 'vomit', 'intake']
        },
        {
          q: 'Her potassium is 6.4 with peaked T waves. Connect ACE-inhibitor therapy to this hyperkalaemia.',
          expected: ['Less ANG II → less aldosterone', 'Aldosterone normally drives distal K⁺ secretion', 'Reduced K⁺ loss → serum K⁺ rises'],
          keywords: ['aldosterone', 'angiotensin', 'distal', 'secret', 'potassium', 'less']
        },
        {
          q: 'What is your immediate management priority, and what specific intervention targets the potassium?',
          expected: ['Stabilise membrane: IV calcium gluconate', 'Shift K⁺ into cells: insulin + dextrose, nebulised salbutamol', 'Remove K⁺: diuretic/renal replacement as needed', 'Withhold ACE inhibitor + review diuretic'],
          keywords: ['calcium', 'calcium gluconate', 'insulin', 'salbutamol', 'shift', 'hold', 'withhold', 'stop', 'ecg']
        },
        {
          q: 'Give ONE reason we do not simply stop all her cardiac medication and discharge her — connect to the bigger picture of heart-failure care and the ACE-inhibitor benefit.',
          expected: ['ACE inhibitors are disease-modifying (mortality benefit, reverse remodelling)', 'We treat the precipitant (dehydration) and restart ACE inhibitor once volume/K⁺ improve', 'Avoiding future dehydration is key'],
          keywords: ['mortality', 'remodel', 'disease modifying', 'restart', 'precipitant', 'dehydration', 'counselling', 'sick day rule']
        }
      ],
      feedback: 'This case ties the RAAS loop to a real emergency: dehydration from the diuretic reduced renal perfusion, the ACE inhibitor removed the aldosterone \u2018escape hatch\u2019 for potassium, and hyperkalaemia declared itself on the ECG. The classic \u2018sick day rule\u2019 — hold ACE inhibitor/ARB and diuretics during vomiting/illness and rehydrate — is exactly what students are expected to know.',
      refTopic: 'raas'
    },
    {
      id: 'case-screening',
      title: 'Is This Rapid Test Good Enough for a National Screening Programme?',
      field: 'Public Health',
      icon: '🧪',
      difficulty: 'Advanced',
      scenario: 'The ministry evaluates a cheap point-of-care antigen test for a chronic infection. Against the gold standard (PCR) in 1000 people, results were: 180 true positives, 20 false negatives, 720 true negatives, 80 false positives.',
      steps: [
        {
          q: 'Build the 2×2 table. What is the sensitivity and what is the specificity? Show your arithmetic.',
          expected: ['Sens = 180/(180+20) = 90%', 'Spec = 720/(720+80) = 90%', 'TP 180, FN 20, TN 720, FP 80'],
          keywords: ['90', '180', '20', '720', '80', 'sensitivity', 'specificity']
        },
        {
          q: 'The lab director says the test is \u201cmisclassified 10% of the time, so it is only 90% accurate overall.\u201d Why is that a flawed oversimplification?',
          expected: ['Accuracy is not the only metric', 'Sensitivity and specificity answer different clinical questions', 'Misclassification has asymmetric real-world cost depending on use'],
          keywords: ['accuracy', 'sensitivity', 'specificity', 'different', 'cost', 'false', 'clinical', 'conditional']
        },
        {
          q: 'Now the programme intends to screen a LOW-prevalence (2%) community. Predict what happens to the positive predictive value, and explain why.',
          expected: ['PPV falls sharply', 'Few true positives, many false positives at low prevalence', '90% specificity in a mostly-healthy population produces many FPs'],
          keywords: ['low', 'fall', 'drop', 'decrease', 'false positive', 'prevalence', 'ppv', 'predictive']
        },
        {
          q: 'Recommend ONE design decision that preserves sensitivity while rescuing specificity at low prevalence, and justify it.',
          expected: ['Two-step / confirmatory testing of positives', 'Raise the test threshold after screening', 'Restrict screening to higher-risk groups'],
          keywords: ['conform', 'confirm', 'second', 'retest', 'two step', 'threshold', 'risk group', 'target']
        }
      ],
      feedback: 'The takeaway: a 90/90 test can still terrorise a low-prevalence programme, because predictive values ride on prevalence, not just intrinsic accuracy. Public-health screening is a systems design problem — the test, the population, and the confirmatory pathway all matter.',
      refTopic: 'sens-spec'
    },
    {
      id: 'case-plexus',
      title: 'The Motorcycle Crash — Localise the Plexus Lesion',
      field: 'Clinical Anatomy',
      icon: '🏍️',
      difficulty: 'Intermediate',
      scenario: 'A 24-year-old motorcyclist is thrown over the handlebars, landing on the side of his head and neck. On exam, the right arm hangs adducted and internally rotated, the forearm is pronated, and he cannot abduct the shoulder above 15° or flex the elbow. Sensation is lost over the lateral arm and forearm. No hand signs of interest.',
      steps: [
        {
          q: 'Name the most likely site of injury and the two root values involved. Justify with the motor findings.',
          expected: ['Erb–Duchenne palsy — upper trunk', 'C5–C6', 'Deltoid, supraspinatus, biceps/brachialis all C5–C6 → abducted, externally rotated posture lost'],
          keywords: ['erb', 'upper trunk', 'c5', 'c6', 'deltoid', 'supraspinatus', 'shoulder', 'abduct']
        },
        {
          q: 'Why exactly does the arm sit adducted and internally rotated rather than simply limp?',
          expected: ['Opposing unparalysed muscles act unopposed', 'Pectoralis major, latissimus dorsi, subscapularis/teres major pull arm in and medially'],
          keywords: ['unopposed', 'pectoral', 'latissimus', 'subscapular', 'teres', 'medial', 'adduct', 'unopposed']
        },
        {
          q: 'The patient now develops a drooping right eyelid and a constricted pupil on the same side. Trace the nerve pathway that explains this.',
          expected: ['T1 preganglionic sympathetic fibres run with the lower trunk', 'If injury extends to T1 → loss of sympathetic outflow to the face → Horner syndrome'],
          keywords: ['t1', 'sympathetic', 'horner', 'preganglionic', 'ptosis', 'miosis', 'lower trunk']
        },
        {
          q: 'What key physical exam feature distinguishes the pure upper-trunk lesion from a cord-level injury, and why is this important for neurosurgical planning?',
          expected: ['Preserved intrinsic hand function + posterior cord functions (wrist/finger extension) if pure upper trunk', 'Distinguishes root avulsion (poor prognosis, consider nerve transfer) from trunk injury'],
          keywords: ['intrinsic', 'hand', 'posterior cord', 'avulsion', 'nerve transfer', 'prognosis', 'radial']
        }
      ],
      feedback: 'Applying the root map: C5–C6 failure = Erb–Duchenne. Check for the T1 sympathetic hitchhiker (Horner) because it upgrades the diagnosis to lower involvement/avulsion and changes surgical planning. Motor patterns, not a memorised list, are what localise the lesion.',
      refTopic: 'brachial'
    },
    {
      id: 'case-outbreak',
      title: 'Outbreak in a Boarding School — Incidence, Attack Rates, and a Bias Check',
      field: 'Epidemiology',
      icon: '🦠',
      difficulty: 'Advanced',
      scenario: 'A viral gastroenteritis outbreak hits a 400-student boarding school. At the start of week 1, 40 students are ill. By the end of week 1, 120 new students develop symptoms. An inspector reports \u201cthe incidence is 160 cases.\u201d',
      steps: [
        {
          q: 'Critique the inspector\u2019s statement. What is actually wrong, and what was the cumulative incidence over week 1?',
          expected: ['Called existing 40 cases part of incidence', 'Cumulative incidence = 120/360 (population at risk excluding the initial 40) ≈ 33%', 'Correctly report incidence as new cases among at-risk'],
          keywords: ['new', 'incidence', 'at risk', '120', '360', '33', 'denominator', 'existing']
        },
        {
          q: 'The outbreak resolves in 5 days in nearly everyone. Would you expect this disease to have a high prevalence in the community afterwards? Explain using the incidence–prevalence equation.',
          expected: ['Low prevalence', 'Duration is short (acute, self-limiting)', 'P ≈ I × D → short D, small P'],
          keywords: ['low', 'short', 'duration', 'prevalence', 'acute', 'transient', 'self limiting']
        },
        {
          q: 'A survey of the same school taken on Monday would measure prevalence; a study that follows students through finals week would measure incidence. Distinguish the design implied by each.',
          expected: ['Cross-sectional survey = point prevalence', 'Cohort/follow-up = incidence', 'Incidence needs the population at risk followed over time'],
          keywords: ['cross', 'cohort', 'follow', 'prevalence', 'incidence', 'design', 'at risk']
        },
        {
          q: 'The study team worried that students who ate cafeteria lunch were more likely to report symptoms than those who ate packed meals. Name this bias and why it matters for the attack-rate comparison.',
          expected: ['Recall / reporting bias (differential outcome misclassification)', 'If reported illness is linked to exposure, the exposure–outcome association distorts', 'Use laboratory-confirmed cases or blind measurement'],
          keywords: ['recall', 'reporting', 'misclassification', 'bias', 'measurement', 'surveillance', 'detection', 'differential']
        }
      ],
      feedback: 'Epidemiologists live on three habits this case entrenches: keep \u2018new\u2019 out of the prevalence pot, remember P = I × D, and suspect biased measurement before believing a risk difference. Acute, short-duration pathogens make terrible high-prevalence survivors — their epidemic is fast, loud, and brief.',
      refTopic: 'incidence-prev'
    }
  ];

  /* ============================================================
     FLASHCARDS — high-yield active recall
  ============================================================ */
  const FLASHCARDS = [
    { id: 'fc1', topic: 'raas', q: 'First step of the RAAS: which cells release renin, and what triggers them?', a: 'Juxtaglomerular cells of the kidney; triggered by low renal perfusion, low distal Na⁺, and sympathetic activation.', style: 'Cause and effect', seed: 1 },
    { id: 'fc2', topic: 'raas', q: 'Where does ACE mostly live, and what does it do?', a: 'Lung endothelium; converts angiotensin I → angiotensin II.', style: 'Definition', seed: 1 },
    { id: 'fc3', topic: 'raas', q: 'What happens to serum potassium when you start an ACE inhibitor — and why?', a: 'K⁺ rises: less angiotensin II → less aldosterone → reduced distal K⁺ secretion.', style: 'Clinical application', seed: 1 },
    { id: 'fc4', topic: 'sens-spec', q: 'Sensitivity = ? What does a high-sensitivity negative result rule out?', a: 'TP ÷ (TP + FN). Rules OUT disease (SnNout).', style: 'High-yield fact', seed: 2 },
    { id: 'fc5', topic: 'sens-spec', q: 'What does the \u2018SpPin\u2019 rule tell you?', a: 'High specificity, positive result rules IN disease.', style: 'Definition', seed: 2 },
    { id: 'fc6', topic: 'sens-spec', q: 'Prevalence drops from 30% to 2%. What happens to PPV, and why?', a: 'PPV falls: false positives swamp true positives among mostly-healthy testees.', style: 'Clinical application', seed: 2 },
    { id: 'fc7', topic: 'brachial', q: 'Recite the brachial plexus chain and the mnemonic.', a: 'Roots → Trunks → Divisions → Cords → Branches. \u201cRob Taylor Drinks Cold Beer\u201d (C5–T1).', style: 'Definition', seed: 1 },
    { id: 'fc8', topic: 'brachial', q: 'Erb–Duchenne: which roots, which posture, which lesion mechanism?', a: 'Upper trunk C5–C6 (birth injury, shoulder traction) → waiter\u2019s-tip arm: adducted, internally rotated, pronated.', style: 'Compare and contrast', seed: 1 },
    { id: 'fc9', topic: 'brachial', q: 'Klumpke palsy: roots, findings, plus which extra sign if T1 sympathetic fibres tear?', a: 'Lower trunk C8–T1 → claw hand, weak intrinsics; Horner syndrome (ptosis, miosis, anhidrosis) if T1 sympathetic involved.', style: 'High-yield fact', seed: 1 },
    { id: 'fc10', topic: 'incidence-prev', q: 'The prevalence equation — and what happens if a cure shortens disease duration?', a: 'Prevalence ≈ Incidence × Duration. Cure/rapid death → shorter duration → lower prevalence.', style: 'Cause and effect', seed: 2 },
    { id: 'fc11', topic: 'incidence-prev', q: 'Why do cross-sectional surveys measure prevalence but not incidence?', a: 'A snapshot has no time dimension; counting NEW cases requires following the population at risk over time (cohort design).', style: 'Concept explanation', seed: 2 },
    { id: 'fc12', topic: 'heart-failure', q: 'Name the four pillars of HFrEF medical therapy.', a: 'ACEi/ARB/ARNI + beta-blocker + mineralocorticoid receptor antagonist + SGLT2 inhibitor (quadruple therapy).', style: 'High-yield fact', seed: 1 },
    { id: 'fc13', topic: 'heart-failure', q: 'Left-sided failure → which congestion? Right-sided → which?', a: 'Left → pulmonary congestion (dyspnoea, orthopnoea, PND, crackles). Right → systemic (oedema, raised JVP, hepatic congestion).', style: 'Compare and contrast', seed: 1 },
    { id: 'fc14', topic: 'heart-failure', q: 'Why does chronic sympathetic activation hurt the failing heart despite supporting it short-term?', a: 'Raises MVO₂ demand, afterload, arrhythmias and drives pathological remodelling → progressive decline despite stronger beats.', style: 'Cause and effect', seed: 1 }
  ];

  /* ============================================================
     BIOSTATISTICS & RESEARCH METHODS COACH modules
  ============================================================ */
  const BIOSTATS = [
    {
      id: 'bs1',
      title: 'Mean, Median & Standard Deviation',
      icon: '📊',
      steps: [
        { type: 'content', title: 'Why you care', body: 'Measures of centre and spread tell you what a \u201ctypical\u201d patient looks like and how much trust to put in a summary. In the clinics you\u2019ll see \u201cmean BP is 118 (SD 9)\u201d — every part of that sentence is a judgment call about distribution.' },
        { type: 'content', title: 'Centre: mean vs median', body: 'The mean (average) is pulled by outliers; the median (middle value) is robust. If a skewed variable like hospital stay is reported as mean, be suspicious — one 90-day outlier is dragging it up. Report mean for symmetric data, median for skewed.' },
        { type: 'calc', title: 'Worked example', problem: 'Length of stay (days): 3, 4, 5, 6, 22.', steps: [
          'Mean = (3+4+5+6+22) ÷ 5 = 8.0 days.',
          'Median = middle value of the ordered set = 5 days.',
          'The lone 22-day outlier pulls the mean far above the median — a skewed distribution.',
          'Conclusion: report the median here; the mean is misleading.'
        ] },
        { type: 'content', title: 'Spread: standard deviation', body: 'SD describes how far values sit from the mean. For roughly normal data, ~68% live within 1 SD, ~95% within 1.96 SD. A large SD relative to the mean often flags skew or outliers.' },
        { type: 'check', title: 'Check yourself', question: 'A skewed dataset: which single summary (mean or median) should you present, and why?', keywords: ['median', 'skew', 'outlier', 'robust'], accept: 'Report the median because it is robust to the skew/outliers that distort the mean.' }
      ]
    },
    {
      id: 'bs2',
      title: 'Probability Fundamentals',
      icon: '🎲',
      steps: [
        { type: 'content', title: 'Why you care', body: 'Every stat result is a probability story. Sensitivity, P-values, and risk all reduce to \u201cwhat fraction of outcomes\u201d. Clicking through conditional probability is the single best investment you can make.' },
        { type: 'content', title: 'The rules', body: 'P(A or B) = P(A) + P(B) − P(A and B). P(A and B) = P(A) × P(B|A) when events are not independent. Independence only if P(B|A) = P(B).' },
        { type: 'calc', title: 'Worked example', problem: 'Test: sensitivity 90%, specificity 90%. Prevalence 10%. If the test is positive, what is the probability the person is truly diseased (PPV)?', steps: [
          'Cohort of 1000 people: 100 diseased, 900 healthy (10% prevalence).',
          'True positives: 90% × 100 = 90. False positives: 10% × 900 = 90.',
          'Total positive results = 180. PPV = 90 ÷ 180 = 50%.',
          'A 90/90 test at 10% prevalence is a coin flip when positive — prevalence does this to you.'
        ] },
        { type: 'check', title: 'Check yourself', question: 'In the example, why is the PPV only 50% despite 90% sensitivity and specificity?', keywords: ['prevalence', 'false positive', 'subject', 'bayes', 'prior'], accept: 'True positives are overwhelmed by false positives because disease is rare — Bayes\u2019 theorem: the prior (prevalence) sets the ceiling.' }
      ]
    },
    {
      id: 'bs3',
      title: 'Sensitivity, Specificity & 2×2 Tables',
      icon: '🎯',
      steps: [
        { type: 'content', title: 'Setting up the table', body: 'Rows = test result, columns = truth. The four cells are TP, FP, FN, TN. Every accuracy term is one ratio built from these cells — set the table up every single time.' },
        { type: 'content', title: 'The two directions', body: 'Sensitivity looks DOWN the diseased column: TP ÷ (TP+FN) — \u201cof everyone with disease, how many did we catch?\u201d. Specificity looks down the healthy column: TN ÷ (TN+FP).' },
        { type: 'calc', title: 'Worked example', problem: 'Screening 2000 people for diabetes. Gold standard: 240 have diabetes. Test: 216 of the 240 test positive; of 1760 healthy, 88 test positive.', steps: [
          'TP = 216, FN = 240 − 216 = 24. TN = 1760 − 88 = 1672. FP = 88.',
          'Sensitivity = 216 ÷ 240 = 90%.',
          'Specificity = 1672 ÷ 1760 = 95%.',
          'PPV = 216 ÷ (216+88) = 71%. NPV = 1672 ÷ (1672+24) = 98.6%.',
          'High NPV here because disease is uncommon — negatives are very trustworthy.'
        ] },
        { type: 'check', title: 'Check yourself', question: 'If the programme screened younger (2% prevalence) instead, which change is the MOST dramatic — sensitivity, specificity, PPV, or NPV?', keywords: ['ppv', 'positive predictive', 'falls', 'drops', 'decreases'], accept: 'PPV falls the most. Sensitivity/specificity are prevalence-independent; predictive values are not.' }
      ]
    },
    {
      id: 'bs4',
      title: 'Risk Ratios & Odds Ratios',
      icon: '⚖️',
      steps: [
        { type: 'content', title: 'Why you care', body: 'RR and OR quantify \u201chow much more likely is the outcome in the exposed group\u201d. They are the workhorse effect measures of aetiology — interpreting them correctly decides whether a finding is \u2018big\u2019 or \u2018noise\u2019.' },
        { type: 'content', title: 'RR vs OR', body: 'RR = risk in exposed ÷ risk in unexposed (needs incidence — cohorts, trials). OR = odds exposed among cases ÷ odds exposed among controls (case–control). For rare outcomes OR ≈ RR; for common outcomes OR exaggerates.' },
        { type: 'calc', title: 'Worked example', problem: 'Smoking and lung cancer: exposed — 90 of 1000 develop disease; unexposed — 10 of 1000 develop disease. Plus a case–control study whose OR is 12.0.', steps: [
          'Risk exposed = 90/1000 = 9%. Risk unexposed = 1%.',
          'RR = 9% ÷ 1% = 9.0 → smokers have 9× the risk.',
          'OR in the case–control = 12.0. Part of the gap vs RR 9 is that OR overestimates when outcomes are common.',
          'Interpretation frame: RR 9 and OR 12 are both \u201cstrong\u201d associations — but they answer different questions.'
        ] },
        { type: 'check', title: 'Check yourself', question: 'Why does the OR exaggerate beyond the RR when an outcome is common?', keywords: ['odds', 'ratio', 'common', 'prevalence', 'overestimate', 'rare'], accept: 'Odds grow faster than probability as the outcome becomes common; OR approximates RR only when the outcome is rare.' }
      ]
    },
    {
      id: 'bs5',
      title: 'Confidence Intervals',
      icon: '📏',
      steps: [
        { type: 'content', title: 'What a CI really is', body: 'A 95% CI is the range that would contain the true effect in ~95 of 100 hypothetical repeated studies. It communicates how PRECISE the estimate is — narrow = stable, wide = unstable/small sample.' },
        { type: 'content', title: 'Reading it', body: 'For a ratio (RR, OR, HR) the null value is 1; for a difference it is 0. If the CI excludes the null, the result is \u201cstatistically significant\u201d. But precision and clinical meaning are separate judgments — a tight CI around a trivial effect is still a trivial effect.' },
        { type: 'calc', title: 'Worked example', problem: 'A trial reports RR 1.30 for the composite outcome. Interpret each CI:', steps: [
          'Case A: 95% CI 1.10–1.55 → excludes 1 → significant, consistent with roughly 10–55% relative increase.',
          'Case B: 95% CI 0.98–1.65 → includes 1 → compatible with no effect; not significant.',
          'Case C: 95% CI 1.02–1.03 → significant and precise, but the effect is clinically nil (2–3% relative).',
          'Lesson: significance ≠ size; look at where the interval sits, not just whether it avoids the null.'
        ] },
        { type: 'check', title: 'Check yourself', question: 'A 95% CI from a 40-person study vs one from a 4000-person study — how do the widths typically compare, and why?', keywords: ['narrow', 'wide', 'larger', 'sample size', 'precision', 'width'], accept: 'Larger samples shrink the CI (less sampling error) — the 4000-person CI is typically far narrower.' }
      ]
    },
    {
      id: 'bs6',
      title: 'Hypothesis Testing & P-values',
      icon: '❓',
      steps: [
        { type: 'content', title: 'The logic in one breath', body: 'Assume the null (no effect). Ask: if the null were true, how surprising is this data? A p-value is that surprise — the probability of data at least this extreme under the null.' },
        { type: 'content', title: 'What p<0.05 means — and does NOT', body: 'It means \u201cunder the null, this (or more extreme) is found in <5% of repeats\u201d. It does NOT mean 5% chance the null is true, nor \u201c95% chance the effect is real\u201d, nor the probability the result is clinically important. Small p = evidence against the null, not an effect-size statement.' },
        { type: 'content', title: 'Sidedness, errors, power', body: 'One-sided tests are usually unacceptable without a pre-specified direction. Type I error = wrongly rejecting a true null (α, typically 0.05). Type II = failing to reject a false null (β); power = 1 − β and rises with N and effect size.' },
        { type: 'check', title: 'Check yourself', question: 'Is \u201cthere is a 3% chance the null hypothesis is true\u201d a correct reading of p = 0.03?', keywords: ['no', 'not', 'null', 'probability of data', 'bayes', 'false'], accept: 'No. p is computed assuming the null is true — it is P(data | null), not P(null | data). That inversion is the single most common error in medicine.' }
      ]
    },
    {
      id: 'bs7',
      title: 'Study Designs & Sampling',
      icon: '🔬',
      steps: [
        { type: 'content', title: 'The ladder of evidence', body: 'RCT \u2192 cohort \u2192 case–control \u2192 cross-sectional \u2192 case series — a rule of thumb, not a law. Randomisation is the unique strength of the RCT: it balances unknown confounders between groups at baseline.' },
        { type: 'content', title: 'Which design when?', body: 'Rare outcome → cohort (follow forward) or case–control (mine records backward). New/rapid outcome → cohort. Prevalence of a condition → cross-sectional. Harm/rare exposure in pregnancy → often case–control or registry.' },
        { type: 'content', title: 'Sampling traps', body: 'Convenience vs probability sampling. Selection bias hides in how people got into the study; measurement bias hides in how variables got measured. Every reported \u2018representative\u2019 sample deserves a sceptical look at who was left out.' },
        { type: 'check', title: 'Check yourself', question: 'You want to show a new vaccine reduces a rare disease. Pick the design and name the ONE feature that makes it most convincing.', keywords: ['rct', 'randomis', 'randomized', 'randomised', 'blinding', 'blinded'], accept: 'An RCT (randomised, ideally blinded) — randomisation is the best defence against confounding.' }
      ]
    },
    {
      id: 'bs8',
      title: 'Bias & Confounding',
      icon: '🕳️',
      steps: [
        { type: 'content', title: 'Bias is design, confounding is epidemiology', body: 'BIAS distorts the measurement or the selection (systematic error — you can\u2019t fix it with statistics). CONFOUNDING is a third variable causally linked to both exposure and outcome that makes the observed association misleading.' },
        { type: 'content', title: 'The confounder recipe', body: 'A confounder must be associated with the exposure AND independently with the outcome AND not on the causal path. Control options: restriction, matching, stratification, adjustment (regression), randomisation.' },
        { type: 'content', title: 'Bias highlights', body: 'Recall bias (cases remember exposures differently), selection bias (who drops out), healthy-worker effect (workers are fitter than the general public), lead-time bias (early diagnosis only looks like longer survival). Become fluent at spotting these; they are exam gold and practice critical.' },
        { type: 'check', title: 'Check yourself', question: 'Coffee-drinkers appear to have more lung cancer. Give one confounding variable that could explain the association without coffee causing cancer.', keywords: ['smoking', 'tobacco', 'confound', 'smoke'], accept: 'Smoking — smokers drink more coffee and develop more lung cancer. Adjust for smoking: the link usually collapses.' }
      ]
    },
    {
      id: 'bs9',
      title: 'Epidemiological Measures (Rates & Ratios)',
      icon: '📈',
      steps: [
        { type: 'content', title: 'Attack rates, CFR, and mortality', body: 'Attack rate = new cases ÷ population at risk during an outbreak. Case fatality rate = deaths among CASES only. Cause-specific mortality = deaths from that cause ÷ population. Numerators and denominators must match the question — mismatched pairs sink exam answers.' },
        { type: 'content', title: 'Incidence rate vs cumulative incidence', body: 'Cumulative incidence ignores people who leave early; incidence rate divides events by person-time (accounts for variable follow-up). Incidence rate is the more honest \u2018speed\u2019 measure in long studies.' },
        { type: 'calc', title: 'Worked example', problem: 'Outbreak: 200 at risk; 50 become ill; 85 person-days of observation among cases; 5 die.', steps: [
          'Attack rate = 50 ÷ 200 = 25%.',
          'Case fatality = 5 ÷ 50 = 10% (denominator = CASES, not the whole school).',
          'Cumulative incidence = 50 ÷ 200 = 25% (matches attack rate here).',
          'Incidence rate would be expressed per person-time if follow-up was individualised.'
        ] },
        { type: 'check', title: 'Check yourself', question: 'In a disease killing 20 of 100 diagnosed people, what is the case fatality rate?', keywords: ['20', '20%', 'twenty'], accept: '20% — CFR is deaths among diagnosed cases (20 ÷ 100), not among the general population.' }
      ]
    }
  ];

  /* ============================================================
     QUIZ BANK — personalised exam prep
  ============================================================ */
  const QUIZ = [
    { topic: 'raas', q: 'Which enzyme converts angiotensin I into angiotensin II?', opts: ['Renin', 'ACE', 'Aldosterone', 'Angiotensinase'], ans: 1, why: 'ACE (angiotensin-converting enzyme), mostly on lung endothelium, performs that conversion.' },
    { topic: 'raas', q: 'Where does aldosterone exert its main effect?', opts: ['Proximal tubule', 'Loop of Henle', 'Distal tubule and collecting duct', 'Glomerulus'], ans: 2, why: 'Aldosterone acts on principal cells of the distal tubule/collecting duct: reabsorb Na⁺, secrete K⁺ and H⁺.' },
    { topic: 'sens-spec', q: 'A test has 95% sensitivity. A negative result…', opts: ['Rules IN the disease', 'Is always wrong', 'Rules OUT the disease with high probability (SnNout)', 'Proves the patient is healthy'], ans: 2, why: 'High sensitivity \u2192 few false negatives \u2192 a negative result effectively excludes disease.' },
    { topic: 'sens-spec', q: 'Disease prevalence falls. What happens to positive predictive value?', opts: ['It rises', 'It falls', 'It is unchanged', 'It becomes 100%'], ans: 1, why: 'Rarer disease \u2192 false positives dominate \u2192 PPV drops regardless of good sensitivity/specificity.' },
    { topic: 'brachial', q: 'Erb–Duchenne palsy involves which roots?', opts: ['C8–T1', 'C5–C6', 'C5–C7', 'C4–C5'], ans: 1, why: 'Upper trunk injuries (C5–C6) from birth/shoulder traction → waiter\u2019s-tip posture.' },
    { topic: 'brachial', q: 'Which nerve is exclusively a medial cord branch?', opts: ['Radial', 'Axillary', 'Ulnar', 'Musculocutaneous'], ans: 2, why: 'The ulnar nerve comes off the medial cord; radial and axillary from the posterior cord; musculocutaneous from the lateral cord.' },
    { topic: 'incidence-prev', q: 'Prevalence ≈ ?', opts: ['Incidence × duration of disease', 'Incidence ÷ duration', 'Only new cases', 'Mortality rate'], ans: 0, why: 'Prevalence ≈ incidence × average disease duration — the snapshot equation of epidemiology.' },
    { topic: 'incidence-prev', q: 'Which design can directly measure incidence?', opts: ['Cross-sectional survey', 'Case series', 'Cohort study', 'Case report'], ans: 2, why: 'Incidence needs the at-risk population followed over time — a cohort (or trial).' },
    { topic: 'heart-failure', q: 'A patient with HFrEF is significantly better on guideline therapy. Which combination is the four-pillar modern standard?', opts: ['ACEi + BB + MRA + SGLT2i', 'Digoxin + BB + diuretic', 'ACEi + aspirin + BB', 'Nitrate + hydralazine + BB'], ans: 0, why: 'Quadruple neurohormonal + metabolic therapy (ACEi/ARB/ARNI, beta-blocker, MRA, SGLT2i) is the HFrEF cornerstone.' },
    { topic: 'heart-failure', q: 'Which biomarker best reflects ventricular wall stretch in heart failure?', opts: ['Troponin', 'CRP', 'BNP / NT-proBNP', 'D-dimer'], ans: 2, why: 'BNP rises with cardiac wall stretch and is central to HF diagnosis and monitoring.' },
    { topic: 'sens-spec', q: '95% CI for an odds ratio is 0.60–1.20. The result is…', opts: ['Statistically significant', 'Statistically non-significant (CI crosses 1)', 'Clinically large', 'Proven null'], ans: 1, why: 'The interval contains the null value of 1 → compatible with no effect → not significant.' },
    { topic: 'incidence-prev', q: 'A new treatment doubles survival in a chronic disease without changing incidence. Prevalence will…', opts: ['Fall', 'Stay the same', 'Rise', 'Reach zero'], ans: 2, why: 'Longer duration (P ≈ I × D) pushes prevalence up even though incidence is untouched.' },
    { topic: 'brachial', q: 'Klumpke palsy plus ptosis and miosis on the same side suggests injury to…', opts: ['C5–C6 only', 'T1 sympathetic fibres (Horner)', 'Musculocutaneous nerve', 'Axillary nerve'], ans: 1, why: 'The preganglionic sympathetic chain fibres travel with T1 — lower trunk injury can strip them → Horners.' },
    { topic: 'raas', q: 'ACE inhibitor cough is most plausibly attributed to…', opts: ['Aldosterone', 'Bradykinin accumulation', 'Hyperkalaemia', 'Direct irritation'], ans: 1, why: 'ACE also degrades bradykinin; blocking it raises bradykinin → dry cough. ARBs spare this.' },
    { topic: 'sens-spec', q: 'p = 0.03 means…', opts: ['3% chance the null is true', 'The result is clinically huge', 'Data this extreme arises <3% of the time IF the null is true', 'Type II error is certain'], ans: 2, why: 'p is P(data | null). It is NOT P(null | data) — the most commonly flipped interpretation in medicine.' },
    { topic: 'incidence-prev', q: 'In a case–control study of a common outcome, the OR tends to…', opts: ['Match the RR exactly', 'Underestimate the RR', 'Overestimate the RR', 'Equal 1 always'], ans: 2, why: 'Odds exaggerate when outcomes are common; OR ≈ RR only when the outcome is rare.' },
    { topic: 'heart-failure', q: 'Which finding best localises RIGHT-sided heart failure?', opts: ['Pulmonary crackles', 'Orthopnoea', 'Raised JVP with dependent oedema', 'Paroxysmal nocturnal dyspnoea'], ans: 2, why: 'Right-sided failure → systemic venous congestion → JVP elevation and oedema. The others reflect left-sided/pulmonary congestion.' },
    { topic: 'brachial', q: 'Proximal loss of shoulder abduction + wrist/finger extension suggests a lesion of which cord?', opts: ['Medial', 'Lateral', 'Posterior', 'Upper trunk only'], ans: 2, why: 'Posterior cord → axillary (deltoid) and radial (extensors). Wide loss across these = posterior cord.' }
  ];

  return { TOPICS, CASES, FLASHCARDS, BIOSTATS, QUIZ };
})();