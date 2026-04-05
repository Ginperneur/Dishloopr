
-- Normalize cuisine tags: standardize to Dutch capitalized format
UPDATE public.restaurants SET cuisines = (
  SELECT array_agg(DISTINCT
    CASE lower(trim(c))
      WHEN 'japanese' THEN 'Japans'
      WHEN 'japans' THEN 'Japans'
      WHEN 'italian' THEN 'Italiaans'
      WHEN 'italiaans' THEN 'Italiaans'
      WHEN 'french' THEN 'Frans'
      WHEN 'frans' THEN 'Frans'
      WHEN 'chinese' THEN 'Chinees'
      WHEN 'chinees' THEN 'Chinees'
      WHEN 'indian' THEN 'Indiaas'
      WHEN 'indiaas' THEN 'Indiaas'
      WHEN 'mexican' THEN 'Mexicaans'
      WHEN 'mexicaans' THEN 'Mexicaans'
      WHEN 'thai' THEN 'Thais'
      WHEN 'thais' THEN 'Thais'
      WHEN 'greek' THEN 'Grieks'
      WHEN 'grieks' THEN 'Grieks'
      WHEN 'spanish' THEN 'Spaans'
      WHEN 'spaans' THEN 'Spaans'
      WHEN 'korean' THEN 'Koreaans'
      WHEN 'koreaans' THEN 'Koreaans'
      WHEN 'vietnamese' THEN 'Vietnamees'
      WHEN 'vietnamees' THEN 'Vietnamees'
      WHEN 'american' THEN 'Amerikaans'
      WHEN 'amerikaans' THEN 'Amerikaans'
      WHEN 'americaans' THEN 'Amerikaans'
      WHEN 'indonesian' THEN 'Indonesisch'
      WHEN 'indonesisch' THEN 'Indonesisch'
      WHEN 'surinamese' THEN 'Surinaams'
      WHEN 'surinaams' THEN 'Surinaams'
      WHEN 'asian' THEN 'Aziatisch'
      WHEN 'aziatisch' THEN 'Aziatisch'
      WHEN 'mediterranean' THEN 'Mediterraans'
      WHEN 'mediterraans' THEN 'Mediterraans'
      WHEN 'dutch' THEN 'Nederlands'
      WHEN 'nederlands' THEN 'Nederlands'
      WHEN 'hollands' THEN 'Nederlands'
      WHEN 'international' THEN 'Internationaal'
      WHEN 'internationaal' THEN 'Internationaal'
      WHEN 'seafood' THEN 'Vis & Zeevruchten'
      WHEN 'vis' THEN 'Vis & Zeevruchten'
      WHEN 'fusion' THEN 'Fusion'
      WHEN 'steakhouse' THEN 'Steakhouse'
      WHEN 'sushi' THEN 'Sushi'
      WHEN 'vegetarian' THEN 'Vegetarisch'
      WHEN 'vegetarisch' THEN 'Vegetarisch'
      WHEN 'vegan' THEN 'Veganistisch'
      WHEN 'veganistisch' THEN 'Veganistisch'
      WHEN 'cantonese' THEN 'Kantonees'
      WHEN 'kantonees' THEN 'Kantonees'
      ELSE initcap(trim(c))
    END
  )
  FROM unnest(cuisines) AS c
)
WHERE cuisines IS NOT NULL AND array_length(cuisines, 1) > 0;

-- Normalize ambience tags: standardize to Dutch capitalized format
UPDATE public.restaurants SET ambience_tags = (
  SELECT array_agg(DISTINCT
    CASE lower(trim(a))
      WHEN 'romantic' THEN 'Romantisch'
      WHEN 'romantisch' THEN 'Romantisch'
      WHEN 'cozy' THEN 'Gezellig'
      WHEN 'gezellig' THEN 'Gezellig'
      WHEN 'modern' THEN 'Modern'
      WHEN 'trendy' THEN 'Trendy'
      WHEN 'hip' THEN 'Trendy'
      WHEN 'classic' THEN 'Klassiek'
      WHEN 'klassiek' THEN 'Klassiek'
      WHEN 'casual' THEN 'Casual'
      WHEN 'informeel' THEN 'Casual'
      WHEN 'fine-dining' THEN 'Fine Dining'
      WHEN 'fine dining' THEN 'Fine Dining'
      WHEN 'high-end' THEN 'High-end'
      WHEN 'luxe' THEN 'High-end'
      WHEN 'family-friendly' THEN 'Kindvriendelijk'
      WHEN 'kindvriendelijk' THEN 'Kindvriendelijk'
      WHEN 'business' THEN 'Zakelijk'
      WHEN 'zakelijk' THEN 'Zakelijk'
      WHEN 'lively' THEN 'Levendig'
      WHEN 'levendig' THEN 'Levendig'
      WHEN 'bruisend' THEN 'Levendig'
      WHEN 'intimate' THEN 'Intiem'
      WHEN 'intiem' THEN 'Intiem'
      WHEN 'industrial' THEN 'Industrieel'
      WHEN 'industrieel' THEN 'Industrieel'
      WHEN 'traditional' THEN 'Traditioneel'
      WHEN 'traditioneel' THEN 'Traditioneel'
      WHEN 'terrace' THEN 'Terras'
      WHEN 'terras' THEN 'Terras'
      ELSE initcap(trim(a))
    END
  )
  FROM unnest(ambience_tags) AS a
)
WHERE ambience_tags IS NOT NULL AND array_length(ambience_tags, 1) > 0;
