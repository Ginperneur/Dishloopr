-- 1. Strip leading "NL, " prefix from addresses
UPDATE public.restaurants
SET address = regexp_replace(address, '^\s*NL\s*,\s*', ''),
    updated_at = now()
WHERE address ~* '^\s*NL\s*,';

-- 2. Reassign city_id when the address clearly contains a different known city name
UPDATE public.restaurants r
SET city_id = c2.id,
    updated_at = now()
FROM public.cities c2
WHERE c2.id <> r.city_id
  AND r.address ~* ('\m' || c2.name || '\M')
  AND NOT EXISTS (
    SELECT 1 FROM public.cities c1
    WHERE c1.id = r.city_id
      AND r.address ~* ('\m' || c1.name || '\M')
  );