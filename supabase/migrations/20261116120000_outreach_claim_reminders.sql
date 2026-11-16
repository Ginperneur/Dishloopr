-- Claim reminders on top of the outreach mail golf.
--   outreach_settings          reminders_enabled (off by default), reminder_interval_days, reminder_max
--   outreach_reminders         one row per restaurant per reminder step; UNIQUE so a step is never sent twice
--   admin_claim_followup()     one row per mailable segment restaurant: mails, reactions, claim state,
--                              page views ("bekeken") and the follow-up status. The admin screen and the
--                              outreach-send-reminders function both read it, so they always agree on who is due.
-- A reminder only goes to a restaurant that got a golf mail, is still unclaimed, has no claim in progress,
-- never replied (automatic replies excluded), did not opt out, and was last mailed reminder_interval_days ago.
-- Idempotent: Lovable may run this file twice under another number.

ALTER TABLE public.outreach_settings
  ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_interval_days integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS reminder_max integer NOT NULL DEFAULT 3;

ALTER TABLE public.outreach_settings DROP CONSTRAINT IF EXISTS outreach_settings_reminder_interval_check;
ALTER TABLE public.outreach_settings ADD CONSTRAINT outreach_settings_reminder_interval_check
  CHECK (reminder_interval_days BETWEEN 3 AND 90);
ALTER TABLE public.outreach_settings DROP CONSTRAINT IF EXISTS outreach_settings_reminder_max_check;
ALTER TABLE public.outreach_settings ADD CONSTRAINT outreach_settings_reminder_max_check
  CHECK (reminder_max BETWEEN 1 AND 6);

CREATE TABLE IF NOT EXISTS public.outreach_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  step integer NOT NULL CHECK (step BETWEEN 1 AND 6),
  segment text NOT NULL CHECK (segment IN ('zichtbaar', 'onzichtbaar_menu')),
  to_email text NOT NULL,
  subject text NOT NULL,
  -- Page views named in the mail (null when the mail did not mention them).
  views_mentioned integer,
  status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'sent', 'failed')),
  provider_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (restaurant_id, step)
);
CREATE INDEX IF NOT EXISTS outreach_reminders_created_idx ON public.outreach_reminders (created_at DESC);

