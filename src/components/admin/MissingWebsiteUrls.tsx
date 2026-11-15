import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Globe, RefreshCw, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Row {
  id: string;
  name: string;
  address: string | null;
  city: { name: string } | null;
}

export function MissingWebsiteUrls() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ count }, { data }] = await Promise.all([
      supabase
        .from('restaurants')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .is('website_url', null),
      supabase
        .from('restaurants')
        .select('id, name, address, city:cities(name)')
        .eq('is_active', true)
        .is('website_url', null)
        .order('name')
        .limit(300),
    ]);
    setTotal(count || 0);
    setRows((data as unknown as Row[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Restaurants zonder website-URL ({total})
          </CardTitle>
          <CardDescription>
            Actieve restaurants waarvan geen website is ingevuld. Aanvullen via Google Places is gestopt, omdat de Google-voorwaarden opslaan niet toestaan. Vul de website handmatig in of vraag het de eigenaar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={load} variant="ghost" className="gap-2 ml-auto">
              <RefreshCw className="h-4 w-4" /> Ververs
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eerste 300 zonder website</CardTitle>
          <CardDescription>Gesorteerd op naam.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Laden…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Geen restaurants zonder website 🎉</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Stad</TableHead>
                    <TableHead>Adres</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.city?.name ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{r.address ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <a
                          href={`/restaurant/${r.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          bekijk <ExternalLink className="h-3 w-3" />
                        </a>
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
