import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Loader2, Mail, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CATEGORY_LABEL, FOLLOWUP_STATUS_LABEL, OPEN_FOLLOWUP_STATUSES, followupSummary,
  type ClaimFollowupRow, type OutreachSettings,
} from '@/lib/outreach';

// Follow-up tables are newer than the generated types.
const db = supabase as unknown as SupabaseClient;
const PAGE = 100;

type ReminderSettings = Pick<OutreachSettings, 'reminders_enabled' | 'reminder_interval_days' | 'reminder_max'>;
type StatusFilter = 'open' | 'alle' | ClaimFollowupRow['opvolg_status'];
type SortKey = 'bezoeken_sinds' | 'bezoeken_30d' | 'laatst_gemaild' | 'naam';
type Preview = { subject: string; html: string; to: string | null; id: string; name: string };

const STATUS_OPTIONS = Object.keys(FOLLOWUP_STATUS_LABEL) as ClaimFollowupRow['opvolg_status'][];
const SORTS: { id: SortKey; label: string }[] = [
  { id: 'bezoeken_sinds', label: 'Meeste bezoeken sinds mail' },
  { id: 'bezoeken_30d', label: 'Meeste bezoeken 30 dagen' },
  { id: 'laatst_gemaild', label: 'Langst geleden gemaild' },
  { id: 'naam', label: 'Naam' },
];
const SORT_FN: Record<SortKey, (a: ClaimFollowupRow, b: ClaimFollowupRow) => number> = {
  bezoeken_sinds: (a, b) => b.views_sinds_mail - a.views_sinds_mail || a.name.localeCompare(b.name, 'nl'),
  bezoeken_30d: (a, b) => b.views_30d - a.views_30d || a.name.localeCompare(b.name, 'nl'),
  // Empty string sorts first, so restaurants that were never mailed come first.
  laatst_gemaild: (a, b) => (a.laatst_gemaild_op ?? '').localeCompare(b.laatst_gemaild_op ?? '') || a.name.localeCompare(b.name, 'nl'),
  naam: (a, b) => a.name.localeCompare(b.name, 'nl'),
};
const PREVIEWABLE: ClaimFollowupRow['opvolg_status'][] = ['wacht', 'herinnering_klaar'];

const errMsg = (e: unknown) => (e as { message?: string } | null)?.message ?? String(e);
const nlDate = (iso: string) => new Date(iso).toLocaleDateString('nl-NL');

// PostgREST caps a response at 1000 rows, so read the RPC in pages like loadAllTargets.
async function loadAllFollowup(): Promise<ClaimFollowupRow[]> {
  const out: ClaimFollowupRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.rpc('admin_claim_followup').order('restaurant_id').range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as ClaimFollowupRow[]));
    if (!data || data.length < 1000) return out;
  }
}

