import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Upload } from 'lucide-react';
import { citySlug, missingColumns, parseCsvTable, toDiscoveryRows, type OvertureImportSummary } from '@/lib/overtureImport';

interface CityOption { id: string; name: string; is_active: boolean }

const NEW_CITY = '__new__';
const CHUNK = 200;

// Uploads a CSV from scripts/overture-discovery into the Review Queue (source = 'overture').
// Only strong candidates and doubtful rows are imported; nothing goes live until an admin
// approves a row, which runs the normal pipeline (PDOK geocode, classify, menu, activate).
export function OvertureImportCard({ cities, onImported }: { cities: CityOption[]; onImported: () => Promise<void> | void }) {
  const [cityId, setCityId] = useState<string>('');
  const [newCityName, setNewCityName] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, string>[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const preview: OvertureImportSummary | null = useMemo(
    () => (rawRows ? toDiscoveryRows(rawRows, cityId || 'preview') : null),
    [rawRows, cityId],
  );
  const counts = useMemo(() => {
    const rows = preview?.rows ?? [];
    return { approve: rows.filter((r) => r.triage === 'approve').length, review: rows.filter((r) => r.triage === 'review').length };
  }, [preview]);

  const onFile = async (file: File | undefined) => {
    setFileError(null);
    setRawRows(null);
    setFileName(file?.name ?? null);
    if (!file) return;
    const { header, rows } = parseCsvTable(await file.text());
    const missing = missingColumns(header);
    if (missing.length) {
      setFileError(`Dit is geen Overture-bestand: kolommen ontbreken (${missing.join(', ')}).`);
      return;
    }
    setRawRows(rows);
  };

  const resolveCity = async (): Promise<string> => {
    if (cityId !== NEW_CITY) return cityId;
    const name = newCityName.trim();
    if (!name) throw new Error('Vul de naam van de nieuwe stad in');
    const slug = citySlug(name);
    const { data: existing } = await supabase.from('cities').select('id').eq('slug', slug).maybeSingle();
    if (existing) return existing.id;
    // New cities start inactive; the first restaurant that goes live with dishes switches it on.
    const { data, error } = await supabase
      .from('cities')
      .insert({ name, slug, country_code: 'NL', is_active: false })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  };

  const runImport = async () => {
    if (!rawRows || !cityId) return;
    setImporting(true);
    try {
      const targetCity = await resolveCity();
      const { rows } = toDiscoveryRows(rawRows, targetCity);
      let sent = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await supabase
          .from('discovery_results')
          .upsert(rows.slice(i, i + CHUNK), { onConflict: 'source,external_id', ignoreDuplicates: true });
        if (error) throw error;
        sent += Math.min(CHUNK, rows.length - i);
      }
      // Mark candidates that match a restaurant already on Dishloopr (same rules as the Google queue).
      const { data: rescan, error: rescanError } = await supabase.rpc('rescan_discovery_duplicates', { p_rules: null });
      const marked = (rescan as { marked?: number } | null)?.marked ?? 0;
      toast.success(
        `${sent} kandidaten naar de Review Queue gestuurd` +
          (rescanError ? ' (duplicaatcheck mislukt, draai die handmatig)' : `, ${marked} gemarkeerd als bestaand restaurant`),
      );
      setRawRows(null);
      setFileName(null);
      setNewCityName('');
      await onImported();
    } catch (e) {
      toast.error((e as { message?: string })?.message || 'Importeren mislukt');
    } finally {
      setImporting(false);
    }
  };

  const ready = !!rawRows && !!cityId && (cityId !== NEW_CITY || newCityName.trim()) && (preview?.rows.length ?? 0) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stad importeren uit Overture Maps</CardTitle>
        <CardDescription>
          Upload het CSV-bestand van <code>scripts/overture-discovery</code>. Sterke kandidaten en twijfelgevallen komen in de
          Review Queue; afgewezen zaken (snackbars, döner, cafetaria's, ketens, gesloten zaken) blijven eruit. Niets gaat live
          zonder goedkeuring. Bron: Overture Maps Foundation (CDLA Permissive 2.0), naamsvermelding verplicht.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="overture-file">CSV-bestand</Label>
            <Input id="overture-file" type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
          <div className="space-y-1">
            <Label>Stad</Label>
            <Select value={cityId} onValueChange={setCityId}>
              <SelectTrigger><SelectValue placeholder="Kies een stad" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_CITY}>+ Nieuwe stad</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}{c.is_active ? '' : ' (inactief)'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {cityId === NEW_CITY && (
            <div className="space-y-1">
              <Label htmlFor="overture-city">Naam nieuwe stad</Label>
              <Input id="overture-city" placeholder="Bijv. Zwolle" value={newCityName} onChange={(e) => setNewCityName(e.target.value)} />
            </div>
          )}
        </div>

        {fileError && <p className="text-sm text-destructive">{fileError}</p>}

        {preview && (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge>{counts.approve} sterke kandidaten</Badge>
              <Badge variant="secondary">{counts.review} twijfelgevallen</Badge>
              <Badge variant="outline">{preview.skipped.reject} afgewezen (niet geïmporteerd)</Badge>
              {preview.skipped.duplicate > 0 && <Badge variant="outline">{preview.skipped.duplicate} al op Dishloopr</Badge>}
              {preview.skipped.invalid > 0 && <Badge variant="destructive">{preview.skipped.invalid} ongeldig</Badge>}
            </div>
            {preview.invalid.length > 0 && (
              <ul className="list-disc pl-5 text-xs text-muted-foreground">
                {preview.invalid.slice(0, 5).map((m) => <li key={m}>{m}</li>)}
                {preview.invalid.length > 5 && <li>… en {preview.invalid.length - 5} meer</li>}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              {fileName}: een eerdere import van hetzelfde bestand wordt niet dubbel toegevoegd.
            </p>
          </div>
        )}

        <Button onClick={runImport} disabled={!ready || importing}>
          {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
          Importeren naar Review Queue
        </Button>
      </CardContent>
    </Card>
  );
}
