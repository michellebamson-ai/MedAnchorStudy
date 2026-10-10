/**
 * Extraction check.
 *
 * Builds real PDF, DOCX and PPTX files in memory — a hand-written PDF, and
 * OOXML zip archives — then asserts the extractors recover the text. Also
 * covers the formats we deliberately do not read, so the honest message is
 * part of the contract rather than a surprise for a student.
 *
 *   npm run check:extract
 */

import { zipSync, strToU8 } from "fflate";
import { extractDocumentText } from "../src/lib/document-text";

const BODY =
  "Hypertension is defined as persistently elevated arterial blood pressure. " +
  "The diagnosis requires at least two readings on separate occasions, because a " +
  "single measurement cannot distinguish sustained hypertension from the transient " +
  "rise caused by pain, anxiety, or white-coat effect in the clinic setting. " +
  "Classification depends on the measured systolic and diastolic values, and the " +
  "category assigned determines the subsequent treatment threshold.";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  console.log(`  [${condition ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures++;
}

// --------------------------------------------------------------------------
// A structurally valid, single-page, uncompressed PDF containing BODY.
// --------------------------------------------------------------------------

function buildPdf(text: string): Buffer {
  const escaped = text.replace(/([\\()])/g, "\\$1");
  const content = `BT /F1 11 Tf 54 720 Td 14 TL (${escaped}) Tj ET`;

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

function buildDocx(text: string): Buffer {
  const xml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:body></w:document>`;
  return Buffer.from(
    zipSync({
      "[Content_Types].xml": strToU8(
        `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
      ),
      "_rels/.rels": strToU8(
        `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
      ),
      "word/document.xml": strToU8(xml),
    })
  );
}

function slideXml(lines: string[]): Uint8Array {
  const paras = lines
    .map((l) => `<a:p><a:r><a:t>${l}</a:t></a:r></a:p>`)
    .join("");
  return strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
      `<p:cSld><p:spTree>${paras}</p:spTree></p:cSld></p:sld>`
  );
}

function buildPptx(): Buffer {
  const s1 = ["Slide one: definition of hypertension", BODY.slice(0, 150)];
  const s2 = ["Slide two: classification thresholds", BODY.slice(150, 320)];
  return Buffer.from(
    zipSync({
      "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Types/>`),
      // slide2 first on purpose: output must be ordered by slide number, not zip order.
      "ppt/slides/slide2.xml": slideXml(s2),
      "ppt/slides/slide1.xml": slideXml(s1),
      "ppt/notesSlides/notesSlide1.xml": slideXml(["Remember to ask about white-coat effect."]),
    })
  );
}

// --------------------------------------------------------------------------

