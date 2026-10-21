# Reviews alleen tonen als er genoeg eigen reviews zijn

## Wat de bezoeker ziet

**Minder dan 10 goedgekeurde eigen reviews**
- Bovenaan de restaurantpagina, op de zoekkaarten en in collecties staat alleen de Google-score: sterren, score en "(1.392 Google-reviews)", met het label "Google". Er staat geen eigen gemiddelde en geen "(0)".
- Is er geen Google-score, dan staan er geen sterren en ook niet de tekst "Nog geen beoordelingen".
- In het blok "Beoordelingen" staat de regel "Ben je hier geweest? Schrijf de eerste Dishloopr-review" met een knop die het reviewformulier opent. Zijn er al 1 tot 9 eigen reviews, dan staan die eronder, zonder gemiddelde. De tekst "Nog geen reviews" verdwijnt.

**10 of meer goedgekeurde eigen reviews**
- Naast elkaar staat dan "4,6 op Dishloopr · 4,5 op Google". Zonder Google-score staat alleen "4,6 op Dishloopr".
- Het blok "Beoordelingen" toont het formulier en de lijst zoals nu.

Scores krijgen een komma (4,5) en aantallen een punt (1.392), in de vorm die bij de gekozen taal hoort.

## Belangrijke bevinding
Het bestaande getal voor het aantal reviews per restaurant klopt niet. Bij 14 restaurants staat daar 10 of meer, terwijl er in totaal 0 goedgekeurde eigen reviews zijn. De drempel van 10 telt daarom de echte goedgekeurde reviews. Het eigen gemiddelde wordt ook uit die reviews berekend. Zo krijgt nu geen enkel restaurant ten onrechte een Dishloopr-score. Aan de opgeslagen gegevens verandert niets.

## Technische details
- Nieuw `src/lib/ratingDisplay.ts`: een functie die uit de Google-score, het aantal Google-reviews, het aantal eigen reviews en het eigen gemiddelde bepaalt wat getoond wordt (`google-only`, `both`, `none`). Constante `OWN_REVIEW_THRESHOLD = 10`. Bevat ook de opmaak van getallen per taal.
- Nieuw `RatingSummary`-onderdeel dat dit gebruikt. Het komt in de bovenkant van `RestaurantPage.tsx` (vervangt regels ~305–330), in `DatabaseRestaurantCard.tsx` (~189–205) en in `CollectionPage.tsx` (~62–67).
- Restaurantpagina: het aantal en gemiddelde komen uit de reviews die `useReviews` al ophaalt (alleen `status = 'published'`).
- Kaarten en collecties: één gebundelde telling van goedgekeurde reviews per restaurant-id (aantal en gemiddelde) voor de getoonde set. Dit draait parallel en houdt het zoeken niet op.
- `ReviewList`/RestaurantPage: onder de 10 eigen reviews staat de CTA-regel met een knop die het formulier openklapt of ernaartoe scrolt; de lege-lijstmelding verdwijnt. De meta-description gebruikt het eigen gemiddelde ook pas vanaf 10.
- Teksten in NL/EN/DE/FR/ES: "Google", "{{count}} Google-reviews", "op Dishloopr", "op Google", en de CTA.
- Unit-tests voor de drempel: 9 eigen reviews geeft alleen Google, 10 geeft beide, een lege Google-score geeft geen sterren, en 0 eigen reviews toont nooit "(0)".
