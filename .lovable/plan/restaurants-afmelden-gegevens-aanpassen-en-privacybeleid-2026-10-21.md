# Restaurants: afmelden, gegevens aanpassen en privacybeleid

## Wat er komt
1. **Pagina /voor-restaurants/afmelden** ("Gegevens aanpassen of verwijderen"): formulier met restaurantnaam, website (optioneel), e-mail, naam, keuze (Geen e-mails meer / Restaurant verwijderen / Gegevens laten aanpassen) en toelichting. Vanaf een restaurantpagina zijn naam en slug al ingevuld. Na versturen de bevestiging: "Ontvangen. Je ontvangt geen mails meer; verzoeken om te verwijderen of aan te passen handelen we binnen 5 werkdagen af."
2. **Pagina /afmelden?t=...**: meldt direct af en toont "Je bent afgemeld voor e-mails over <restaurant>" of "Deze link is niet (meer) geldig".
3. **Links**: footer onder Juridisch "Restaurant aanpassen of verwijderen"; onderaan elke restaurantpagina klein "Ben je de eigenaar? Claim of laat dit aanpassen".
4. **Admin-tabblad "Afmeldingen"**: lijst van verzoeken, status wijzigen (in behandeling / afgehandeld / afgewezen) en notitie opslaan.
5. **Privacybeleid**: één datum bovenaan (onderste weg), nieuw kopje "Gegevens van restaurants", Google (Gemini) en later Cloudflare bij verwerkers, zoekopdrachten zonder naam/IP max. 12 maanden, en lege plekken voor KvK-nummer en vestigingsadres.

## Technisch
- Nieuwe pagina's `RestaurantOptoutPage.tsx` en `UnsubscribePage.tsx`, routes in App.tsx (noindex).
- Formulier met zod-validatie; `supabase.rpc('request_restaurant_optout', {...})` met p_soort `geen_mail|verwijderen|gegevens_aanpassen`; prefill via query `?slug=&naam=`.
- `rpc('unsubscribe_restaurant_contact', { p_token })`; resultaattekst bepaalt melding.
- Admin-component `OptoutRequestsManager` leest/updatet `restaurant_optout_requests` (eerst kolommen en admin-RLS controleren; ontbreekt update-rechten voor admin, dan een kleine policy toevoegen).
- Geen andere databasewijzigingen.
