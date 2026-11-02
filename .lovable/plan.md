# Openingstijden bovenaan in Basisgegevens

## Wat verandert
1. In het blok "Basisgegevens" op het eigenarendashboard komt het openingstijden-veld als eerste, vóór restaurantnaam en beschrijving.
2. Zolang alle dagvelden leeg zijn, staat direct boven het openingstijden-veld een opvallend maar rustig blok met klok-icoon:
   "We missen nog je openingstijden — bezoekers zien nu 'onbekend' in plaats van 'open' of 'gesloten'. Vul dit als eerste in."
   Het blok verdwijnt zodra er minstens één dag is ingevuld.
3. Opslaan blijft precies hetzelfde: wijzigingen gaan ter goedkeuring naar de admin.

## Technisch
- Alleen `src/components/owner/BasicInfoEditor.tsx`: openingstijden-blok verplaatsen naar boven.
- Melding getoond als `DAYS.every(d => !hours[d.key]?.trim())`; stijl met semantische tokens (`bg-primary/10`, `border-primary/30`, `Clock`-icoon), zoals overige dashboardkaarten.
- Geen wijziging aan `submit` of `restaurant_pending_edits`.
