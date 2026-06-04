import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tag, Plus, Trash2, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { openConfirm } from '@/components/ui/confirm-dialog';
interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  max_uses: number | null;
  use_count: number;
  valid_until: string | null;
  is_active: boolean;
}

export function PromoCodesManager({ restaurantId }: { restaurantId: string }) {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    code: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 10,
    max_uses: '',
    valid_until: '',
  });

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('promo_codes')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });
    setCodes(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurantId]);

  const create = async () => {
    if (!form.code.trim()) { toast.error('Code is verplicht'); return; }
    const { error } = await (supabase as any).from('promo_codes').insert({
      restaurant_id: restaurantId,
      code: form.code.toUpperCase().trim(),
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      valid_until: form.valid_until || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Kortingscode aangemaakt');
    setForm({ code: '', description: '', discount_type: 'percentage', discount_value: 10, max_uses: '', valid_until: '' });
    load();
  };

  const toggle = async (id: string, active: boolean) => {
    await (supabase as any).from('promo_codes').update({ is_active: !active }).eq('id', id);
    load();
  };

  const remove = async (id: string) => {
    if (!(await openConfirm('Code verwijderen?'))) return;
    await (supabase as any).from('promo_codes').delete().eq('id', id);
    toast.success('Verwijderd');
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tag className="h-5 w-5 text-primary" /> Kortingscodes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border rounded-lg bg-muted/30">
          <div>
            <Label className="text-xs">Code</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="WELKOM10" />
          </div>
          <div>
            <Label className="text-xs">Omschrijving</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="10% voor nieuwe gasten" />
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="amount">Bedrag (€)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Waarde</Label>
            <Input type="number" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })} />
          </div>
          <div>
            <Label className="text-xs">Max. gebruik (leeg = onbeperkt)</Label>
            <Input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Geldig tot</Label>
            <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={create} className="w-full"><Plus className="h-4 w-4 mr-1" /> Code aanmaken</Button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Laden…</p>
        ) : codes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nog geen kortingscodes.</p>
        ) : (
          <ul className="space-y-2">
            {codes.map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold">{c.code}</span>
                    <Badge variant={c.is_active ? 'default' : 'secondary'} className="text-[10px]">
                      {c.is_active ? 'Actief' : 'Inactief'}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {c.discount_type === 'percentage' ? `${c.discount_value}%` : `€${c.discount_value}`}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {c.use_count}{c.max_uses ? `/${c.max_uses}` : ''} gebruikt
                    </span>
                  </div>
                  {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(c.code); toast.success('Gekopieerd'); }}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggle(c.id, c.is_active)}>
                  {c.is_active ? 'Pauzeer' : 'Activeer'}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}