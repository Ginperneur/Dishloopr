# Dishloopr search review

0 findings are failing in the fresh foundations scan. Older warnings are not treated as current results.

| Finding | Level | State |
| --- | --- | --- |
| Home page is reachable | low | passing |
| AI assistants can see your site as markdown | low | passing |
| Search engines see your fully-rendered pages | low | passing |
| Crawler rules look good | low | passing |
| Sitemap looks good | low | passing |
| Page basics are set | low | passing |
| Site icon is set up for search | low | passing |
| Home page search metadata is set | low | passing |
| Social preview basics are set | low | passing |

## Additional issues confirmed in the current source

- Restaurant pages still use the unsupported Open Graph type `restaurant`; change it to `website` while preserving schema.org Restaurant data.
- About-page feature headings jump from H1 to H3; use H2. Several gallery navigation buttons lack accessible names.
- The sitemap generator gives static pages today's date on every run and uses it as a fallback for missing update dates. Remove these artificial freshness dates, preserving genuine page-specific timestamps.
- The sitemap includes `/events`, which redirects to `/evenementen`; list the destination instead.
- Sitemap dish matching only accepts `approved_by_admin`, while the public page also accepts `verified_by_owner`. Align the eligible statuses so verified menu dishes are not missed.
- The live `/eten/biefstuk-tilburg` page has 28 restaurant links and permits indexing, but is missing from the sitemap. Include eligible hub/fallback pages using the same selection rules as the public pages, preserving the three-restaurant minimum.

Approval below applies to these confirmed corrections, not the obsolete warnings. Do not add login/signup pages to the sitemap, remove static social-preview fallbacks, or create speculative guides.

## Google and AI evidence

- The live `/llms.txt` already exists and returns HTTP 200. Its presence is not a guarantee that AI assistants will cite Dishloopr.
- No accessible Google Search Console connection is available. Google's chosen canonical URLs, index coverage, actual clicks and impressions are therefore unverified.
- Semrush's Netherlands database reports 400 organic keywords and an estimated 232 organic visits per month; these are estimates, not measured visitors.

## Initial ranking priorities

Source: Semrush, Netherlands database. Difficulty scores estimate competition, not time to rank or a guarantee.

| Search | Estimated monthly searches | Difficulty | Priority |
| --- | ---: | ---: | --- |
| ramen rotterdam | 1,900 | 17/100 | Main dish×city opportunity; existing landing page |
| pizza groningen | 1,600 | 14/100 | Strong priority; existing page already has related rankings |
| carpaccio restaurants | 260 | 20/100 | Protect the reported existing position 1 |
| biefstuk tilburg | 20 | 0/100 | Small experimental target; existing useful page, missing sitemap entry |
| restaurant rotterdam | 12,100 | 36/100 | Broader and harder; not the first priority |

Semrush already reports `/eten/carpaccio-rotterdam` at position 1 for `carpaccio restaurants` (260 monthly searches) and `/eten/pizza-groningen` at position 13 for `pizzeria s groningen` (1,900). Protect the former and improve the latter before expanding into generic restaurant searches.

## Live page verification

All four pages above show a page-specific title, a self-referencing canonical and `index,follow` after rendering. Observed distinct restaurant links: ramen Rotterdam 11, pizza Groningen 20, carpaccio Rotterdam 143, biefstuk Tilburg 28. These counts are rendered links, not an independent database inventory.

For ramen Rotterdam, Semrush's top results include restaurant websites, De Buik, Tripadvisor and Rotterdam Centrum. A menu-grounded comparison can compete on usefulness, but low estimated difficulty does not guarantee page-one rankings.

Improve existing pages with verified menu prices, useful comparisons, accurate opening-hours data and genuine reviews. Avoid invented rankings, unverified dietary claims, mass-produced guides, or promises of AI citations.