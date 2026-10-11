/**
 * Live object storage check.
 *
 * check:storage proves the driver signs correctly, but against a mock that
 * tolerates whatever region it is given. Cloudflare R2 accepts "auto"; Backblaze
 * B2 validates the region inside the credential scope and answers SignatureDoesNotMatch
 * if it is wrong, which is the single most likely setup mistake.
 *
 * This runs against the real bucket: writes a uniquely named object, reads it
 * back, deletes it, and reports exactly what the provider said if any step fails.
 *
 *   npm run check:storage:live
 *
 * Does nothing destructive: the key is written with a random suffix and removed
 * in the same run.
 */

import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { storageStatus } from "../src/lib/storage";
import { putObject, getObject, deleteObject, signedFetch } from "../src/lib/storage";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  console.log("\nLIVE OBJECT STORAGE CHECKS\n");

  const status = storageStatus();
  if (!status.configured) {
    console.log("  NOT CONFIGURED — uploads are on local disk.");
    console.log(`  ${status.problem}\n`);
    console.log("  Set these in web/.env to enable:");
    console.log("    OBJECT_STORAGE_ENDPOINT");
    console.log("    OBJECT_STORAGE_BUCKET");
    console.log("    OBJECT_STORAGE_ACCESS_KEY_ID");
    console.log("    OBJECT_STORAGE_SECRET_ACCESS_KEY");
    console.log("    OBJECT_STORAGE_REGION   <- Backblaze B2 needs this; R2 uses auto\n");
    process.exit(1);
  }

  const endpoint = process.env.OBJECT_STORAGE_ENDPOINT ?? "";
  const region = process.env.OBJECT_STORAGE_REGION ?? "auto";
  console.log(`  endpoint : ${endpoint}`);
  console.log(`  bucket   : ${status.bucket}`);
  console.log(`  region   : ${region}\n`);

  // The region is what silently breaks B2, so call it out rather than let the
  // first 403 explain it.
  const looksLikeB2 = /backblazestorage\.com/i.test(endpoint);
  if (looksLikeB2 && (!region || region === "auto")) {
    check("Backblaze region is set", false, "OBJECT_STORAGE_REGION is 'auto'; B2 will reject the signature");
  } else {
    check("region looks usable", !!region, region);
  }

  // ---- real write / read / delete ----
  const marker = `live-check-${randomUUID().slice(0, 8)}.txt`;
  const body = Buffer.from(`MedAnchor Study live storage check ${new Date().toISOString()}\n`, "utf8");
  const userId = "live-check";

  let stored: string | null = null;
  try {
    const put = await putObject(userId, marker, body);
    stored = put.storedPath;
    check("PUT accepted by the provider", true, `${put.storedPath} (${put.bytes} bytes)`);
  } catch (err) {
    const msg = (err as Error).message;
    console.log(`\n  PUT failed: ${msg}\n`);
    if (/SignatureDoesNotMatch/i.test(msg)) {
      console.log("  That usually means one of:");
      console.log("    - OBJECT_STORAGE_REGION is wrong (Backblaze B2 needs the region from its endpoint)");
      console.log("    - the secret belongs to a different key than the access key id");
      console.log("    - the clock is significantly off\n");
    }
    if (/AccessDenied|InvalidAccessKeyId/i.test(msg)) {
      console.log("  The key was rejected. Check it has Files: Read & Write on this bucket.\n");
    }
    if (/NoSuchBucket/i.test(msg)) {
      console.log("  The bucket name does not exist, or the key cannot see it.\n");
    }
    failures++;
  }

  if (stored) {
    const read = await getObject(stored);
    check("GET returns identical bytes", !!read && read.equals(body), read ? `${read.length} bytes` : "null");

    await deleteObject(stored);
    const gone = await getObject(stored);
    check("DELETE removes it", gone === null);
  }

  // ---- the raw path, to surface a provider error verbatim ----
  try {
    const cfg = {
      host: endpoint.replace(/^https?:\/\//i, "").replace(/\/$/, ""),
      scheme: "https" as const,
      bucket: status.bucket ?? "",
      region,
      accessKey: process.env.OBJECT_STORAGE_ACCESS_KEY_ID ?? "",
      secretKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY ?? "",
    };
    const res = await signedFetch(cfg, `uploads/${userId}/does-not-exist-probe.txt`, null, "GET");
    check("a missing object reports 404, not an auth error", res.status === 404, `HTTP ${res.status}`);
  } catch (err) {
    check("signed GET probe", false, (err as Error).message.slice(0, 100));
  }

  await prisma.$disconnect().catch(() => null);

  console.log("");
  if (failures) {
    console.log(`  ${failures} LIVE STORAGE CHECK(S) FAILED\n`);
    process.exit(1);
  }
  console.log("  LIVE OBJECT STORAGE CHECKS PASSED\n");
  console.log("  Uploads will now survive a redeploy.\n");
}

main().catch((err) => {
  console.log(`  ERRORED: ${err?.message ?? err}\n`);
  process.exit(1);
});