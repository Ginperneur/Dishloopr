-- Menuservice runs by itself: after payment run-menu-service imports the menu
-- (website, PDF or photo), has it translated to English, German and French and
-- stores it here as 'awaiting_owner'. The owner checks it and publishes it; it is
-- then public at /menu/<slug> (also the QR code and website widget target).
-- An admin only steps in when the import fails.

CREATE TABLE IF NOT EXISTS public.restaurant_menus (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'processing',
  source_url text,
  -- [{ category, name, description, price, translations: { en|de|fr: { name, description, category } } }]
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  generated_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_menus_status_check CHECK (status IN ('processing', 'awaiting_owner', 'published', 'failed'))
);
ALTER TABLE public.restaurant_menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published menus"
  ON public.restaurant_menus FOR SELECT
  USING (status = 'published' AND EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.is_active));

CREATE POLICY "Owners view their menu"
  ON public.restaurant_menus FOR SELECT
  USING (auth.uid() IS NOT NULL AND public.is_verified_owner(auth.uid(), restaurant_id));

CREATE POLICY "Admins manage menus"
  ON public.restaurant_menus FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Owner (or admin) approves the generated menu; this also closes the Menuservice order.
CREATE OR REPLACE FUNCTION public.publish_restaurant_menu(p_restaurant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), p_restaurant_id)) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  UPDATE public.restaurant_menus
     SET status = 'published', published_at = now(), updated_at = now()
   WHERE restaurant_id = p_restaurant_id AND status IN ('awaiting_owner', 'published')
     AND jsonb_array_length(items) > 0;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Er is nog geen menukaart om te publiceren' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.package_orders
     SET fulfillment_status = 'done', updated_at = now()
   WHERE restaurant_id = p_restaurant_id AND package = 'menu_service' AND fulfillment_status IN ('todo', 'in_progress');
END;
$$;
REVOKE ALL ON FUNCTION public.publish_restaurant_menu(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_restaurant_menu(uuid) TO authenticated;

-- Weekday mornings: remind the admin of document claims open for more than 1 working day.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'remind-pending-claims';
SELECT cron.schedule(
  'remind-pending-claims',
  '0 7 * * 1-5',
  $cron$
  SELECT net.http_post(
    url := 'https://uktafmxojymsojqewzuy.supabase.co/functions/v1/remind-pending-claims',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT secret FROM public.internal_job_secrets WHERE name = 'cron')
    ),
    body := '{}'::jsonb
  );
  $cron$
);
