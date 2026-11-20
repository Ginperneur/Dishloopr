/**
 * Returns the trimmed URL only when it parses and uses http: or https:.
 * Use for owner- or database-provided links so javascript:, data: and other schemes never reach an href/src.
 */
export function safeHttpUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? trimmed : undefined;
  } catch {
    return undefined;
  }
}
