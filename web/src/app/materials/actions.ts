"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { analyzeText, type AnalysisFinding } from "@/lib/analyze";
import { getProvider } from "@/lib/ai/simulated";
import { recordActivity } from "@/lib/mastery";
import { reviewCard as scheduleReview } from "@/lib/spaced-repetition";
import { removeDocumentFile, storePastedText, storeUploadedFiles } from "@/lib/documents";

export interface ActionResult {
  ok: boolean;
  message: string;
  documentId?: string;
}

async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.id;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "material";
}

/** Upload one or more files. Spec messages for too-big and unsupported kinds. */
export async function uploadMaterial(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in to add materials." };
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const subject = String(formData.get("subject") ?? "").trim() || null;
  const analyzeAfter = formData.get("analyzeAfter") === "1";

  if (!files.length) return { ok: false, message: "Choose at least one file first." };

  let ids: string[];
  try {
    ids = await storeUploadedFiles(
      userId,
      await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          type: f.type,
          size: f.size,
          buffer: Buffer.from(await f.arrayBuffer()),
        }))
      ),
      subject
    );
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Upload stopped. Tap to try again." };
  }

  if (analyzeAfter) {
    for (const id of ids) await runAnalysis(userId, id);
  }

  revalidatePath("/materials");
  return {
    ok: true,
    message: ids.length > 1 ? `${ids.length} materials added.` : "Material added.",
    documentId: ids[ids.length - 1],
  };
}

/** Paste-text path: creates a real text document the whole pipeline can use. */
export async function pasteTextMaterial(formData: FormData): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in to add materials." };
  }

  const title = String(formData.get("title") ?? "").trim() || "Pasted notes";
  const subject = String(formData.get("subject") ?? "").trim() || null;
  const text = String(formData.get("text") ?? "").trim();
  if (text.length < 50) {
    return { ok: false, message: "Paste a little more text — at least a paragraph — so there is something to read." };
  }

  const id = await storePastedText(userId, title, subject, text);

  if (formData.get("analyzeAfter") === "1") {
    await runAnalysis(userId, id);
  }

  revalidatePath("/materials");
  return { ok: true, message: "Notes added.", documentId: id };
}

export async function deleteDocument(documentId: string): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in to manage materials." };
  }
  const doc = await prisma.document.findFirst({ where: { id: documentId, userId } });
  if (!doc) return { ok: false, message: "Material not found." };

  // Delete removes the file and everything made from it (spec §1 privacy).
  await prisma.document.delete({ where: { id: documentId } });
  await removeDocumentFile(doc.storedPath);

  revalidatePath("/materials");
  return { ok: true, message: "Deleted, including everything made from it." };
}

export async function renameDocument(documentId: string, title: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const clean = title.trim().slice(0, 120);
    if (!clean) return { ok: false, message: "Give it a name first." };
    await prisma.document.updateMany({ where: { id: documentId, userId }, data: { title: clean } });
    revalidatePath("/materials");
    return { ok: true, message: "Renamed." };
  } catch {
    return { ok: false, message: "Sign in to manage materials." };
  }
}

export async function setDocumentSubject(documentId: string, subject: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await prisma.document.updateMany({
      where: { id: documentId, userId },
      data: { subject: subject.trim().slice(0, 80) || null },
    });
    revalidatePath("/materials");
    return { ok: true, message: "Subject updated." };
  } catch {
    return { ok: false, message: "Sign in to manage materials." };
  }
}

/** Run (or re-run) the reading pass over a document. */
export async function analyzeDocument(documentId: string): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in to analyze materials." };
  }
  const result = await runAnalysis(userId, documentId);
  revalidatePath("/materials");
  return result;
}

