import { extractText as pdfExtractText, getDocumentProxy, extractImages } from "unpdf";
import mammoth from "mammoth";
import { unzipSync, strFromU8 } from "fflate";
import { ocrImages, OCR_ENABLED } from "@/lib/ocr";
import { transcribeAudio } from "@/lib/transcribe";
import { probePdf } from "@/lib/pdf-probe";
import { rawToPng } from "@/lib/png";

/**
 * Text extraction for uploaded study material.
 *
 * Lecture material arrives as whatever the student's university handed them:
 * PDF handouts, PowerPoint decks, Word notes. Before this module all of those
 * stored fine but produced no text, so summaries and questions silently had
 * nothing to work from.
 *
 * Design rules:
 *  - A parser failure never fails the upload. The file is still stored; we
 *    record why it could not be read and the UI says so plainly.
 *  - We return *text only*. No rendering, no OCR, no AI. Parsing must be fast,
 *    free and deterministic.
 *  - Unsupported formats return a reason, not a silent empty string, so the
 *    student is told the truth instead of getting a blank summary.
 */

export interface ExtractionResult {
  text: string | null;
  /** Which parser handled it, for the UI ("pdf", "docx", "pptx", "plain text"). */
  engine: string;
  /** Why nothing came back, when nothing did. */
  reason?: string;
  /** Page or slide count where known. */
  units?: number;
  /** Timed transcript segments, for audio. Lets a student find a term by timestamp. */
  segments?: { start: number; end: number; text: string }[];
  /** Audio length in seconds. */
  duration?: number;
}

/** Below this we treat the result as noise rather than content. */
const MIN_USABLE_CHARS = 40;
/** Long documents are truncated before storage; 25 MB of text is far past useful. */
const MAX_CHARS = 400_000;

export interface ExtractInput {
  buffer: Buffer;
  mimeType: string;
  ext: string;
}

export async function extractDocumentText({ buffer, mimeType, ext }: ExtractInput): Promise<ExtractionResult> {
  const format = detectFormat(ext, mimeType);

  try {
    switch (format) {
      case "pdf":
        return await fromPdf(buffer);
      case "docx":
        return await fromDocx(buffer);
      case "pptx":
        return fromPptx(buffer);
      case "plain":
        return fromPlainText(buffer);
      case "legacy-doc":
        return {
          text: null,
          engine: "doc",
          reason:
            "This is the old binary .doc format. Save it as .docx (or export a PDF) and upload that instead.",
        };
      case "image":
        return await fromImage(buffer);
      case "audio":
        return await fromAudio(buffer);
      default:
        return {
          text: null,
          engine: format,
          reason: `We don't know how to read .${ext || "?"} files yet.`,
        };
    }
  } catch (err) {
    // A corrupt or unusual file must not break the upload.
    return {
      text: null,
      engine: format,
      reason: `This file looks damaged or unusual, so it couldn't be read (${shortError(err)}).`,
    };
  }
}

// ---------------------------------------------------------------------------

type Format = "pdf" | "docx" | "pptx" | "plain" | "legacy-doc" | "image" | "audio" | "unknown";

function detectFormat(ext: string, mimeType: string): Format {
  const e = ext.toLowerCase();
  const m = (mimeType || "").toLowerCase();

  if (e === "pdf" || m === "application/pdf") return "pdf";
  if (e === "docx") return "docx";
  if (e === "doc") return "legacy-doc";
  if (e === "pptx" || e === "key") return "pptx";
  if (["txt", "md", "markdown", "csv", "tsv", "log", "text", "json", "xml", "rtf"].includes(e)) return "plain";
  // Trust the extension for OOXML types, whose mime types are long and easy to miss.
  if (m.startsWith("application/vnd.openxmlformats-officedocument")) return e === "pptx" ? "pptx" : "docx";
  if (m.startsWith("text/") || m === "application/json" || m === "application/xml") return "plain";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/msword") return "legacy-doc";
  return "unknown";
}

