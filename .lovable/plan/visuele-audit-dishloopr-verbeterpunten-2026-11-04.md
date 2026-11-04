# Visuele audit Dishloopr — verbeterpunten

Bekeken op mobiel (390px) en desktop (1280px): home, zoeken (pizza), restaurantpagina (Loetje), /eten/pizza-amsterdam, collecties, pakketten.

## Bevindingen (op prioriteit)

1. **Logo is onleesbaar klein** (mobiel en desktop, ~30px breed). Het merk valt weg; vergroten naar ~120px breed op desktop, ~100px mobiel.
2. **Cookiebanner bedekt ~30% van het mobiele scherm** en ligt over de eerste resultaten en de knop op de restaurantpagina. Compacter maken op mobiel: kortere tekst, knoppen naast elkaar, max ~140px hoog.
3. **/eten/{gerecht}-{stad}: resultaten staan onder twee lange tekstalinea's.** Op mobiel zie je geen enkel restaurant boven de vouw. Intro inkorten tot 1 regel, langere SEO-tekst onder de resultatenlijst zetten.
4. **Zoekkop in kleine letters**: "pizza in Heel Nederland". Eerste letter hoofdletter ("Pizza in Heel Nederland").
5. **Restaurantpagina: tags in drie verschillende stijlen** (geel, grijs, zwart) en dubbel ("Klassiek" + "Traditioneel/Klassiek"). Eén uniforme chipstijl per soort (keuken / sfeer / concept) en dubbele betekenissen samenvoegen in de weergave.
6. **Desktop homepage: populaire keukens lopen over naar een tweede regel met één losse chip ("Grieks").** Aantal beperken of in één scrollbare rij zetten.
7. **Chatknop rechtsonder overlapt de cookiebanner en kaarten.** Verbergen zolang de cookiebanner open is.
8. **Restaurantpagina mobiel: actieknoppen (favoriet/delen/website) zijn kleine losse icoontjes** zonder label. Labels toevoegen of een duidelijke rij "Reserveren · Route · Bellen" bovenaan.
9. **Algemene stockfoto als eerste zoekresultaat** voegt weinig toe; restaurants zonder eigen foto krijgen een rustigere placeholder (gerechticoon + oranje tint) in plaats van een willekeurige sfeerfoto.

## Buiten scope
Geen wijzigingen aan zoeklogica, data, SEO-regels of prijzen — alleen weergave.

## Technisch
- Logo: `Header`/navbar component, img-hoogte vergroten met vaste width/height (CLS 0 houden).
- CookieConsent: mobiele variant met compactere layout; `AfterIdle`-chat pas tonen na consentkeuze.
- DishCityPage: introtekst verplaatsen onder resultaten (blijft in HTML voor SEO).
- Zoekkop: capitalize eerste letter van term.
- Tag-weergave RestaurantPage: één badgevariant per categorie, dedupe op genormaliseerde tekst.
- Verifiëren met Playwright-screenshots mobiel/desktop voor en na.