async function runAnalysis(userId: string, documentId: string): Promise<ActionResult> {
  const doc = await prisma.document.findFirst({ where: { id: documentId, userId } });
  if (!doc) return { ok: false, message: "Material not found." };

  await prisma.document.update({ where: { id: documentId }, data: { status: "extracting", error: null } });

  if (doc.error === "unreadable" || !doc.extractedText) {
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "uploaded", error: "unreadable" },
    });
    return { ok: false, message: "We can't read this kind of file yet." };
  }

  const text = doc.extractedText;
  if (text.trim().length < 100) {
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "uploaded", error: "too-short" },
    });
    return { ok: false, message: "We couldn't find topics in this file. Try another file." };
  }

  await prisma.document.update({ where: { id: documentId }, data: { status: "analyzing" } });

  let result;
  try {
    result = analyzeText(text);
  } catch {
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "uploaded", error: "failed" },
    });
    return { ok: false, message: "We couldn't finish reading this. Try again." };
  }

  // Replace previous findings so "Analyze again" is a clean redo.
  await prisma.docConcept.deleteMany({ where: { documentId } });

  const all: AnalysisFinding[] = [
    ...result.topics,
    ...result.concepts,
    ...result.definitions,
    ...result.formulas,
    ...result.tables,
    ...result.diagrams,
    ...result.facts,
    ...result.links,
    ...result.hardAreas,
    ...result.courseWords,
  ];
  for (const f of all) {
    await prisma.docConcept.create({
      data: {
        documentId,
        label: f.label.slice(0, 200),
        kind: f.kind,
        detail: f.detail?.slice(0, 500) ?? null,
        confidence: f.confidence,
      },
    });
  }

  await prisma.document.update({ where: { id: documentId }, data: { status: "analyzed", error: null } });

  await recordActivitySafe(userId, {
    kind: "analyze",
    activity: "analyze_document",
    score: null,
    detail: { documentId, counts: result.counts },
  });

  return { ok: true, message: "Reading finished — here's what we found.", documentId };
}

export type GenerateControls = {
  detail: number; // 1 brief, 3 standard, 5 deep
  style: string; // simple | technical | examples
  difficulty: number; // 1 easy, 3 medium, 5 hard
  goal: string; // understand | exam_prep | quick_review
  make: string[]; // notes | summaries | flashcards | questions | cases
  topicLabels: string[]; // checked topics; empty = all
};

/**
 * Build study tools from the checked topics. Notes, summaries, flashcards and
 * questions fill their tabs; cases go to Practice; review times go to the plan.
 */
