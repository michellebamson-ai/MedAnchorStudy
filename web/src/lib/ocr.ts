import { createWorker, type Worker } from "tesseract.js";

/**
 * OCR for scanned material.
 *
 * A lecture PDF is usually a scan: pages of images with no text layer. The
 * extractors in document-text.ts read the text layer, found nothing, and the
 * file silently produced no summaries or questions. This recovers those files
 * by recognising the images instead.
 *
 * Why local OCR rather than a vision model:
 *  - No quota. Gemini's free tier allows 20 generation requests a day, which a
 *    single scanned deck would exhaust.
 *  - Nothing leaves the machine. Students are told never to upload patient
 *    records, and OCR that phones a third party with their images would make
 *    that warning hollow.
 *  - No API key, so it works on a fresh checkout.
 *
 * Cost is time: the first call pays for loading the worker and language data.
 * The worker is a module-level singleton, so later uploads reuse it.
 */

/** Set OCR_ENABLED="0" to switch it off where CPU is scarce. */
export const OCR_ENABLED = (process.env.OCR_ENABLED ?? "1") !== "0";

/**
 * How many images to recognise per file. A 60-page scanned handbook is minutes
 * of CPU and the first few pages carry the concepts worth summarising.
 */
export const OCR_MAX_IMAGES = Number(process.env.OCR_MAX_IMAGES ?? 12) || 12;

export interface OcrResult {
  text: string;
  confidence: number;
}

/**
 * Formats worth trying OCR on. Text-based formats are handled by the real
 * extractors and would only waste CPU here.
 */
export function isOcrCandidate(filename: string, mimeType: string): boolean {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const m = (mimeType || "").toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff", "gif", "pdf"].includes(ext)) return true;
  return m === "application/pdf" || m.startsWith("image/");
}

/**
 * Tesseract downloads its language data on first use. Keep it in one ignored
 * directory rather than scattering it, so it never reaches git and never has to
 * be re-fetched on every run.
 */
const LANG_CACHE_DIR = process.env.OCR_CACHE_DIR ?? ".tessdata";

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("eng", 1, { cachePath: LANG_CACHE_DIR }).catch((err) => {
      // Do not cache a rejected promise, or one transient failure disables OCR
      // for the life of the process.
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

/**
 * Recognise one image. Returns empty text rather than throwing, because a
 * failed OCR must degrade the upload, not fail it.
 */
export async function ocrImage(image: Buffer): Promise<OcrResult> {
  if (!OCR_ENABLED) return { text: "", confidence: 0 };
  // Must be checked before calling recognize: tesseract.js raises an
  // uncaught error from inside its worker for unreadable input, which takes
  // the whole process down rather than rejecting the promise. A corrupt or
  // mislabelled upload would otherwise crash the server.
  if (!looksLikeImage(image)) return { text: "", confidence: 0 };
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(image);
    return {
      text: (data.text ?? "").trim(),
      confidence: typeof data.confidence === "number" ? data.confidence : 0,
    };
  } catch {
    return { text: "", confidence: 0 };
  }
}

/** Magic-byte check, so unreadable bytes never reach the OCR worker. */
export function looksLikeImage(buf: Buffer): boolean {
  if (!buf || buf.length < 12) return false;
  const hex = (n: number) => buf[n];
  // PNG
  if (hex(0) === 0x89 && hex(1) === 0x50 && hex(2) === 0x4e && hex(3) === 0x47) return true;
  // JPEG
  if (hex(0) === 0xff && hex(1) === 0xd8 && hex(2) === 0xff) return true;
  // GIF
  if (buf.subarray(0, 3).toString("ascii") === "GIF") return true;
  // BMP
  if (hex(0) === 0x42 && hex(1) === 0x4d) return true;
  // WEBP: "RIFF" .... "WEBP"
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return true;
  // TIFF, both byte orders
  if ((hex(0) === 0x49 && hex(1) === 0x49 && hex(2) === 0x2a && hex(3) === 0x00) ||
      (hex(0) === 0x4d && hex(1) === 0x4d && hex(2) === 0x00 && hex(3) === 0x2a)) return true;
  return false;
}

/**
 * Recognise several images and join what was found, keeping the page order.
 *
 * Pages that yield nothing are dropped rather than padded with blanks, and a
 * total failure returns empty so the caller can explain why.
 */
export async function ocrImages(images: Buffer[]): Promise<OcrResult> {
  if (!OCR_ENABLED || !images.length) return { text: "", confidence: 0 };

  const pages: string[] = [];
  let confidenceSum = 0;
  let counted = 0;

  for (const image of images.slice(0, OCR_MAX_IMAGES)) {
    const result = await ocrImage(image);
    if (result.text) {
      pages.push(result.text);
      confidenceSum += result.confidence;
      counted++;
    }
  }

  return {
    text: pages.join("\n\n").trim(),
    confidence: counted ? confidenceSum / counted : 0,
  };
}

/** Release the worker, so a test or a script can exit cleanly. */
export async function terminateOcr(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise.catch(() => null);
  workerPromise = null;
  await worker?.terminate().catch(() => undefined);
}