export function ClaimFollowupPanel() {
  const [rows, setRows] = useState<ClaimFollowupRow[]>([]);
  const [saved, setSaved] = useState<ReminderSettings | null>(null);
  const [draft, setDraft] = useState<ReminderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('open');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('bezoeken_sinds');
  const [limit, setLimit] = useState(PAGE);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [testEmail, setTestEmail] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [followup, s] = await Promise.all([
        loadAllFollowup(),
        db.from('outreach_settings').select('*').eq('id', true).single(),
      ]);
      if (s.error) throw s.error;
      const row = s.data as ReminderSettings;
      setRows(followup);
      setSaved(row);
      setDraft(row);
    } catch (e) {
      toast.error(`Laden mislukt: ${errMsg(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { setLimit(PAGE); }, [filter, query, sort]);

  const counts = useMemo(() => followupSummary(rows), [rows]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter(r => filter === 'alle'
        || (filter === 'open' ? OPEN_FOLLOWUP_STATUSES.includes(r.opvolg_status) : r.opvolg_status === filter))
      .filter(r => !q || [r.name, r.stad, r.email].some(v => (v ?? '').toLowerCase().includes(q)))
      .sort(SORT_FN[sort]);
  }, [rows, filter, query, sort]);

  const saveReminders = async () => {
    if (!draft) return;
    const days = draft.reminder_interval_days;
    const max = draft.reminder_max;
    if (!Number.isInteger(days) || days < 3 || days > 90) { toast.error('Dagen tussen mails moet tussen 3 en 90 liggen'); return; }
    if (!Number.isInteger(max) || max < 1 || max > 6) { toast.error('Maximaal aantal herinneringen moet tussen 1 en 6 liggen'); return; }
    setBusy('settings');
    const { error } = await db.from('outreach_settings').update({
      reminders_enabled: draft.reminders_enabled,
      reminder_interval_days: days,
      reminder_max: max,
      updated_at: new Date().toISOString(),
    }).eq('id', true);
    setBusy(null);
    if (error) toast.error(error.message); else { toast.success('Herinneringen opgeslagen'); void refresh(); }
  };

  const runReminders = async () => {
    if (!window.confirm(`${counts.herinneringKlaar} restaurant(s) zijn toe aan een herinnering. Nu de volgende batch versturen (binnen batchgrootte en daglimiet)?`)) return;
    setBusy('run');
    const { data, error } = await supabase.functions.invoke('outreach-send-reminders', { body: { mode: 'run' } });
    setBusy(null);
    if (error || data?.error) toast.error(data?.error ?? error?.message);
    else toast.success(data.skipped ? `Niets verstuurd: ${data.skipped}` : `${data.sent} verstuurd, ${data.failed} mislukt`);
    void refresh();
  };

  const showPreview = async (row: ClaimFollowupRow) => {
    setBusy(`preview:${row.restaurant_id}`);
    const { data, error } = await supabase.functions.invoke('outreach-send-reminders', { body: { mode: 'preview', restaurant_id: row.restaurant_id } });
    setBusy(null);
    if (error || data?.error) { toast.error(data?.error ?? error?.message); return; }
    setTestEmail('');
    setPreview({ subject: data.subject, html: data.html, to: data.to ?? null, id: row.restaurant_id, name: row.name });
  };

  const sendTest = async () => {
    if (!preview) return;
    const to = testEmail.trim();
    if (!to.includes('@')) { toast.error('Vul een geldig e-mailadres in'); return; }
    setBusy('test');
    const { data, error } = await supabase.functions.invoke('outreach-send-reminders', { body: { mode: 'test', restaurant_id: preview.id, test_email: to } });
    setBusy(null);
    if (error || !data?.ok) toast.error(data?.error ?? error?.message ?? 'Testmail mislukt');
    else toast.success(`Testmail verstuurd naar ${to}`);
  };

  const stats = [
    { label: 'Gemaild', value: counts.gemaild },
    { label: 'Nog open', value: counts.open },
    { label: 'Herinnering klaar', value: counts.herinneringKlaar },
    { label: 'Gereageerd', value: counts.gereageerd },
    { label: 'Geclaimd na mail', value: counts.geclaimdNaMail },
    { label: 'Paginabezoeken sinds mail', value: counts.viewsSindsMail, note: 'bij open restaurants' },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Restaurants die een mail kregen maar niet geclaimd of gereageerd hebben, krijgen elke {saved?.reminder_interval_days ?? '…'} dagen een herinnering, maximaal {saved?.reminder_max ?? '…'} keer. Reacties, claims en afmeldingen stoppen de herinneringen automatisch.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {stats.map(s => (
          <Card key={s.label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{s.value}</p>
              {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Herinneringen instellen</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {draft ? (
            <>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="f-enabled">Automatische herinneringen aan</Label>
                <Switch id="f-enabled" checked={draft.reminders_enabled} onCheckedChange={v => setDraft({ ...draft, reminders_enabled: v })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="f-days">Dagen tussen mails</Label>
                  <Input id="f-days" type="number" min={3} max={90} value={draft.reminder_interval_days}
                    onChange={e => setDraft({ ...draft, reminder_interval_days: Number(e.target.value) })} />
                </div>
                <div>
                  <Label htmlFor="f-max">Maximaal aantal herinneringen</Label>
                  <Input id="f-max" type="number" min={1} max={6} value={draft.reminder_max}
                    onChange={e => setDraft({ ...draft, reminder_max: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={saveReminders} disabled={busy === 'settings'}>
                  {busy === 'settings' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Opslaan
                </Button>
                <Button variant="outline" onClick={runReminders} disabled={busy === 'run' || counts.herinneringKlaar === 0}>
                  {busy === 'run' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Herinneringen nu versturen
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Instellingen laden…</p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-64">
          <Label>Status</Label>
          <Select value={filter} onValueChange={v => setFilter(v as StatusFilter)}>
            <SelectTrigger aria-label="Filter op status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Nog open</SelectItem>
              <SelectItem value="alle">Alle statussen</SelectItem>
              {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{FOLLOWUP_STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full min-w-0 sm:w-64">
          <Label htmlFor="f-zoek">Zoeken</Label>
          <Input id="f-zoek" placeholder="Naam, stad of e-mail" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className="w-full sm:w-64">
          <Label>Sorteren op</Label>
          <Select value={sort} onValueChange={v => setSort(v as SortKey)}>
            <SelectTrigger aria-label="Sorteren op"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORTS.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Vernieuwen
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">{visible.length} restaurant(s)</p>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Restaurant</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Bezoeken sinds mail</th>
              <th className="px-3 py-2 text-right font-medium">Bezoeken 30 d</th>
              <th className="px-3 py-2 text-right font-medium">Totaal</th>
              <th className="px-3 py-2 font-medium">Mails</th>
              <th className="px-3 py-2 font-medium">Laatst gemaild</th>
              <th className="px-3 py-2 font-medium">Volgende herinnering</th>
              <th className="px-3 py-2 font-medium">Actie</th>
            </tr>
          </thead>
          <tbody>
            {visible.slice(0, limit).map(r => (
              <tr key={r.restaurant_id} className="border-t align-top">
                <td className="px-3 py-2">
                  <a href={`/restaurant/${r.slug}`} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">{r.name}</a>
                  {r.stad && <div className="text-xs text-muted-foreground">{r.stad}</div>}
                </td>
                <td className="px-3 py-2">
                  <Badge variant="secondary">{FOLLOWUP_STATUS_LABEL[r.opvolg_status]}</Badge>
                  {r.reactie_categorie && <div className="mt-1 text-xs text-muted-foreground">{CATEGORY_LABEL[r.reactie_categorie] ?? r.reactie_categorie}</div>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.views_sinds_mail}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.views_30d}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.views_totaal}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.golf_mails} + {r.herinneringen} herinnering(en)</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.laatst_gemaild_op ? nlDate(r.laatst_gemaild_op) : 'nooit'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.volgende_herinnering_op ? nlDate(r.volgende_herinnering_op) : ''}</td>
                <td className="px-3 py-2">
                  {PREVIEWABLE.includes(r.opvolg_status) && (
                    <Button size="sm" variant="outline" onClick={() => showPreview(r)} disabled={busy !== null}>
                      {busy === `preview:${r.restaurant_id}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Voorbeeld
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && visible.length === 0 && <p className="text-sm text-muted-foreground">Geen restaurants in deze selectie.</p>}
      {visible.length > limit && <Button variant="outline" onClick={() => setLimit(l => l + PAGE)}>Toon 100 meer</Button>}

      <Dialog open={preview !== null} onOpenChange={open => { if (!open) setPreview(null); }}>
        <DialogContent className="max-w-3xl">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle>Voorbeeld herinnering: {preview.name}</DialogTitle>
                <DialogDescription>Aan: {preview.to ?? 'geen adres'}</DialogDescription>
              </DialogHeader>
              <p className="text-sm"><b>Onderwerp:</b> {preview.subject}</p>
              <iframe title="Voorbeeld herinnering" srcDoc={preview.html} sandbox="" className="h-[480px] w-full rounded border bg-white" />
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Label htmlFor="f-test">Testmail naar</Label>
                  <Input id="f-test" type="email" placeholder="naam@voorbeeld.nl" value={testEmail} onChange={e => setTestEmail(e.target.value)} />
                </div>
                <Button variant="outline" onClick={sendTest} disabled={busy === 'test'}>
                  {busy === 'test' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}Testmail sturen
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
