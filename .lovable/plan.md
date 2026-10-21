# Nieuwsbrief in de footer en live cijfers op de homepage

## 1. Nieuwsbriefformulier

**Waarom er nu niets gebeurt:** het formulier probeert een adres bij te werken op basis van het e-mailadres. Dat vereist een uniciteitsregel op e-mail, maar die bestaat niet. Bovendien mogen anonieme bezoekers niet bijwerken. Het verzoek wordt daardoor geweigerd. Er staan nu 0 aanmeldingen in de database.

**Wat er verandert:**
- Het e-mailadres wordt eerst gecontroleerd: zonder spaties, kleine letters en een geldig formaat, maximaal 255 tekens. Is het ongeldig, dan verschijnt onder het veld "Vul een geldig e-mailadres in." en wordt er niets verstuurd.
- Bij een geldig adres wordt een nieuwe aanmelding opgeslagen met het e-mailadres, plus het account als iemand ingelogd is. Daarna wordt niets teruggelezen.
- Bij succes verschijnt "Gelukt! Je staat op de lijst." en wordt het veld leeggemaakt.
- Staat het adres er al, dan verschijnt "Je staat al op de lijst." Dat geldt ook als hoofdletters of spaties anders zijn.
- Bij een andere fout verschijnt "Er ging iets mis. Probeer het opnieuw."
- De meldingen zijn er in alle vijf talen.

**Database:** er komt één regel bij die een e-mailadres maar één keer toestaat, los van hoofdletters. Er staan nog geen aanmeldingen, dus er gaat niets verloren.

**Test in de preview:** een ongeldig adres geeft de foutmelding. Een nieuw adres geeft "Gelukt!" en staat daarna in de database. Hetzelfde adres nog eens, met hoofdletters, geeft "Je staat al op de lijst." Het testadres ruim ik daarna op.

## 2. Statistiekbalk op de homepage

De balk haalt zijn cijfers al live op, maar telt anders dan je wilt. Nu telt hij alleen restaurants met gerechten (vandaar 1.264) en alle actieve steden uit de stedenlijst. Nieuw:
- **Restaurants:** alle actieve restaurants. Nu zijn dat er 2.199, dus de balk toont "2.100+".
- **Steden:** steden met minstens 1 actief restaurant. Nu zijn dat er 30. Dit getal is kleiner dan 100, dus de balk toont het exact. Afronden op honderdtallen zou hier "0+" geven.
- **Gerechten:** goedgekeurde gerechtkoppelingen, door de beheerder of de eigenaar. Nu zijn dat er 83.797, dus de balk toont "83.700+".
- Afronden gaat naar beneden op honderdtallen, met een "+" erachter, voor elk getal vanaf 100. Het getal Reviews blijft zoals het is: verborgen onder de 10.

## Technische details
- `src/lib/validations.ts`: `newsletterEmailSchema` (zod: trim, lowercase, email, max 255).
- `Footer.tsx`: `supabase.from('newsletter_subscribers').insert({ email, user_id: user?.id ?? null })` zonder `.select()`. Fout `23505` wordt "al op de lijst". Een inline foutmelding met `aria-invalid`; `useAuth` levert de gebruiker.
- Migratie: `CREATE UNIQUE INDEX newsletter_subscribers_email_lower_key ON public.newsletter_subscribers (lower(email));`.
- `SocialProof.tsx`: restaurants via `count: exact, head` op `is_active = true` (het aftrekken van lege restaurants vervalt). Steden via `cities.select('id, restaurants!inner(id)', { count: 'exact', head: true }).eq('restaurants.is_active', true)`. Gerechten blijven `approved_by_admin` en `verified_by_owner`. Nieuwe helper `roundDownHundreds` in `src/lib/utils.ts` met een unit-test (2199 → 2100, 83797 → 83700, 30 → 30).
- Unit-tests voor de e-mailcontrole: geldige en ongeldige adressen, hoofdletters en spaties.
