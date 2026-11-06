-- Minimal stand-ins for Supabase-managed objects (auth, roles, base tables, pg_cron)
-- that the migrations under test depend on. Not a copy of the real schema.
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.test_ctx (uid uuid, role text);
INSERT INTO public.test_ctx VALUES (NULL, 'anon');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT uid FROM public.test_ctx LIMIT 1 $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT role FROM public.test_ctx LIMIT 1 $$;
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE public.cities (id uuid PRIMARY KEY, name text);
CREATE TABLE public.restaurants (id uuid PRIMARY KEY, name text, slug text, city_id uuid, is_active boolean DEFAULT true, claimed_by_owner_id uuid, rating numeric, owner_tier text DEFAULT 'basic');
CREATE TABLE public.dishes (id uuid PRIMARY KEY, name text, slug text, canonical_slug text);
CREATE TABLE public.restaurant_dishes (id serial, restaurant_id uuid, dish_id uuid, price numeric, status text);
CREATE TABLE public.restaurant_stats_daily (restaurant_id uuid, dag date, metric text, context text, n int);
CREATE TABLE public.search_logs (id serial, query_norm text, city text, created_at timestamptz DEFAULT now(), clicked_restaurant_id uuid, results_count int);
CREATE TABLE public.reviews (restaurant_id uuid, rating int, status text, created_at timestamptz DEFAULT now());
CREATE TABLE public.seo_landing_pages (slug text, dish_id uuid);
CREATE TABLE public.owner_email_preferences (user_id uuid);
CREATE TABLE public.internal_job_secrets (name text, secret text);
CREATE TABLE public.user_roles (user_id uuid, role text);
CREATE FUNCTION public.has_role(_user_id uuid, _role text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE FUNCTION public.is_verified_owner(_user_id uuid, _restaurant_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS (SELECT 1 FROM public.restaurants WHERE id = _restaurant_id AND claimed_by_owner_id = _user_id) $$;
-- Stand-in for the DB-only restaurant_positions(): rank by rating within the dish page.
CREATE FUNCTION public.restaurant_positions(p_slug text) RETURNS TABLE (dish_name text, page_slug text, "position" int, total int) LANGUAGE sql STABLE AS $$
  SELECT 'Carbonara', 'carbonara-utrecht', 2, 7 FROM public.restaurants WHERE slug = p_slug
$$;
-- pg_cron / pg_net are not available in PGlite.
CREATE SCHEMA cron;
CREATE TABLE cron.job (jobid serial, jobname text);
CREATE FUNCTION cron.schedule(a text, b text, c text) RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;
CREATE FUNCTION cron.unschedule(a int) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;

CREATE TABLE public.app_settings (id serial, key text UNIQUE, value text, description text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