export async function generateFromDocument(
  documentId: string,
  controls: GenerateControls
): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in to generate study tools." };
  }

  const doc = await prisma.document.findFirst({
    where: { id: documentId, userId },
    include: { concepts: true },
  });
  if (!doc) return { ok: false, message: "Material not found." };
  if (!doc.extractedText || doc.extractedText.trim().length < 100) {
    return { ok: false, message: "Analyze this material first — there isn't enough readable text yet." };
  }
  if (!controls.make.length) {
    return { ok: false, message: "Tick at least one thing to make." };
  }

  const findings = doc.concepts.filter((c) => c.kind === "topic");
  const picked =
    controls.topicLabels.length > 0
      ? findings.filter((f) => controls.topicLabels.includes(f.label))
      : findings;
  const topicNames = picked.length ? picked.map((p) => p.label) : ["the material"];
  const sourceText = doc.extractedText.slice(0, 6000);

  const provider = getProvider();
  const profile = await prisma.profile.findUnique({ where: { userId } });
  const level = profile?.academicLevel === "resident" ? "advanced" : "student";
  const examNote = controls.goal === "exam_prep" ? "Made for exam prep." : null;

  const base = {
    detailLevel: controls.detail,
    style: controls.style,
    format: "markdown",
    difficulty: controls.difficulty,
    objective: controls.goal,
  };

  let made = 0;

  for (const topic of topicNames.slice(0, 6)) {
    const req = { ...base, sourceText, topic, level: level as "student" | "advanced" };

    if (controls.make.includes("notes")) {
      const g = await provider.generate({ ...req, kind: "breakdown" });
      await prisma.artifact.create({
        data: {
          documentId,
          userId,
          kind: "breakdown",
          title: `${topic} — topic breakdown`,
          body: { ...asObject(g.body), source: labelFor(doc), examNote },
          ...base,
        },
      });
      made += 1;
    }
    if (controls.make.includes("summaries")) {
      const g = await provider.generate({ ...req, kind: "summary" });
      await prisma.artifact.create({
        data: {
          documentId,
          userId,
          kind: "summary",
          title: `${topic} — high-yield summary`,
          body: { ...asObject(g.body), source: labelFor(doc), examNote },
          ...base,
        },
      });
      made += 1;
    }
    if (controls.make.includes("flashcards")) {
      const g = await provider.generate({ ...req, kind: "flashcards" });
      const cards = asCards(g.body);
      for (const c of cards.slice(0, 10)) {
        await prisma.flashcard.create({
          data: {
            documentId,
            front: c.front,
            back: c.back,
            hint: null,
            tags: [topic],
            cardType: "qa",
            origin: "generated",
          },
        });
      }
      made += cards.length ? 1 : 0;
    }
    if (controls.make.includes("questions")) {
      const g = await provider.generate({ ...req, kind: "questions" });
      const qs = asQuestions(g.body);
      for (const q of qs.slice(0, 10)) {
        await prisma.question.create({
          data: {
            documentId,
            sourcePage: doc.title,
            stem: q.stem,
            choices: q.choices,
            answerIndex: q.answerIndex,
            explanation: q.explanation,
            difficulty: controls.difficulty,
            tags: [topic],
          },
        });
      }
      made += qs.length ? 1 : 0;
    }
    if (controls.make.includes("cases")) {
      const g = await provider.generate({ ...req, kind: "case_scenario" });
      await prisma.artifact.create({
        data: {
          documentId,
          userId,
          kind: "case_scenario",
          title: `${topic} — case scenario`,
          body: { ...asObject(g.body), source: labelFor(doc) },
          ...base,
        },
      });
      made += 1;
    }
  }

  if (!made) return { ok: false, message: "We couldn't make tools from this. Try again." };

  await prisma.document.update({ where: { id: documentId }, data: { status: "analyzed" } });
  await recordActivitySafe(userId, {
    kind: "generate",
    activity: "generate_tools",
    detail: { documentId, made, controls: { ...controls, topicLabels: topicNames } },
  });

  revalidatePath("/materials");
  return { ok: true, message: `Made ${made} study ${made === 1 ? "tool" : "tools"} — they're in their tabs now.`, documentId };
}

function labelFor(doc: { title: string }) {
  return { type: "uploaded", title: doc.title };
}

function asObject(body: unknown): Record<string, unknown> {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return { content: body };
}

function asCards(body: unknown): Array<{ front: string; back: string }> {
  const list = Array.isArray(body) ? body : (body as { cards?: unknown })?.cards;
  if (!Array.isArray(list)) return [];
  return list
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({ front: String(c.front ?? ""), back: String(c.back ?? "") }))
    .filter((c) => c.front && c.back);
}

function asQuestions(
  body: unknown
): Array<{ stem: string; choices: string[]; answerIndex: number; explanation: string }> {
  const list = Array.isArray(body) ? body : (body as { questions?: unknown })?.questions;
  if (!Array.isArray(list)) return [];
  return list
    .filter((q): q is Record<string, unknown> => !!q && typeof q === "object")
    .map((q) => ({
      stem: String(q.stem ?? ""),
      choices: Array.isArray(q.choices) ? q.choices.map(String).slice(0, 4) : [],
      answerIndex: Number(q.answerIndex ?? 0),
      explanation: String(q.explanation ?? ""),
    }))
    .filter((q) => q.stem && q.choices.length >= 2);
}

