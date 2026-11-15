// Turns Supabase Auth sign-up errors into Dutch messages a restaurant owner can act on.
// Unknown errors keep Supabase's own text, so a failure is never hidden behind a generic line.

interface AuthErrorLike { message?: string; code?: string; status?: number }

const RULES: { test: (e: Required<Pick<AuthErrorLike, 'message'>> & AuthErrorLike) => boolean; text: string }[] = [
  { test: e => e.code === 'user_already_exists' || /already registered|already been registered/i.test(e.message),
    text: 'Dit e-mailadres is al geregistreerd. Log in of kies "Wachtwoord vergeten".' },
  { test: e => e.code === 'weak_password' && /pwned|leaked|known|breach/i.test(e.message),
    text: 'Dit wachtwoord komt voor in gelekte wachtwoordlijsten. Kies een ander wachtwoord.' },
  { test: e => e.code === 'weak_password' || /password should|password is too weak|at least \d+ characters/i.test(e.message),
    text: 'Dit wachtwoord is niet sterk genoeg. Gebruik minimaal 8 tekens met hoofdletters, kleine letters, cijfers en een leesteken.' },
  { test: e => e.code === 'over_email_send_rate_limit' || e.status === 429 || /rate limit|too many/i.test(e.message),
    text: 'Er zijn net te veel pogingen gedaan. Wacht een paar minuten en probeer het opnieuw.' },
  { test: e => e.code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(e.message),
    text: 'Dit e-mailadres wordt niet geaccepteerd. Controleer het adres of gebruik een ander.' },
  { test: e => /sending (confirmation|magic link)? ?email|error sending|hook/i.test(e.message),
    text: 'Je account kon niet worden aangemaakt omdat de bevestigingsmail niet verstuurd kon worden. Probeer het later opnieuw of mail info@dishloopr.com.' },
  { test: e => /database error saving new user/i.test(e.message),
    text: 'Je account kon niet worden opgeslagen. Probeer het later opnieuw of mail info@dishloopr.com.' },
  { test: e => e.code === 'signup_disabled' || /signups? not allowed|signup is disabled/i.test(e.message),
    text: 'Registreren is op dit moment niet mogelijk. Mail info@dishloopr.com.' },
];

export function signupErrorMessage(error: AuthErrorLike | null | undefined): string {
  const e = { ...error, message: error?.message ?? '' };
  const hit = RULES.find(r => r.test(e));
  if (hit) return hit.text;
  return e.message
    ? `Registreren lukte niet: ${e.message}`
    : 'Er is een fout opgetreden bij het registreren. Probeer het opnieuw.';
}
