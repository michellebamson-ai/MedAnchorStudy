/**
 * One-off: render the emblem to the raster sizes the app and browsers need.
 * Run manually with: npx tsx scripts/build-logo-assets.ts
 */
import sharp from "sharp";

const SIZES = [
  { file: "public/brand/logo-512.png", size: 512 },
  { file: "public/brand/logo-1024.png", size: 1024 },
  { file: "public/brand/favicon-192.png", size: 192 },
  { file: "public/brand/favicon-512.png", size: 512 },
];

async function main() {
  for (const { file, size } of SIZES) {
    await sharp("public/brand/logo.svg", { density: 600 })
      .resize(size, size, { fit: "contain", background: "#000000" })
      .png({ compressionLevel: 9 })
      .toFile(file);
    console.log(`  ${file}  ${size}x${size}`);
  }
  console.log("\n  Done.");
}

main().catch((e) => {
  console.log("FAILED:", e?.message ?? e);
  process.exit(1);
});