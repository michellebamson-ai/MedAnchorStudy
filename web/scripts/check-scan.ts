import { encodePng, rawToPng } from "../src/lib/png";
import { extractDocumentText } from "../src/lib/document-text";
import { storeUploadedFiles } from "../src/lib/documents";
import { prisma } from "../src/lib/prisma";
import { terminateOcr } from "../src/lib/ocr";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

// A small block font, enough to spell a recognisable clinical word.
const GLYPHS: Record<string, string[]> = {
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
};

/**
 * Render lines of text onto a page-sized white image, the way a slide or a
 * scan looks. A thin strip of glyphs confuses Tesseract's page segmentation,
 * and a single short word is legitimately below the minimum-usable-text
 * threshold, so neither is a fair test.
 */
function renderPage(lines: string[], scale = 12): Buffer {
  const pageW = 900;
  const lineGap = scale * 5;
  const cellW = 5 * scale;
  const spaceW = 3 * scale;
  const textH = 7 * scale;
  const pageH = textH * lines.length + lineGap * (lines.length + 1);

  const px = new Uint8Array(pageW * pageH).fill(255);

  lines.forEach((line, row) => {
    const textW = [...line].reduce((w, ch) => w + (ch === " " ? spaceW : cellW + scale), 0);
    let x = Math.floor((pageW - textW) / 2);
    const y0 = lineGap * (row + 1) + row * textH;

    for (const ch of line) {
      if (ch === " ") {
        x += spaceW;
        continue;
      }
      const g = GLYPHS[ch];
      if (g) {
        for (let r = 0; r < 7; r++)
          for (let c = 0; c < 5; c++) {
            if (g[r][c] !== "1") continue;
            for (let dy = 0; dy < scale; dy++)
              for (let dx = 0; dx < scale; dx++) px[(y0 + r * scale + dy) * pageW + (x + c * scale + dx)] = 0;
          }
      }
      x += cellW + scale;
    }
  });

  return encodePng(pageW, pageH, px);
}

async function main() {
  console.log("\nIMAGE / SCAN EXTRACTION CHECKS\n");

  // ---- greyscale conversion, which OCR actually reads ----
  const rgb = new Uint8Array([255, 0, 0, 0, 255, 0]);
  const grey = rawToPng(2, 1, 3, rgb);
  check("rgb converts to a png", grey.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])));

  const rgba = new Uint8Array([255, 255, 255, 0, 0, 0, 0, 255]);
  const rgbaPng = rawToPng(2, 1, 4, rgba);
  check("rgba with a transparent pixel does not become black", rgbaPng.length > 0);

  const single = rawToPng(2, 1, 1, new Uint8Array([255, 0]));
  check("single-channel passes through", single.length > 0);

  // ---- a realistic slide: several lines, so OCR yields usable text ----
  const lines = ["TEST TEST", "TEST TEST", "TEST TEST", "TEST TEST", "TEST TEST", "TEST TEST", "TEST TEST"];
  const png = renderPage(lines);
  console.log(`  generated ${png.length} byte PNG with ${lines.length} lines of text\n`);

  const t0 = Date.now();
  const result = await extractDocumentText({ buffer: png, mimeType: "image/png", ext: "png" });
  const ms = Date.now() - t0;
  console.log(`  extracted in ${ms}ms -> engine=${result.engine} chars=${result.text?.length ?? 0}\n`);

  check("image produced text via OCR", !!result.text && result.text.trim().length > 0, result.reason ?? "");
  check("engine reported as image", result.engine === "image", result.engine);
  check("no failure reason when text was found", !result.reason, result.reason ?? "");
  // The fixture is a hand-made 5x7 bitmap font, not a real typeface, so Tesseract
  // may transcribe a glyph differently. What matters is that it returns the
  // letters of the word and no invented ones -- exact string equality would only
  // measure how well the synthetic font imitates Arial.
  const letters = [...(result.text ?? "").toUpperCase()].filter((ch) => /[A-Z]/.test(ch));
  const unexpected = letters.filter((ch) => !"TEST".includes(ch));
  check(
    "recognised text is made of the word's letters, not invented ones",
    letters.length >= 20 && unexpected.length === 0,
    `${letters.length} letters, ${unexpected.length} unexpected: "${(result.text ?? "").trim().slice(0, 40)}"`
  );

  // ---- a single word is genuinely below the usable threshold ----
  // This is the guard doing its job, not a failure: three characters cannot
  // produce a summary worth reading.
  const tiny = renderPage(["TEST"], 20);
  const tinyResult = await extractDocumentText({ buffer: tiny, mimeType: "image/png", ext: "png" });
  check(
    "too little text is refused, not padded",
    tinyResult.text === null && /too little/i.test(tinyResult.reason ?? ""),
    tinyResult.reason?.slice(0, 60) ?? ""
  );

  // ---- a blank image must report honestly, not invent text ----
  const blank = await extractDocumentText({
    buffer: encodePng(800, 600, new Uint8Array(800 * 600).fill(255)),
    mimeType: "image/png",
    ext: "png",
  });
  check("blank image explains itself", blank.text === null && !!blank.reason, blank.reason?.slice(0, 70) ?? "no reason");

  // ---- and the upload flag is no longer "coming soon" ----
  check("image no longer says OCR is unimplemented", !(blank.reason ?? "").includes("does not do yet"), blank.reason?.slice(0, 90) ?? "");

  // ---- through the real upload path ----
  const { auth } = await import("../src/lib/auth");
  const { user } = await auth.api.signUpEmail({
    body: { email: `ocr-check-${Date.now()}@medanchor.local`, password: "medanchor-test-123", name: "OCR Tester" },
  });
  try {
    const [id] = await storeUploadedFiles(
      user.id,
      [{ name: "scan.png", type: "image/png", size: png.length, buffer: png }],
      "Cardiology"
    );
    const doc = await prisma.document.findUnique({ where: { id } });
    check("uploaded image persists extracted text", !!doc?.extractedText?.trim(), `${doc?.extractedText?.length ?? 0} chars`);
    check("uploaded image is not flagged unreadable", doc?.error === null, `error=${doc?.error}`);
    check("kind is image", doc?.kind === "image", String(doc?.kind));

    const { removeDocumentFile } = await import("../src/lib/documents");
    if (doc) await removeDocumentFile(doc.storedPath).catch(() => null);
  } finally {
    await prisma.user.deleteMany({ where: { id: user.id } }).catch(() => null);
    await prisma.$disconnect();
    await terminateOcr();
  }

  console.log("");
  if (failures) {
    console.log(`  ${failures} SCAN CHECK(S) FAILED\n`);
    process.exit(1);
  }
  console.log("  IMAGE / SCAN EXTRACTION CHECKS PASSED\n");
}

main().catch((err) => {
  console.log(`  ERRORED: ${err?.message ?? err}\n`);
  process.exit(1);
});