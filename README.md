# Dishloopr

Je bent een senior product engineer + designer. Bouw een complete, production-ready webapp genaamd Dishloopr: een restaurant-zoekmachine waar gebruikers restaurants vinden op basis van een gerecht (dish) en filters zoals high-end, romantisch, family-friendly, prijs, plus stad. De site moet beschikbaar zijn in Nederlands, Engels, Spaans, Duits en Frans. Start als MVP met Amsterdam en Rotterdam.

0) Belangrijke inputs (assets & stijl)

Ik lever logo + screenshots aan. Gebruik deze als leidraad voor de UI: kleuren, typography, spacing, knoppen, kaarten, component-stijl.

Maak het design modern, clean, premium, met duidelijke hiërarchie en uitstekende UX op mobiel.

Voeg een “design system” toe (kleur tokens, spacing, typografie, componenten).

1) Doel & kernflow

Bezoekersflow:

Bezoeker komt op de homepagina.

Voert een gerecht in (autocomplete) + kiest stad + filters.

Ziet restaurantresultaten die gesorteerd zijn op match + gekozen filters + Dishloopr rating/reviews.

Kan restaurant openen, info bekijken, delen, favorieten, en een review achterlaten inclusief tags en foto’s.

Restaurant-eigenaar flow:

Kan restaurant claimen/aanvragen (verificatie).

Krijgt een dashboard met:

clicks per gerecht (dish)

profielviews

doorkliks naar website / route / bellen

reviews overzicht + reageren

Kan Top Listing / Uitgelicht kopen om extra op te vallen in zoekresultaten.

Admin flow:

Admin dashboard waar ik:

alle restaurants/data kan zien

restaurants kan toevoegen/bewerken

tags/dishes kan beheren

betalingen/abonnementen kan zien

featured/top listing kan toekennen of via betaling laten activeren

2) Rollen & permissies

Implementeer rollen met RBAC:

visitor (niet ingelogd)

user (ingelogd)

owner (geclaimde restaurants beheren)

admin (alles)

3) Data model (minimaal, uitbreidbaar)

Gebruik een database (bijv. Postgres) met een ORM (Prisma). Minimaal:

City

id, name, countryCode, slug, isActive

Dish

id, name, slug, synonyms[], cuisineTags[], isActive

Restaurant

id, name, slug

cityId

address, postalCode, geoLat, geoLng

priceLevel (1-4), cuisines[], ambienceTags[] (romantisch, family friendly, etc.)

dishTags (koppeling RestaurantDish)

phone, websiteUrl, reservationUrl, openingHours

images[]

claimedByOwnerId (nullable)

isFeatured (bool), featuredUntil (date)

isTopListing (bool), topUntil (date)

createdAt/updatedAt

RestaurantDish (koppeling)

restaurantId, dishId

confidenceScore (0-1) (hoe zeker is de dish match)

clicks (for analytics)

createdAt

Review

id, restaurantId, userId

rating (1-5)

title, body

photos[]

tagVotes: per tag (true/false/unsure)

suggestedTags[]

createdAt, status (published/pending/flagged)

User

id, email, name, passwordHash / provider

role

favorites (RestaurantFavorite)

createdAt

RestaurantFavorite

userId, restaurantId, createdAt

ClickEvent / AnalyticsEvent

id, restaurantId, dishId?, cityId?

type: search_result_click | website_click | call_click | directions_click | share_click

userId? (nullable), sessionId, createdAt

Payment / Subscription

id, restaurantId, ownerId

plan: featured | top_listing

status, amount, currency

startAt, endAt

provider (Stripe)

createdAt

4) Zoekmachine & ranking

Bouw een ranking-algoritme dat combineert:

Dish match score (exact match > synonym > fuzzy)

Filter match (price, tags, high-end, romantisch, family-friendly)

Review score (gemiddelde rating + aantal reviews met Bayesian smoothing)

Sponsored boost:

Top listing: duidelijke badge + plaatsing hoger (maar transparant als “gesponsord”)

Featured: visueel uitgelicht card (maar niet altijd #1)

Belangrijk:

Zorg dat filters écht invloed hebben op ranking.

Voeg sorteeropties: “Beste match”, “Hoogste rating”, “Meeste reviews”, “Prijs laag-hoog”, “Prijs hoog-laag”.

5) Filters (MVP + uitbreidbaar)

Minimaal:

Stad (Amsterdam/Rotterdam)

Prijs (1-4) + “budget / gemiddeld / luxe”

Tags:

romantisch

family-friendly

high-end

gezellig

zakelijk

vegetarisch/vegan friendly

toegankelijkheid (rolstoel)

