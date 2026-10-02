import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { storeUploadedFiles } from "@/lib/documents";

/**
 * Multipart upload with client-visible progress (MATERIALS_SPEC.md §1: each
 * file shows a progress bar while it uploads). The browser's XHR upload
 * events drive the bar; the server buffers the part, stores it, and returns
 * the created document ids.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ ok: false, message: "Sign in to add materials." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, message: "Upload stopped. Tap to try again." }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const subject = String(form.get("subject") ?? "").trim() || null;
  if (!files.length) {
    return NextResponse.json({ ok: false, message: "Choose at least one file first." }, { status: 400 });
  }

  try {
    const ids = await storeUploadedFiles(
      user.id,
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

    const docs = await prisma.document.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, kind: true, subject: true, status: true, error: true },
    });

    return NextResponse.json({ ok: true, message: "Material added.", documents: docs });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload stopped. Tap to try again.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
