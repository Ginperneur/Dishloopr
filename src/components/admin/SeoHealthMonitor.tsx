import { useState, useEffect } from 'react';
import { Globe, Loader2, AlertTriangle, Check, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

interface SeoIssue {
  id: string;
  name: string;
  slug: string;
  issue: string;
  severity: 'high' | 'medium' | 'low';
}

export function SeoHealthMonitor() {
  const [issues, setIssues] = useState<SeoIssue[]>([]);
  const [seoPages, setSeoPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(0);

  const runScan = async () => {
    setLoading(true);
    setIssues([]);
    setScanned(0);

    try {
      // Fetch restaurants
      let allRestaurants: any[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase
          .from('restaurants')
          .select('id, name, slug, is_active')
          .eq('is_active', true)
          .range(from, from + 999);
        if (!data || data.length === 0) break;
        allRestaurants = allRestaurants.concat(data);
        if (data.length < 1000) break;
        from += 1000;
      }

      // Fetch SEO landing pages
      const { data: pages } = await supabase
        .from('seo_landing_pages')
        .select('*')
        .eq('is_active', true);
      setSeoPages(pages || []);

      const foundIssues: SeoIssue[] = [];

      // Check restaurants
      const slugCounts = new Map<string, string[]>();
      for (const r of allRestaurants) {
        // Missing slug
        if (!r.slug || r.slug.trim() === '') {
          foundIssues.push({
            id: r.id,
            name: r.name,
            slug: r.slug || '',
            issue: 'Ontbrekende slug',
            severity: 'high',
          });
        } else {
          const existing = slugCounts.get(r.slug) || [];
          existing.push(r.name);
          slugCounts.set(r.slug, existing);
        }
      }

      // Duplicate slugs
      for (const [slug, names] of slugCounts) {
        if (names.length > 1) {
          for (const name of names) {
            foundIssues.push({
              id: slug,
              name,
              slug,
              issue: `Dubbele slug: "${slug}" (${names.length}x)`,
              severity: 'high',
            });
          }
        }
      }

      setScanned(allRestaurants.length);

      // Check SEO pages
      if (pages) {
        const pageSlugCounts = new Map<string, number>();
        for (const page of pages) {
          if (!page.meta_title || page.meta_title.trim() === '') {
            foundIssues.push({
              id: page.id,
              name: page.h1_title || page.slug,
              slug: page.slug,
              issue: 'Ontbrekende meta title',
              severity: 'medium',
            });
          }
          if (!page.meta_description || page.meta_description.trim() === '') {
            foundIssues.push({
              id: page.id,
              name: page.h1_title || page.slug,
              slug: page.slug,
              issue: 'Ontbrekende meta description',
              severity: 'medium',
            });
          }
          if (page.meta_title && page.meta_title.length > 60) {
            foundIssues.push({
              id: page.id,
              name: page.h1_title || page.slug,
              slug: page.slug,
              issue: `Meta title te lang (${page.meta_title.length} tekens, max 60)`,
              severity: 'low',
            });
          }
          if (page.meta_description && page.meta_description.length > 160) {
            foundIssues.push({
              id: page.id,
              name: page.h1_title || page.slug,
              slug: page.slug,
              issue: `Meta description te lang (${page.meta_description.length} tekens, max 160)`,
              severity: 'low',
            });
          }
          const count = pageSlugCounts.get(page.slug) || 0;
          pageSlugCounts.set(page.slug, count + 1);
        }

        for (const [slug, count] of pageSlugCounts) {
          if (count > 1) {
            foundIssues.push({
              id: slug,
              name: slug,
              slug,
              issue: `Dubbele SEO pagina slug (${count}x)`,
              severity: 'high',
            });
          }
        }
      }

      // Sort by severity
      const order = { high: 0, medium: 1, low: 2 };
      foundIssues.sort((a, b) => order[a.severity] - order[b.severity]);
      setIssues(foundIssues);
    } catch (err) {
      console.error('SEO scan error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runScan();
  }, []);

  const highCount = issues.filter(i => i.severity === 'high').length;
  const mediumCount = issues.filter(i => i.severity === 'medium').length;
  const lowCount = issues.filter(i => i.severity === 'low').length;
  const healthScore = scanned > 0 ? Math.max(0, Math.round(100 - (highCount * 5 + mediumCount * 2 + lowCount * 0.5))) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              SEO Health Monitor
            </CardTitle>
            <CardDescription>Controleer slug-duplicaten, ontbrekende meta-data en SEO-problemen</CardDescription>
          </div>
          <Button onClick={runScan} disabled={loading} variant="outline" size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Opnieuw scannen
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">SEO scan uitvoeren...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Health score */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 col-span-2 md:col-span-1">
                <p className="text-xs text-muted-foreground">Health Score</p>
                <p className={`text-3xl font-bold ${
                  healthScore >= 80 ? 'text-green-600' :
                  healthScore >= 50 ? 'text-orange-600' : 'text-destructive'
                }`}>{healthScore}%</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Gescand</p>
                <p className="text-2xl font-bold">{scanned}</p>
              </div>
              <div className="p-3 rounded-lg bg-destructive/10">
                <p className="text-xs text-muted-foreground">Hoog</p>
                <p className="text-2xl font-bold text-destructive">{highCount}</p>
              </div>
              <div className="p-3 rounded-lg bg-orange-500/10">
                <p className="text-xs text-muted-foreground">Medium</p>
                <p className="text-2xl font-bold text-orange-600">{mediumCount}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Laag</p>
                <p className="text-2xl font-bold">{lowCount}</p>
              </div>
            </div>

            {issues.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Check className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p className="font-semibold text-green-700 dark:text-green-400">Geen SEO-problemen gevonden!</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ernst</TableHead>
                    <TableHead>Pagina</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Probleem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map((issue, i) => (
                    <TableRow key={`${issue.id}-${i}`}>
                      <TableCell>
                        <Badge variant={
                          issue.severity === 'high' ? 'destructive' :
                          issue.severity === 'medium' ? 'secondary' : 'outline'
                        }>
                          {issue.severity === 'high' ? 'Hoog' :
                           issue.severity === 'medium' ? 'Medium' : 'Laag'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{issue.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{issue.slug}</TableCell>
                      <TableCell>{issue.issue}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
