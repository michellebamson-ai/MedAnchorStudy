import { deflateSync } from "node:zlib";

/**
 * Minimal PNG encoder.
 *
 * Needed because Tesseract only accepts encoded image files. Images pulled out
 * of a PDF arrive as raw pixels from unpdf, and feeding those to the worker
 * directly makes it raise an uncaught error and take the process down.
 *
 * 8-bit greyscale, no interlacing — enough for the page scans and screenshots
 * this app sees, and small enough to encode cheaply.
 */

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

export function encodePng(width: number, height: number, pixels: Uint8Array | Uint8ClampedArray): Buffer {
  const raw = Buffer.alloc((width + 1) * height);
  const src = Buffer.from(
    (pixels as Uint8Array).buffer,
    (pixels as Uint8Array).byteOffset,
    (pixels as Uint8Array).length
  );
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0; // filter: none
    src.copy(raw, y * (width + 1) + 1, y * width, (y + 1) * width);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Convert raw pixels from unpdf into greyscale. OCR reads luminance, so this
 * both feeds the encoder and improves recognition on tinted scans.
 *
 * `channels` is 1 (grey), 3 (RGB) or 4 (RGBA).
 */
export function rawToPng(width: number, height: number, channels: number, data: Uint8Array | Uint8ClampedArray): Buffer {
  if (channels === 1) return encodePng(width, height, data);

  const out = new Uint8Array(width * height);
  const count = width * height;
  for (let i = 0; i < count; i++) {
    const p = i * channels;
    if (channels === 3) {
      // Rec. 601 luma, which tracks perceived brightness better than a flat mean.
      out[i] = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000;
    } else {
      // Drop alpha: a transparent slide background must read as white, not black.
      const alpha = data[p + 3] / 255;
      const luma = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000;
      out[i] = Math.round(255 + (luma - 255) * alpha);
    }
  }
  return encodePng(width, height, out);
}