import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Loader2, FileSpreadsheet, FileJson, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ExportFormat = 'csv' | 'json';

interface ExportConfig {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  fetchData: () => Promise<Record<string, unknown>[]>;
}

const BATCH_SIZE = 1000;

async function fetchAllRows(
  table: string,
  select: string,
  order?: string
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = (supabase as any).from(table).select(select).range(from, from + BATCH_SIZE - 1);
    if (order) {
      query = query.order(order);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      all.push(...(data as Record<string, unknown>[]));
      if (data.length < BATCH_SIZE) hasMore = false;
      from += BATCH_SIZE;
    }
  }
  return all;
}

function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}_${key}` : key;
    if (value === null || value === undefined) {
      result[fullKey] = '';
    } else if (Array.isArray(value)) {
      result[fullKey] = value.join('; ');
    } else if (typeof value === 'object') {
      const nested = flattenObject(value as Record<string, unknown>, fullKey);
      Object.assign(result, nested);
    } else {
      result[fullKey] = String(value);
    }
  }
  return result;
}

function toCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  const flatRows = data.map(row => flattenObject(row));
  const headers = [...new Set(flatRows.flatMap(r => Object.keys(r)))];

  const escape = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines = [
    headers.map(escape).join(','),
    ...flatRows.map(row => headers.map(h => escape(row[h] ?? '')).join(',')),
  ];
  return lines.join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob(['\uFEFF' + content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const EXPORTS: ExportConfig[] = [
  {
    key: 'restaurants',
    label: 'Restaurants',
    description: 'Alle restaurants met adres, stad, cuisines, rating, website, contact, etc.',
    icon: <Database className="w-5 h-5" />,
    fetchData: () =>
      fetchAllRows(
        'restaurants',
        'id, name, slug, address, postal_code, phone, website_url, instagram_url, tiktok_url, cuisines, ambience_tags, dietary_options, concepts, experiences, meal_types, price_level, rating, review_count, is_active, is_featured, has_terrace, geo_lat, geo_lng, claim_status, created_at, updated_at, city:cities(name, slug)',
        undefined,
        'name'
      ),
  },
  {
    key: 'dishes',
    label: 'Gerechten (taxonomie)',
    description: 'Alle gerechten in de database met tags en synoniemen.',
    icon: <Database className="w-5 h-5" />,
    fetchData: () =>
      fetchAllRows('dishes', 'id, name, name_en, slug, cuisine_tags, seasonal_tags, synonyms, is_active, search_count, created_at', undefined, 'name'),
  },
  {
    key: 'restaurant_dishes',
    label: 'Restaurant-gerecht koppelingen',
    description: 'Welk gerecht bij welk restaurant hoort, inclusief status en confidence.',
    icon: <Database className="w-5 h-5" />,
    fetchData: () =>
      fetchAllRows(
        'restaurant_dishes',
        'id, status, source, confidence_score, course_type, is_signature, is_halal, is_vegetarian, is_vegan, is_gluten_free, created_at, dish:dishes(name, slug), restaurant:restaurants(name, slug)',
        undefined,
        'created_at'
      ),
  },
  {
    key: 'reviews',
    label: 'Reviews',
    description: 'Alle reviews met rating, tekst en restaurant info.',
    icon: <Database className="w-5 h-5" />,
    fetchData: () =>
      fetchAllRows(
        'reviews',
        'id, rating, title, body, status, is_verified, suggested_tags, created_at, restaurant:restaurants(name, slug)',
        undefined,
        'created_at'
      ),
  },
  {
    key: 'cities',
    label: 'Steden',
    description: 'Alle steden met land en status.',
    icon: <Database className="w-5 h-5" />,
    fetchData: () =>
      fetchAllRows('cities', 'id, name, slug, country_code, is_active, created_at', undefined, 'name'),
  },
  {
    key: 'collections',
    label: 'Collecties',
    description: 'Alle collecties met metadata.',
    icon: <Database className="w-5 h-5" />,
    fetchData: () =>
      fetchAllRows('collections', 'id, title, slug, subtitle, description, cuisine, is_active, is_featured, seo_title, seo_description, created_at', undefined, 'title'),
  },
  {
    key: 'newsletter_subscribers',
    label: 'Nieuwsbrief abonnees',
    description: 'Alle nieuwsbrief abonnees met status.',
    icon: <Database className="w-5 h-5" />,
    fetchData: () =>
      fetchAllRows('newsletter_subscribers', 'id, email, is_active, subscribed_at, unsubscribed_at', undefined, 'subscribed_at'),
  },
];

export function DataExportManager() {
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [format, setFormat] = useState<ExportFormat>('csv');

  const handleExport = async (config: ExportConfig) => {
    setExportingKey(config.key);
    try {
      const data = await config.fetchData();

      if (data.length === 0) {
        toast.error('Geen data gevonden om te exporteren');
        return;
      }

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `dishloopr-${config.key}-${timestamp}`;

      if (format === 'json') {
        const content = JSON.stringify(data, null, 2);
        downloadFile(content, `${filename}.json`, 'application/json');
      } else {
        const content = toCsv(data);
        downloadFile(content, `${filename}.csv`, 'text/csv');
      }

      toast.success(`${data.length} rijen geëxporteerd als ${format.toUpperCase()}`);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Export mislukt');
    } finally {
      setExportingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Data Export
              </CardTitle>
              <CardDescription>Exporteer data vanuit Dishloopr als CSV of JSON</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Formaat:</span>
              <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">
                    <span className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" /> CSV
                    </span>
                  </SelectItem>
                  <SelectItem value="json">
                    <span className="flex items-center gap-2">
                      <FileJson className="w-4 h-4" /> JSON
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {EXPORTS.map((config) => (
              <div
                key={config.key}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="text-muted-foreground">{config.icon}</div>
                  <div>
                    <div className="font-medium">{config.label}</div>
                    <div className="text-sm text-muted-foreground">{config.description}</div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport(config)}
                  disabled={exportingKey !== null}
                >
                  {exportingKey === config.key ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {exportingKey === config.key ? 'Exporteren...' : format.toUpperCase()}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
