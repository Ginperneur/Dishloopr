DROP POLICY IF EXISTS "Users view own support conversations" ON public.support_conversations;
CREATE POLICY "Users view own support conversations" ON public.support_conversations FOR SELECT
  USING ((auth.uid() IS NOT NULL AND auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Users update own support conversations" ON public.support_conversations;
CREATE POLICY "Users update own support conversations" ON public.support_conversations FOR UPDATE
  USING ((auth.uid() IS NOT NULL AND auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Anyone can create support conversations" ON public.support_conversations;
DROP POLICY IF EXISTS "Users create own support conversations" ON public.support_conversations;
CREATE POLICY "Users create own support conversations" ON public.support_conversations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);
DROP POLICY IF EXISTS "Users view own support messages" ON public.support_messages;
CREATE POLICY "Users view own support messages" ON public.support_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.support_conversations c
    WHERE c.id = support_messages.conversation_id
      AND ((auth.uid() IS NOT NULL AND c.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))));
DROP POLICY IF EXISTS "Anyone can insert messages in own conversation" ON public.support_messages;
DROP POLICY IF EXISTS "Users insert messages in own conversation" ON public.support_messages;
CREATE POLICY "Users insert messages in own conversation" ON public.support_messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.support_conversations c
    WHERE c.id = support_messages.conversation_id AND auth.uid() IS NOT NULL AND c.user_id = auth.uid()));