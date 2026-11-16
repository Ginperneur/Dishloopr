import { useEffect, useMemo, useState } from 'react';
import { Search, Store, User, CornerDownLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ADMIN_GROUPS } from './adminNav';

interface AdminSearchProps {
  onNavigate: (section: string) => void;
  onOpenRestaurant: (restaurant: any) => void;
  onOpenUser: (user: any) => void;
}

interface Hit { id: string; title: string; sub: string }

/** Strip characters that have meaning in a PostgREST `or` filter. */
const safeTerm = (q: string) => q.replace(/[%,()*\\]/g, ' ').trim();

/**
 * Admin-wide search (Cmd/Ctrl+K): restaurants by name or address, users by name
 * or email, and admin pages by name. Results come from the server, so nothing
 * needs to be preloaded.
 */
export function AdminSearch({ onNavigate, onOpenRestaurant, onOpenUser }: AdminSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [restaurants, setRestaurants] = useState<Hit[]>([]);
  const [users, setUsers] = useState<Hit[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const term = safeTerm(query);
    if (term.length < 2) { setRestaurants([]); setUsers([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      const [r, u] = await Promise.all([
        supabase.from('restaurants').select('id, name, address, is_active')
          .or(`name.ilike.%${term}%,address.ilike.%${term}%`).order('name').limit(8),
        supabase.from('profiles').select('id, name, email')
          .or(`name.ilike.%${term}%,email.ilike.%${term}%`).limit(5),
      ]);
      if (cancelled) return;
      setRestaurants((r.data || []).map((x) => ({
        id: x.id, title: x.name, sub: `${x.address || ''}${x.is_active ? '' : ' · inactief'}`,
      })));
      setUsers((u.data || []).map((x) => ({ id: x.id, title: x.name || x.email || 'Onbekend', sub: x.email || '' })));
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const pages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ADMIN_GROUPS.flatMap((g) => g.tabs.map((t) => ({ ...t, group: g.label })))
      .filter((t) => t.label.toLowerCase().includes(q) || t.group.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query]);

  const close = () => { setOpen(false); setQuery(''); };

  const openRestaurant = async (id: string) => {
    const { data, error } = await supabase.from('restaurants').select('*, cities:city_id (name)').eq('id', id).maybeSingle();
    if (error || !data) { toast.error('Restaurant niet gevonden'); return; }
    close();
    onOpenRestaurant(data);
  };

  const openUser = async (id: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
    if (error || !data) { toast.error('Gebruiker niet gevonden'); return; }
    close();
    onOpenUser(data);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full min-w-0 max-w-xs items-center gap-2 rounded-md border border-border/60 bg-background px-3 text-sm text-muted-foreground hover:bg-muted/40"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Zoek restaurant, gebruiker of pagina</span>
        <kbd className="ml-auto hidden rounded border border-border/60 px-1.5 text-[11px] sm:inline">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="overflow-hidden p-0 shadow-lg">
          <DialogTitle className="sr-only">Zoeken in admin</DialogTitle>
          <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5">
            <CommandInput value={query} onValueChange={setQuery} placeholder="Zoek restaurant, gebruiker of pagina" />
            <CommandList>
              {query.trim().length >= 2 && <CommandEmpty>Niets gevonden.</CommandEmpty>}
              {pages.length > 0 && (
                <CommandGroup heading="Pagina's">
                  {pages.map((p) => (
                    <CommandItem key={p.id} value={`page-${p.id}`} onSelect={() => { close(); onNavigate(p.id); }}>
                      <CornerDownLeft className="mr-2 h-4 w-4" />
                      <span>{p.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{p.group}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {restaurants.length > 0 && (
                <CommandGroup heading="Restaurants">
                  {restaurants.map((r) => (
                    <CommandItem key={r.id} value={`r-${r.id}`} onSelect={() => openRestaurant(r.id)}>
                      <Store className="mr-2 h-4 w-4" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{r.title}</span>
                        <span className="truncate text-xs text-muted-foreground">{r.sub}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {users.length > 0 && (
                <CommandGroup heading="Gebruikers">
                  {users.map((u) => (
                    <CommandItem key={u.id} value={`u-${u.id}`} onSelect={() => openUser(u.id)}>
                      <User className="mr-2 h-4 w-4" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{u.title}</span>
                        <span className="truncate text-xs text-muted-foreground">{u.sub}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
