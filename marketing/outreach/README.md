# Mailgolf naar restauranteigenaren

Doel: elk restaurant in Dishloopr krijgt één persoonlijke mail, eigenaren claimen hun pagina, en de warmste reacties komen gesorteerd bij jou terecht zodat ze klant worden (Uitgelicht, Owner Pro, evenementen).

## Hoe het werkt

```
restaurants + restaurant_contacts + restaurants_verborgen
        │
        ▼
outreach_targets (view)          segment + mail_status per restaurant, ook de CSV download
        │
        ▼
outreach-send-wave (agent)       elk uur op werkdagen 9 tot 17 uur een batch, tot de daglimiet
        │  mail A: online en zichtbaar        → claim gratis + aanbod
        │  mail B: online, niet zichtbaar     → claim en vul je menu aan, of stuur je menu terug + aanbod
        ▼
eigenaar antwoordt  →  antwoord+<restaurant id>@<inbound domein>
        │
        ▼
outreach-inbound (agent)         slaat op, AI kwalificeert: categorie, prioriteit, dealkans,
        │                        samenvatting, aanbevolen actie, conceptantwoord
        │  afmelden en automatische antwoorden handelt de agent zelf af
        ▼
Admin > Outreach > Inbox         jij leest, past het concept aan en klikt Verstuur
                                 (hete leads krijg je ook direct per mail)
```

De agent stuurt nooit zelf een inhoudelijk antwoord: alles wat geen afmelding of autoreply is, wacht op jouw klik.

## Segmenten

| Segment | Wie | Mail |
|---|---|---|
| zichtbaar | actief restaurant (heeft goedgekeurde gerechten) | A |
| onzichtbaar_menu | in `restaurants_verborgen` met een reden over menu, gerecht of kaart (of zonder reden) en minder gerechten dan het minimum | B |
| uitgesloten | inactief om een andere reden (gesloten, dubbel, …) | geen |

Binnen een segment wordt alleen `mail_status = mailbaar` gemaild. Niet gemaild: al geclaimd, geen geldig adres, afgemeld (ook via het opt-out formulier), en eenmanszaken en vof's zolang "Eenmanszaken en vof overslaan" aan staat. Dat laatste staat standaard aan omdat de Telecommunicatiewet bij natuurlijke personen vooraf toestemming vraagt voor ongevraagde commerciële mail. Zet het alleen uit na eigen juridisch advies.

Per golf krijgt een restaurant maximaal één mail (database slot op restaurant + golf). Een volgende golf (bijvoorbeeld een herinnering) start je door "Golf" op 2 te zetten; pas dan wel eerst de tekst aan.

## Zichtbaarheidsregel en claimen van verborgen restaurants

- **Regel:** een restaurant is zichtbaar voor gasten vanaf **5 gerechten** (drankjes tellen niet mee). Het getal stel je in onder Admin > Outreach > Mail en instellingen; mail B noemt het en zegt hoeveel gerechten we nu van het restaurant kennen.
- **Automatisch online:** een restaurant dat om zijn menu verborgen is, komt vanzelf online zodra het het minimum haalt. Een databasetrigger regelt dat bij elke goedgekeurde gerechtkoppeling, of die nu komt van een eigenaar die zijn menu uploadt of van jou als admin.
- **Claimen kan nu ook als je verborgen bent:** `/claim/<slug>` werkt voor verborgen restaurants. Op de claimpagina staat dan wat er ontbreekt. Na goedkeuring ziet de eigenaar zijn restaurant in het dashboard, met een balk "nog X gerechten te gaan" en een knop naar de menu-upload.
- Restaurants die om een andere reden verborgen zijn (gesloten, dubbel), blijven onvindbaar en niet claimbaar.

## Flyer

De flyer staat in Supabase Storage (publieke bucket `marketing`, bestand `outreach/dishloopr-flyer.pdf`), los van de website, dus hij werkt meteen en hoeft niet te wachten op een deploy.

- **Uploaden of vervangen:** Admin > Outreach > Mail en instellingen > "Flyer uploaden (pdf)". Een nieuwe upload vervangt de oude; volgende mails krijgen meteen de nieuwe.
- **Bijlage, link of uit:** in hetzelfde blok. Bijlage = pdf mee in de mail ("In de bijlage vind je onze flyer…"). Link = geen bijlage maar een link "Download onze flyer (pdf)", lichter en beter voor de spamscore. Uit = geen flyer en geen flyerzin.
- **Terugval:** is de flyer onbereikbaar, dan gaan de mails gewoon de deur uit zonder flyerzin (alle belangrijke info staat ook in de mail zelf) en zie je bovenaan Admin > Outreach een waarschuwing tot het weer werkt.

