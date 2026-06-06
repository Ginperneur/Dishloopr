## Doel

Elke pagina volledig vertaald in NL / EN / DE / FR / ES, zonder Nederlandse "leaks". Drie soorten content vragen elk een eigen aanpak.

## Type content & aanpak

| Soort | Voorbeeld | Aanpak |
|---|---|---|
| UI-strings (statisch) | "Bij mij in de buurt", "Opslaan", "Alle gerechten" | `t()` + sleutels in `src/i18n/locales/*.json` |
| Enum-achtige DB-waarden | cuisines (`italiaans`), ambience_tags (`gezellig`), `course_type` (`hoofdgerecht`), dietary labels | Centrale mapping `CONSTANT → i18n key` in `src/lib/i18n/` |
| Echte redactionele DB-content | collectietitels, subtitels, beschrijvingen | JSONB-kolommen `title_i18n`, `subtitle_i18n`, `description_i18n` op `collections`, met NL als fallback |

## Fase 1 — Foundation (1 PR)

1. Inventariseer alle hardcoded NL-strings en alle DB-enums via een `rg`-sweep; output als checklist in deze plan-thread.
2. Maak `src/lib/i18n/taxonomy.ts` met mappings:
   - `CUISINE_I18N_KEYS`, `AMBIENCE_I18N_KEYS` (bestaat al deels), `COURSE_TYPE_I18N_KEYS`, `DIETARY_I18N_KEYS`, `PRICE_LEVEL_I18N_KEYS`.
   - Eén helper `tTaxonomy(t, type, value)` met sane fallback (capitalize raw value).
3. Voeg alle bijbehorende keys toe in alle 5 locale-bestanden onder secties `taxonomy.cuisines.*`, `taxonomy.ambience.*`, `taxonomy.course.*`, `taxonomy.dietary.*`.

## Fase 2 — Statische UI sweep

Per pagina-groep een focused commit:
- **Homepage** (`Index.tsx`, `home/*`): "Bij mij in de buurt", "Ontdek per stad", cuisine-knoppen, "Alle gerechten", trending sections, collections strip.
- **Zoek + filters**: filter-popover labels, chip-labels, "Zelfde gerecht/prijsklasse", lege-staat teksten.
- **Restaurantpagina**: menu-categorieën (course types), review-sectie, "Opslaan", "Bekend om", openingstijden labels, social proof.
- **Collectie-detail, /steden, /collecties**: subtitles, lege staten, CTA's.

Alle hardcoded NL → `t('section.key')` + entries in alle 5 locale-bestanden.

## Fase 3 — Dynamische redactionele content (collecties)

1. Migratie: voeg `title_i18n jsonb`, `subtitle_i18n jsonb`, `description_i18n jsonb` toe aan `collections`. Default `{}`. Fallback-volgorde in code: `title_i18n[lang] → title_i18n.nl → title`.
2. Backfill: kopieer huidige `title`/`subtitle`/`description` naar `*_i18n.nl`.
3. Admin-UI in `CollectionEditor`: tab per taal voor titel/subtitel/beschrijving. (Of: laat admin alleen NL invullen en gebruik AI-vertaal-knop via Lovable AI Gateway — vergelijkbaar met bestaande translate-flow.)
4. Helper `useLocalizedField(row, 'title')` voor de frontend.

Cuisine/ambience-tags zijn enums → vallen onder Fase 1, geen schema-werk.

## Fase 4 — QA + lint

1. Voeg een `scripts/check-i18n.ts` toe die alle locale-bestanden vergelijkt op missende sleutels (CI-vriendelijk).
2. Loop alle 5 talen handmatig door op /, /search, /restaurant/:slug, /collections, /steden.
3. Sla missing-key-warnings van i18next op via een dev-overlay om laatste leaks te vinden.

## Uitvoeringsvolgorde & verwachting

Ik stel voor dat ik per turn één fase (of subset van fase 2) oplever — anders wordt elke PR onreviewbaar. Eerstvolgende oplevering na akkoord: **Fase 1 (foundation + taxonomy)**.

## Wat ik NIET in scope plaats (tenzij je het er bij wilt)

- Admin-panel vertalen (intern gebruik, NL volstaat).
- Owner-dashboard vertalen (B2B, gefaseerd via aparte ticket).
- Restaurant-namen/adressen vertalen (niet wenselijk — eigennamen).
- SEO-vertalingen via hreflang (memory zegt expliciet: client-side i18n, geen hreflang).
