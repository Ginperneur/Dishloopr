import { isSafePublicUrl } from "./auth.ts";

/** True when an IPv4 address (dotted quad) is not a public, routable address. */
export function isPrivateIPv4(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return true;
  const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && c === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

/** True when an IPv6 address is not a public, routable address. */
export function isPrivateIPv6(ip: string): boolean {
  const h = ip.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (h === "::" || h === "::1") return true;
  // IPv4-mapped / compatible (::ffff:a.b.c.d or ::ffff:aabb:ccdd)
  const mapped = h.match(/^(?:0{0,4}:){2,5}(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  const mappedHex = h.match(/^(?:0{0,4}:){2,5}ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16), lo = parseInt(mappedHex[2], 16);
    return isPrivateIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  if (h.startsWith("::ffff:")) return true;
  const first = parseInt(h.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local
  if ((first & 0xff00) === 0xff00) return true; // multicast
  if (h.startsWith("64:ff9b:")) return true; // NAT64
  if (h.startsWith("2001:db8")) return true; // documentation
  if (h.startsWith("100::")) return true; // discard
  return false;
}

/**
 * Async SSRF check: syntax check (isSafePublicUrl) plus DNS resolution (A and AAAA).
 * Every resolved address must be public. Hostnames that resolve to nothing are rejected.
 */
export async function isSafePublicUrlResolved(raw: string): Promise<boolean> {
  if (!isSafePublicUrl(raw)) return false;
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  // Literal IPs
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return !isPrivateIPv4(host);
  if (host.includes(":")) return !isPrivateIPv6(host);
  const addrs: string[] = [];
  let anyOk = false;
  for (const type of ["A", "AAAA"] as const) {
    try {
      const res = await Deno.resolveDns(host, type);
      anyOk = true;
      addrs.push(...(res as string[]));
    } catch (_e) {
      // NXDOMAIN / no record of this type; handled below
    }
  }
  if (!anyOk || addrs.length === 0) return false;
  for (const ip of addrs) {
    if (ip.includes(":") ? isPrivateIPv6(ip) : isPrivateIPv4(ip)) return false;
  }
  return true;
}

export class UnsafeUrlError extends Error {
  constructor(message = "URL is niet toegestaan") { super(message); this.name = "UnsafeUrlError"; }
}

export interface SafeFetchOptions {
  /** Max body bytes read (default 5 MB). The returned Response body is truncated to this size. */
  maxBytes?: number;
  /** Max redirect hops (default 4). */
  maxRedirects?: number;
}

/**
 * fetch() for URLs that come from a request or the database. Resolves DNS and rejects private
 * ranges on every hop (redirects are followed manually), and caps the response body size.
 * Throws UnsafeUrlError when a hop is not allowed. Note: DNS is validated right before the fetch,
 * the platform resolves again; this blocks direct and redirect-based SSRF but not a DNS-rebinding
 * race with a TTL of 0.
 */
export async function safeFetch(
  url: string,
  init: RequestInit = {},
  opts: SafeFetchOptions = {},
): Promise<Response> {
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024;
  const maxRedirects = opts.maxRedirects ?? 4;
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (!(await isSafePublicUrlResolved(current))) throw new UnsafeUrlError();
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      try { await res.body?.cancel(); } catch (_e) { /* ignore */ }
      current = new URL(res.headers.get("location")!, current).toString();
      continue;
    }
    return capBody(res, maxBytes);
  }
  throw new UnsafeUrlError("Te veel redirects");
}

function capBody(res: Response, maxBytes: number): Response {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    try { res.body?.cancel(); } catch (_e) { /* ignore */ }
    throw new UnsafeUrlError("Antwoord te groot");
  }
  if (!res.body) return res;
  let seen = 0;
  const limiter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > maxBytes) {
        controller.error(new UnsafeUrlError("Antwoord te groot"));
        return;
      }
      controller.enqueue(chunk);
    },
  });
  return new Response(res.body.pipeThrough(limiter), {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}
