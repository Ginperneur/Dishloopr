-- Admins could already read support_conversations/support_messages (policies
-- from 20260511184559), but had no way to mark an escalated conversation as
-- handled, and no admin UPDATE policy existed at all.

ALTER TABLE public.support_conversations
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE POLICY "Admins update support conversations"
  ON public.support_conversations FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_support_conversations_escalated
  ON public.support_conversations(escalated, resolved_at);
