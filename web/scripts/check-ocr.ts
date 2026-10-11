/**
 * OCR checks.
 *
 * Before this, a scanned lecture PDF uploaded and silently produced nothing,
 * because it has no text layer to extract. Almost every university PDF is a
 * scan, so that was the difference between working on real course material and
 * not.
 *
 * The image here is generated in-memory -- a PNG is encoded by hand so the test
 * carries no binary fixture -- and recognised for real. Asserting only that
 * the API returns without throwing would pass even if every character were
 * garbage.
 *
 *   npm run check:ocr
 */

import { deflateSync } from "node:zlib";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

// --- A minimal PNG encoder: 8-bit greyscale, no interlacing. -----------------

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

function encodePng(width: number, height: number, pixels: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  const raw = Buffer.alloc((width + 1) * height);
  const src = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.length);
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0; // filter: none
    src.copy(raw, y * (width + 1) + 1, y * width, (y + 1) * width);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- A 5x7 bitmap font, enough for the word used below. ---------------------

const GLYPHS: Record<string, string[]> = {
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
};

function renderWord(word: string, scale: number): Buffer {
  const gap = scale * 2;
  const cellW = 5 * scale;
  const width = word.length * cellW + (word.length - 1) * gap + gap * 2;
  const height = 7 * scale + gap * 2;
  const px = new Uint8Array(width * height).fill(255); // white

  let x = gap;
  for (const ch of word) {
    const glyph = GLYPHS[ch];
    if (glyph) {
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (glyph[row][col] !== "1") continue;
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              const p = (gap + row * scale + dy) * width + (x + col * scale + dx);
              px[p] = 0; // black
            }
          }
        }
      }
    }
    x += cellW + gap;
  }
  return encodePng(width, height, px);
}

async function main() {
  console.log("\nOCR CHECKS\n");

  const { ocrImage, looksLikeImage, terminateOcr, OCR_ENABLED, OCR_MAX_IMAGES, isOcrCandidate } = await import("../src/lib/ocr");

  check("OCR is enabled by default", OCR_ENABLED);

  // ---- generate a real image containing real text ----
  const word = "TEST";
  const png = renderWord(word, 12);
  console.log(`  generated ${png.length} byte PNG containing "${word}"`);

  check("PNG encoder produced a valid file", png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])));
  check("IHDR present", png.includes(Buffer.from("IHDR")));
  check("IEND present", png.includes(Buffer.from("IEND")));

  // ---- recognise it for real ----
  const t0 = Date.now();
  const result = await ocrImage(png);
  const ms = Date.now() - t0;
  const text = (result.text ?? "").replace(/\s+/g, " ").trim();
  console.log(`\n  recognised in ${ms}ms -> "${text}" (confidence ${Math.round(result.confidence ?? 0)})\n`);

  check("OCR returned text", text.length > 0, `${text.length} chars`);
  check("OCR confidence is plausible", (result.confidence ?? 0) > 30, `${Math.round(result.confidence ?? 0)}`);

  // Every character is a judgement call for a hand-drawn bitmap font, so assert
  // that most of the word survived rather than demanding it be pixel perfect.
  const hits = word.split("").filter((c) => text.toUpperCase().includes(c)).length;
  check("most of the word was recognised", hits >= 3, `${hits}/${word.length} letters matched: "${text}"`);

  // ---- an image with no text must say so, not invent something ----
  const blank = encodePng(120, 80, new Uint8Array(120 * 80).fill(255));
  const blankResult = await ocrImage(blank);
  check("blank image yields no text", (blankResult.text ?? "").trim().length === 0, `confidence ${Math.round(blankResult.confidence ?? 0)}`);

  // ---- garbage input must not crash the process ----
  // tesseract.js raises an uncaught error from inside its worker for unreadable
  // input, which would take the server down rather than reject. Validation has
  // to happen before recognize is ever called.
  check("text is not an image", !looksLikeImage(Buffer.from("this is not an image at all", "utf8")));
  check("random bytes are not an image", !looksLikeImage(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])));
  check("empty buffer is not an image", !looksLikeImage(Buffer.alloc(0)));
  check("truncated png is not an image", !looksLikeImage(png.subarray(0, 6)));
  check("a real png passes the check", looksLikeImage(png));

  let survived = true;
  try {
    const r = await ocrImage(Buffer.from("this is not an image at all", "utf8"));
    survived = r.text.length === 0;
  } catch {
    survived = false;
  }
  check("non-image input returns empty rather than throwing", survived);

  // ---- which files are worth sending to OCR ----
  check("scanned PDF is an OCR candidate", isOcrCandidate("scan.pdf", "application/pdf"));
  check("png is an OCR candidate", isOcrCandidate("slide.png", "image/png"));
  check("jpeg is an OCR candidate", isOcrCandidate("photo.jpg", "image/jpeg"));
  check("plain text is not", !isOcrCandidate("notes.txt", "text/plain"));
  check("docx is not", !isOcrCandidate("notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
  check("page budget is bounded and sane", OCR_MAX_IMAGES > 0 && OCR_MAX_IMAGES <= 40, `${OCR_MAX_IMAGES}`);

  console.log("");
  // The Tesseract worker holds the event loop open, so without this the
  // script never exits and the suite appears to hang forever.
  await terminateOcr();
  if (failures) {
    console.log(`  ${failures} OCR CHECK(S) FAILED\n`);
    process.exit(1);
  }
  console.log("  OCR CHECKS PASSED\n");
}

main().catch((err) => {
  console.log(`  OCR CHECKS ERRORED: ${err?.message ?? err}\n`);
  process.exit(1);
});