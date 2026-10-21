# Restaurant claimen zonder sms

## Wat de eigenaar ziet
1. **Startknop** op elke restaurantpagina zonder eigenaar: "Is dit jouw restaurant? Claim gratis", bij de naam en onderaan. Gaat naar `/claim/:slug`. Niet ingelogd: inloggen of registreren, daarna automatisch terug. `/restaurant/:slug?claim=1` opent de claim meteen.
2. **Claimpagina** met twee routes. Sms is verborgen en de tekst over "telefoonverificatie" verdwijnt:
   - **A. Zakelijk e-mailadres (direct):** het adres moet op het domein van de restaurantwebsite eindigen (zonder www, subdomeinen mogen). Er gaat een 6-cijferige code naar alleen dat adres. De code is 15 minuten geldig, je hebt maximaal 5 pogingen en kunt maximaal 3 codes per uur per claim aanvragen. Met de juiste code ben je meteen geverifieerd eigenaar.
   - **B. Handmatig:** voor restaurants zonder website of als je geen mailadres op het eigen domein hebt. Je uploadt bewijs (KvK-uittreksel, of een foto van een factuur of menukaart met de restaurantnaam) en vult naam, functie en telefoonnummer in. Daarna zie je: "We controleren je aanvraag binnen 2 werkdagen."
3. **Al geclaimd:** "Dit restaurant is al geclaimd. Onterecht? Neem contact op", met een link naar het contactformulier. Per gebruiker kan er per restaurant één claim tegelijk openstaan.
4. **Na goedkeuring:** je gaat door naar het restaurant-dashboard met een checklist: menu en prijzen, openingstijden, foto's, parkeerinformatie en sfeer-tags.
5. **Beheer:** een pagina "Claims" die alleen admins zien. Daarop staan openstaande aanvragen met bewijsstukken en de knoppen Goedkeuren en Afwijzen (met reden). De aanvrager krijgt in beide gevallen een e-mail. Alles wordt gelogd.

## Technische details
- De bestaande functie verify-claim wordt uitgebreid. Ze werkt al met de huidige claimtabel en het eigenaarsrecht, en daar zijn het dashboard en de beveiliging op gebouwd. Bij goedkeuring komt er bovendien een rij in claim_requests (`approved`) en in restaurant_team_members (rol owner). Verder worden restaurants.claim_status = `verified_owner` en claimed_by_owner_id gezet, en komt er een regel in claim_activity_logs.
- Codes: geldigheid van 30 naar 15 minuten. Er komt een server-side limiet van 3 codes per uur per claim. De code wordt gehasht opgeslagen in claim_verification_secrets.
- Route B: nieuwe action `submit_manual` die de bewijsbestanden opslaat in een privé-opslagmap per gebruiker. Daarnaast komen er een claim_requests-rij `pending`, restaurants.claim_status = `claimed_unverified` en een log.
- Nieuwe actions `admin_approve` en `admin_reject` (alleen voor admins, gecontroleerd op de server). Goedkeuren gebruikt dezelfde stap als route A.
- Server-side regels: geen nieuwe claim als het restaurant `verified_owner` is, en geen tweede openstaande claim. Hiervoor gebruik ik can_create_claim plus een extra controle.
- E-mail: de codes gaan net als nu via de bestaande verzendmethode. Goedkeuring en afwijzing gaan via send-claim-notification.
- Sms-onderdelen in ClaimPage en VerificationRequiredDialog worden verborgen achter een vlag, zolang er geen sms-provider is.
- Er komen een `/claim/:slug`-route en een redirect na inloggen met de terugkeer-URL. ClaimsVerificationManager in het adminpaneel wordt de pagina "Claims".
- Tests: unit-tests voor de domeincontrole (subdomein ok, gmail geweigerd) en de limieten (5 pogingen, 3 codes per uur, 15 minuten).
- Eindtest in de preview met een testaccount: route A waarbij ik de code simuleer door die van de server te lezen in testmodus, en route B met een upload en goedkeuring als admin. Daarna meld ik wat werkt en wat niet.
