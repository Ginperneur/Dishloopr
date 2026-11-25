-- Own cover photos for the collections (25 November 2026), served from public/collections/.
-- Until now the self-filling collections showed the photo of their number 1, which mostly came
-- from Google (docs/google-places-compliance.md); every collection gets its own photo instead.
-- "Getest door Dishloopr" keeps its existing photo. Idempotent on purpose.

UPDATE public.collections c SET cover_image = '/collections/' || c.slug || '.webp', updated_at = now()
 WHERE c.slug IN ('beste-pizza', 'beste-steak', 'beste-smashburgers', 'beste-sushi', 'beste-pasta', 'beste-tacos',
                  'beste-pho', 'beste-tiramisu', 'beste-cheesecake', 'beste-french-toast', 'halal-uit-eten',
                  'glutenvrij-uit-eten', 'all-you-can-eat', 'shared-dining', 'date-night-restaurants',
                  'budget-lunch-spots', 'perfect-voor-de-kleintjes', 'hidden-gems-nederland', 'zakelijke-lunch',
                  'trendy-coffee-spots')
   AND c.cover_image IS DISTINCT FROM '/collections/' || c.slug || '.webp';
