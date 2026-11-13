// Password strength for sign-up and reset. Two parts:
//  - passwordStrength(): instant local score with tips (length, variety, guessable patterns)
//  - pwnedCount(): the same leaked-password check Supabase Auth runs (Have I Been Pwned),
//    via k-anonymity: only the first 5 hex chars of the SHA-1 hash leave the browser.

export type StrengthScore = 0 | 1 | 2 | 3 | 4;
export interface StrengthResult { score: StrengthScore; label: string; tips: string[] }

export const STRENGTH_LABELS = ['Te zwak', 'Zwak', 'Matig', 'Goed', 'Sterk'] as const;

const SEQUENCES = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

function hasSequence(pw: string): boolean {
  const lower = pw.toLowerCase();
  return SEQUENCES.some(seq => {
    for (let i = 0; i + 4 <= seq.length; i++) {
      const part = seq.slice(i, i + 4);
      if (lower.includes(part) || lower.includes([...part].reverse().join(''))) return true;
    }
    return false;
  });
}

/** `context`: words the password must not lean on, e.g. the name and the e-mail's local part. */
export function passwordStrength(pw: string, context: string[] = []): StrengthResult {
  if (!pw) return { score: 0, label: '', tips: [] };
  // Most useful first: too short, then guessable patterns, then nice-to-haves.
  const must: string[] = [], risky: string[] = [], nice: string[] = [];
  let points = 0;

  if (pw.length >= 8) points++; else must.push('Gebruik minimaal 8 tekens.');
  if (pw.length >= 12) points++; else if (pw.length >= 8) nice.push('Met 12 tekens of meer wordt het veel sterker.');
  if (pw.length >= 16) points++;

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length;
  if (classes >= 3) points++; else nice.push('Mix kleine letters, hoofdletters, cijfers en leestekens.');

  const lower = pw.toLowerCase();
  const words = [...context, 'dishloopr', 'wachtwoord', 'password', 'welkom', 'restaurant']
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length >= 3);
  if (words.some(w => lower.includes(w))) {
    points -= 2;
    risky.push('Gebruik niet je naam, e-mailadres of een voor de hand liggend woord.');
  }
  if (/^[A-Za-z]+\d{1,4}[^A-Za-z0-9]{0,2}$/.test(pw)) {
    points -= 1;
    risky.push('Eén woord met een cijfer en leesteken erachter is makkelijk te raden. Gebruik liever een paar losse woorden.');
  }
  if (/(.)\1\1/.test(pw) || hasSequence(pw)) {
    points -= 1;
    risky.push('Vermijd reeksen zoals 1234 of abcd en herhaalde tekens.');
  }

  const score = Math.max(0, Math.min(4, points)) as StrengthScore;
  return { score, label: STRENGTH_LABELS[score], tips: [...must, ...risky, ...nice].slice(0, 2) };
}

/** Times the password appears in known breaches; null when the check could not run. */
export async function pwnedCount(pw: string, signal?: AbortSignal): Promise<number | null> {
  try {
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(pw));
    const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, {
      headers: { 'Add-Padding': 'true' },
      signal,
    });
    if (!res.ok) return null;
    const suffix = hex.slice(5);
    for (const line of (await res.text()).split('\n')) {
      const [hash, count] = line.trim().split(':');
      if (hash === suffix) return Number(count) || 0;
    }
    return 0;
  } catch {
    return null;
  }
}
