import { useRef, useState } from 'react';
import { Upload, FileText, Loader2, Check, AlertCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { slugify } from '@/lib/utils';

interface Props {
  restaurantId: string;
  restaurantName: string;
}

type Status = 'idle' | 'busy' | 'success' | 'error';

const CSV_TEMPLATE = `name,description,price,category,is_signature
Pizza Margherita,Klassiek met buffalo mozzarella,14.50,hoofdgerecht,true
Tiramisu,Huisgemaakt dessert,7.50,dessert,false
Caprese salade,Tomaat mozzarella basilicum,9.00,voorgerecht,false
`;

export function OwnerMenuUpload({ restaurantId, restaurantName }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStatus('idle');
    setProgress(0);
    setError(null);
    setSummary(null);
  };

  const downloadTemplate = () => {
    const blob = new Blob(['\uFEFF' + CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'menu-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handlePdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Alleen PDF bestanden zijn toegestaan');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('PDF is te groot (max 20MB)');
      return;
    }
    setStatus('busy');
    setProgress(20);
    setError(null);
    setSummary(null);
    try {
      const base64 = await fileToBase64(file);
      setProgress(50);
      const { data, error } = await supabase.functions.invoke('parse-menu-pdf', {
        body: { restaurantId, pdfBase64: base64 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setProgress(100);
      setStatus('success');
      setSummary(
        `${data.added?.length || 0} nieuwe gerechten toegevoegd, ${data.existing?.length || 0} gekoppeld.`
      );
      toast.success('Menu verwerkt');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Onbekende fout');
      toast.error('PDF verwerken mislukt');
    } finally {
      if (pdfRef.current) pdfRef.current.value = '';
    }
  };

  const parseCsv = (text: string): Record<string, string>[] => {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const splitLine = (line: string) => {
      const out: string[] = [];
      let cur = '';
      let q = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (q && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else q = !q;
        } else if (c === ',' && !q) {
          out.push(cur);
          cur = '';
        } else cur += c;
      }
      out.push(cur);
      return out;
    };
    const headers = splitLine(lines[0]).map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const cols = splitLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => (row[h] = (cols[i] || '').trim()));
      return row;
    });
  };

  const handleCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('CSV is te groot (max 5MB)');
      return;
    }
    setStatus('busy');
    setProgress(10);
    setError(null);
    setSummary(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) throw new Error('Geen rijen gevonden in CSV');
      if (!('name' in rows[0])) throw new Error('CSV mist verplichte kolom "name"');

      let added = 0;
      let linked = 0;
      let errors = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = (row.name || '').trim();
        if (!name) continue;
        setProgress(10 + Math.round(((i + 1) / rows.length) * 85));
        const slug = slugify(name);
        try {
          // Find or create dish
          const { data: existing } = await supabase
            .from('dishes')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();
          let dishId = existing?.id;
          if (!dishId) {
            const { data: created, error: insErr } = await supabase
              .from('dishes')
              .insert({ name, slug, is_active: true })
              .select('id')
              .single();
            if (insErr) throw insErr;
            dishId = created.id;
            added++;
          }
          // Upsert restaurant_dishes
          const isSig = ['true', '1', 'ja', 'yes'].includes((row.is_signature || '').toLowerCase());
          const courseRaw = (row.category || '').toLowerCase().trim();
          const allowedCourses = ['voorgerecht','hoofdgerecht','dessert','bijgerecht','drank','menu'];
          const course_type = allowedCourses.includes(courseRaw) ? courseRaw : null;
          const { error: linkErr } = await supabase
            .from('restaurant_dishes')
            .upsert(
              {
                restaurant_id: restaurantId,
                dish_id: dishId,
                status: 'approved_by_admin',
                source: 'owner_csv',
                confidence_score: 0.95,
                is_signature: isSig,
                ...(course_type ? { course_type } : {}),
              } as any,
              { onConflict: 'restaurant_id,dish_id' }
            );
          if (linkErr) throw linkErr;
          linked++;
        } catch (e) {
          console.error('CSV row error', name, e);
          errors++;
        }
      }
      setProgress(100);
      setStatus('success');
      setSummary(`${linked} gerechten verwerkt (${added} nieuw, ${errors} fouten).`);
      toast.success('CSV verwerkt');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Onbekende fout');
      toast.error('CSV verwerken mislukt');
    } finally {
      if (csvRef.current) csvRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Menu importeren — {restaurantName}
        </CardTitle>
        <CardDescription>
          Upload je menukaart als PDF (AI herkent gerechten) of als CSV-bestand (exact ingevoerd).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === 'busy' && (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Verwerken...
            </div>
            <Progress value={progress} />
          </div>
        )}
        {status === 'success' && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <Check className="h-4 w-4" /> {summary}
            </div>
            <Button variant="outline" size="sm" onClick={reset}>Nog een bestand uploaden</Button>
          </div>
        )}
        {status === 'error' && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
            <Button variant="outline" size="sm" onClick={reset}>Opnieuw proberen</Button>
          </div>
        )}
        {status === 'idle' && (
          <Tabs defaultValue="pdf">
            <TabsList>
              <TabsTrigger value="pdf">PDF</TabsTrigger>
              <TabsTrigger value="csv">CSV</TabsTrigger>
            </TabsList>
            <TabsContent value="pdf" className="pt-4">
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => pdfRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Klik om je menu-PDF te uploaden</p>
                <p className="text-xs text-muted-foreground mt-1">Max 20MB · AI herkent automatisch alle gerechten</p>
              </div>
              <input ref={pdfRef} type="file" accept="application/pdf" onChange={handlePdf} className="hidden" />
            </TabsContent>
            <TabsContent value="csv" className="pt-4 space-y-3">
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => csvRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Klik om een CSV te uploaden</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Kolommen: <code className="text-[10px]">name, description, price, category, is_signature</code>
                </p>
              </div>
              <input ref={csvRef} type="file" accept=".csv,text/csv" onChange={handleCsv} className="hidden" />
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download voorbeeld-template
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}