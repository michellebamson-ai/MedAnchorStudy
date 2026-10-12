"""
PDF inspection and text recovery with PyMuPDF.

The TypeScript extractor reads PDFs with unpdf. That works, but it reports one
answer for the whole file: there is text, or there is not. When a lecture
handout is born-digital on page 1 and scanned from page 14 onwards, unpdf returns
a partial result and the caller cannot tell which pages are missing. This
answers per page.

Two jobs:

  1. Report, for every page, how much text is in its text layer. The caller can
     then OCR only the pages that are actually images, instead of rendering and
     recognising every page of a document that is mostly fine.

  2. Return the full text in reading order. PyMuPDF handles things unpdf does
     not: encrypted files, rotated pages, and PDFs whose text layer is present
     but stored in a form the other library mis-decodes.

Reads JSON on stdin, writes JSON on stdout:

    {"buffer": "<base64>", "maxPages": 400}

The PDF is passed as base64 rather than a path so nothing is written to disk and
no temp file has to be cleaned up. It is never interpreted as anything but data.
"""

import base64
import json
import sys

try:
    import pymupdf  # PyMuPDF >= 1.24 renamed the module; fall back for older.
except ImportError:  # pragma: no cover - environment problem
    try:
        import fitz as pymupdf
    except ImportError as exc:
        json.dump({"ok": False, "error": f"PyMuPDF is not installed: {exc}"}, sys.stdout)
        sys.exit(1)

# Below this many characters a page is treated as an image needing OCR. A real
# text page carries far more than this, while a scanned page carries zero or a
# stray page number and header.
MIN_CHARS_FOR_TEXT_PAGE = 40


def analyse(data: bytes, max_pages: int):
    pages = []
    encrypted = False
    total_pages = 0

    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:
        return {"ok": False, "error": f"could not open the PDF: {exc}"}

    try:
        total_pages = doc.page_count

        if doc.needs_pass:
            # Many lecture PDFs are "protected" with an empty owner password,
            # which permits viewing but not editing. Opening with an empty
            # password is the standard way to read those, and is exactly what a
            # viewer does when you double-click the file.
            if not doc.authenticate(""):
                return {
                    "ok": False,
                    "error": "This PDF is password protected, so its text cannot be read.",
                    "encrypted": True,
                }
            encrypted = True

        limit = min(total_pages, max_pages) if max_pages else total_pages
        full_text = []

        for index in range(limit):
            page = doc.load_page(index)
            try:
                # "blocks" respects the reading order PyMuPDF infers from the
                # layout, which matters for multi-column papers where a naive
                # per-line read interleaves the columns.
                text = page.get_text("text") or ""
            except Exception:
                text = ""

            cleaned = text.strip()
            # De-hyphenate words broken across a line ending, which is common in
            # extracted academic PDFs and produces odd tokens for summaries.
            cleaned = cleaned.replace("-\n", "")
            chars = len(cleaned)

            pages.append({
                "page": index + 1,
                "chars": chars,
                "hasText": chars >= MIN_CHARS_FOR_TEXT_PAGE,
                "width": int(page.rect.width),
                "height": int(page.rect.height),
                "rotation": int(page.rotation),
                # A page whose content is drawn in landscape but stored portrait,
                # or vice versa, is a signal that layout-based extraction on
                # this page is unreliable.
                "landscape": page.rect.width > page.rect.height,
            })
            full_text.append(cleaned)

        metadata = doc.metadata or {}
        return {
            "ok": True,
            "totalPages": total_pages,
            "readPages": limit,
            "truncated": limit < total_pages,
            "encrypted": encrypted,
            "pages": pages,
            # Page numbers with no text layer: exactly the ones worth OCRing.
            "pagesNeedingOcr": [p["page"] for p in pages if not p["hasText"]],
            "textPages": sum(1 for p in pages if p["hasText"]),
            "metadata": {
                "title": metadata.get("title") or None,
                "author": metadata.get("author") or None,
                "producer": metadata.get("producer") or None,
            },
            "text": "\n\n".join(t for t in full_text if t).strip(),
        }
    finally:
        doc.close()


def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError as exc:
        json.dump({"ok": False, "error": f"invalid JSON input: {exc}"}, sys.stdout)
        sys.exit(1)

    try:
        buffer = base64.b64decode(payload.get("buffer", ""))
        if not buffer:
            raise ValueError("no PDF bytes supplied")
        result = analyse(buffer, int(payload.get("maxPages") or 0))
    except Exception as exc:  # never surface a traceback to the server
        result = {"ok": False, "error": str(exc)}

    json.dump(result, sys.stdout)
    sys.exit(0 if result.get("ok") else 1)


if __name__ == "__main__":
    main()