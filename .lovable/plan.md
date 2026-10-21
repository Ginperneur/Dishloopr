# Packages bijwerken (binnen dezelfde hoofdversie)

## Wat er verandert
- **react-router-dom**: 6.30.1 → 6.30.6 (laatste 6.x)
- **recharts**: 2.15.4 blijft — dit is al de nieuwste 2.x
- **@supabase/supabase-js**: 2.89.0 → 2.118.0 (laatste 2.x)

## Controle daarna
1. Build en typecheck slagen; bestaande tests draaien (`bun test`).
2. In de preview (mobiel en desktop):
   - Zoeken: "pizza in rotterdam" geeft resultaten; terug vanaf restaurant behoudt de lijst.
   - Restaurantpagina: menu, reviews, parkeerinfo, nieuwe eigenaarslink.
   - Dashboard (ingelogd) laadt.
   - Admin: KPI-/omzetgrafieken tekenen.
3. Console op nieuwe fouten controleren.

## Technisch
- `bun add react-router-dom@6.30.6 @supabase/supabase-js@2.118.0`.
- Bij typefouten door nieuwere database-types in supabase-js: klein aanpassen zonder gedrag te wijzigen.
- Dashboard/admin vragen een ingelogde sessie; lukt die niet, dan meld ik dat als niet getest.
