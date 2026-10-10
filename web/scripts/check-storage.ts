/**
 * Storage driver checks.
 *
 * The S3 driver signs SigV4 by hand and had never been exercised against a real
 * endpoint, so a subtle mistake — a header in the wrong order, a bad path
 * encoding — would only surface as a 403 on the first upload in production.
 *
 * This runs a local S3-compatible server that recomputes the signature from
 * scratch with Node's crypto and rejects anything that does not match. The
 * verifier shares no code with the driver, so an error in one cannot mask the
 * other. Because the driver reads its config per call, the endpoint can point
 * at localhost over http.
 *
 *   npm run check:storage
 */

import { createHmac, createHash } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const ACCESS_KEY = "AKIAEXAMPLETESTKEY01";
const SECRET_KEY = "test-secret-key-do-not-use-anywhere-real";
const REGION = "auto";
const BUCKET = "medanchor-test";

const hmac = (key: Buffer | string, data: string) =>
  createHmac("sha256", key).update(data, "utf8").digest();
const sha256hex = (data: string | Buffer) =>
  createHash("sha256").update(data).digest("hex");

/** Independent SigV4 verification, written from the AWS spec rather than reused. */
function verifySignature(req: IncomingMessage, body: Buffer): { ok: boolean; reason?: string } {
  const auth = req.headers.authorization ?? "";
  const m = /^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/([^/]+)\/s3\/aws4_request,\s*SignedHeaders=([^,]+),\s*Signature=([0-9a-f]+)$/.exec(
    auth
  );
  if (!m) return { ok: false, reason: "Authorization header malformed" };

  const [, keyId, dateStamp, region, signedHeaders, providedSig] = m;
  if (keyId !== ACCESS_KEY) return { ok: false, reason: `unknown access key ${keyId}` };
  if (region !== REGION) return { ok: false, reason: `region ${region} expected ${REGION}` };

  const amzDate = String(req.headers["x-amz-date"] ?? "");
  if (amzDate.slice(0, 8) !== dateStamp) return { ok: false, reason: "date mismatch" };

  const declaredHash = String(req.headers["x-amz-content-sha256"] ?? "");
  const actualHash = sha256hex(body);
  if (declaredHash !== actualHash) return { ok: false, reason: "payload hash does not match body" };

  const names = signedHeaders.split(";").sort();
  if (names.join(";") !== signedHeaders) return { ok: false, reason: "SignedHeaders not sorted" };

  // Host must be signed, otherwise the request can be replayed elsewhere.
  if (!names.includes("host")) return { ok: false, reason: "host header is not signed" };

  const canonicalHeaders = names
    .map((n) => {
      const v = req.headers[n];
      const flat = Array.isArray(v) ? v.join(",") : String(v ?? "");
      return `${n}:${flat.trim()}\n`;
    })
    .join("");

  const url = new URL(req.url ?? "/", "http://placeholder");
  const canonicalRequest = [
    req.method ?? "",
    url.pathname,
    url.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    actualHash,
  ].join("\n");

  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256hex(canonicalRequest)].join("\n");

  const kSigning = hmac(hmac(hmac(hmac(`AWS4${SECRET_KEY}`, dateStamp), region), "s3"), "aws4_request");
  const expected = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  if (expected !== providedSig) return { ok: false, reason: "signature mismatch" };
  return { ok: true };
}

