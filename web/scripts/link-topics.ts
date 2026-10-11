/**
 * One-off: point existing rows at Topics so mastery updates can reach them.
 *
 * CommScenario had no topic link at all, and every BioModule had a null one,
 * so recordActivity skipped refreshMastery for both features and neither
 * communication practice nor biostatistics ever moved a topic score. The column
 * and the foreign key already existed for BioModule; it was simply never
 * populated.
 *
 * Run: npx tsx scripts/link-topics.ts
 */
import { prisma } from "../src/lib/prisma";

/** Only map a module where a genuinely matching curriculum Topic exists. */
const BIO_TO_TOPIC: Record<string, string> = {
  bs3: "sens-spec", // Sensitivity, Specificity & 2x2 Tables
  bs9: "incidence-prev", // Epidemiological Measures (Rates & Ratios)
};

async function main() {
  // Communication is a real learnable skill the app teaches and grades, so it
  // deserves a mastery target rather than being left untracked.
  const COMM_TOPIC = "clinical-communication";
  await prisma.topic.upsert({
    where: { slug: COMM_TOPIC },
    create: {
      slug: COMM_TOPIC,
      title: "Clinical Communication",
      domain: "medicine",
      summary: "Taking a history, explaining a diagnosis, and breaking difficult news.",
      estMinutes: 40,
    },
    update: {},
  });
  console.log("ensured topic:", COMM_TOPIC);

  const bio = await prisma.bioModule.findMany({ select: { slug: true, title: true } });
  let linkedBio = 0;
  for (const m of bio) {
    const slug = BIO_TO_TOPIC[m.slug];
    if (!slug) continue;
    await prisma.bioModule.update({ where: { slug: m.slug }, data: { topicSlug: slug } });
    linkedBio++;
    console.log(`  bioModule ${m.slug} -> ${slug}`);
  }
  console.log("bio modules linked:", linkedBio);

  const scenarios = await prisma.commScenario.findMany({ select: { id: true, slug: true } });
  for (const s of scenarios) {
    await prisma.commScenario.update({ where: { id: s.id }, data: { topicSlug: COMM_TOPIC } });
  }
  console.log("comm scenarios linked:", scenarios.length);

  await prisma.$disconnect();
}

main();