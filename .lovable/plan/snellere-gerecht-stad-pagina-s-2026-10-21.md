# Snellere gerecht×stad-pagina’s

## Doel
De titel en tekst eerder zichtbaar maken en de restaurantlijst sneller laden op `/eten/{gerecht}-{stad}` en de bijbehorende filterpagina’s. Alleen de manier van ophalen en tonen verandert; geen wijzigingen aan opgeslagen gegevens of toegangsregels.

## 1. Minder opeenvolgende verzoeken
- Haal de bestaande paginatekst met het gekoppelde gerecht en de stad in één verzoek op, in plaats van drie losse verzoeken.
- Voor pagina’s zonder opgeslagen tekst: controleer de mogelijke stadnamen samen, kies de langste passende stadsnaam en hergebruik het gevonden gerecht en de stad. Voorkom dat dezelfde gegevens nogmaals worden opgehaald voor redirects en paginavulling.
- Haal gegevens die niet van elkaar afhangen tegelijk op: de gerechtfamilie, restaurants in de gekozen stad en eventuele informatie over de bovenliggende hub.
- Beperk gerechtkoppelingen tot actieve restaurants in de gekozen stad, in plaats van eerst alle bijpassende koppelingen in Nederland op te halen.
- Verwerk grote lijsten in begrensde parallelle blokken met volledige paginering. Zo worden resultaten boven de limiet van 1.000 rijen niet afgekapt en ontstaan geen extreem lange verzoeken.

## 2. Eerste inhoud niet laten wachten op aanvullende links
- Toon de echte titel en introductietekst zodra de pagina, het gerecht en de stad bekend zijn; laat ze niet wachten op variantchips of de backlink naar een hub.
- Laat de restaurantlijst tijdelijk vaste plaatshouders tonen. Toon nog geen nulresultaten, filteraantallen of FAQ-aantallen zolang de telling niet klaar is.
- Laat aanvullende links onafhankelijk laden en reserveer daarvoor ruimte waar nodig om verschuiven te beperken.
- Verwijder de verschijningsanimatie van de eerste tekst en eerste resultaten, zodat beschikbare inhoud direct zichtbaar is.
- Laat de uiteindelijke zoekmachine-instellingen en aantallen afhangen van de afgeronde restaurantselectie. Tijdens het laden geen onterecht indexeerbare pagina of onjuiste gestructureerde gegevens tonen.

## 3. Gegevens hergebruiken
- Bewaar pagina en restaurantselectie kort via de bestaande cache. Wisselen tussen bijvoorbeeld de basispagina en ‘Lunch’ gebruikt dezelfde selectie, zonder opnieuw alle verzoeken te doen.
- Voorkom dubbele gelijktijdige verzoeken voor dezelfde pagina.
- Bij een snelle wissel van gerecht of stad mogen oude antwoorden de nieuwe pagina niet overschrijven.

## Wat hetzelfde blijft
- Alleen actieve restaurants met een passend goedgekeurd gerecht: `approved_by_admin` of `verified_by_owner`.
- Hubs tonen de hele gerechtfamilie; ledenpagina’s blijven op hun eigen canonical gerecht gericht. De top 12 variantchips en bestaande redirects blijven behouden.
- Maaltijdtype, sfeer en prijs blijven op dezelfde velden filteren; aantallen en huidige sortering blijven gelijk.
- De grens van 3 restaurants voor indexeerbare facetpagina’s en gegenereerde basispagina’s blijft gelijk. Ongeldige facets blijven 404; lege facetselecties houden de melding en teruglink.
- Nederlandse uitleg bij gerechten blijft uitsluitend zichtbaar in Nederlandse lijstjes en kaartjes, niet in titels, links of meta-informatie.
- Een lege gerechtselectie wordt niet vervangen door willekeurige restaurants uit die stad.

## Controle en nieuwe meting
- Vergelijk vóór en na de wijziging de restaurant-id’s en aantallen voor ramen in Amsterdam, een hub, een ledenpagina en een facetpagina.
- Test directe bezoeken, redirects, lege en ongeldige pagina’s, snel wisselen tussen pagina’s en teruggaan naar een eerder geopende pagina.
- Voeg kleine tests toe voor paginering, hergebruik van verzoeken en het negeren van verouderde antwoorden.
- Controleer de titel, restaurantkaarten, foto’s, filteraantallen en zoekmachine-instellingen in de mobiele preview.
- Meet opnieuw onder dezelfde mobiele Lighthouse-instellingen als de vorige lokale meting: score, LCP, CLS, dataverbruik en aantal gegevensverzoeken. Meet ook de homepage als regressiecontrole.
- Vergelijk met de vorige lokale cijfers: homepage **63 / LCP 4,8 s / CLS 0 / 1,36 MB**; ramen-Amsterdam **49 / LCP 9,2 s / CLS 0 / 1,21 MB**. Dit zijn geen officiële PageSpeed-cijfers van de live website. Een hogere score of LCP onder 3 seconden wordt niet vooraf gegarandeerd.

## Technische uitvoering
- Splits de publieke loader uit `useSeoLandingPage.ts` op in paginagegevens, restaurantselectie en aanvullende navigatie; laat de adminbewerkingen ongemoeid.
- Gebruik de aanwezige TanStack Query-cache, met aparte laadstatussen en sleutels per basisslug; facets filteren lokaal dezelfde restaurantselectie.
- Gebruik bestaande relationele selecties om stad en activiteit vroeg te begrenzen; geen nieuwe tabellen, functies of migraties.
- Controleer iedere leesfout expliciet: een mislukt verzoek is geen lege selectie of 404. Zorg voor stabiele paginering en begrensde gelijktijdigheid.
- Leg de afgesproken laadstructuur vast in de bestaande projectafspraken en voer de relevante tests uit.