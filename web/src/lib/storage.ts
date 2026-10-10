/**
 * File storage (STUDY_PLAN_SPEC deployment notes).
 *
 * Uploads used to be written straight to `data/uploads/` with node:fs, which is
 * fine locally and catastrophic on a host with an ephemeral filesystem — every
 * redeploy silently deletes every student's material. This puts a driver behind
 * an interface: local disk in development, S3-compatible object storage
 * (Cloudflare R2, Backblaze B2, AWS S3) in production.
 *
 * No SDK is bundled. The S3 driver speaks the REST API with SigV4 signed by hand
 * using Web Crypto, which keeps the dependency list at zero and works on any
 * runtime Node supports. If you would rather use the AWS SDK, implement the same
 * three functions and swap it in `storage()` below.
 */

const S3_HOST = process.env.OBJECT_STORAGE_ENDPOINT ?? "";
const BUCKET = process.env.OBJECT_STORAGE_BUCKET ?? "";
const REGION = process.env.OBJECT_STORAGE_REGION ?? "auto";
const ACCESS_KEY = process.env.OBJECT_STORAGE_ACCESS_KEY_ID ?? "";
const SECRET_KEY = process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY ?? "";

export type StorageDriver = "local" | "s3";

export interface StorageStatus {
  driver: StorageDriver;
  configured: boolean;
  bucket: string | null;
  /** Human-readable reason when not usable — surfaced rather than swallowed. */
  problem: string | null;
}

export function storageStatus(): StorageStatus {
  if (!S3_HOST || !BUCKET || !ACCESS_KEY || !SECRET_KEY) {
    const missing = [
      !S3_HOST && "OBJECT_STORAGE_ENDPOINT",
      !BUCKET && "OBJECT_STORAGE_BUCKET",
      !ACCESS_KEY && "OBJECT_STORAGE_ACCESS_KEY_ID",
      !SECRET_KEY && "OBJECT_STORAGE_SECRET_ACCESS_KEY",
    ].filter(Boolean);
    return {
      driver: "local",
      configured: false,
      bucket: null,
      problem: `Object storage not configured (missing ${missing.join(", ")}); uploads are on local disk and will be lost on redeploy.`,
    };
  }
  return { driver: "s3", configured: true, bucket: BUCKET, problem: null };
}

/**
 * Object keys are namespaced per user. Never interpolate a raw filename — that
 * is how path traversal gets in. Dots are legal inside a name but must never
 * form a `.` or `..` segment, which is why the all-dots case is replaced rather
 * than merely sanitised.
 */
export function objectKey(userId: string, filename: string): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "anon";
  const cleaned = filename.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 120);
  const name = cleaned && !/^\.+$/.test(cleaned) ? cleaned : "file";
  return `uploads/${safeUser}/${name}`;
}

export interface PutResult {
  /** Value to store in Document.storedPath. */
  storedPath: string;
  bytes: number;
}

/** Write an object. Returns the storedPath to persist. */
export async function putObject(
  userId: string,
  filename: string,
  body: Buffer | string
): Promise<PutResult> {
  const key = objectKey(userId, filename);
  const bytes = Buffer.byteLength(body);

  if (storageStatus().driver === "s3") {
    const bodyBuf = typeof body === "string" ? Buffer.from(body, "utf8") : body;
    const res = await signedFetch(key, bodyBuf, "PUT");
    if (!res.ok) {
      throw new Error(`Storage PUT ${key} failed: ${res.status} ${await res.text().catch(() => "")}`);
    }
    return { storedPath: `s3://${BUCKET}/${key}`, bytes };
  }

  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join, dirname } = await import("node:path");
  const localPath = join("data", "uploads", userId, filename);
  const abs = join(process.cwd(), "..", localPath);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, body);
  return { storedPath: localPath, bytes };
}

/** Read an object back. */
export async function getObject(storedPath: string): Promise<Buffer | null> {
  if (storedPath.startsWith("s3://")) {
    const key = storedPath.replace(`s3://${BUCKET}/`, "");
    const res = await signedFetch(key, null, "GET");
    if (!res.ok || res.status === 404) return null;
    return Buffer.from(await res.arrayBuffer());
  }
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  try {
    return await readFile(join(process.cwd(), "..", storedPath));
  } catch {
    return null;
  }
}

/** Delete an object. Missing objects are not an error. */
export async function deleteObject(storedPath: string): Promise<void> {
  if (storedPath.startsWith("s3://")) {
    const key = storedPath.replace(`s3://${BUCKET}/`, "");
    await signedFetch(key, null, "DELETE").catch(() => undefined);
    return;
  }
  const { rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  await rm(join(process.cwd(), "..", storedPath), { force: true, recursive: false }).catch(() => undefined);
}

// ------------------------------------------------------------- SigV4 signing

function encodePath(p: string): string {
  return p.split("/").map((seg) => encodeURIComponent(seg)).join("/");
}

function hmac(key: Uint8Array, data: string): Promise<Buffer> {
  return crypto.subtle
    .importKey("raw", key as unknown as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then((k) => crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)))
    .then((sig) => Buffer.from(sig));
}

const sha256 = (data: Buffer | Uint8Array | string): Promise<Buffer> =>
  crypto.subtle
    .digest("SHA-256", typeof data === "string" ? new TextEncoder().encode(data) : (data as BufferSource))
    .then((d) => Buffer.from(d));

function hex(buf: Buffer): string {
  return buf.toString("hex");
}

/**
 * Minimal AWS Signature V4. Enough for R2/B2/S3 GET, PUT and DELETE on a single
 * object; not a general-purpose client.
 */
async function signedFetch(key: string, body: Buffer | null, method: "GET" | "PUT" | "DELETE"): Promise<Response> {
  if (!S3_HOST) throw new Error("Object storage is not configured.");

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = hex(await sha256(body ?? Buffer.alloc(0)));

  // The public URL is used as the canonical host; R2 accepts the endpoint host.
  const host = S3_HOST.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const url = `https://${host}/${BUCKET}/${encodePath(key)}`;

  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };

  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = Object.entries(headers)
    .map(([k, v]) => `${k}:${v.trim()}\n`)
    .join("");

  const canonicalRequest = [
    method,
    `/${BUCKET}/${encodePath(key)}`,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${REGION}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    hex(await sha256(canonicalRequest)),
  ].join("\n");

  const kDate = await hmac(Buffer.from(`AWS4${SECRET_KEY}`, "utf8"), dateStamp);
  const kRegion = await hmac(kDate, REGION);
  const kService = await hmac(kRegion, "s3");
  const kSigning = await hmac(kService, "aws4_request");
  const signature = hex(await hmac(kSigning, stringToSign));

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(url, {
    method,
    headers: { ...headers, authorization },
    // Buffer is a Uint8Array, but the DOM lib types only accept the narrower
    // BodyInit union, so hand it the underlying ArrayBuffer view instead.
    body: method === "PUT" && body ? new Uint8Array(body) : undefined,
  });
}