ALTER TABLE public.outreach_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outreach_reminders_admin ON public.outreach_reminders;
CREATE POLICY outreach_reminders_admin ON public.outreach_reminders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- opvolg_status, in order of precedence:
--   geclaimd           claimed (or claimed_unverified / verified)
--   claim_loopt        a claim request is open (pending, email or phone verified)
--   gereageerd         replied to an outreach mail (automatic replies do not count); a human follows up
--   afgemeld           opted out
--   niet_mailbaar      no usable email, or sole trader / partnership while those are skipped
--   nog_niet_gemaild   mailable, but no golf mail sent yet
--   reeks_klaar        all reminders sent
--   wacht              mailed less than reminder_interval_days ago
--   herinnering_klaar  due for the next reminder
DROP FUNCTION IF EXISTS public.admin_claim_followup();
CREATE FUNCTION public.admin_claim_followup()
RETURNS TABLE (
  restaurant_id uuid,
  name text,
  slug text,
  stad text,
  email text,
  segment text,
  mail_status text,
  claim_status text,
  golf_mails integer,
  herinneringen integer,
  eerste_mail_op timestamptz,
  laatst_gemaild_op timestamptz,
  gereageerd_op timestamptz,
  reactie_categorie text,
  claim_loopt boolean,
  views_totaal integer,
  views_30d integer,
  views_sinds_mail integer,
  volgende_herinnering_op timestamptz,
  opvolg_status text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR coalesce(auth.role(), '') = 'service_role') THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH s AS (
    SELECT o.reminder_interval_days AS iv, o.reminder_max AS mx FROM public.outreach_settings o WHERE o.id
  ),
  today AS (SELECT (now() AT TIME ZONE 'Europe/Amsterdam')::date AS d),
  msg AS (
    SELECT m.restaurant_id AS rid, count(*)::int AS n, min(m.sent_at) AS first_at
    FROM public.outreach_messages m WHERE m.status = 'sent' GROUP BY m.restaurant_id
  ),
  rem AS (
    SELECT x.restaurant_id AS rid, count(*)::int AS n
    FROM public.outreach_reminders x WHERE x.status = 'sent' GROUP BY x.restaurant_id
  ),
  rep AS (
    SELECT DISTINCT ON (y.restaurant_id) y.restaurant_id AS rid, y.received_at AS at, y.categorie AS cat
    FROM public.outreach_replies y
    WHERE y.restaurant_id IS NOT NULL AND y.status <> 'automatisch' AND coalesce(y.categorie, '') <> 'automatisch'
    ORDER BY y.restaurant_id, y.received_at DESC
  ),
  clm AS (
    SELECT DISTINCT c.restaurant_id AS rid FROM public.restaurant_claims c
    WHERE c.status IN ('pending', 'email_verified', 'phone_verified')
  ),
  base AS (
    SELECT t.*, coalesce(msg.n, 0) AS g_n, msg.first_at, coalesce(rem.n, 0) AS r_n,
           rep.at AS rep_at, rep.cat AS rep_cat, (clm.rid IS NOT NULL) AS c_open
    FROM public.outreach_targets t
    LEFT JOIN msg ON msg.rid = t.restaurant_id
    LEFT JOIN rem ON rem.rid = t.restaurant_id
    LEFT JOIN rep ON rep.rid = t.restaurant_id
    LEFT JOIN clm ON clm.rid = t.restaurant_id
    WHERE t.segment IN ('zichtbaar', 'onzichtbaar_menu')
  ),
  views AS (
    SELECT sd.restaurant_id AS rid,
           sum(sd.n)::int AS total,
           sum(sd.n) FILTER (WHERE sd.dag > (SELECT d FROM today) - 30)::int AS last30,
           sum(sd.n) FILTER (WHERE b.first_at IS NOT NULL
             AND sd.dag >= (b.first_at AT TIME ZONE 'Europe/Amsterdam')::date)::int AS since_mail
    FROM public.restaurant_stats_daily sd
    JOIN base b ON b.restaurant_id = sd.restaurant_id
    WHERE sd.metric = 'bekeken'
    GROUP BY sd.restaurant_id
  ),
  st AS (
    SELECT b.*, v.total, v.last30, v.since_mail,
      CASE
        WHEN b.mail_status = 'al_geclaimd' THEN 'geclaimd'
        WHEN b.c_open THEN 'claim_loopt'
        WHEN b.rep_at IS NOT NULL THEN 'gereageerd'
        WHEN b.mail_status = 'afgemeld' THEN 'afgemeld'
        WHEN b.mail_status <> 'mailbaar' THEN 'niet_mailbaar'
        WHEN b.g_n = 0 THEN 'nog_niet_gemaild'
        WHEN b.r_n >= (SELECT mx FROM s) THEN 'reeks_klaar'
        WHEN b.laatst_gemaild_op > now() - make_interval(days => (SELECT iv FROM s)) THEN 'wacht'
        ELSE 'herinnering_klaar'
      END AS os
    FROM base b LEFT JOIN views v ON v.rid = b.restaurant_id
  )
  SELECT st.restaurant_id::uuid, st.name::text, st.slug::text, st.stad::text, st.email::text, st.segment::text,
         st.mail_status::text, st.claim_status::text, st.g_n::int, st.r_n::int, st.first_at::timestamptz,
         st.laatst_gemaild_op::timestamptz, st.rep_at::timestamptz, st.rep_cat::text, st.c_open,
         coalesce(st.total, 0), coalesce(st.last30, 0), coalesce(st.since_mail, 0),
         CASE WHEN st.os IN ('wacht', 'herinnering_klaar')
              THEN greatest(now(), coalesce(st.laatst_gemaild_op, now()) + make_interval(days => (SELECT iv FROM s))) END,
         st.os
  FROM st;
END $$;

REVOKE ALL ON FUNCTION public.admin_claim_followup() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_claim_followup() TO authenticated, service_role;

-- Weekdays 07:30 UTC (08:30 / 09:30 Amsterdam), before the hourly golf batches, so reminders
-- get room under the shared daily cap. Does nothing while reminders_enabled = false.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'outreach-send-reminders';
SELECT cron.schedule(
  'outreach-send-reminders',
  '30 7 * * 1-5',
  $cron$
  SELECT net.http_post(
    url := 'https://uktafmxojymsojqewzuy.supabase.co/functions/v1/outreach-send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT secret FROM public.internal_job_secrets WHERE name = 'cron')
    ),
    body := '{"mode":"cron"}'::jsonb
  );
  $cron$
);