## Database als bestand

Admin > Outreach > "Database downloaden (CSV)": alle restaurants met segment, mail_status, mailadres, telefoon, website, rechtsvorm, KvK, gerechten, golf en afmeldstatus. Puntkomma gescheiden, opent direct in Excel. Of in de Supabase SQL editor: `select * from outreach_targets;`

## Eenmalig instellen (jij)

1. **Migratie draaien**: `drizzle/migrations/0025_outreach_agent.sql` (ook in `supabase/migrations/20261112150000_outreach_agent.sql`). Maakt de tabellen, de view, de afmeldfunctie en de cronjob. De cron doet niets zolang "Automatisch versturen" uit staat.
2. **Edge functions deployen**: `outreach-send-wave`, `outreach-inbound`, `outreach-reply`, `outreach-unsubscribe`.
3. **Inbound mail bij Resend**: voeg een ontvangstdomein toe, bijvoorbeeld `reply.dishloopr.com` (MX record naar Resend), en maak een webhook voor `email.received` naar `https://uktafmxojymsojqewzuy.supabase.co/functions/v1/outreach-inbound`.
4. **Secrets in Supabase**:
   - `OUTREACH_REPLY_DOMAIN` = `reply.dishloopr.com` (het ontvangstdomein uit stap 3)
   - `OUTREACH_INBOUND_SECRET` = de signing secret van die webhook (begint met `whsec_`)
   - `OUTREACH_NOTIFY_EMAIL` = jouw adres voor meldingen over hete leads
   - optioneel `OUTREACH_FROM` (standaard `Ginuwine Ayanne van Dishloopr <hallo@dishloopr.com>`) en `OUTREACH_SENDER_NAME` (standaard `Ginuwine Ayanne`)
   - `RESEND_API_KEY` en `LOVABLE_API_KEY` bestaan al.
5. **Testen**: Admin > Outreach > Mail en instellingen, zoek een restaurant, bekijk de mail en klik "Stuur testmail naar mij". Antwoord op die testmail en kijk of hij in de Inbox verschijnt met een kwalificatie.
6. **Starten**: klik eerst één keer "Volgende batch nu versturen" en kijk een dag naar bounces en antwoorden. Daarna "Automatisch versturen" aan.

## Tempo

Standaard 40 per batch en 150 per dag. Een nieuw verzendpatroon vanaf dishloopr.com in één keer naar duizenden adressen landt in spam en schaadt ook je transactionele mail (claimcodes). Bij weinig bounces en klachten na een week kun je naar 300 en daarna 500 per dag. Met 150 per dag ben je in ongeveer een maand rond; wil je alle zichtbare restaurants voor 1 december gehad hebben, ga dan na de eerste goede dagen naar 300 per dag.

## Categorieën in de inbox

wil claimen, interesse Uitgelicht, interesse Owner Pro, menu aangeleverd, vraag, wil gebeld worden, niet geïnteresseerd, afmelden (automatisch verwerkt), gegevens onjuist, wil verwijderd worden, verkeerde persoon, klacht, automatisch antwoord (automatisch gearchiveerd), overig. De lijst sorteert op dealkans, zodat de warmste leads bovenaan staan.

Bij "menu aangeleverd": open de bijlage via de knop, zet het menu erin (bestaande menuparser in de admin) en antwoord met het concept. Haalt het restaurant daarmee het minimum, dan staat het automatisch online.

## Bestanden

- `supabase/functions/_shared/outreach/templates.ts`: de mailteksten (lees ze in `mailteksten.md`)
- `supabase/functions/outreach-send-wave/`: verzenden, preview, testmail
- `supabase/functions/outreach-inbound/`: ontvangen en kwalificeren
- `supabase/functions/outreach-reply/`: jouw antwoord versturen, bijlagen ophalen
- `supabase/functions/outreach-unsubscribe/`: one click afmelden vanuit Gmail en Apple Mail
- `src/components/admin/OutreachManager.tsx`: het admin scherm
- `supabase/tests/outreach.ts`: controleert de mails (geen streepjes, juiste prijzen en data)
