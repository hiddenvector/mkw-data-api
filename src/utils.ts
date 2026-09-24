import type { Context } from 'hono';

/**
 * cyrb53: fast, non-cryptographic 53-bit string hash.
 * Used only to derive cache validators, never for anything security-sensitive.
 */
export function hash53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Builds a strong ETag from a version prefix and the serialized response body.
 * Any change to the body or to the prefix (service version) yields a new ETag.
 */
export function makeEtag(prefix: string, body: unknown): string {
  return `"${prefix}-${hash53(JSON.stringify(body)).toString(36)}"`;
}

/** Strips the weak-validator prefix so If-None-Match uses weak comparison (RFC 9110 §13.1.2). */
const opaqueTag = (tag: string) => (tag.startsWith('W/') ? tag.slice(2) : tag);

/**
 * Sets the ETag header and reports whether the request's If-None-Match matches it.
 * Callers should return a 304 when this is true.
 */
export function isNotModified(c: Context, etag: string): boolean {
  c.header('ETag', etag);

  const ifNoneMatch = c.req.header('If-None-Match');
  if (!ifNoneMatch) return false;

  const target = opaqueTag(etag);
  return ifNoneMatch
    .split(',')
    .map((t) => t.trim())
    .some((t) => t === '*' || opaqueTag(t) === target);
}
