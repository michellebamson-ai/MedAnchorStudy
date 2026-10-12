/**
 * Per-page PDF inspection with PyMuPDF.
 *
 * `unpdf` answers one question for a whole file: is there text, yes or no. A
 * handout that was typed up for pages 1-3 and photocopied for pages 4-20 comes
 * back as a partial result with no way to tell what was missed, so the caller
 * either accepts a half-read document or OCRs every page including the ones that
 * already had perfectly good text.
 *
 * PyMuPDF answers it per page, and also handles files unpdf struggles with:
 * encrypted-but-viewable PDFs, rotated pages, and multi-column layouts whose
 * text layer it reads in the right order.
 *
 * Degrades rather than fails. Without Python this returns `available: false` and
 * the caller falls back to exactly the behaviour it had before.
 *
 * Server-only: it spawns a process.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export interface PdfPageInfo {
  page: number;
  chars: number;
  hasText: boolean;
  width: number;
  height: number;
  rotation: number;
  landscape: boolean;
}

export interface PdfProbe {
  available: boolean;
  ok: boolean;
  error?: string;
  /** True when the file could be opened only by supplying an empty password. */
  encrypted?: boolean;
  totalPages?: number;
  readPages?: number;
  truncated?: boolean;
  pages?: PdfPageInfo[];
  /** Page numbers with no usable text layer: the only ones worth OCRing. */
  pagesNeedingOcr?: number[];
  textPages?: number;
  metadata?: { title: string | null; author: string | null; producer: string | null };
  text?: string;
}

const SCRIPT = "pdf_probe.py";
const TIMEOUT_MS = 45_000;
// Base64 inflates by a third, and a 100 MB upload would produce ~133 MB on
// stdin. Anything larger is refused rather than buffered.
const MAX_PDF_BYTES = 60 * 1024 * 1024;

function pythonCandidates(): string[] {
  const fromEnv = process.env.PYTHON_PATH?.trim();
  const localAppData = process.env.LOCALAPPDATA;
  const out: string[] = [];
  if (fromEnv) out.push(fromEnv);
  if (localAppData) {
    for (const minor of ["313", "312", "311", "310"]) {
      out.push(path.join(localAppData, "Programs", "Python", `Python${minor}`, "python.exe"));
    }
  }
  out.push("python", "python3", "py");
  return out;
}

let cached: string | null | undefined;

/** Find an interpreter that can actually import pymupdf, once per process. */
function findPython(): Promise<string | null> {
  if (cached !== undefined) return Promise.resolve(cached);

  if (!existsSync(path.join(process.cwd(), "scripts", SCRIPT))) {
    cached = null;
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const candidates = pythonCandidates();
    let index = 0;
    const tryNext = () => {
      if (index >= candidates.length) {
        cached = null;
        resolve(null);
        return;
      }
      const candidate = candidates[index++];
      execFile(candidate, ["-c", "import pymupdf"], { timeout: 15_000, windowsHide: true }, (error) => {
        if (!error) {
          cached = candidate;
          resolve(candidate);
        } else {
          tryNext();
        }
      });
    };
    tryNext();
  });
}

/**
 * Inspect a PDF, page by page. Never throws.
 *
 * Pass the raw file bytes. The page list is what matters to the caller: it can
 * OCR `pagesNeedingOcr` instead of the whole document.
 */
export async function probePdf(buffer: Buffer, maxPages = 0): Promise<PdfProbe> {
  if (buffer.length > MAX_PDF_BYTES) {
    return { available: true, ok: false, error: "That PDF is too large to inspect." };
  }

  const python = await findPython();
  if (!python) {
    return { available: false, ok: false, error: "PyMuPDF is not available on this machine." };
  }

  const payload = JSON.stringify({
    buffer: buffer.toString("base64"),
    maxPages,
  });

  return new Promise((resolve) => {
    execFile(
      python,
      [path.join(process.cwd(), "scripts", SCRIPT)],
      {
        timeout: TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, PYTHONWARNINGS: "ignore" },
      },
      (error, stdout, stderr) => {
        const text = String(stdout ?? "").trim();
        if (!text) {
          resolve({
            available: true,
            ok: false,
            error: stderr
              ? `The PDF inspector failed: ${String(stderr).trim().slice(0, 200)}`
              : "The PDF inspector produced no output.",
          });
          return;
        }
        try {
          resolve({ available: true, ...(JSON.parse(text) as Omit<PdfProbe, "available">) });
        } catch {
          resolve({ available: true, ok: false, error: "The PDF inspector returned unreadable output." });
        }
        void error;
      }
    ).stdin?.end(payload);
  });
}

export function resetPdfProbeCache(): void {
  cached = undefined;
}