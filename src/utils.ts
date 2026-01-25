/**
 * Check If-None-Match header for 304 responses
 */
export function checkNotModified(
  c: { req: { header: (name: string) => string | undefined } },
  etag: string,
): boolean {
  const ifNoneMatch = c.req.header('If-None-Match');
  if (!ifNoneMatch) return false;

  // Handle multiple ETags (comma-separated) and wildcard
  const tags = ifNoneMatch.split(',').map((t) => t.trim());
  return tags.includes('*') || tags.includes(etag) || tags.includes(`W/${etag}`);
}