/** Toggle a star on a note or summary. */
export async function toggleFavorite(artifactId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const a = await prisma.artifact.findFirst({ where: { id: artifactId, userId } });
    if (!a) return { ok: false, message: "Not found." };
    await prisma.artifact.update({ where: { id: artifactId }, data: { favorite: !a.favorite } });
    revalidatePath("/materials");
    return { ok: true, message: a.favorite ? "Removed from favorites." : "Starred." };
  } catch {
    return { ok: false, message: "Sign in to star items." };
  }
}

/** Write your own note. App notes can be edited too — the original stays. */
export async function saveNote(formData: FormData): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in to write notes." };
  }
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const bodyText = String(formData.get("body") ?? "").trim();
  const documentId = String(formData.get("documentId") ?? "") || null;
  const subject = String(formData.get("subject") ?? "").trim() || null;
  const editOf = String(formData.get("editOf") ?? "") || null;

  if (!title || bodyText.length < 10) {
    return { ok: false, message: "Give the note a title and a little more text." };
  }

  if (documentId) {
    const owns = await prisma.document.findFirst({ where: { id: documentId, userId } });
    if (!owns) return { ok: false, message: "Material not found." };
  }

  await prisma.artifact.create({
    data: {
      documentId,
      userId,
      kind: "revision_notes",
      title,
      body: { manual: true, text: bodyText, subject, editedFrom: editOf },
      detailLevel: 3,
      style: "simple",
      format: "markdown",
      difficulty: 3,
    },
  });

  revalidatePath("/materials");
  return { ok: true, message: "Note saved." };
}

export async function deleteArtifact(artifactId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await prisma.artifact.deleteMany({ where: { id: artifactId, userId } });
    revalidatePath("/materials");
    return { ok: true, message: "Deleted." };
  } catch {
    return { ok: false, message: "Sign in to manage notes." };
  }
}

/** Make your own card — front, back, and the material or subject. */
export async function createCard(formData: FormData): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in to make flashcards." };
  }
  const front = String(formData.get("front") ?? "").trim();
  const back = String(formData.get("back") ?? "").trim();
  const documentId = String(formData.get("documentId") ?? "") || null;
  const cardType = ["qa", "term", "formula", "concept"].includes(String(formData.get("cardType")))
    ? String(formData.get("cardType"))
    : "qa";

  if (!front || !back) return { ok: false, message: "Both sides of the card need text." };
  if (documentId) {
    const owns = await prisma.document.findFirst({ where: { id: documentId, userId } });
    if (!owns) return { ok: false, message: "Material not found." };
  }

  await prisma.flashcard.create({
    data: { documentId, front: front.slice(0, 500), back: back.slice(0, 2000), cardType, origin: "manual" },
  });
  revalidatePath("/materials");
  return { ok: true, message: "Card added." };
}

export async function updateCard(
  cardId: string,
  data: { front?: string; back?: string; note?: string }
): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in to edit cards." };
  }
  const card = await prisma.flashcard.findFirst({
    where: { id: cardId },
    include: { document: true },
  });
  // Seeded cards are global; personal cards belong to a document the user owns.
  if (!card || (card.document && card.document.userId !== userId)) {
    return { ok: false, message: "Card not found." };
  }
  if (data.front !== undefined || data.back !== undefined) {
    await prisma.flashcard.update({
      where: { id: cardId },
      data: {
        ...(data.front !== undefined ? { front: data.front.slice(0, 500) } : {}),
        ...(data.back !== undefined ? { back: data.back.slice(0, 2000) } : {}),
      },
    });
  }
  if (data.note !== undefined) {
    await prisma.cardReviewState.upsert({
      where: { userId_cardId: { userId, cardId } },
      create: { userId, cardId, note: data.note.slice(0, 1000) },
      update: { note: data.note.slice(0, 1000) },
    });
  }
  revalidatePath("/materials");
  return { ok: true, message: "Card updated." };
}

