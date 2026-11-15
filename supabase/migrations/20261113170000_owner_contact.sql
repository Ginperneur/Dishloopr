-- Contact and complaints for restaurant owners. contact_messages (the /contact form) gets a
-- category, the restaurant and sender, and a status, so owners can send a question, problem,
-- complaint or billing issue from their dashboard and admins can handle them in Admin.
-- Idempotent on purpose (Lovable may apply it under another number, or twice).
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'nieuw',
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS handled_at timestamptz;

ALTER TABLE public.contact_messages DROP CONSTRAINT IF EXISTS contact_messages_status_check;
ALTER TABLE public.contact_messages ADD CONSTRAINT contact_messages_status_check
  CHECK (status IN ('nieuw', 'in_behandeling', 'afgehandeld'));
ALTER TABLE public.contact_messages DROP CONSTRAINT IF EXISTS contact_messages_category_check;
ALTER TABLE public.contact_messages ADD CONSTRAINT contact_messages_category_check
  CHECK (category IS NULL OR category IN ('vraag', 'probleem', 'klacht', 'betaling', 'gegevens', 'anders'));

CREATE INDEX IF NOT EXISTS contact_messages_status_idx ON public.contact_messages (status, created_at DESC);
CREATE INDEX IF NOT EXISTS contact_messages_user_idx ON public.contact_messages (user_id, created_at DESC);

-- A signed-in sender can only file a message under their own id, and only for a restaurant they manage.
CREATE OR REPLACE FUNCTION public.contact_message_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Je kunt alleen namens jezelf een bericht sturen' USING ERRCODE = '42501';
  END IF;
  IF NEW.restaurant_id IS NOT NULL AND NOT (public.has_role(auth.uid(), 'admin') OR public.is_verified_owner(auth.uid(), NEW.restaurant_id)
     OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = NEW.restaurant_id AND r.claimed_by_owner_id = auth.uid())) THEN
    NEW.restaurant_id := NULL;
  END IF;
  IF TG_OP = 'INSERT' AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.status := 'nieuw'; NEW.admin_notes := NULL; NEW.handled_at := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS contact_message_guard ON public.contact_messages;
CREATE TRIGGER contact_message_guard BEFORE INSERT ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.contact_message_guard();

DROP POLICY IF EXISTS "Senders can read their own contact messages" ON public.contact_messages;
CREATE POLICY "Senders can read their own contact messages" ON public.contact_messages
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins can update contact messages" ON public.contact_messages;
CREATE POLICY "Admins can update contact messages" ON public.contact_messages
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