Cuisine (Italiaans, Japans, etc.)

Open nu (optioneel)

Afstand (optioneel, als geo aanwezig)

6) Pagina’s & UI componenten

Public

Home (zoekbalk + stad + quick filters + trending dishes)

Zoekresultaten (filters sidebar/topbar, kaartenlijst, sorteren, badges, featured cards)

Restaurant detail:

header met foto’s

kerninfo

dish highlights (“Bekend om: …”)

tags

reviews (met foto’s)

CTA knoppen: reserveren/website/bellen/route/delen/favoriet

Login/Register (email + OAuth optioneel)

Profiel:

favorieten

eigen reviews

instellingen (taal)

Owner

Claim restaurant flow (aanvraag, bewijs, admin approve)

Owner dashboard:

clicks per dish, periode filter (7/30/90)

profielviews

review management + reageren

plan/upgrade (featured/top listing)

Admin

Admin dashboard (data overview)

Restaurants CRUD

Dishes CRUD + synonyms beheer

Tags beheer

Reviews moderation

Payments/Subscriptions overzicht

Analytics overzicht per stad/dish/restaurant

7) Reviews: UX en tag-validatie

Bij review plaatsen:

rating + tekst

upload foto’s

“Kloppen deze tags?” (toon huidige tags, user stemt: behouden/verwijderen/weet niet)

“Mis je tags?” (suggested tags)

optioneel: “Welke gerechten heb je gegeten?” (koppeling naar dish)

anti-spam basics (rate limiting, moderation status)

8) i18n (NL/EN/ES/DE/FR)

Volledige UI vertaalbaar.

Taal automatisch op browser, maar te wijzigen in UI.

URL’s SEO-friendly (bijv. /nl/amsterdam?dish=sushi)

Contentvelden: restaurantnaam blijft hetzelfde, tags/dishes vertaalbaar via dictionary.

9) SEO & performance

Server-side rendering of statische rendering waar nuttig (minimaal goede meta tags).

OpenGraph tags voor delen van restaurants.

Sitemap per taal + per stad.

Friendly slugs: /nl/restaurant/<slug>

Snelle laadtijd, lazy load images, skeleton loaders.

10) Technische stack (advies, kies één en lever werkend op)

Bouw als moderne webapp met:

Frontend: React + TypeScript (Vite of Next.js)

UI: component library of eigen design system

Backend: API routes + auth

DB: Postgres + Prisma

Auth: email/password + magic link of OAuth (minimaal email+password)

Storage: image upload (S3/Cloudinary)

Payments: Stripe (test mode)

Deploy: Vercel

Logging/monitoring: basis error logging

11) Seed data (MVP)

Voeg seed data toe voor:

steden: Amsterdam, Rotterdam

20–40 restaurants (fake maar realistisch)

30–60 dishes incl. synonyms (bv. “ramen” ~ “noodle soup”)

100–200 reviews verdeeld

Zorg dat de app meteen demo-baar is.

12) Admin tools die ik al heb

Ik heb al een back-office dashboard (restaurants/tags toevoegen, payments, etc.). Integreer dit of bouw het opnieuw als onderdeel van dezelfde app met admin role.

13) Deliverables (wat je moet opleveren)

Complete codebase met duidelijke structuur

README met:

installatie

env vars

database migraties + seed

run scripts

docker-compose optioneel voor local Postgres

Vercel-ready deploy config

Basis test setup (minimaal lint + typecheck)

Security basics:

env vars nooit in repo

input validation

protected routes

14) Extra’s die je zelf moet toevoegen (waardevol voor Dishloopr)

Voeg slimme features toe die passen bij een restaurant zoekmachine:

“Trending dishes” per stad

“Nieuw toegevoegd” restaurants

“Collection” pagina’s (bijv. “Romantisch dineren in Amsterdam”)

Report/flag review

Owner reactie op review

Email notifications (optioneel)

Fraud/spam mitigatie basics

15) Acceptatiecriteria (MVP done betekent)

Ik kan zoeken op dish + stad + filters.

Resultaten zijn logisch gerangschikt.

Inloggen werkt.

Favorieten werken.

Review flow incl. tags + foto upload werkt.

Owner dashboard toont clicks per dish.

Admin kan restaurants/dishes/tags beheren.

Featured/top listing kan geactiveerd worden (test payment ok).

i18n werkt in alle 5 talen.

Deploybaar op Vercel.

Begin nu met het genereren van de volledige implementatie. Lever de complete codebase en alle benodigde bestanden.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://dishloopr.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d128ec0a-5dc5-42ad-ad58-3a02e9f5278f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