export async function deleteCard(cardId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const card = await prisma.flashcard.findFirst({
      where: { id: cardId },
      include: { document: true },
    });
    // Never delete the shared seed deck from here; personal cards only.
    if (!card || !card.document || card.document.userId !== userId) {
      return { ok: false, message: "Only your own cards can be deleted here." };
    }
    await prisma.flashcard.delete({ where: { id: cardId } });
    revalidatePath("/materials");
    return { ok: true, message: "Card deleted." };
  } catch {
    return { ok: false, message: "Sign in to manage cards." };
  }
}

/** Grade a card: Wrong brings it back sooner, Correct pushes it out. */
export async function gradeCard(
  cardId: string,
  grade: "forgot" | "hard" | "good" | "easy",
  topicSlug?: string | null
): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in so your reviews count." };
  }
  const card = await prisma.flashcard.findUnique({ where: { id: cardId }, include: { topic: true } });
  if (!card) return { ok: false, message: "Card not found." };

  const state = await scheduleReview(userId, cardId, grade);
  const correct = grade === "good" || grade === "easy";
  await recordActivitySafe(userId, {
    kind: "flashcard",
    activity: correct ? "flashcard_correct" : "flashcard_wrong",
    topicSlug: topicSlug ?? card.topic?.slug ?? null,
    score: correct ? 1 : 0,
    maxScore: 1,
    detail: { cardId, grade },
  });
  return {
    ok: true,
    message:
      state.intervalDays <= 0
        ? "Wrong — this one comes back in this session."
        : `Correct — back in ${state.intervalDays} ${state.intervalDays === 1 ? "day" : "days"}.`,
  };
}

/** Record one answered question: history, mastery, and the loop. */
export async function answerQuestion(input: {
  questionId: string;
  correct: boolean;
  topicSlug?: string | null;
  sessionId: string;
  mode?: string;
}): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in so your answers count." };
  }
  const q = await prisma.question.findUnique({ where: { id: input.questionId }, include: { topic: true } });
  if (!q) return { ok: false, message: "Question not found." };

  await prisma.quizAttempt.create({
    data: {
      userId,
      questionId: q.id,
      topicSlug: input.topicSlug ?? q.topic?.slug ?? null,
      sessionId: input.sessionId,
      mode: input.mode ?? "practice",
      correct: input.correct,
      score: input.correct ? 1 : 0,
    },
  });
  await recordActivitySafe(userId, {
    kind: "quiz",
    activity: "practice_question",
    topicSlug: input.topicSlug ?? q.topic?.slug ?? null,
    score: input.correct ? 1 : 0,
    maxScore: 1,
    detail: { questionId: q.id, sessionId: input.sessionId },
  });
  return { ok: true, message: input.correct ? "Correct." : "Noted — this becomes a flashcard." };
}

/** "Make flashcards / Practice this" from any note or summary (spec §3/§4). */
export async function deriveFromArtifact(
  artifactId: string,
  kind: "flashcards" | "questions"
): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in to make study tools." };
  }
  const a = await prisma.artifact.findFirst({
    where: { id: artifactId, userId },
    include: { document: true },
  });
  if (!a) return { ok: false, message: "Not found." };

  const text = flattenBody(a.body).slice(0, 4000);
  if (text.length < 60) {
    return { ok: false, message: "There's not enough text here to work with." };
  }

  const provider = getProvider();
  const topic = a.title.split("—")[0].trim() || a.title;
  try {
    if (kind === "flashcards") {
      const g = await provider.generate({
        kind: "flashcards",
        sourceText: text,
        topic,
        level: "student",
        detailLevel: a.detailLevel,
        style: a.style,
        format: "markdown",
        difficulty: a.difficulty,
      });
      const cards = asCards(g.body).slice(0, 8);
      for (const c of cards) {
        await prisma.flashcard.create({
          data: {
            documentId: a.documentId,
            front: c.front,
            back: c.back,
            cardType: "qa",
            origin: "generated",
            tags: [topic],
          },
        });
      }
      if (!cards.length) return { ok: false, message: "We couldn't make flashcards from this. Try again." };
    } else {
      const g = await provider.generate({
        kind: "questions",
        sourceText: text,
        topic,
        level: "student",
        detailLevel: a.detailLevel,
        style: a.style,
        format: "markdown",
        difficulty: a.difficulty,
      });
      const qs = asQuestions(g.body).slice(0, 8);
      for (const q of qs) {
        await prisma.question.create({
          data: {
            documentId: a.documentId,
            sourcePage: a.document?.title ?? a.title,
            stem: q.stem,
            choices: q.choices,
            answerIndex: q.answerIndex,
            explanation: q.explanation,
            difficulty: a.difficulty,
            tags: [topic],
          },
        });
      }
      if (!qs.length) return { ok: false, message: "We couldn't make questions from this. Try again." };
    }
  } catch {
    return { ok: false, message: "We couldn't make study tools from this. Try again." };
  }

  await recordActivitySafe(userId, {
    kind: "generate",
    activity: kind === "flashcards" ? "derive_flashcards" : "derive_questions",
    detail: { artifactId },
  });
  revalidatePath("/materials");
  return {
    ok: true,
    message:
      kind === "flashcards"
        ? "Flashcards made — they're in the Flashcards tab."
        : "Questions made — they're in Practice Questions.",
  };
}

