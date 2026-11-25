# Restaurant Finder met Verras me en Food Match

## Wat je ziet
- De knop "Verras me!" op de homepage heet voortaan **Restaurant Finder** (in alle 5 talen).
- Klik opent een luxe pop-up (mobiel: volledig scherm van onderen) met twee grote kaarten:
  - **Verras me** – de huidige verrassingsfunctie, ongewijzigd.
  - **Food Match** – een swipe-vragenlijst.

## Food Match stappen
Eén vraag per scherm, voortgangsbalk bovenaan, vloeiende kaartanimaties, swipen of tikken.
1. **Alleen of met vrienden?** Bij "met vrienden" maak je een sessie en krijg je een deel-link/WhatsApp-knop. Vrienden openen de link en doorlopen dezelfde vragen.
2. **Stad** – kiezen uit de bestaande steden (of huidige locatie).
3. **Sfeer** – kaarten met de bestaande sfeertags (Romantisch, Gezellig, Terras, etc.).
4. **Gerecht** – Tinder-stijl: swipe rechts = lekker, links = nee; meerdere mogelijk (vlees, vis, garnalen, ramen, pizza, sushi, burger, vegetarisch...).
5. **Resultaat** – 2 restaurants met foto, score en waarom ze matchen, met knop naar de restaurantpagina. In groepsmodus pas zodra iedereen klaar is (of de maker op "Toon resultaat" drukt); keuzes van alle deelnemers worden samengevoegd.

## Stijl
Donkere, warme luxe-uitstraling binnen het bestaande merk: diep antraciet met oranje accenten, Bricolage Grotesque koppen, zachte gloed en schaduwen, grote foto-kaarten. Alle kleuren via design-tokens.

## Technisch
- Nieuw: `src/components/finder/RestaurantFinderDialog.tsx`, `FoodMatchFlow.tsx`, `SwipeCard.tsx` (framer-motion drag), `src/lib/foodMatch.ts` (scoring), test `foodMatch.test.ts`.
- `SurpriseMe.tsx` krijgt een "embedded" modus; `Index.tsx` toont de nieuwe knop.
- Matching: bestaande `search_restaurants` / sfeer via `ambience_tags`, gerechtcategorieën gemapt op `dish_group`/canonical slugs; alleen listable restaurants; top 2 op matchscore, daarna `compareLandingOrder`.
- Groep: nieuwe tabellen `food_match_sessions` (stad, maker, share_code, status) en `food_match_answers` (sessie, deelnemer, sfeer[], gerechten[]), met grants en RLS: iedereen met de code mag de sessie lezen en een antwoord toevoegen via een security-definer RPC; deelnemers hoeven niet in te loggen (naam + anoniem token lokaal). Live verversen via polling elke 3s tijdens de wachtstap.
- Route `/food-match/:code` (noindex) voor vrienden.
