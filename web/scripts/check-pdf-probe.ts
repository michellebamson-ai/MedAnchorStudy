/**
 * Verifies the PyMuPDF page inspector against PDFs built to order.
 *
 * The point of the inspector is to distinguish a page that has real text from a
 * page that is only a picture, so the tests are built around that distinction
 * rather than around a single happy-path file. A document where the typed pages
 * come first and the scanned pages follow is the case that costs the most when
 * it is handled wrongly.
 */

import { readFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { probePdf, resetPdfProbeCache } from "../src/lib/pdf-probe";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${name}${detail ? ` - ${detail}` : ""}`);
  } else {
    failed++;
    console.log(`  [FAIL] ${name}${detail ? ` - ${detail}` : ""}`);
  }
}

const TMP = path.join(process.cwd(), "tmp-pdf-probe");

function python(): string | null {
  const candidates = [
    process.env.PYTHON_PATH,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs", "Python", "Python312", "python.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs", "Python", "Python313", "python.exe"),
    "python",
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    try {
      execFileSync(c, ["-c", "import pymupdf"], { stdio: "ignore", timeout: 15_000 });
      return c;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/** Build a PDF: n text pages, then m pages that are only an image. */
function buildPdf(py: string, name: string, textPages: number, scanPages: number, extras: string[] = []): Buffer {
  const script = `
import pymupdf, sys
doc = pymupdf.open()
for i in range(${textPages}):
    p = doc.new_page()
    p.insert_text((72, 100), "Hypertension lecture %d" % (i + 1), fontsize=18)
    for line in range(12):
        p.insert_text((72, 140 + line * 22), "Blood pressure rises with age and sodium intake.", fontsize=11)
for i in range(${scanPages}):
    p = doc.new_page()
    pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 400, 300))
    pix.set_rect(pix.irect, (200, 210, 220))
    p.insert_image(pymupdf.Rect(50, 50, 550, 400), pixmap=pix)
${extras.join("\n")}
doc.save(sys.argv[1])
`;
  const out = path.join(TMP, name);
  execFileSync(py, ["-c", script, out], { stdio: "ignore", timeout: 30_000 });
  return readFileSync(out);
}

async function main(): Promise<void> {
  console.log("PDF PAGE INSPECTOR CHECKS\n");

  const py = python();
  if (!py) {
    console.log("  [SKIP] PyMuPDF is not installed, so these checks cannot run.");
    console.log("\nPDF INSPECTOR CHECKS SKIPPED");
    return;
  }

  rmSync(TMP, { recursive: true, force: true });
  execFileSync(py, ["-c", "import os; os.makedirs(r'" + TMP + "', exist_ok=True)"], { stdio: "ignore" });
  resetPdfProbeCache();

  // --- Mixed document: the case this whole feature exists for ---
  const mixed = buildPdf(py, "mixed.pdf", 3, 2);
  const r1 = await probePdf(mixed);
  check("probe: opened the PDF", r1.ok && r1.available, r1.error ?? "");
  check("probe: page count is right", r1.totalPages === 5, `got ${r1.totalPages}`);
  check("probe: three pages counted as text", r1.textPages === 3, `got ${r1.textPages}`);
  check(
    "probe: only the image pages are flagged for OCR",
    JSON.stringify(r1.pagesNeedingOcr) === JSON.stringify([4, 5]),
    `got ${JSON.stringify(r1.pagesNeedingOcr)}`
  );
  check("probe: text recovered from typed pages", (r1.text ?? "").includes("Hypertension"), "");
  check("probe: hyphenation repaired across line breaks", !(r1.text ?? "").includes("-\n"), "");
  check(
    "probe: every page reports geometry",
    (r1.pages ?? []).every((p) => p.width > 0 && p.height > 0 && typeof p.rotation === "number"),
    ""
  );

  // --- Fully born-digital ---
  const digital = buildPdf(py, "digital.pdf", 4, 0);
  const r2 = await probePdf(digital);
  check("digital: no pages need OCR", (r2.pagesNeedingOcr ?? []).length === 0, `got ${JSON.stringify(r2.pagesNeedingOcr)}`);
  check("digital: all pages counted as text", r2.textPages === 4, `got ${r2.textPages}`);

  // --- Fully scanned ---
  const scanned = buildPdf(py, "scanned.pdf", 0, 3);
  const r3 = await probePdf(scanned);
  check("scanned: every page flagged for OCR", (r3.pagesNeedingOcr ?? []).length === 3, `got ${JSON.stringify(r3.pagesNeedingOcr)}`);
  check("scanned: no text claimed", r3.textPages === 0, `got ${r3.textPages}`);

  // --- Landscape page is reported as such ---
  const landscape = buildPdf(py, "landscape.pdf", 1, 0, [
    'p = doc.new_page(width=842, height=595)',
    'p.insert_text((72, 100), "A landscape slide", fontsize=18)',
  ]);
  const r4 = await probePdf(landscape);
  check("landscape: orientation is detected", (r4.pages ?? []).some((p) => p.landscape), "");

  // --- maxPages caps the read without failing ---
  const r5 = await probePdf(mixed, 2);
  check("maxPages: reads only what was asked", r5.readPages === 2, `got ${r5.readPages}`);
  check("maxPages: reports truncation", r5.truncated === true, "");

  // --- Junk must not crash the server ---
  const junk = await probePdf(Buffer.from("this is not a pdf at all"));
  check("edge: junk bytes are rejected, not thrown", junk.ok === false, junk.error ?? "");
  const empty = await probePdf(Buffer.alloc(0));
  check("edge: an empty buffer is rejected", empty.ok === false, empty.error ?? "");

  rmSync(TMP, { recursive: true, force: true });

  console.log(`\n${failed === 0 ? "PDF INSPECTOR CHECKS PASSED" : `${failed} CHECK(S) FAILED`}`);
  if (failed > 0) process.exit(1);
}

void existsSync;
main().catch((e) => {
  console.error("PDF inspector check crashed:", e);
  process.exit(1);
});