async function main() {
  console.log("\nEXTRACTION CHECKS\n");

  const pdf = await extractDocumentText({
    buffer: buildPdf(BODY),
    mimeType: "application/pdf",
    ext: "pdf",
  });
  console.log(`\nPDF -> engine=${pdf.engine} units=${pdf.units} chars=${pdf.text?.length ?? 0}`);
  check("pdf: recovers text", !!pdf.text?.includes("persistently elevated"));
  check("pdf: page count", pdf.units === 1, `got ${pdf.units}`);
  check("pdf: no failure reason", !pdf.reason);

  const docx = await extractDocumentText({
    buffer: buildDocx(BODY),
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: "docx",
  });
  console.log(`\nDOCX -> engine=${docx.engine} chars=${docx.text?.length ?? 0}`);
  check("docx: recovers text", !!docx.text?.includes("white-coat effect"));

  const pptx = await extractDocumentText({
    buffer: buildPptx(),
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ext: "pptx",
  });
  console.log(`\nPPTX -> engine=${pptx.engine} units=${pptx.units} chars=${pptx.text?.length ?? 0}`);
  check("pptx: slide 1 text", !!pptx.text?.includes("definition of hypertension"));
  check("pptx: slide 2 text", !!pptx.text?.includes("classification thresholds"));
  check("pptx: speaker notes included", !!pptx.text?.includes("white-coat effect"));
  check(
    "pptx: ordered by slide number",
    !!pptx.text && pptx.text.indexOf("definition of hypertension") < pptx.text.indexOf("classification thresholds")
  );
  check("pptx: slide count", pptx.units === 2, `got ${pptx.units}`);

  const plain = await extractDocumentText({
    buffer: Buffer.from(BODY, "utf8"),
    mimeType: "text/plain",
    ext: "txt",
  });
  check("plain: still reads text", !!plain.text?.includes("persistently elevated"));

  // Formats we do not read must say why, and must not throw.
  const legacy = await extractDocumentText({
    buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0]),
    mimeType: "application/msword",
    ext: "doc",
  });
  check("legacy .doc: refuses with a reason", legacy.text === null && !!legacy.reason);

  const image = await extractDocumentText({
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    mimeType: "image/png",
    ext: "png",
  });
  check("image: refuses with a reason", image.text === null && !!image.reason);

  const corrupt = await extractDocumentText({
    buffer: Buffer.from("this is definitely not a pdf", "utf8"),
    mimeType: "application/pdf",
    ext: "pdf",
  });
  check("corrupt pdf: fails without throwing", corrupt.text === null && !!corrupt.reason);

  const tiny = await extractDocumentText({
    buffer: Buffer.from("too short", "utf8"),
    mimeType: "text/plain",
    ext: "txt",
  });
  check("near-empty file: reports too little text", tiny.text === null && !!tiny.reason);

  // ------------------------------------------------------------------------
  // The real upload path. Parsers passing is not enough — the extracted text
  // has to survive storage and land on the Document row, and an unreadable
  // file has to be flagged honestly instead of looking ready.
  // ------------------------------------------------------------------------
  console.log("\n-- through storeUploadedFiles --");

  const { storeUploadedFiles, removeDocumentFile } = await import("../src/lib/documents");
  const { prisma } = await import("../src/lib/prisma");
  const { auth } = await import("../src/lib/auth");

  // storeUploadedFiles has a real foreign key to User, so this needs a real account.
  const { user } = await auth.api.signUpEmail({
    body: {
      email: `extract-${Date.now()}@medanchor.local`,
      password: "medanchor-test-123",
      name: "Extract Tester",
    },
  });
  const stamp = user.id;

  try {
    const pdfId = (
      await storeUploadedFiles(
        stamp,
        [{ name: "lecture-1.pdf", type: "application/pdf", size: 0, buffer: buildPdf(BODY) }],
        "Cardiology"
      )
    )[0];
    const pdfDoc = await prisma.document.findUnique({ where: { id: pdfId } });
    check("db: pdf text persisted", !!pdfDoc?.extractedText?.includes("persistently elevated"));
    check("db: pdf flagged as fine", pdfDoc?.error === null, `error=${pdfDoc?.error}`);
    check("db: pdf kind", pdfDoc?.kind === "pdf", `kind=${pdfDoc?.kind}`);

    // The old code called .docx readable-but-empty, so this used to show
    // "Ready to analyze" and then fail on Analyze.
    const docId = (
      await storeUploadedFiles(
        stamp,
        [{ name: "old-notes.doc", type: "application/msword", size: 4, buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0]) }],
        null
      )
    )[0];
    const legacyDoc = await prisma.document.findUnique({ where: { id: docId } });
    check("db: unreadable .doc is flagged", legacyDoc?.error === "unreadable", `error=${legacyDoc?.error}`);
    check("db: .doc has a human reason", !!legacyDoc?.extractionNote, `note=${legacyDoc?.extractionNote ?? "null"}`);
    check("db: .doc is not claiming readiness", legacyDoc?.extractedText === null);

    for (const id of [pdfId, docId]) {
      const d = await prisma.document.findUnique({ where: { id } });
      if (d) await removeDocumentFile(d.storedPath);
      await prisma.document.delete({ where: { id } }).catch(() => null);
    }
  } finally {
    await prisma.document.deleteMany({ where: { userId: stamp } });
    await prisma.user.delete({ where: { id: stamp } }).catch(() => null);
    await prisma.$disconnect();
  }

  console.log("");
  if (failures) {
    console.log(`  ${failures} EXTRACTION CHECK(S) FAILED\n`);
    process.exit(1);
  }
  console.log("  EXTRACTION CHECKS PASSED\n");
}

main();
