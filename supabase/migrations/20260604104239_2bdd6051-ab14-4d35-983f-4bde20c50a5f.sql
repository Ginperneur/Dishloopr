
-- user_lists: named folders/lists per user
CREATE TABLE public.user_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
  description text CHECK (description IS NULL OR length(description) <= 280),
  emoji text CHECK (emoji IS NULL OR length(emoji) <= 8),
  color text CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
  is_public boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_lists_user_id_idx ON public.user_lists(user_id);
CREATE INDEX user_lists_public_idx ON public.user_lists(is_public) WHERE is_public = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_lists TO authenticated;
GRANT SELECT ON public.user_lists TO anon;
GRANT ALL ON public.user_lists TO service_role;

ALTER TABLE public.user_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own lists"
  ON public.user_lists FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Anyone can view public lists"
  ON public.user_lists FOR SELECT
  USING (is_public = true);

CREATE POLICY "Admins manage all lists"
  ON public.user_lists FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER user_lists_set_updated_at
  BEFORE UPDATE ON public.user_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- user_list_items: restaurants in each list
CREATE TABLE public.user_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.user_lists(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  note text CHECK (note IS NULL OR length(note) <= 500),
  sort_order integer NOT NULL DEFAULT 0,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(list_id, restaurant_id)
);

CREATE INDEX user_list_items_list_idx ON public.user_list_items(list_id);
CREATE INDEX user_list_items_restaurant_idx ON public.user_list_items(restaurant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_list_items TO authenticated;
GRANT SELECT ON public.user_list_items TO anon;
GRANT ALL ON public.user_list_items TO service_role;

ALTER TABLE public.user_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage items in own lists"
  ON public.user_list_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_lists l
    WHERE l.id = user_list_items.list_id AND l.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_lists l
    WHERE l.id = user_list_items.list_id AND l.user_id = auth.uid()
  ));

CREATE POLICY "Anyone can view items in public lists"
  ON public.user_list_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_lists l
    WHERE l.id = user_list_items.list_id AND l.is_public = true
  ));

CREATE POLICY "Admins manage all list items"
  ON public.user_list_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
