# Openingstijden overnemen uit stage

Controle vooraf (al uitgevoerd): 666 restaurants in stage, waarvan 312 nu zonder openingstijden.

## Stappen
1. Back-up maken: nieuwe tabel `restaurants_backup_openingstijden` met id + huidige opening_hours van de 666 restaurants (schemawijziging via migratie, incl. RLS aan zonder policies zodat hij niet publiek leesbaar is).
2. Update uitvoeren: alleen restaurants waar opening_hours nu leeg/null of `{}` is krijgen de waarde uit stage; `updated_at = now()`. Bestaande openingstijden worden niet overschreven. Verwacht: 312 rijen.
3. Controle achteraf: aantal gevulde van de 666 rapporteren (verwacht 666 als alle stage-waarden gevuld zijn).

Geen andere tabellen of code worden gewijzigd.