async function fromPdf(buffer: Buffer): Promise<ExtractionResult> {
  const { text, totalPages } = await pdfExtractText(new Uint8Array(buffer), { mergePages: true });
  const clean = finalize(text, "pdf", totalPages);

  if (clean.text) return clean;

  // No text from the first reader. Before assuming the whole file is a scan,
  // ask PyMuPDF, which recovers text from several PDFs unpdf cannot read at all
  // and — more usefully — says which pages are genuinely blank of text.
  const probe = await probePdf(buffer).catch(() => ({ available: false, ok: false }) as const);
  if (probe.available && probe.ok && probe.text?.trim()) {
    const viaPymupdf = finalize(probe.text, "pdf", probe.totalPages ?? totalPages);
    if (viaPymupdf.text) {
      return {
        ...viaPymupdf,
        reason: probe.encrypted
          ? "This PDF is password protected for editing; its text was read without the password."
          : undefined,
      };
    }
  }

  // Still no text, so it is almost certainly a scan. Recover the page images
  // and read those instead of giving up.
  const scanned = await ocrScannedPdf(buffer, totalPages, probe.available && probe.ok ? probe.pagesNeedingOcr : undefined);
  if (scanned.text) return scanned;

  const passwordNote =
    probe.available && probe.encrypted
      ? " This PDF is password protected, so its contents cannot be read."
      : "";

  return {
    text: null,
    engine: "pdf",
    reason: (OCR_ENABLED
      ? "This PDF has no text layer and its page images could not be read. If it is a scan, OCR it first, or upload the original slides."
      : "No text found in this PDF, which usually means it is a scan of images.") + passwordNote,
    units: totalPages,
  };
}

/** Smallest image worth OCRing — skips logos, bullets and rule lines. */
const MIN_OCR_SIDE = 200;

/**
 * Pull the page images out of a scanned PDF and recognise them.
 *
 * A scan is just a PDF whose pages are pictures, so the text we want is already
 * inside the file — it simply is not in a text layer. unpdf hands back raw
 * pixels per page, which are re-encoded before OCR because the recogniser
 * rejects raw data outright.
 */
async function ocrScannedPdf(
  buffer: Buffer,
  totalPages: number,
  /** From PyMuPDF. When present, only these pages are worth recognising. */
  pagesNeedingOcr?: number[]
): Promise<ExtractionResult> {
  if (!OCR_ENABLED || !totalPages) return { text: "", engine: "pdf", confidence: 0 } as ExtractionResult;

  const pages: string[] = [];
  let confidenceSum = 0;
  let counted = 0;
  // Declared outside the try because the summary reason is built after it.
  let limit = 0;
  let targetCount = 0;

  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    // The first few pages carry the concepts worth summarising; a 400-page
    // scanned handbook would otherwise burn minutes of CPU.
    limit = Math.min(totalPages, 12);

    // Recognising a page costs seconds. A document that is typed for pages 1-3
    // and scanned from page 14 should have only those later pages sent to the
    // recogniser, so unpdf's partial result does not turn into wasted CPU or a
    // gap in the extracted text.
    const target = pagesNeedingOcr?.length
      ? pagesNeedingOcr.filter((p) => p <= limit)
      : Array.from({ length: limit }, (_, i) => i + 1);
    targetCount = target.length;

    if (!target.length) return { text: "", engine: "pdf", confidence: 0 } as ExtractionResult;

    for (const page of target) {
      const images = await extractImages(pdf, page).catch(() => []);
      // The page picture is by far the largest thing on it; the rest are
      // artefacts like logos and borders.
      const pageImages = images
        .filter((img) => Math.min(img.width, img.height) >= MIN_OCR_SIDE)
        .sort((a, b) => b.width * b.height - a.width * a.height)
        .slice(0, 2)
        .map((img) => rawToPng(img.width, img.height, img.channels, img.data));

      if (!pageImages.length) continue;
      const result = await ocrImages(pageImages);
      if (result.text) {
        pages.push(result.text);
        confidenceSum += result.confidence;
        counted++;
      }
    }
  } catch {
    return { text: "", engine: "pdf", confidence: 0 } as ExtractionResult;
  }

  const text = pages.join("\n\n").trim();
  const skipped = limit - targetCount;
  return {
    text,
    engine: "pdf",
    units: totalPages,
    reason:
      (text && totalPages > 12 ? `Only the first ${12} pages were read.` : undefined) ??
      (skipped > 0 ? `${skipped} page(s) already had readable text and were not re-recognised.` : undefined),
    confidence: counted ? confidenceSum / counted : 0,
  } as ExtractionResult;
}

/** A standalone image is OCRed directly; there is no other way in. */
async function fromImage(buffer: Buffer): Promise<ExtractionResult> {
  if (!OCR_ENABLED) {
    return {
      text: null,
      engine: "image",
      reason: "Images need OCR, which is switched off on this server. Export your slides as a PDF or .pptx and upload that.",
    };
  }

  const result = await ocrImages([buffer]);
  if (!result.text) {
    return {
      text: null,
      engine: "image",
      reason: "No readable text found in this image. It may be a photo or a diagram rather than a slide — export it as a PDF and upload that.",
    };
  }
  return finalize(result.text, "image");
}

