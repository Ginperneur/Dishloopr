## Doel

Maak duplicate-detectie in discovery instelbaar, verplaats het opruimen naar de server, en log iedere opruimactie.

## 1. Database (migratie)

**a. Settings-rij in `app_settings`** voor duplicate-criteria (één JSON-blob):
```
key: 'discovery_duplicate_rules'
value: jsonb met:
  - match_by_place_id (bool, default true)
  - match_by_name (bool, default true)
  - name_min_similarity (numeric 0–1, default 0.85)
  - same_city_required (bool, default true)
  - radius_meters (int, default 150) — alleen als beide coords hebben
```
(opslag in bestaande `app_settings.value` als text; we casten naar/van JSON in client + RPC).

**b. RPC `cleanup_discovery_duplicates(p_rules jsonb)`** — SECURITY DEFINER, admin-only:
- Verwijdert in één statement alle `discovery_results` met `status = 'duplicate'`.
- Schrijft één `admin_activity_logs` row: `action_type='discovery_cleanup_duplicates'`, `entity_type='discovery_results'`, `details = { deleted_count, rules, took_ms }`.
- Returnt `jsonb { deleted_count, took_ms }`.

**c. RPC `rescan_discovery_duplicates(p_rules jsonb)`** — SECURITY DEFINER, admin-only:
- Voor alle `status='pending'`-rijen: pas regels toe (place_id-match → restaurants.google_place_id; naam-fuzzy via `similarity()` met pg_trgm; optioneel zelfde city; optioneel radius via Haversine in SQL).
- Update gematchte rijen naar `status='duplicate'` + `matched_restaurant_id`.
- Logt zelfde manier: `action_type='discovery_rescan_duplicates'`, details `{ checked, marked, rules }`.
- Returnt `jsonb { checked, marked }`.
- Voor naam-similarity: vereist extensie `pg_trgm` (`CREATE EXTENSION IF NOT EXISTS pg_trgm`).

## 2. Frontend (`src/components/admin/RestaurantDiscovery.tsx`)

**a. Nieuw dialoog "Duplicate-regels":**
- Geopend via knopje naast de bestaande "Opruimen"-knop op de Duplicaten-statkaart.
- Velden: checkboxes voor `match_by_place_id`, `match_by_name`, `same_city_required`; slider 0.50–1.00 voor `name_min_similarity`; number-input voor `radius_meters`.
- "Opslaan" → upsert in `app_settings` (text-cast van JSON).
- "Hertesten (re-scan)" → roept RPC `rescan_discovery_duplicates` aan en toont toast met `{checked, marked}`.

**b. Server-side opruimen:**
- Vervang de huidige client-side `while`-batchloop door één call: `supabase.rpc('cleanup_discovery_duplicates', { p_rules: rules })`.
- Tijdens uitvoering: indeterminate `Progress`-bar in een kleine sectie ("Opruimen loopt…"), na afloop toast met `{deleted_count, took_ms}`.

**c. Nieuwe tab/sectie "Opruim-historie"** (compacte tabel onder de stats of via een 4e tab):
- Leest laatste 20 rijen uit `admin_activity_logs` waar `action_type IN ('discovery_cleanup_duplicates','discovery_rescan_duplicates')`.
- Toont: tijd, actie, aantal (uit `details.deleted_count` / `details.marked`), uitvoerder-id (kort), eventueel gebruikte regels.

## 3. Code-hygiëne

- Verwijder ongebruikte client-batch-state na refactor.
- Houd bestaande "Opruimen"-knop, maar alle logica via RPC.
- Geen wijziging aan `discover-restaurants` edge function (volgende iteratie).

## Technische details

- pg_trgm `similarity(a,b)` voor naam-matching; Haversine in plain SQL voor radius.
- Lees regels in UI bij mount via `app_settings.select('value').eq('key','discovery_duplicate_rules')`.
- Audit-rij gebruikt bestaande `admin_activity_logs` (RLS staat al admin-INSERT/SELECT toe).
- Geen wijzigingen aan RLS van `discovery_results` (admin-ALL is voldoende; RPC's zijn SECURITY DEFINER en checken `has_role(auth.uid(),'admin')`).
