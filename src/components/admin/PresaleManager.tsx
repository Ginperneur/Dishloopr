import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toast } from 'sonner';
import {
  PRESALE_STATUSES, groupPresale, filterPresale, presaleRows, filterRows, rowStatusCounts, cityCounts,
  contactPhone, rowsCsv, presaleUpdate,
  type PresaleTarget, type PresaleRestaurant, type PresaleContact, type PresaleStatus,
} from '@/lib/presale';

const PAGE_SIZE = 50;

function StatusSelect({ value, disabled, onChange, label }: { value: string; disabled: boolean; onChange: (v: PresaleStatus) => void; label: string }) {
  return (
    <Select value={value} disabled={disabled} onValueChange={v => onChange(v as PresaleStatus)}>
      <SelectTrigger className="h-9 w-36" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>{PRESALE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function NoteInput({ value, disabled, onSave, label }: { value: string; disabled: boolean; onSave: (v: string) => void; label: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <Input value={draft} disabled={disabled} aria-label={label} maxLength={2000} className="h-9 min-w-48"
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { if (draft !== value) onSave(draft); }} />
  );
}

export function PresaleManager() {
  const { isAdmin, loading: checkingAdmin } = useAdminCheck();
  const [targets, setTargets] = useState<PresaleTarget[]>([]);
  const [restaurants, setRestaurants] = useState<PresaleRestaurant[]>([]);
  const [contacts, setContacts] = useState<PresaleContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<'page' | 'restaurant'>('page');
  const [city, setCity] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const all: PresaleTarget[] = [];
      for (let from = 0; ; from += 1000) {
        const r = await supabase.from('presale_targets').select('id,pagina_slug,stad,gerecht,positie,totaal,restaurant_id,status,notitie,updated_at').order('id').range(from, from + 999);
        if (r.error) throw r.error;
        all.push(...(r.data ?? []));
        if ((r.data?.length ?? 0) < 1000) break;
      }
      const ids = [...new Set(all.map(r => r.restaurant_id))];
      const chunks = Array.from({ length: Math.ceil(ids.length / 150) }, (_, i) => ids.slice(i * 150, (i + 1) * 150));
      const batches = await Promise.all(chunks.map(async chunk => {
        const [r, c] = await Promise.all([
          supabase.from('restaurants').select('id,name,slug,phone,claimed_by_owner_id').in('id', chunk),
          supabase.from('restaurant_contacts').select('restaurant_id,email,email_kwaliteit,instagram,telefoon_site').in('restaurant_id', chunk),
        ]);
        if (r.error) throw r.error;
        if (c.error) throw c.error;
        return { r: r.data ?? [], c: c.data ?? [] };
      }));
      setTargets(all); setRestaurants(batches.flatMap(b => b.r)); setContacts(batches.flatMap(b => b.c));
    } catch { toast.error('Presale laden mislukt. Probeer opnieuw.'); }
    finally { setLoading(false); }
  }, [isAdmin]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [city, status, search, view]);

  const rows = useMemo(() => presaleRows(targets, restaurants, contacts), [targets, restaurants, contacts]);
  const groups = useMemo(() => groupPresale(targets, restaurants, contacts)
    .sort((a, b) => (a.bestPosition ?? Infinity) - (b.bestPosition ?? Infinity) || b.pageCount - a.pageCount), [targets, restaurants, contacts]);
  const cities = useMemo(() => cityCounts(targets), [targets]);
  const statusCounts = useMemo(() => rowStatusCounts(targets), [targets]);
  const filteredRows = useMemo(() => filterRows(rows, { city, status, search }), [rows, city, status, search]);
  const filteredGroups = useMemo(() => filterPresale(groups, { city, status, threePlus: false, hasEmail: false, search }), [groups, city, status, search]);
  const total = view === 'page' ? filteredRows.length : filteredGroups.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const slice = <T,>(list: T[]) => list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const save = async (key: string, scope: { id?: number; restaurantId?: string }, patch: { status?: PresaleStatus; notitie?: string }) => {
    setBusy(b => ({ ...b, [key]: true }));
    try {
      const values = presaleUpdate(patch);
      let q = supabase.from('presale_targets').update(values);
      q = scope.id !== undefined ? q.eq('id', scope.id) : q.eq('restaurant_id', scope.restaurantId!);
      const r = await q.select('id');
      if (r.error || !r.data?.length) throw r.error ?? new Error('no rows');
      const touched = new Set(r.data.map(x => x.id));
      setTargets(prev => prev.map(t => touched.has(t.id) ? { ...t, ...values } : t));
      toast.success(patch.status ? 'Status opgeslagen' : 'Notitie opgeslagen');
    } catch { toast.error('Opslaan mislukt. Je wijziging is niet opgeslagen.'); }
    finally { setBusy(b => ({ ...b, [key]: false })); }
  };

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([rowsCsv(filteredRows)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `dishloopr-presale-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  if (checkingAdmin) return <p className="text-muted-foreground">Laden…</p>;
  if (!isAdmin) return null;

  const RestaurantCell = ({ r }: { r?: PresaleRestaurant }) => (
    <div className="flex flex-wrap items-center gap-2">
      {r ? <Link to={`/restaurant/${r.slug}`} className="font-medium text-primary hover:underline">{r.name}</Link> : <span>Onbekend</span>}
      {r?.claimed_by_owner_id && <Badge variant="secondary">Al geclaimd</Badge>}
    </div>
  );
  const ContactCells = ({ phone, email }: { phone: string; email?: string | null }) => (<>
    <TableCell className="whitespace-nowrap">{phone ? <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="hover:underline">{phone}</a> : '—'}</TableCell>
    <TableCell>{email ? <a href={`mailto:${email}`} className="hover:underline whitespace-nowrap">{email}</a> : '—'}</TableCell>
  </>);

  return (
    <section className="space-y-5" aria-label="Presale">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Presale</h2>
        <div className="flex flex-wrap gap-2">
          <ToggleGroup type="single" value={view} onValueChange={v => v && setView(v as 'page' | 'restaurant')} variant="outline">
            <ToggleGroupItem value="page">Per pagina ({targets.length})</ToggleGroupItem>
            <ToggleGroupItem value="restaurant">Per restaurant ({groups.length})</ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Vernieuwen</Button>
          <Button onClick={exportCsv} disabled={loading || !filteredRows.length}><Download className="mr-2 h-4 w-4" />Exporteer CSV</Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {PRESALE_STATUSES.map(s => (
            <button key={s} onClick={() => setStatus(status === s ? 'all' : s)} className={`rounded-lg border px-3 py-1.5 text-sm ${status === s ? 'border-primary bg-primary/10' : 'bg-card'}`}>
              {s} <span className="font-semibold">{statusCounts[s]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {cities.map(([c, n]) => (
            <button key={c} onClick={() => setCity(city === c ? 'all' : c)} className={`rounded-full border px-3 py-1 text-xs ${city === c ? 'border-primary bg-primary/10' : 'bg-card'}`}>
              {c} <span className="font-semibold">{n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoek op restaurantnaam" aria-label="Zoek op restaurantnaam" className="w-64" />
        <Select value={city} onValueChange={setCity}>
          <SelectTrigger className="w-48" aria-label="Stad"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Alle steden</SelectItem>{cities.map(([c]) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44" aria-label="Status filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Alle statussen</SelectItem>{PRESALE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <span className="self-center text-sm text-muted-foreground">{total} resultaten</span>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
        <div className="overflow-x-auto rounded-xl border">
          {view === 'page' ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Restaurant</TableHead><TableHead>Stad</TableHead><TableHead>Gerecht</TableHead><TableHead>Positie</TableHead>
                <TableHead>Telefoon</TableHead><TableHead>E-mail</TableHead><TableHead>Status</TableHead><TableHead>Notitie</TableHead>
              </TableRow></TableHeader>
              <TableBody>{slice(filteredRows).map(r => {
                const key = `row-${r.id}`;
                return (
                  <TableRow key={r.id} data-testid="presale-row">
                    <TableCell><RestaurantCell r={r.restaurant} /></TableCell>
                    <TableCell>{r.stad ?? '—'}</TableCell>
                    <TableCell><Link to={`/eten/${r.pagina_slug}`} className="hover:underline">{r.gerecht ?? r.pagina_slug}</Link></TableCell>
                    <TableCell className="whitespace-nowrap">#{r.positie ?? '—'} / {r.totaal ?? '—'}</TableCell>
                    <ContactCells phone={contactPhone(r)} email={r.contact?.email} />
                    <TableCell><StatusSelect value={r.status} disabled={!!busy[key]} label={`Status ${r.restaurant?.name ?? ''}`} onChange={v => save(key, { id: r.id }, { status: v })} /></TableCell>
                    <TableCell><NoteInput value={r.notitie ?? ''} disabled={!!busy[key]} label={`Notitie ${r.restaurant?.name ?? ''}`} onSave={v => save(key, { id: r.id }, { notitie: v })} /></TableCell>
                  </TableRow>
                );
              })}</TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Restaurant</TableHead><TableHead>Stad</TableHead><TableHead>Pagina's</TableHead><TableHead>Beste positie</TableHead>
                <TableHead>Telefoon</TableHead><TableHead>E-mail</TableHead><TableHead>Status</TableHead><TableHead>Notitie</TableHead>
              </TableRow></TableHeader>
              <TableBody>{slice(filteredGroups).map(g => {
                const key = `rest-${g.id}`;
                return (
                  <TableRow key={g.id} data-testid="presale-group">
                    <TableCell><RestaurantCell r={g.restaurant} /></TableCell>
                    <TableCell>{g.cities.join(', ')}</TableCell>
                    <TableCell>
                      <div className="font-semibold">{g.pageCount}</div>
                      <div className="text-xs text-muted-foreground">{g.pages.map(p => `${p.gerecht ?? p.pagina_slug} #${p.positie ?? '—'}`).join(', ')}</div>
                    </TableCell>
                    <TableCell>#{g.bestPosition ?? '—'}</TableCell>
                    <ContactCells phone={contactPhone(g)} email={g.contact?.email} />
                    <TableCell><StatusSelect value={g.status} disabled={!!busy[key]} label={`Status ${g.restaurant?.name ?? ''}`} onChange={v => save(key, { restaurantId: g.id }, { status: v })} /></TableCell>
                    <TableCell><NoteInput value={g.note} disabled={!!busy[key]} label={`Notitie ${g.restaurant?.name ?? ''}`} onSave={v => save(key, { restaurantId: g.id }, { notitie: v })} /></TableCell>
                  </TableRow>
                );
              })}</TableBody>
            </Table>
          )}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>Vorige</Button>
          <span className="text-sm">{current} / {pages}</span>
          <Button variant="outline" size="sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>Volgende</Button>
        </div>
      )}
    </section>
  );
}
