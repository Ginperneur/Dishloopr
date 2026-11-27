-- Remove a restaurant at its owner's request, in one admin action (AVG: handled within 5 working days).
--
-- The restaurant row is kept, hidden, on purpose: the Overture import and Discovery skip restaurants
-- that already exist, so keeping the row stops the restaurant from coming back. The hide reason does not
-- match hidden_for_menu(), so the menu trigger never switches it on again. Contact details are wiped;
-- the opt-out request keeps the requester's address, which outreach_targets uses to never mail again.
-- Removal requests that arrive as a reply in the outreach inbox get a request here too (outreach_reply_id).
-- Idempotent: Lovable may renumber or re-run this migration.

ALTER TABLE public.restaurant_optout_requests
  ADD COLUMN IF NOT EXISTS outreach_reply_id uuid REFERENCES public.outreach_replies(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_optout_requests_reply_uidx
  ON public.restaurant_optout_requests (outreach_reply_id) WHERE outreach_reply_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_remove_restaurant_on_request(p_request_id uuid, p_restaurant_id uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req public.restaurant_optout_requests%ROWTYPE;
  v_rid uuid;
  v_name text;
  v_active boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Alleen admins kunnen restaurants verwijderen' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_req FROM public.restaurant_optout_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verzoek niet gevonden'; END IF;
  v_rid := coalesce(p_restaurant_id, v_req.restaurant_id);
  IF v_rid IS NULL THEN RAISE EXCEPTION 'Koppel eerst een restaurant aan dit verzoek'; END IF;
  SELECT name, is_active INTO v_name, v_active FROM public.restaurants WHERE id = v_rid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Restaurant niet gevonden'; END IF;

  UPDATE public.restaurants SET is_active = false, updated_at = now() WHERE id = v_rid;
  DELETE FROM public.restaurants_verborgen WHERE id = v_rid;
  INSERT INTO public.restaurants_verborgen (id, reden, hidden_at, was_active)
  VALUES (v_rid, 'verwijderd op verzoek van de eigenaar', now(), v_active);

  UPDATE public.restaurant_contacts
     SET email = NULL, alle_emails = NULL, instagram = NULL, facebook = NULL, telefoon_site = NULL,
         kvk = NULL, rechtsvorm = NULL, afgemeld_op = coalesce(afgemeld_op, now()), updated_at = now()
   WHERE restaurant_id = v_rid;

  UPDATE public.restaurant_optout_requests
     SET restaurant_id = v_rid, status = 'afgehandeld', afgehandeld_op = now(),
         admin_notitie = concat_ws(' | ', nullif(admin_notitie, ''),
           'Verwijderd op ' || to_char(now() AT TIME ZONE 'Europe/Amsterdam', 'DD-MM-YYYY')
           || ': verborgen, contactgegevens gewist, wordt nooit meer gemaild')
   WHERE id = p_request_id;

  RETURN v_name;
END $$;
REVOKE ALL ON FUNCTION public.admin_remove_restaurant_on_request(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_restaurant_on_request(uuid, uuid) TO authenticated;

-- Removal requests that already came in as an outreach reply.
INSERT INTO public.restaurant_optout_requests (email, naam_aanvrager, restaurant_id, restaurant_naam, soort, toelichting, outreach_reply_id)
SELECT y.from_email, y.from_name, y.restaurant_id, coalesce(r.name, y.subject, 'Onbekend restaurant'), 'verwijderen', y.samenvatting, y.id
  FROM public.outreach_replies y
  LEFT JOIN public.restaurants r ON r.id = y.restaurant_id
 WHERE y.categorie = 'verwijderen' AND y.from_email IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.restaurant_optout_requests x WHERE x.outreach_reply_id = y.id);
