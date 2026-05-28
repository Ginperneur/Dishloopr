import { useEffect, useState } from 'react';
import { Languages, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const LANGUAGES = [
  { code: 'nl', label: '🇳🇱 Nederlands' },
  { code: 'en', label: '🇬🇧 English' },
  { code: 'de', label: '🇩🇪 Deutsch' },
  { code: 'fr', label: '🇫🇷 Français' },
  { code: 'es', label: '🇪🇸 Español' },
];

type Translation = { language_code: string; name: string; tagline: string; description: string };

export function MultiLanguageProfile({ restaurantId, defaultName }: { restaurantId: string; defaultName: string }) {
  const [translations, setTranslations] = useState<Record<string, Translation>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from('restaurant_translations')
        .select('language_code, name, tagline, description')
        .eq('restaurant_id', restaurantId);
      const map: Record<string, Translation> = {};
      LANGUAGES.forEach((l) => {
        const existing = (data as Translation[] | null)?.find((t) => t.language_code === l.code);
        map[l.code] = existing || { language_code: l.code, name: '', tagline: '', description: '' };
      });
      setTranslations(map);
    })();
  }, [restaurantId]);

  const save = async (code: string) => {
    setSaving(code);
    const t = translations[code];
    const { error } = await (supabase as any)
      .from('restaurant_translations')
      .upsert(
        { restaurant_id: restaurantId, language_code: code, name: t.name || null, tagline: t.tagline || null, description: t.description || null },
        { onConflict: 'restaurant_id,language_code' }
      );
    setSaving(null);
    if (error) { toast.error('Opslaan mislukt'); return; }
    toast.success(`Vertaling ${code.toUpperCase()} opgeslagen`);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Languages className="h-4 w-4" />
          Vertaal je restaurantnaam en korte beschrijving voor internationale gasten.
        </div>

        <Tabs defaultValue="nl">
          <TabsList className="grid grid-cols-5 w-full">
            {LANGUAGES.map((l) => (
              <TabsTrigger key={l.code} value={l.code} className="text-xs">{l.label.split(' ')[0]}</TabsTrigger>
            ))}
          </TabsList>
          {LANGUAGES.map((l) => (
            <TabsContent key={l.code} value={l.code} className="space-y-3 pt-3">
              <div>
                <Label className="text-xs">Naam ({l.label})</Label>
                <Input
                  placeholder={defaultName}
                  value={translations[l.code]?.name || ''}
                  onChange={(e) => setTranslations({ ...translations, [l.code]: { ...translations[l.code], name: e.target.value } })}
                />
              </div>
              <div>
                <Label className="text-xs">Tagline</Label>
                <Input
                  placeholder="Korte slogan…"
                  value={translations[l.code]?.tagline || ''}
                  onChange={(e) => setTranslations({ ...translations, [l.code]: { ...translations[l.code], tagline: e.target.value } })}
                />
              </div>
              <div>
                <Label className="text-xs">Beschrijving</Label>
                <Textarea
                  rows={4}
                  placeholder="Wat maakt dit restaurant uniek?"
                  value={translations[l.code]?.description || ''}
                  onChange={(e) => setTranslations({ ...translations, [l.code]: { ...translations[l.code], description: e.target.value } })}
                />
              </div>
              <Button size="sm" onClick={() => save(l.code)} disabled={saving === l.code}>
                <Save className="h-4 w-4 mr-1" /> {saving === l.code ? 'Opslaan…' : `Opslaan ${l.code.toUpperCase()}`}
              </Button>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}