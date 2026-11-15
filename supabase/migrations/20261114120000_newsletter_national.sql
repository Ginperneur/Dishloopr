-- Newsletter placements are sold for all of the Netherlands only (20 euro) until targeted sending
-- exists. This makes a paid placement actually reach subscribers:
--  * a campaign can be built from an edition (email_campaigns.edition_id); when that campaign
--    completes, the edition is marked sent and its approved placements published;
--  * every subscriber can unsubscribe through their own link (unsubscribe_newsletter).
-- Idempotent on purpose (Lovable may apply it under another number, or twice).
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS edition_id uuid REFERENCES public.newsletter_editions(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.newsletter_campaign_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.edition_id IS NOT NULL THEN
    UPDATE public.newsletter_editions
      SET status = 'sent', sent_at = now(), recipient_count = NEW.sent_count, updated_at = now()
      WHERE id = NEW.edition_id;
    UPDATE public.newsletter_placements
      SET status = 'published', updated_at = now()
      WHERE edition_id = NEW.edition_id AND status = 'approved';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS newsletter_campaign_completed ON public.email_campaigns;
CREATE TRIGGER newsletter_campaign_completed AFTER UPDATE OF status ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.newsletter_campaign_completed();

-- The link in every newsletter carries the subscriber's id (a random uuid).
CREATE OR REPLACE FUNCTION public.unsubscribe_newsletter(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.newsletter_subscribers SET is_active = false, unsubscribed_at = now()
    WHERE id = p_id AND is_active;
  RETURN EXISTS (SELECT 1 FROM public.newsletter_subscribers WHERE id = p_id);
END $$;
REVOKE ALL ON FUNCTION public.unsubscribe_newsletter(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.unsubscribe_newsletter(uuid) TO anon, authenticated;
