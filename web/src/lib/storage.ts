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
 * runtime Node supports.
 *
 * Configuration is read on every call rather than captured at import. Reading it
 * once meant a misconfigured import produced a permanently wrong driver, and it
 * made the signing path impossible to exercise without restarting the process.
 */

export type StorageDriver = "local" | "s3";

export interface StorageStatus {
  driver: StorageDriver;
  configured: boolean;
  bucket: string | null;
  /** Human-readable reason when not usable — surfaced rather than swallowed. */
  problem: string | null;
}

/** Network calls must not hang a student's upload forever. */
const REQUEST_TIMEOUT_MS = 15_000;

type EnvLike = Record<string, string | undefined>;

interface S3Config {
  host: string;
  /** https for R2/S3/B2, http for a local MinIO or the test server. */
  scheme: "http" | "https";
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
}

function env(): EnvLike {
  return process.env;
}

/** Parse the endpoint into scheme + host, defaulting to https. */
function parseEndpoint(raw: string): { host: string; scheme: "http" | "https" } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    return { host: url.host, scheme: url.protocol === "http:" ? "http" : "https" };
  } catch {
    return null;
  }
}

function s3Config(e: EnvLike = env()): S3Config | null {
  const endpoint = e.OBJECT_STORAGE_ENDPOINT ?? "";
  const bucket = (e.OBJECT_STORAGE_BUCKET ?? "").trim();
  const accessKey = (e.OBJECT_STORAGE_ACCESS_KEY_ID ?? "").trim();
  const secretKey = (e.OBJECT_STORAGE_SECRET_ACCESS_KEY ?? "").trim();

  const parsed = parseEndpoint(endpoint);
  if (!parsed || !bucket || !accessKey || !secretKey) return null;

  return {
    host: parsed.host,
    scheme: parsed.scheme,
    bucket,
    region: (e.OBJECT_STORAGE_REGION ?? "").trim() || "auto",
    accessKey,
    secretKey,
  };
}

export function storageStatus(): StorageStatus {
  if (s3Config()) {
    return { driver: "s3", configured: true, bucket: (env().OBJECT_STORAGE_BUCKET ?? "").trim(), problem: null };
  }
  const missing = [
    !parseEndpoint(env().OBJECT_STORAGE_ENDPOINT ?? "") && "OBJECT_STORAGE_ENDPOINT",
    !(env().OBJECT_STORAGE_BUCKET ?? "").trim() && "OBJECT_STORAGE_BUCKET",
    !(env().OBJECT_STORAGE_ACCESS_KEY_ID ?? "").trim() && "OBJECT_STORAGE_ACCESS_KEY_ID",
    !(env().OBJECT_STORAGE_SECRET_ACCESS_KEY ?? "").trim() && "OBJECT_STORAGE_SECRET_ACCESS_KEY",
  ].filter(Boolean);
  return {
    driver: "local",
    configured: false,
    bucket: null,
    problem: `Object storage not configured (missing ${missing.join(", ")}); uploads are on local disk and will be lost on redeploy.`,
  };
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
  const cfg = s3Config();

  if (cfg) {
    const bodyBuf = typeof body === "string" ? Buffer.from(body, "utf8") : body;
    const res = await signedFetch(cfg, key, bodyBuf, "PUT");
    if (!res.ok) {
      throw new Error(`Storage PUT ${key} failed: ${res.status} ${await res.text().catch(() => "")}`);
    }
    return { storedPath: `s3://${cfg.bucket}/${key}`, bytes: bodyBuf.length };
  }

  // Local driver stores under the same sanitised key the S3 driver would use,
  // so switching drivers later cannot leave a mismatched layout behind.
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join, dirname } = await import("node:path");
  const rel = key.replace(/^uploads\//, "");
  const abs = join(process.cwd(), "..", "data", "uploads", rel);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, body);
  return { storedPath: `data/uploads/${rel}`, bytes: Buffer.byteLength(body) };
}

/** Read an object back. */
export async function getObject(storedPath: string): Promise<Buffer | null> {
  const cfg = s3Config();
  if (cfg && storedPath.startsWith("s3://")) {
    const prefix = `s3://${cfg.bucket}/`;
    // A path from a different bucket is not ours to read.
    if (!storedPath.startsWith(prefix)) return null;
    const key = storedPath.slice(prefix.length);
    const res = await signedFetch(cfg, key, null, "GET");
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
  const cfg = s3Config();
  if (cfg && storedPath.startsWith("s3://")) {
    const prefix = `s3://${cfg.bucket}/`;
    if (!storedPath.startsWith(prefix)) return;
    await signedFetch(cfg, storedPath.slice(prefix.length), null, "DELETE").catch(() => undefined);
    return;
  }
  const { rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  await rm(join(process.cwd(), "..", storedPath), { force: true, recursive: false }).catch(() => undefined);
}

// ------------------------------------------------------------- SigV4 signing

/** RFC 3986 encoding, which is stricter than encodeURIComponent for !'()* */
function uriEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodePath(p: string): string {
  return p.split("/").map((seg) => uriEncode(seg)).join("/");
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
export async function signedFetch(
  cfg: S3Config,
  key: string,
  body: Buffer | null,
  method: "GET" | "PUT" | "DELETE"
): Promise<Response> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = hex(await sha256(body ?? Buffer.alloc(0)));

  const url = `${cfg.scheme}://${cfg.host}/${cfg.bucket}/${encodePath(key)}`;
  const canonicalUri = `/${cfg.bucket}/${encodePath(key)}`;

  // Signed headers must be listed in the order they are signed, and that order
  // is alphabetical. Building it from insertion order happened to work and would
  // silently break the moment a header was added.
  const headers: Record<string, string> = {
    host: cfg.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const signedHeaderNames = Object.keys(headers).sort();
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalHeaders = signedHeaderNames.map((k) => `${k}:${headers[k].trim()}\n`).join("");

  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    hex(await sha256(canonicalRequest)),
  ].join("\n");

  const kDate = await hmac(Buffer.from(`AWS4${cfg.secretKey}`, "utf8"), dateStamp);
  const kRegion = await hmac(kDate, cfg.region);
  const kService = await hmac(kRegion, "s3");
  const kSigning = await hmac(kService, "aws4_request");
  const signature = hex(await hmac(kSigning, stringToSign));

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(url, {
    method,
    headers: { ...headers, authorization },
    body: method === "PUT" && body ? new Uint8Array(body) : undefined,
    // Without this a stalled network hangs the upload indefinitely and the
    // student sees a spinner with no explanation.
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}