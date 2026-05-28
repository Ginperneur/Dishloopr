import { useEffect, useState } from 'react';
import { Handshake, Plus, Check, X, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { toast } from 'sonner';

interface Promo {
  id: string;
  initiator_restaurant_id: string;
  partner_restaurant_id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  initiator?: { name: string } | null;
  partner?: { name: string } | null;
}

export function CrossPromotionManager({ restaurantId }: { restaurantId: string }) {
  const [items, setItems] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string }[]>([]);
  const [partner, setPartner] = useState<{ id: string; name: string } | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('cross_promotions')
      .select('*, initiator:restaurants!cross_promotions_initiator_restaurant_id_fkey(name), partner:restaurants!cross_promotions_partner_restaurant_id_fkey(name)')
      .or(`initiator_restaurant_id.eq.${restaurantId},partner_restaurant_id.eq.${restaurantId}`)
      .order('created_at', { ascending: false });
    setItems((data as Promo[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurantId]);

  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('restaurants')
        .select('id, name')
        .ilike('name', `%${search}%`)
        .neq('id', restaurantId)
        .eq('is_active', true)
        .limit(8);
      setSearchResults(data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [search, restaurantId]);

  const propose = async () => {
    if (!partner || !title) { toast.error('Kies een partner en titel'); return; }
    const { error } = await (supabase as any).from('cross_promotions').insert({
      initiator_restaurant_id: restaurantId,
      partner_restaurant_id: partner.id,
      title,
      description: description || null,
      status: 'pending',
    });
    if (error) { toast.error('Kon voorstel niet versturen'); return; }
    toast.success(`Voorstel verstuurd naar ${partner.name}`);
    setPartner(null); setTitle(''); setDescription(''); setSearch('');
    load();
  };

  const setStatus = async (id: string, status: string) => {
    await (supabase as any).from('cross_promotions').update({ status }).eq('id', id);
    toast.success('Bijgewerkt');
    load();
  };

  const remove = async (id: string) => {
    await (supabase as any).from('cross_promotions').delete().eq('id', id);
    load();
  };

  const statusBadge = (s: string) => {
    const map: Record<string, any> = {
      pending: { v: 'secondary', l: 'In afwachting' },
      accepted: { v: 'default', l: 'Geaccepteerd' },
      rejected: { v: 'destructive', l: 'Afgewezen' },
      expired: { v: 'outline', l: 'Verlopen' },
      cancelled: { v: 'outline', l: 'Geannuleerd' },
    };
    const cfg = map[s] || { v: 'outline', l: s };
    return <Badge variant={cfg.v}>{cfg.l}</Badge>;
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Handshake className="h-4 w-4" />
          Werk samen met andere restaurants — bv. wijn-diner combo, korting bij beide of cross-shout-outs.
        </div>

        <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
          <div>
            <Label className="text-xs">Partner restaurant</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start font-normal">
                  {partner ? partner.name : 'Zoek een restaurant…'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[300px]" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Typ minimaal 2 letters…" value={search} onValueChange={setSearch} />
                  <CommandList>
                    <CommandEmpty>Geen resultaten</CommandEmpty>
                    <CommandGroup>
                      {searchResults.map((r) => (
                        <CommandItem key={r.id} onSelect={() => { setPartner(r); setOpen(false); }}>
                          {r.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label className="text-xs">Titel</Label>
            <Input placeholder="Bv. Wijn & dine combo" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Beschrijving</Label>
            <Textarea rows={2} placeholder="Wat krijgen gasten?" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button onClick={propose} size="sm" className="w-full">
            <Plus className="h-4 w-4 mr-1" /> Verstuur voorstel
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-3">Laden…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">Nog geen cross-promoties.</p>
        ) : (
          <div className="space-y-2">
            {items.map((it) => {
              const isIncoming = it.partner_restaurant_id === restaurantId && it.status === 'pending';
              const otherName = it.initiator_restaurant_id === restaurantId ? it.partner?.name : it.initiator?.name;
              return (
                <div key={it.id} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{it.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {isIncoming ? 'Voorstel van' : 'Met'} <span className="font-medium">{otherName}</span>
                      </p>
                    </div>
                    {statusBadge(it.status)}
                  </div>
                  {it.description && <p className="text-sm text-muted-foreground">{it.description}</p>}
                  <div className="flex gap-2 pt-1">
                    {isIncoming && (
                      <>
                        <Button size="sm" onClick={() => setStatus(it.id, 'accepted')}>
                          <Check className="h-4 w-4 mr-1" /> Accepteren
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setStatus(it.id, 'rejected')}>
                          <X className="h-4 w-4 mr-1" /> Afwijzen
                        </Button>
                      </>
                    )}
                    {it.initiator_restaurant_id === restaurantId && (
                      <Button size="sm" variant="ghost" onClick={() => remove(it.id)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Verwijderen
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}