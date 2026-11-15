import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AlertTriangle, Download, FileUp, Loader2, Mail, Paperclip, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CATEGORY_LABEL, MAIL_STATUS_LABEL, pendingForWave, segmentMatrix, targetsCsv,
  type OutreachReply, type OutreachSettings, type OutreachTarget,
} from '@/lib/outreach';

// Outreach tables are newer than the generated types.
const db = supabase as unknown as SupabaseClient;
const SEGMENTS = [
  { id: 'zichtbaar', label: 'Online en zichtbaar' },
  { id: 'onzichtbaar_menu', label: 'Online, niet zichtbaar (menu)' },
  { id: 'uitgesloten', label: 'Uitgesloten' },
] as const;

async function loadAllTargets(): Promise<OutreachTarget[]> {
  const out: OutreachTarget[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('outreach_targets').select('*').order('restaurant_id').range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as OutreachTarget[]));
    if (!data || data.length < 1000) return out;
  }
}

export function OutreachManager() {
  const [targets, setTargets] = useState<OutreachTarget[]>([]);
  const [settings, setSettings] = useState<OutreachSettings | null>(null);
  const [replies, setReplies] = useState<OutreachReply[]>([]);
  const [sentToday, setSentToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const day = new Date(); day.setUTCHours(0, 0, 0, 0);
      const [t, s, r, c] = await Promise.all([
        loadAllTargets(),
        db.from('outreach_settings').select('*').eq('id', true).single(),
        db.from('outreach_replies').select('*').order('received_at', { ascending: false }).limit(200),
        db.from('outreach_messages').select('id', { count: 'exact', head: true }).gte('created_at', day.toISOString()).neq('status', 'failed'),
      ]);
      setTargets(t);
      setSettings(s.data as OutreachSettings);
      setReplies((r.data ?? []) as OutreachReply[]);
      setSentToday(c.count ?? 0);
    } catch (e) {
      toast.error(`Laden mislukt: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const matrix = useMemo(() => segmentMatrix(targets), [targets]);
  const pending = settings ? pendingForWave(targets, settings.wave) : 0;
  const reasons = useMemo(() => {
    const m = new Map<string, number>();
    targets.filter(t => !t.is_active).forEach(t => m.set(t.verborgen_reden ?? '(geen reden)', (m.get(t.verborgen_reden ?? '(geen reden)') ?? 0) + 1));
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [targets]);

  const exportCsv = () => {
    const blob = new Blob(['﻿' + targetsCsv(targets)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dishloopr-restaurants-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const saveSettings = async () => {
    if (!settings) return;
    setBusy('settings');
    const { error } = await db.from('outreach_settings').update({ ...settings, updated_at: new Date().toISOString() }).eq('id', true);
    setBusy(null);
    if (error) toast.error(error.message); else { toast.success('Instellingen opgeslagen'); void refresh(); }
  };

  const runBatch = async () => {
    if (!settings || !window.confirm(`Nu maximaal ${settings.batch_size} mails versturen (golf ${settings.wave})?`)) return;
    setBusy('run');
    const { data, error } = await supabase.functions.invoke('outreach-send-wave', { body: { mode: 'run' } });
    setBusy(null);
    if (error || data?.error) toast.error(data?.error ?? error?.message);
    else toast.success(data.skipped ? `Niets verstuurd: ${data.skipped}` : `${data.sent} verstuurd, ${data.failed} mislukt`);
    if (data?.flyer_warning) toast.warning(data.flyer_warning);
    void refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Vernieuwen
        </Button>
        <Button variant="outline" onClick={exportCsv} disabled={!targets.length}><Download className="mr-2 h-4 w-4" />Database downloaden (CSV, {targets.length})</Button>
        <Button onClick={runBatch} disabled={!settings || busy === 'run' || pending === 0}>
          {busy === 'run' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Volgende batch nu versturen
        </Button>
        <span className="text-sm text-muted-foreground">Nog {pending} te mailen in golf {settings?.wave ?? '…'} · vandaag {sentToday}/{settings?.daily_cap ?? '…'}</span>
      </div>

      {settings?.flyer_warning && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{settings.flyer_warning}</span>
        </div>
      )}

      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox">Inbox ({replies.filter(r => r.status === 'te_beoordelen').length})</TabsTrigger>
          <TabsTrigger value="segments">Segmenten</TabsTrigger>
          <TabsTrigger value="mail">Mail en instellingen</TabsTrigger>
        </TabsList>

        <TabsContent value="segments" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {SEGMENTS.map(s => (
              <Card key={s.id}>
                <CardHeader className="pb-2"><CardTitle className="text-base">{s.label}</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {Object.entries(matrix[s.id] ?? {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                    <div key={k} className="flex justify-between"><span>{MAIL_STATUS_LABEL[k] ?? k}</span><span className="font-semibold">{n}</span></div>
                  ))}
                  {!matrix[s.id] && <p className="text-muted-foreground">Geen restaurants</p>}
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Redenen verborgen restaurants</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <p className="mb-2 text-muted-foreground">Alleen redenen met menu, gerecht of kaart (of zonder reden) en minder gerechten dan het minimum krijgen de mail over een onvolledig menu. De rest wordt niet gemaild.</p>
              {reasons.map(([r, n]) => <div key={r} className="flex justify-between"><span>{r}</span><span className="font-semibold">{n}</span></div>)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mail">{settings && <MailSettings settings={settings} onChange={setSettings} onSave={saveSettings} saving={busy === 'settings'} targets={targets} />}</TabsContent>

        <TabsContent value="inbox"><Inbox replies={replies} targets={targets} onChanged={refresh} /></TabsContent>
      </Tabs>
    </div>
  );
}

function MailSettings({ settings, onChange, onSave, saving, targets }: {
  settings: OutreachSettings; onChange: (s: OutreachSettings) => void; onSave: () => void; saving: boolean; targets: OutreachTarget[];
}) {
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<{ subject: string; html: string; to: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q.length < 2 ? [] : targets.filter(t => t.segment !== 'uitgesloten' && t.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, targets]);

  const show = async (id: string) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('outreach-send-wave', { body: { mode: 'preview', restaurant_id: id } });
    setBusy(false);
    if (error || data?.error) { toast.error(data?.error ?? error?.message); return; }
    setPreview({ ...data, id });
  };
  const test = async () => {
    if (!preview) return;
    const { data: u } = await supabase.auth.getUser();
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('outreach-send-wave', { body: { mode: 'test', restaurant_id: preview.id, test_email: u.user?.email } });
    setBusy(false);
    if (error || data?.error) toast.error(data?.error ?? error?.message); else toast.success(`Testmail verstuurd naar ${u.user?.email}`);
    if (data?.flyer_warning) toast.warning(data.flyer_warning);
  };
  const num = (k: 'wave' | 'batch_size' | 'daily_cap') => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...settings, [k]: Number(e.target.value) || 1 });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Agent instellingen</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div><Label htmlFor="o-enabled">Automatisch versturen</Label><p className="text-xs text-muted-foreground">Werkdagen elk uur tussen 9 en 17 uur een batch, tot de daglimiet.</p></div>
            <Switch id="o-enabled" checked={settings.enabled} onCheckedChange={v => onChange({ ...settings, enabled: v })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label htmlFor="o-wave">Golf</Label><Input id="o-wave" type="number" min={1} value={settings.wave} onChange={num('wave')} /></div>
            <div><Label htmlFor="o-batch">Per batch</Label><Input id="o-batch" type="number" min={1} max={200} value={settings.batch_size} onChange={num('batch_size')} /></div>
            <div><Label htmlFor="o-cap">Per dag</Label><Input id="o-cap" type="number" min={1} max={2000} value={settings.daily_cap} onChange={num('daily_cap')} /></div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div><Label htmlFor="o-np">Eenmanszaken en vof overslaan</Label><p className="text-xs text-muted-foreground">De wet vraagt bij natuurlijke personen vooraf toestemming voor ongevraagde mail.</p></div>
            <Switch id="o-np" checked={settings.skip_natural_persons} onCheckedChange={v => onChange({ ...settings, skip_natural_persons: v })} />
          </div>
          <div>
            <Label htmlFor="o-min">Minimaal aantal gerechten om zichtbaar te worden</Label>
            <Input id="o-min" type="number" min={1} max={50} className="w-28" value={settings.menu_minimum} onChange={e => onChange({ ...settings, menu_minimum: Math.max(1, Number(e.target.value) || 1) })} />
            <p className="mt-1 text-xs text-muted-foreground">Drankjes tellen niet mee. Een verborgen restaurant komt automatisch online zodra het dit aantal haalt, en mail B noemt dit getal.</p>
          </div>
          <FlyerSettings mode={settings.flyer_mode} onMode={m => onChange({ ...settings, flyer_mode: m })} />
          <Button onClick={onSave} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Opslaan</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Mail bekijken en testen</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Zoek een restaurant" value={query} onChange={e => setQuery(e.target.value)} aria-label="Zoek een restaurant" />
          {matches.map(m => (
            <button key={m.restaurant_id} onClick={() => show(m.restaurant_id)} className="flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm hover:bg-muted">
              <span>{m.name} <span className="text-muted-foreground">{m.stad}</span></span>
              <Badge variant="secondary">{m.segment === 'zichtbaar' ? 'zichtbaar' : 'menu'}</Badge>
            </button>
          ))}
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {preview && (
            <>
              <p className="text-sm"><b>Aan:</b> {preview.to ?? 'geen adres'}<br /><b>Onderwerp:</b> {preview.subject}</p>
              <iframe title="Voorbeeld mail" srcDoc={preview.html} sandbox="" className="h-[520px] w-full rounded border bg-white" />
              <Button variant="outline" onClick={test} disabled={busy}><Mail className="mr-2 h-4 w-4" />Stuur testmail naar mij</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const FLYER_PATH = 'outreach/dishloopr-flyer.pdf';
const FLYER_MODES = [
  { id: 'bijlage', label: 'Als bijlage' },
  { id: 'link', label: 'Als downloadlink' },
  { id: 'uit', label: 'Niet meesturen' },
] as const;

function FlyerSettings({ mode, onMode }: { mode: OutreachSettings['flyer_mode']; onMode: (m: OutreachSettings['flyer_mode']) => void }) {
  const [busy, setBusy] = useState(false);
  // The bucket is private: open the current flyer through a short-lived signed link.
  const view = async () => {
    const { data, error } = await supabase.storage.from('marketing').createSignedUrl(FLYER_PATH, 300);
    if (error || !data?.signedUrl) { toast.error('Nog geen flyer geüpload'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') { toast.error('Alleen pdf'); return; }
    setBusy(true);
    const { error } = await supabase.storage.from('marketing').upload(FLYER_PATH, file, { upsert: true, contentType: 'application/pdf', cacheControl: '300' });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success('Flyer geüpload');
  };
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label>Flyer voor eigenaren</Label>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Flyer meesturen">
        {FLYER_MODES.map(m => (
          <Button key={m.id} type="button" size="sm" role="radio" aria-checked={mode === m.id} variant={mode === m.id ? 'default' : 'outline'} onClick={() => onMode(m.id)}>{m.label}</Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Een bijlage valt meer op, een link maakt de mail lichter en landt minder snel in spam. Is de flyer onbereikbaar, dan gaan de mails zonder flyer en zie je hier bovenaan een waarschuwing.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" variant="outline" disabled={busy} asChild>
          <label className="cursor-pointer">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}Flyer uploaden (pdf)
            <input type="file" accept="application/pdf" className="sr-only" onChange={upload} />
          </label>
        </Button>
        <Button type="button" size="sm" variant="link" className="min-h-11 px-0" onClick={view}>Huidige flyer bekijken</Button>
      </div>
    </div>
  );
}

function Inbox({ replies, targets, onChanged }: { replies: OutreachReply[]; targets: OutreachTarget[]; onChanged: () => void }) {
  const [filter, setFilter] = useState('te_beoordelen');
  const names = useMemo(() => new Map(targets.map(t => [t.restaurant_id, `${t.name}${t.stad ? `, ${t.stad}` : ''}`])), [targets]);
  const list = replies
    .filter(r => filter === 'alle' || r.status === filter)
    .sort((a, b) => (filter === 'te_beoordelen' ? (b.deal_kans ?? 0) - (a.deal_kans ?? 0) : 0) || b.received_at.localeCompare(a.received_at));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {['te_beoordelen', 'beantwoord', 'afgehandeld', 'automatisch', 'alle'].map(s => (
          <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)}>
            {s.replace('_', ' ')} ({s === 'alle' ? replies.length : replies.filter(r => r.status === s).length})
          </Button>
        ))}
      </div>
      {list.length === 0 && <p className="text-sm text-muted-foreground">Geen antwoorden in deze lijst.</p>}
      {list.map(r => <ReplyCard key={r.id} reply={r} restaurant={r.restaurant_id ? names.get(r.restaurant_id) : undefined} onChanged={onChanged} />)}
    </div>
  );
}

function ReplyCard({ reply, restaurant, onChanged }: { reply: OutreachReply; restaurant?: string; onChanged: () => void }) {
  const [text, setText] = useState(reply.concept_antwoord ?? '');
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<{ filename: string; url: string }[] | null>(null);
  const prio = reply.prioriteit === 'hoog' ? 'destructive' : reply.prioriteit === 'laag' ? 'outline' : 'secondary';

  const send = async () => {
    if (!window.confirm(`Antwoord versturen naar ${reply.from_email}?`)) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('outreach-reply', { body: { mode: 'send', reply_id: reply.id, text } });
    setBusy(false);
    if (error || data?.error) toast.error(data?.error ?? error?.message); else { toast.success('Verstuurd'); onChanged(); }
  };
  const close = async () => {
    const { error } = await db.from('outreach_replies').update({ status: 'afgehandeld' }).eq('id', reply.id);
    if (error) toast.error(error.message); else onChanged();
  };
  const attachments = async () => {
    const { data, error } = await supabase.functions.invoke('outreach-reply', { body: { mode: 'attachments', reply_id: reply.id } });
    if (error || data?.error) toast.error(data?.error ?? error?.message); else setFiles(data.attachments);
  };

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{restaurant ?? reply.from_name ?? reply.from_email}</span>
          <span className="text-sm text-muted-foreground">{reply.from_email} · {new Date(reply.received_at).toLocaleString('nl-NL')}</span>
          {reply.categorie && <Badge>{CATEGORY_LABEL[reply.categorie] ?? reply.categorie}</Badge>}
          {reply.prioriteit && <Badge variant={prio}>{reply.prioriteit}</Badge>}
          {reply.deal_kans !== null && <Badge variant="outline">deal {reply.deal_kans}%</Badge>}
        </div>
        {reply.classify_error && <p className="text-sm text-destructive">Kwalificatie mislukt: {reply.classify_error}</p>}
        {reply.samenvatting && <p className="text-sm">{reply.samenvatting}</p>}
        {reply.aanbevolen_actie && <p className="text-sm"><b>Actie:</b> {reply.aanbevolen_actie}</p>}
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Originele mail: {reply.subject}</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded bg-muted p-3 font-sans">{reply.body_text}</pre>
        </details>
        {reply.attachments?.length > 0 && (
          <div className="text-sm">
            <Button size="sm" variant="outline" onClick={attachments}><Paperclip className="mr-2 h-4 w-4" />{reply.attachments.length} bijlage(n) openen</Button>
            {files?.map(f => <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="ml-3 text-primary underline">{f.filename}</a>)}
          </div>
        )}
        {reply.status === 'beantwoord' ? (
          <pre className="whitespace-pre-wrap rounded border p-3 font-sans text-sm"><b>Jouw antwoord:</b>{'\n'}{reply.answer_text}</pre>
        ) : (
          <>
            <Textarea value={text} onChange={e => setText(e.target.value)} rows={7} aria-label="Antwoord" />
            <div className="flex gap-2">
              <Button onClick={send} disabled={busy || text.trim().length < 5}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Verstuur antwoord</Button>
              {reply.status !== 'afgehandeld' && <Button variant="outline" onClick={close}>Afgehandeld zonder antwoord</Button>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
