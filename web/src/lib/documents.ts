import { deleteObject, putObject } from "@/lib/storage";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { extractText } from "@/lib/analyze";

export const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

const KIND_BY_EXT: Record<string, string> = {
  pdf: "pdf",
  ppt: "slides",
  pptx: "slides",
  key: "slides",
  doc: "text",
  docx: "text",
  txt: "text",
  md: "text",
  markdown: "text",
  csv: "text",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  mp3: "audio",
  m4a: "audio",
  wav: "audio",
  ogg: "audio",
};

export interface IncomingFile {
  name: string;
  type: string;
  size: number;
  buffer: Buffer;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "material";
}

export function kindFor(name: string): { kind: string; ext: string } {
  const ext = extname(name).replace(/^\./, "").toLowerCase();
  return { kind: KIND_BY_EXT[ext] ?? "other", ext };
}

/** Persist files and create Document rows. Throws on oversize files. */
export async function storeUploadedFiles(
  userId: string,
  files: IncomingFile[],
  subject: string | null
): Promise<string[]> {
  const ids: string[] = [];
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      throw new Error("This file is too large. Try splitting it into smaller parts.");
    }
    const { kind, ext } = kindFor(file.name);
    const stored = `${randomUUID()}-${safeName(file.name)}`;
    const { storedPath } = await putObject(userId, stored, file.buffer);

    const extracted = extractText(file.buffer, file.type || "application/octet-stream", ext);

    const doc = await prisma.document.create({
      data: {
        userId,
        title: file.name.replace(/\.[^.]+$/, "") || file.name,
        originalName: file.name,
        kind,
        mimeType: file.type || null,
        bytes: file.size,
        storedPath,
        subject,
        extractedText: extracted,
        status: "uploaded",
        error: extracted || kind === "text" ? null : "unreadable",
      },
    });
    ids.push(doc.id);
  }
  return ids;
}

export async function storePastedText(
  userId: string,
  title: string,
  subject: string | null,
  text: string
): Promise<string> {
  const stored = `${randomUUID()}-pasted.txt`;
  const { storedPath } = await putObject(userId, stored, text);

  const doc = await prisma.document.create({
    data: {
      userId,
      title,
      originalName: "pasted-text.txt",
      kind: "text",
      mimeType: "text/plain",
      bytes: Buffer.byteLength(text),
      storedPath,
      subject,
      extractedText: text,
      status: "uploaded",
    },
  });
  return doc.id;
}

export async function removeDocumentFile(storedPath: string): Promise<void> {
  await deleteObject(storedPath);
}
