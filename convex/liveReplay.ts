"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";

/**
 * Joins a live broadcast's recording parts into the replay video. The host's
 * MediaRecorder output was cut into parts at arbitrary byte boundaries, so
 * the parts back to back are the original file. Runs in Node for the memory
 * a 15-minute recording needs.
 */
export const assemble = internalAction({
  args: {
    postId: v.id("posts"),
    take: v.string(),
    posterStorageId: v.optional(v.id("_storage")),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const parts = await ctx.runQuery(internal.live.recordingParts, {
      postId: args.postId,
      take: args.take,
    });
    if (parts.length === 0) return;
    let storageId: Id<"_storage">;
    try {
      const blobs: Blob[] = [];
      for (const p of parts) {
        const b = await ctx.storage.get(p.storageId);
        if (!b) throw new Error(`Recording part ${p.seq} is missing`);
        blobs.push(b);
      }
      const type = blobs[0].type || "video/webm";
      if (type.includes("webm") && args.duration) {
        // MediaRecorder's WebM has no duration, so players can't show its length or seek.
        const bytes = new Uint8Array(await new Blob(blobs).arrayBuffer());
        storageId = await ctx.storage.store(
          new Blob([withWebmDuration(bytes, args.duration * 1000)], { type }),
        );
      } else if (blobs.length === 1) storageId = parts[0].storageId;
      else storageId = await ctx.storage.store(new Blob(blobs, { type }));
    } catch (e) {
      console.error("Couldn't join the live recording", e);
      await ctx.runMutation(internal.live.discardTake, { postId: args.postId, take: args.take });
      return;
    }
    await ctx.runMutation(internal.live.attachReplay, { ...args, storageId });
  },
});

/* ------------------------------------------------------------------ */
/* WebM duration                                                       */
/* ------------------------------------------------------------------ */

const EBML = 0x1a45dfa3;
const SEGMENT = 0x18538067;
const INFO = 0x1549a966;
const CLUSTER = 0x1f43b675;
const SEEK_HEAD = 0x114d9b74;
const TIMECODE_SCALE = 0x2ad7b1;
const DURATION = 0x4489;

type Vint = { value: number; length: number; unknown: boolean };

/** An EBML variable-length integer at `i`; `keepMarker` for element ids. */
function vint(b: Uint8Array<ArrayBuffer>, i: number, keepMarker: boolean): Vint | null {
  const first = b[i];
  if (first === undefined || first === 0) return null;
  let length = 1;
  while (!(first & (0x80 >> (length - 1)))) length++;
  if (i + length > b.length) return null;
  let value = keepMarker ? first : first & (0xff >> length);
  let ones = value === 0xff >> length;
  for (let k = 1; k < length; k++) {
    value = value * 256 + b[i + k];
    if (b[i + k] !== 0xff) ones = false;
  }
  return { value, length, unknown: !keepMarker && ones };
}

/**
 * Writes `ms` into the Segment Info's Duration (adding the element when the
 * recorder left it out). Returns the bytes unchanged when the layout isn't the
 * simple one MediaRecorder writes (no SeekHead, Info before the first Cluster).
 */
function withWebmDuration(b: Uint8Array<ArrayBuffer>, ms: number): Uint8Array<ArrayBuffer> {
  const header = vint(b, 0, true);
  const headerSize = header && vint(b, header.length, false);
  if (header?.value !== EBML || !headerSize) return b;
  let i = header.length + headerSize.length + headerSize.value;
  const seg = vint(b, i, true);
  const segSize = seg && vint(b, i + seg.length, false);
  if (seg?.value !== SEGMENT || !segSize) return b;
  const segSizeAt = i + seg.length;
  i = segSizeAt + segSize.length;
  for (;;) {
    const id = vint(b, i, true);
    const size = id && vint(b, i + id.length, false);
    if (!id || !size || id.value === CLUSTER || id.value === SEEK_HEAD) return b;
    const dataAt = i + id.length + size.length;
    if (id.value !== INFO) {
      i = dataAt + size.value;
      continue;
    }
    const end = dataAt + size.value;
    let scale = 1_000_000;
    for (let j = dataAt; j < end; ) {
      const cid = vint(b, j, true);
      const csize = cid && vint(b, j + cid.length, false);
      if (!cid || !csize) return b;
      const at = j + cid.length + csize.length;
      if (cid.value === TIMECODE_SCALE) {
        scale = 0;
        for (let k = 0; k < csize.value; k++) scale = scale * 256 + b[at + k];
      } else if (cid.value === DURATION) {
        // Already there: overwrite in place.
        const out = b.slice();
        const view = new DataView(out.buffer, at, csize.value);
        const units = (ms * 1_000_000) / (scale || 1_000_000);
        if (csize.value === 8) view.setFloat64(0, units);
        else if (csize.value === 4) view.setFloat32(0, units);
        return out;
      }
      j = at + csize.value;
    }
    const units = (ms * 1_000_000) / (scale || 1_000_000);
    const duration = new Uint8Array(11);
    duration.set([0x44, 0x89, 0x88]);
    new DataView(duration.buffer).setFloat64(3, units);
    // The new Info size as an 8-byte vint.
    const newSize = size.value + duration.length;
    const sizeBytes = new Uint8Array(8);
    sizeBytes[0] = 0x01;
    for (let k = 7, n = newSize; k >= 1; k--, n = Math.floor(n / 256)) sizeBytes[k] = n % 256;
    const out = new Uint8Array(b.length - size.length + 8 + duration.length);
    out.set(b.subarray(0, i + id.length), 0);
    out.set(sizeBytes, i + id.length);
    out.set(b.subarray(dataAt, end), i + id.length + 8);
    out.set(duration, i + id.length + 8 + size.value);
    out.set(b.subarray(end), i + id.length + 8 + size.value + duration.length);
    // A Segment with a known size grows by what was added.
    if (!segSize.unknown) {
      const grown = segSize.value + (out.length - b.length);
      if (grown >= 2 ** (7 * segSize.length) - 1) return b;
      for (let k = segSize.length - 1, n = grown; k >= 0; k--, n = Math.floor(n / 256))
        out[segSizeAt + k] = n % 256;
      out[segSizeAt] |= 0x80 >> (segSize.length - 1);
    }
    return out;
  }
}
