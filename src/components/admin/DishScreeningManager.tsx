import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Play, Check, X, CheckCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ReviewRow {
  id: string;
  screen_score: number | null;
  screen_canonical: string | null;
  screen_course: string | null;
  screen_reason: string | null;
  dish: { id: string; name: string; slug: string; canonical_slug: string | null; course: string | null } | null;
  restaurant: { id: string; name: string } | null;
}

export function DishScreeningManager() {
  const [batchSize, setBatchSize] = useState(200);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulking, setBulking] = useState(false);

  const loadReview = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('restaurant_dishes')
      .select('id, screen_score, screen_canonical, screen_course, screen_reason, dish:dishes(id, name, slug, canonical_slug, course), restaurant:restaurants(id, name)')
      .eq('status', 'needs_review')
      .order('screen_score', { ascending: false })
      .limit(300);
    if (error) toast.error('Kon review-queue niet laden');
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { loadReview(); }, []);

  const runScreening = async () => {
    setRunning(true);
    setLastResult(null);
    const { data, error } = await supabase.functions.invoke('dish-screening', { body: { batchSize } });
    setRunning(false);
    if (error) {
      toast.error('Screening mislukt: ' + error.message);
      return;
    }
    setLastResult(data);
    toast.success(`Verwerkt: ${data?.processed ?? 0} (✓ ${data?.approved ?? 0} / ✗ ${data?.rejected ?? 0} / ? ${data?.review ?? 0})`);
    await loadReview();
  };

  const approveRow = async (row: ReviewRow) => {
    if (!row.dish) return;
    const patch: Record<string, unknown> = {};
    if (!row.dish.canonical_slug && row.screen_canonical) patch.canonical_slug = row.screen_canonical;
    if (!row.dish.course && row.screen_course) patch.course = row.screen_course;
    if (Object.keys(patch).length > 0) {
      await supabase.from('dishes').update(patch as never).eq('id', row.dish.id);
    }
    const { error } = await supabase.from('restaurant_dishes').update({
      status: 'approved_by_admin',
      approved_at: new Date().toISOString(),
    }).eq('id', row.id);
    if (error) { toast.error('Kon niet goedkeuren'); return; }
    toast.success('Goedgekeurd');
    setRows((rs) => rs.filter((r) => r.id !== row.id));
  };

  const rejectRow = async (row: ReviewRow) => {
    const { error } = await supabase.from('restaurant_dishes').update({
      status: 'rejected',
    }).eq('id', row.id);
    if (error) { toast.error('Kon niet afwijzen'); return; }
    toast.success('Afgewezen');
    setRows((rs) => rs.filter((r) => r.id !== row.id));
  };

  const bulkApprove = async () => {
    const targets = rows.filter((r) => (r.screen_score ?? 0) >= 0.6);
    if (targets.length === 0) { toast.info('Geen rijen met score ≥ 0.6'); return; }
    setBulking(true);
    let ok = 0;
    for (const row of targets) {
      try {
        if (row.dish) {
          const patch: Record<string, unknown> = {};
          if (!row.dish.canonical_slug && row.screen_canonical) patch.canonical_slug = row.screen_canonical;
          if (!row.dish.course && row.screen_course) patch.course = row.screen_course;
          if (Object.keys(patch).length > 0) {
            await supabase.from('dishes').update(patch as never).eq('id', row.dish.id);
          }
        }
        const { error } = await supabase.from('restaurant_dishes').update({
          status: 'approved_by_admin',
          approved_at: new Date().toISOString(),
        }).eq('id', row.id);
        if (!error) ok++;
      } catch {}
    }
    setBulking(false);
    toast.success(`${ok} koppelingen goedgekeurd`);
    await loadReview();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Run screening</CardTitle>
          <CardDescription>Screent gerechten met status 'suggested' of 'needs_review' tegen het canonical-vocabulaire.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Batch size</label>
            <Input
              type="number"
              min={1}
              max={1000}
              value={batchSize}
              onChange={(e) => setBatchSize(Math.max(1, Math.min(1000, Number(e.target.value) || 200)))}
              className="w-28"
            />
          </div>
          <Button onClick={runScreening} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Run screening
          </Button>
          {lastResult && (
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">Verwerkt: {lastResult.processed}</Badge>
              <Badge className="bg-green-600">✓ {lastResult.approved}</Badge>
              <Badge variant="destructive">✗ {lastResult.rejected}</Badge>
              <Badge variant="outline">? {lastResult.review}</Badge>
              <Badge variant="outline">vocab: {lastResult.vocab_size}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Review-queue</CardTitle>
            <CardDescription>{rows.length} koppelingen wachten op handmatige beoordeling.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadReview} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verversen'}
            </Button>
            <Button onClick={bulkApprove} disabled={bulking || rows.length === 0}>
              {bulking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCheck className="h-4 w-4 mr-2" />}
              Keur alle review ≥ 0.6 goed
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Geen rijen om te beoordelen.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Gerecht</TableHead>
                    <TableHead>Canonical</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Reden</TableHead>
                    <TableHead className="text-right">Actie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs">{row.restaurant?.name ?? '—'}</TableCell>
                      <TableCell className="text-xs font-medium">{row.dish?.name ?? '—'}<div className="text-muted-foreground">{row.dish?.slug}</div></TableCell>
                      <TableCell className="text-xs">{row.screen_canonical ?? '—'}</TableCell>
                      <TableCell className="text-xs">{row.screen_course ?? '—'}</TableCell>
                      <TableCell className="text-xs">{row.screen_score?.toFixed(2) ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.screen_reason ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => approveRow(row)}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => rejectRow(row)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}