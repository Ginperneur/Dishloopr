
-- Conversations
CREATE TABLE public.support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  title TEXT,
  escalated BOOLEAN NOT NULL DEFAULT false,
  escalated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_conversations_user ON public.support_conversations(user_id);
CREATE INDEX idx_support_conversations_session ON public.support_conversations(session_id);

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own support conversations"
  ON public.support_conversations FOR SELECT
  USING (auth.uid() = user_id OR (user_id IS NULL AND session_id IS NOT NULL));

CREATE POLICY "Anyone can create support conversations"
  ON public.support_conversations FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR (auth.uid() IS NULL AND user_id IS NULL AND session_id IS NOT NULL)
  );

CREATE POLICY "Users update own support conversations"
  ON public.support_conversations FOR UPDATE
  USING (auth.uid() = user_id OR (user_id IS NULL AND session_id IS NOT NULL));

CREATE POLICY "Admins view all support conversations"
  ON public.support_conversations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Messages
CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  needs_human BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_messages_conv ON public.support_messages(conversation_id, created_at);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own support messages"
  ON public.support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id = conversation_id
        AND (c.user_id = auth.uid() OR (c.user_id IS NULL AND c.session_id IS NOT NULL))
    )
  );

CREATE POLICY "Anyone can insert messages in own conversation"
  ON public.support_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id = conversation_id
        AND (
          (auth.uid() IS NOT NULL AND c.user_id = auth.uid())
          OR (auth.uid() IS NULL AND c.user_id IS NULL AND c.session_id IS NOT NULL)
        )
    )
  );

CREATE POLICY "Admins view all support messages"
  ON public.support_messages FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_support_conv_updated
  BEFORE UPDATE ON public.support_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