/**
 * Recorded lectures.
 *
 * Runs locally through faster-whisper, so a recording made in a clinical
 * placement never leaves the machine. Every failure path returns a reason the
 * student can act on rather than an empty summary they would read as "the app
 * understood my lecture and found nothing".
 */
async function fromAudio(buffer: Buffer): Promise<ExtractionResult> {
  const transcript = await transcribeAudio(buffer);

  if (!transcript.ok || !transcript.text) {
    return {
      text: null,
      engine: "audio",
      reason:
        transcript.error ??
        "No speech was detected in that recording. It may be silent, or music only.",
    };
  }

  const result = finalize(transcript.text, "audio");
  return {
    ...result,
    segments: transcript.segments,
    duration: transcript.duration,
    // Speech models mis-hear multi-syllable clinical terms, so the UI is told
    // what was actually said rather than presenting it as a perfect record.
    reason: transcript.words && transcript.words < 20
      ? `Only ${transcript.words} words were detected, which may mean the recording is short or mostly silent. Check the transcript before relying on it.`
      : undefined,
  };
}

async function fromDocx(buffer: Buffer): Promise<ExtractionResult> {
  const { value } = await mammoth.extractRawText({ buffer });
  // mammoth warns about embedded images it drops; the text is still usable.
  return finalize(value, "docx");
}

/**
 * PPTX is a zip of XML. We read the slide parts in numeric order and pull the
 * DrawingML text runs. Speaker notes live in a sibling part and carry most of
 * the teaching content in a real lecture deck, so they are included.
 */
function fromPptx(buffer: Buffer): ExtractionResult {
  const files = unzipSync(new Uint8Array(buffer));

  const slideNumber = (name: string) => {
    const m = name.match(/^ppt\/slides\/slide(\d+)\.xml$/);
    return m ? Number(m[1]) : null;
  };
  const noteNumber = (name: string) => {
    const m = name.match(/^ppt\/notesSlides\/notesSlide(\d+)\.xml$/);
    return m ? Number(m[1]) : null;
  };

  const slides = Object.keys(files)
    .map((name) => ({ name, n: slideNumber(name) }))
    .filter((s): s is { name: string; n: number } => s.n !== null)
    .sort((a, b) => a.n - b.n);

  if (!slides.length) {
    return { text: null, engine: "pptx", reason: "This file has no readable slides inside it." };
  }

  const notes = new Map<number, string>();
  for (const name of Object.keys(files)) {
    const n = noteNumber(name);
    if (n === null) continue;
    const body = xmlTextRuns(files[name]);
    if (body) notes.set(n, body);
  }

  const parts: string[] = [];
  for (const slide of slides) {
    const body = xmlTextRuns(files[slide.name]);
    const note = notes.get(slide.n);
    if (!body && !note) continue;
    parts.push(`## Slide ${slide.n}\n${body ?? ""}${note ? `\n\nSpeaker notes: ${note}` : ""}`);
  }

  return finalize(parts.join("\n\n"), "pptx", slides.length);
}

/** Concatenate <a:t> runs, treating paragraph breaks as line breaks. */
function xmlTextRuns(bytes: Uint8Array): string {
  const xml = strFromU8(bytes);
  const out: string[] = [];
  const re = /<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>|<a:br\s*\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    out.push(m[1] === undefined ? "\n" : decodeXml(m[1]));
  }
  return out.join("").replace(/[ \t]+\n/g, "\n").trim();
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

function fromPlainText(buffer: Buffer): ExtractionResult {
  const raw = buffer.toString("utf8").replace(/^﻿/, "");
  const nul = raw.indexOf(" ");
  const sample = nul === -1 ? raw : raw.slice(0, nul);
  if (sample.length < 20) {
    return {
      text: null,
      engine: "plain",
      reason: "This file has almost no readable text in it.",
    };
  }
  return finalize(raw.replace(/ /g, ""), "plain");
}

/** Shared tail: trim, collapse whitespace noise, decide usable or not. */
function finalize(raw: string, engine: string, units?: number): ExtractionResult {
  const text = raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length < MIN_USABLE_CHARS) {
    return {
      text: null,
      engine,
      reason: `Only ${text.length} characters could be read, which is too little to study.`,
      units,
    };
  }
  const truncated = text.length > MAX_CHARS;
  return {
    text: truncated ? text.slice(0, MAX_CHARS) : text,
    engine,
    units,
    reason: truncated ? "This file is very long — only the first part was used." : undefined,
  };
}

function shortError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 120);
}