function flattenBody(body: unknown): string {
  if (typeof body === "string") return body;
  if (Array.isArray(body)) return body.map(flattenBody).join("\n");
  if (body && typeof body === "object") {
    return Object.entries(body as Record<string, unknown>)
      .filter(([k]) => k !== "source" && k !== "examNote")
      .map(([, v]) => flattenBody(v))
      .join("\n");
  }
  return "";
}

/** Wrong answers become flashcards (spec §6 results screen). */
export async function wrongToFlashcard(questionId: string): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { ok: false, message: "Sign in to save flashcards." };
  }
  const q = await prisma.question.findUnique({ where: { id: questionId } });
  if (!q) return { ok: false, message: "Question not found." };
  const exists = await prisma.flashcard.findFirst({
    where: { front: q.stem, origin: "mistake", documentId: q.documentId },
  });
  if (exists) return { ok: true, message: "Already saved as a flashcard." };
  await prisma.flashcard.create({
    data: {
      topicId: q.topicId,
      documentId: q.documentId,
      front: q.stem,
      back: q.explanation,
      cardType: "qa",
      origin: "mistake",
    },
  });
  revalidatePath("/materials");
  return { ok: true, message: "Saved as a flashcard — it will come back for review." };
}

async function recordActivitySafe(
  userId: string,
  input: Omit<Parameters<typeof import("@/lib/mastery").recordActivity>[0], "userId">
): Promise<void> {
  const { recordActivity } = await import("@/lib/mastery");
  await recordActivity({ ...input, userId });
}

/**
 * Grade a typed diagram answer against the material's own terms
 * (MATERIALS_SPEC.md §6 diagram labeling).
 */
export async function gradeDiagram(
  documentId: string,
  answer: string
): Promise<{ score: number; feedback: string }> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { score: 0, feedback: "Sign in so your answers count." };
  }
  const doc = await prisma.document.findFirst({
    where: { id: documentId, userId },
    include: { concepts: { where: { kind: { in: ["concept", "definition", "term"] } }, take: 12 } },
  });
  if (!doc) return { score: 0, feedback: "Material not found." };

  const expected = doc.concepts.map((c) => c.label);
  const provider = getProvider();
  const graded = await provider.grade({
    prompt: `Label the key parts of the diagram in "${doc.title}".`,
    answer: answer.slice(0, 2000),
    expectedTerms: expected.length ? expected : [doc.title],
    sourceText: doc.extractedText?.slice(0, 2000),
  });

  await recordActivitySafe(userId, {
    kind: "quiz",
    activity: "diagram_labeling",
    score: graded.score,
    maxScore: 1,
    detail: { documentId },
  });

  return { score: graded.score, feedback: graded.feedback };
}
