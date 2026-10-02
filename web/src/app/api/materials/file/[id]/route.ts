import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

const MIME_FALLBACK: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  txt: "text/plain",
  md: "text/markdown",
};

/**
 * Serves a student's own file (download menu, diagram labeling). Auth-checked:
 * only the owning user can read it (MATERIALS_SPEC.md §1 privacy).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.document.findFirst({ where: { id, userId: user.id } });
  if (!doc) return NextResponse.json({ ok: false }, { status: 404 });

  try {
    const data = await readFile(join(process.cwd(), "..", doc.storedPath));
    const ext = doc.originalName.split(".").pop()?.toLowerCase() ?? "";
    const type = doc.mimeType || MIME_FALLBACK[ext] || "application/octet-stream";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(data.length),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.originalName)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
}
