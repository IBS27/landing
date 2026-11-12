import { notFound } from "@tanstack/react-router";

const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

/**
 * Whether `s` is shaped like a Convex document id: base32 bytes holding a
 * varint table number, a 16-byte id and a 2-byte Fletcher-16 footer. Catches
 * malformed URL params before they reach a `v.id()` validator (which would
 * throw). It can't tell which table an id belongs to.
 */
export function isConvexId(s: string): boolean {
  if (s.length < 31 || s.length > 37) return false;
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const c of s) {
    const v = ALPHABET.indexOf(c);
    if (v < 0) return false;
    acc = ((acc << 5) | v) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  if ((acc & ((1 << bits) - 1)) !== 0) return false;

  let pos = 0;
  while (pos < bytes.length && bytes[pos] & 0x80) pos++;
  pos++; // last varint byte
  if (bytes.length - pos !== 18) return false;

  let sum1 = 0;
  let sum2 = 0;
  for (const b of bytes.slice(0, -2)) {
    sum1 = (sum1 + b) & 0xff;
    sum2 = (sum2 + sum1) & 0xff;
  }
  return bytes[bytes.length - 2] === sum1 && bytes[bytes.length - 1] === sum2;
}

/** Route `beforeLoad` guard: a malformed id renders the root's "This Page Isn't Available". */
export function requireConvexId(id: string) {
  if (!isConvexId(id)) throw notFound();
}
