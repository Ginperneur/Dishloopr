import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Loader2, Mail, Phone, Instagram, Save, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { PRESALE_STATUSES, groupPresale, filterPresale, presaleCounts, presaleUpdate, presaleCsv, type PresaleTarget, type PresaleRestaurant, type PresaleContact, type PresaleStatus } from '@/lib/presale';

function instagramUrl(value: string) {
  const handle = value.trim().replace(/^@/, '');
  if (/^[a-zA-Z0-9._]+$/.test(handle)) return `https://www.instagram.com/${handle}/`;
  try {
    const url = new URL(handle.startsWith('http') ? handle : `https://${handle}`);
    return url.protocol === 'https:' && (url.hostname === 'instagram.com' || url.hostname === 'www.instagram.com') ? url.href : undefined;
  } catch { return undefined; }
}

export function PresaleManager() {
  const { isAdmin, loading: checkingAdmin } = useAdminCheck();
  const [targets, setTargets] = useState<PresaleTarget[]>([]);
  const [restaurants, setRestaurants] = useState<PresaleRestaurant[]>([]);
  const [contacts, setContacts] = useState<PresaleContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [city, setCity] = useState('all');
  const [status, setStatus] = useState('all');
  const [threePlus, setThreePlus] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true); setError(false);
    try {
      const all: PresaleTarget[] = [];
      for (let from = 0; ; from += 1000) {
        const result = await supabase.from('presale_targets').select('id,pagina_slug,stad,gerecht,positie,totaal,restaurant_id,status,notitie,updated_at').order('id').range(from, from + 999);
        if (result.error) throw result.error;
        all.push(...(result.data ?? []));
        if ((result.data?.length ?? 0) < 1000) break;
      }
      const ids = [...new Set(all.map(r => r.restaurant_id))];
      const chunks = Array.from({ length: Math.ceil(ids.length / 150) }, (_, i) => ids.slice(i * 150, (i + 1) * 150));
      const batches = await Promise.all(chunks.map(async chunk => {
        const [r, c] = await Promise.all([
          supabase.from('restaurants').select('id,name,slug,phone').in('id', chunk),
          supabase.from('restaurant_contacts').select('restaurant_id,email,email_kwaliteit,instagram').in('restaurant_id', chunk),
        ]);
        if (r.error) throw r.error;
        if (c.error) throw c.error;
        return { restaurants: r.data ?? [], contacts: c.data ?? [] };
      }));
      setTargets(all); setRestaurants(batches.flatMap(b => b.restaurants)); setContacts(batches.flatMap(b => b.contacts));
    } catch { setError(true); toast.error('Presale laden mislukt. Probeer opnieuw.'); }
    finally { setLoading(false); }
  }, [isAdmin]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [city, status, threePlus, hasEmail]);

  const groups = useMemo(() => groupPresale(targets, restaurants, contacts), [targets, restaurants, contacts]);
  const counts = useMemo(() => presaleCounts(groups), [groups]);
  const cities = useMemo(() => [...new Set(groups.flatMap(g => g.cities))].sort((a, b) => a.localeCompare(b, 'nl')), [groups]);
  const filtered = useMemo(() => filterPresale(groups, { city, status, threePlus, hasEmail }), [groups, city, status, threePlus, hasEmail]);
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pages);

  const update = async (id: string, patch: { status?: PresaleStatus; notitie?: string }) => {
    if (!isAdmin || busy[id]) return;
    setBusy(prev => ({ ...prev, [id]: true }));
    try {
      const values = presaleUpdate(patch);
      const result = await supabase.from('presale_targets').update(values).eq('restaurant_id', id).select('id');
      if (result.error || !result.data?.length) throw result.error ?? new Error('No rows updated');
      setTargets(prev => prev.map(row => row.restaurant_id === id ? { ...row, ...values } : row));
      if (patch.notitie !== undefined) setNotes(prev => { const next = { ...prev }; delete next[id]; return next; });
      toast.success('Restaurant bijgewerkt');
    } catch { toast.error('Opslaan mislukt. Je wijzigingen zijn niet opgeslagen.'); }
    finally { setBusy(prev => ({ ...prev, [id]: false })); }
  };
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([presaleCsv(filtered)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `dishloopr-presale-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };

  if (checkingAdmin) return <p className="text-muted-foreground">Laden…</p>;
  if (!isAdmin) return null;
  return <section className="space-y-5" aria-label="Presale">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">Presale</h2>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || Object.values(busy).some(Boolean)} aria-label="Presale vernieuwen" title="Vernieuwen"><RefreshCw className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading || error || !filtered.length}><Download className="mr-2 h-4 w-4" />CSV-export</Button>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7 border-y border-border py-4">
      {PRESALE_STATUSES.map(s => <div key={s}><p className="text-xs text-muted-foreground capitalize">{s}</p><p className="text-2xl font-semibold tabular-nums">{loading ? '—' : counts[s]}</p></div>)}
    </div>
    <div className="flex flex-wrap items-center gap-4">
      <Select value={city} onValueChange={setCity}><SelectTrigger className="w-44" aria-label="Filter stad"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle steden</SelectItem>{cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
      <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-44" aria-label="Filter status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle statussen</SelectItem>{PRESALE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      <div className="flex items-center gap-2"><Checkbox id="presale-three" checked={threePlus} onCheckedChange={v => setThreePlus(v === true)} /><Label htmlFor="presale-three">Op 3+ pagina’s</Label></div>
      <div className="flex items-center gap-2"><Checkbox id="presale-email" checked={hasEmail} onCheckedChange={v => setHasEmail(v === true)} /><Label htmlFor="presale-email">Heeft e-mail</Label></div>
    </div>
    {loading ? <div className="space-y-3" aria-label="Presale laden">{[1, 2, 3].map(i => <div key={i} className="h-28 animate-pulse rounded bg-muted" />)}</div> : error ? <div role="alert" className="py-8"><p className="mb-3 text-destructive">Presale kon niet worden geladen.</p><Button onClick={() => void load()}>Opnieuw proberen</Button></div> : <>
      <p className="text-sm text-muted-foreground">{filtered.length} restaurants · {filtered.reduce((n, g) => n + g.pageCount, 0)} gerechtpagina-plaatsingen</p>
      <div className="overflow-x-auto">
        <Table className="min-w-[980px]">
          <TableHeader><TableRow><TableHead>Restaurant / stad</TableHead><TableHead>Pagina’s / beste positie</TableHead><TableHead>Contact</TableHead><TableHead>Status / notitie</TableHead></TableRow></TableHeader>
          <TableBody>{filtered.slice((currentPage - 1) * 25, currentPage * 25).map(g => {
            const name = g.restaurant?.name ?? g.id;
            const ig = g.contact?.instagram ? instagramUrl(g.contact.instagram) : undefined;
            const note = notes[g.id] ?? g.note;
            return <TableRow key={g.id} data-presale-restaurant={g.id}>
              <TableCell className="align-top w-52"><p className="font-semibold">{g.restaurant ? <Link className="hover:underline text-primary" to={`/restaurant/${g.restaurant.slug}`}>{name}</Link> : name}</p><p className="text-sm text-muted-foreground mt-1">{g.cities.join(', ') || '—'}</p></TableCell>
              <TableCell className="align-top max-w-80"><p className="mb-2 text-sm font-medium">{g.pageCount} pagina’s · beste #{g.bestPosition ?? '—'}</p><div className="flex flex-wrap gap-x-3 gap-y-1">{g.pages.map(p => <Link key={p.pagina_slug} className="text-sm text-primary hover:underline" to={`/eten/${p.pagina_slug}`} title={`${p.stad ?? ''} · #${p.positie ?? '—'} van ${p.totaal ?? '—'}`}>{p.gerecht ?? p.pagina_slug} #{p.positie ?? '—'}</Link>)}</div></TableCell>
              <TableCell className="align-top max-w-72"><div className="space-y-2 text-sm break-words">
                {g.contact?.email ? <div><a href={`mailto:${g.contact.email}`} className="inline-flex items-center gap-2 text-primary hover:underline"><Mail className="h-3.5 w-3.5 shrink-0" />{g.contact.email}</a><div className="mt-1"><Badge variant="secondary">{g.contact.email_kwaliteit || 'Kwaliteit onbekend'}</Badge></div></div> : <p className="text-muted-foreground">Geen e-mail</p>}
                {g.contact?.instagram && (ig ? <a href={ig} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline"><Instagram className="h-3.5 w-3.5 shrink-0" />{g.contact.instagram}</a> : <p>{g.contact.instagram}</p>)}
                {g.restaurant?.phone && <a href={`tel:${g.restaurant.phone.replace(/[^+\d]/g, '')}`} className="flex items-center gap-2 text-primary hover:underline"><Phone className="h-3.5 w-3.5" />{g.restaurant.phone}</a>}
              </div></TableCell>
              <TableCell className="align-top w-64"><div className="space-y-2">
                <Select value={g.status} disabled={busy[g.id]} onValueChange={s => { if (PRESALE_STATUSES.includes(s as PresaleStatus)) void update(g.id, { status: s as PresaleStatus }); }}><SelectTrigger aria-label={`Status ${name}`}><SelectValue /></SelectTrigger><SelectContent>{PRESALE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                <Textarea rows={2} aria-label={`Notitie ${name}`} placeholder="Notitie" value={note} disabled={busy[g.id]} onChange={e => setNotes(prev => ({ ...prev, [g.id]: e.target.value }))} />
                <Button variant="outline" size="sm" disabled={busy[g.id] || note === g.note} onClick={() => void update(g.id, { notitie: note })}>{busy[g.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Opslaan</Button>
              </div></TableCell>
            </TableRow>;
          })}{!filtered.length && <TableRow><TableCell colSpan={4} className="py-12 text-center text-muted-foreground">Geen restaurants gevonden.</TableCell></TableRow>}</TableBody>
        </Table>
      </div>
      {pages > 1 && <div className="flex justify-between items-center gap-3"><p className="text-sm text-muted-foreground">Pagina {currentPage} van {pages}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Vorige</Button><Button variant="outline" size="sm" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Volgende</Button></div></div>}
    </>}
  </section>;
}