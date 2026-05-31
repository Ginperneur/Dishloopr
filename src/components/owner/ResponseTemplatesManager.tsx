import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { MessageSquareReply, Plus, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface Template {
  id: string; title: string; body: string; category: string; sentiment: string | null; use_count: number;
}

export function ResponseTemplatesManager({ restaurantId }: { restaurantId: string }) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({ title: '', body: '', category: 'general', sentiment: 'any' });

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('response_templates')
      .select('*').eq('restaurant_id', restaurantId).order('use_count', { ascending: false });
    setTemplates(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurantId]);

  const openNew = () => {
    setEditing(null);
    setForm({ title: '', body: '', category: 'general', sentiment: 'any' });
    setOpen(true);
  };
  const openEdit = (t: Template) => {
    setEditing(t);
    setForm({ title: t.title, body: t.body, category: t.category, sentiment: t.sentiment || 'any' });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Vul titel en tekst in');
      return;
    }
    const payload: any = {
      title: form.title.trim(),
      body: form.body.trim(),
      category: form.category,
      sentiment: form.sentiment === 'any' ? null : form.sentiment,
    };
    if (editing) {
      const { error } = await (supabase as any).from('response_templates').update(payload).eq('id', editing.id);
      if (error) { toast.error('Opslaan mislukt'); return; }
      toast.success('Template bijgewerkt');
    } else {
      const { error } = await (supabase as any).from('response_templates').insert({
        ...payload, restaurant_id: restaurantId, user_id: user!.id,
      });
      if (error) { toast.error('Opslaan mislukt'); return; }
      toast.success('Template toegevoegd');
    }
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Template verwijderen?')) return;
    const { error } = await (supabase as any).from('response_templates').delete().eq('id', id);
    if (error) { toast.error('Verwijderen mislukt'); return; }
    toast.success('Verwijderd');
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareReply className="h-5 w-5 text-primary" /> Reactietemplates
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nieuw</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Template bewerken' : 'Nieuwe template'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Titel</label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Bv. Bedankje 5 sterren" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Categorie</label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">Algemeen</SelectItem>
                      <SelectItem value="thanks">Bedankje</SelectItem>
                      <SelectItem value="apology">Excuses</SelectItem>
                      <SelectItem value="invite_back">Terug uitnodigen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Geschikt voor</label>
                  <Select value={form.sentiment} onValueChange={(v) => setForm({ ...form, sentiment: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Alle reviews</SelectItem>
                      <SelectItem value="positive">Positief (4–5★)</SelectItem>
                      <SelectItem value="neutral">Neutraal (3★)</SelectItem>
                      <SelectItem value="negative">Negatief (1–2★)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Tekst</label>
                <Textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Bedankt voor je bezoek!" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
              <Button onClick={save}>Opslaan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Laden…</p>
         ) : templates.length === 0 ? (
          <OwnerEmptyState
            compact
            icon={MessageSquare}
            title="Geen templates"
            description="Maak een template om reviews snel te beantwoorden."
          />
        ) : (
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t.id} className="rounded-md border p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{t.title}</span>
                    <Badge variant="secondary" className="text-xs">{t.category}</Badge>
                    {t.sentiment && <Badge variant="outline" className="text-xs">{t.sentiment}</Badge>}
                    {t.use_count > 0 && <span className="text-xs text-muted-foreground">{t.use_count}× gebruikt</span>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{t.body}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}