async function main() {
  console.log("\nSTORAGE DRIVER CHECKS\n");

  const objects = new Map<string, Buffer>();
  let rejected = 0;

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const url = new URL(req.url ?? "/", "http://placeholder");
      const prefix = `/${BUCKET}/`;

      if (!url.pathname.startsWith(prefix)) {
        res.writeHead(404).end("no such bucket");
        return;
      }
      const key = url.pathname.slice(prefix.length);

      const verdict = verifySignature(req, body);
      if (!verdict.ok) {
        rejected++;
        res.writeHead(403).end(`SignatureDoesNotMatch: ${verdict.reason}`);
        return;
      }

      if (req.method === "PUT") {
        objects.set(decodeURIComponent(key), body);
        res.writeHead(200, { ETag: '"x"' }).end();
      } else if (req.method === "GET") {
        const found = objects.get(decodeURIComponent(key));
        if (!found) {
          res.writeHead(404).end("NoSuchKey");
          return;
        }
        res.writeHead(200).end(found);
      } else if (req.method === "DELETE") {
        objects.delete(decodeURIComponent(key));
        res.writeHead(204).end();
      } else {
        res.writeHead(405).end();
      }
    });
  });

  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  console.log(`  mock S3 on 127.0.0.1:${port}/${BUCKET}\n`);

  const endpoint = `http://127.0.0.1:${port}`;
  process.env.OBJECT_STORAGE_ENDPOINT = endpoint;
  process.env.OBJECT_STORAGE_BUCKET = BUCKET;
  process.env.OBJECT_STORAGE_ACCESS_KEY_ID = ACCESS_KEY;
  process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY = SECRET_KEY;
  process.env.OBJECT_STORAGE_REGION = REGION;

  // Imported after env is set, but the driver reads config per call anyway.
  const { putObject, getObject, deleteObject, storageStatus, objectKey } = await import("../src/lib/storage");

  const status = storageStatus();
  check("driver selects s3 when configured", status.driver === "s3" && status.configured, JSON.stringify(status));
  check("bucket reported", status.bucket === BUCKET, String(status.bucket));

  // ---- PUT / GET round trip ----
  const body = Buffer.from("Hypertension is defined as persistently elevated arterial blood pressure.", "utf8");
  const put = await putObject("user-123", "lecture-1.pdf", body);
  check("PUT accepted (signature valid)", rejected === 0, rejected ? `rejected ${rejected}` : "verified");
  check("storedPath uses s3 scheme", put.storedPath.startsWith(`s3://${BUCKET}/`), put.storedPath);
  check("byte count reported", put.bytes === body.length, `${put.bytes}`);

  const read = await getObject(put.storedPath);
  check("GET returns the exact bytes", !!read && read.equals(body), read ? `${read.length} bytes` : "null");

  // ---- Keys needing encoding ----
  const weird = await putObject("user-123", "lecture #2 (final)+v2.pdf", Buffer.from("encoded"));
  const weirdRead = await getObject(weird.storedPath);
  check("key with spaces/#/+/parens round trips", !!weirdRead && weirdRead.toString() === "encoded", weird.storedPath);

  // ---- DELETE ----
  await deleteObject(put.storedPath);
  const afterDelete = await getObject(put.storedPath);
  check("DELETE removes the object", afterDelete === null);
  check("deleting again is not an error", await deleteObject(put.storedPath).then(() => true).catch(() => false));

  // ---- Missing object ----
  check("GET of a missing key returns null", (await getObject(`s3://${BUCKET}/uploads/u/nope.pdf`)) === null);

  // ---- A wrong secret must be rejected by the server, proving the check bites ----
  const { putObject: putWith } = await import("../src/lib/storage");
  process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY = "wrong-secret-entirely";
  const before = rejected;
  let threw = false;
  try {
    await putWith("user-123", "bad.pdf", Buffer.from("x"));
  } catch {
    threw = true;
  }
  check("a wrong secret is rejected", threw && rejected > before, threw ? "threw" : "was accepted");
  process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY = SECRET_KEY;

  // ---- A dead endpoint must fail fast rather than hang ----
  process.env.OBJECT_STORAGE_ENDPOINT = "http://127.0.0.1:1";
  const t0 = Date.now();
  let failed = false;
  try {
    await putObject("user-123", "x.pdf", Buffer.from("x"));
  } catch {
    failed = true;
  }
  const elapsed = Date.now() - t0;
  check("unreachable endpoint fails", failed);
  check("and fails quickly", elapsed < 20_000, `${elapsed}ms`);

  // ---- Fall back to local when unconfigured ----
  delete process.env.OBJECT_STORAGE_ENDPOINT;
  delete process.env.OBJECT_STORAGE_BUCKET;
  delete process.env.OBJECT_STORAGE_ACCESS_KEY_ID;
  delete process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY;
  const localStatus = storageStatus();
  check("falls back to local", localStatus.driver === "local" && !localStatus.configured);
  check("local problem names the missing vars", (localStatus.problem ?? "").includes("OBJECT_STORAGE_ENDPOINT"), localStatus.problem ?? "");

  const local = await putObject("local-user", "notes.txt", Buffer.from("local content"));
  check("local write returns a disk path", local.storedPath.startsWith("data/uploads/"), local.storedPath);
  const localRead = await getObject(local.storedPath);
  check("local read round trips", !!localRead && localRead.toString() === "local content");
  await deleteObject(local.storedPath);

  // ---- Path traversal: assert the property, not an exact filename ----
  // Slashes must be gone, so the result can never escape the prefix. The exact
  // name is not the security property and does not matter.
  const traversal = objectKey("u", "../../etc/passwd");
  const suffix = traversal.slice("uploads/u/".length);
  check("traversal: no slash survives", !suffix.includes("/"), traversal);
  check("traversal: no segment escapes", !suffix.split("/").some((s) => s === ".." || s === "."), suffix);
  check("traversal: stays under uploads/", traversal.startsWith("uploads/u/"), traversal);
  check("all-dots name is replaced", objectKey("u", "..") === "uploads/u/file", objectKey("u", ".."));
  check("user id is sanitised", objectKey("../../root", "f.pdf") === "uploads/root/f.pdf", objectKey("../../root", "f.pdf"));

  // Keep-alive sockets otherwise outlive the server and crash libuv on exit.
  server.closeAllConnections();
  server.close();

  console.log("");
  if (failures) {
    console.log(`  ${failures} STORAGE CHECK(S) FAILED\n`);
    process.exit(1);
  }
  console.log("  STORAGE DRIVER CHECKS PASSED\n");
}

main();