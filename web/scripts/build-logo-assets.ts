/**
 * Produce the sizes the app and browsers need from the original logo file.
 *
 * The source is the supplied 1254px PNG at roughly 1.5 MB, far too heavy to
 * serve on every page. Everything here is derived from that one file so the
 * artwork is never re-drawn or re-coloured, only resampled.
 *
 * The source is intentionally NOT committed: a 1.5 MB binary that nothing at
 * runtime reads directly is dead weight in git history forever. If you clone
 * this fresh, drop the logo at public/brand/logo.png first, then run this.
 *
 * Run: npx tsx scripts/build-logo-assets.ts
 */
import sharp from "sharp";

const SOURCE = "public/brand/logo.png";

const OUTPUTS = [
  { file: "public/brand/logo-512.png", size: 512 },
  { file: "public/brand/logo-256.png", size: 256 },
  { file: "public/brand/logo-128.png", size: 128 },
  { file: "public/brand/icon-192.png", size: 192 },
  { file: "public/brand/icon-512.png", size: 512 },
  { file: "public/app-icon.png", size: 512 },
];

async function main() {
  const meta = await sharp(SOURCE).metadata();
  console.log(`\n  source: ${SOURCE}  ${meta.width} x ${meta.height}`);

  for (const { file, size } of OUTPUTS) {
    await sharp(SOURCE)
      // LANCZOS keeps the thin coils and barbs crisp rather than smeared.
      .resize(size, size, { fit: "fill", kernel: "lanczos3" })
      .png({ compressionLevel: 9, quality: 90 })
      .toFile(file);
    const kb = Math.round((await import("node:fs")).statSync(file).size / 1024);
    console.log(`  ${file.padEnd(30)} ${size}px  ${kb} KB`);
  }

  console.log("\n  Done. The source file itself is untouched.\n");
}

main().catch((e) => {
  console.log("FAILED:", e?.message ?? e);
  process.exit(1);
});