import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CSVRestaurant {
  name: string;
  city: string;
  status: 'pending' | 'enriching' | 'success' | 'error' | 'duplicate';
  errorMessage?: string;
  enrichedData?: {
    place_id: string;
    address: string;
    geo_lat: number | null;
    geo_lng: number | null;
    phone: string | null;
    website: string | null;
    rating: number | null;
    price_level: number;
    opening_hours: string[] | null;
    photo_references: string[];
  };
}

interface BulkRestaurantUploadProps {
  onSuccess: () => void;
}

export function BulkRestaurantUpload({ onSuccess }: BulkRestaurantUploadProps) {
  const [restaurants, setRestaurants] = useState<CSVRestaurant[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'preview' | 'enriching' | 'importing' | 'done'>('upload');
  const [progress, setProgress] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): CSVRestaurant[] => {
    const lines = text.trim().split('\n');
    const parsed: CSVRestaurant[] = [];
    const startIndex = lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('naam') ? 1 : 0;
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const separator = line.includes(';') ? ';' : ',';
      const parts = line.split(separator).map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= 2 && parts[0] && parts[1]) {
        parsed.push({ name: parts[0], city: parts[1], status: 'pending' });
      }
    }
    return parsed;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      toast.error('Upload alsjeblieft een CSV bestand');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        toast.error('Geen geldige restaurants gevonden in het bestand');
        return;
      }
      if (parsed.length > 500) {
        toast.error('Maximum 500 restaurants per upload. Je hebt ' + parsed.length + ' restaurants.');
        return;
      }
      setRestaurants(parsed);
      setCurrentStep('preview');
      toast.success(`${parsed.length} restaurants gevonden`);
    };
    reader.readAsText(file);
  };

  const enrichWithGooglePlaces = async () => {
    setCurrentStep('enriching');
    setIsProcessing(true);
    setProgress(0);

    const total = restaurants.length;
    let completed = 0;

    for (let i = 0; i < restaurants.length; i++) {
      setRestaurants(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'enriching' } : r));

      try {
        const { data, error } = await supabase.functions.invoke('google-places-search', {
          body: { query: restaurants[i].name, city: restaurants[i].city }
        });
        if (error) throw error;

        if (data.results && data.results.length > 0) {
          const place = data.results[0];
          setRestaurants(prev => prev.map((r, idx) => idx === i ? {
            ...r, status: 'success',
            enrichedData: {
              place_id: place.place_id, address: place.address,
              geo_lat: place.geo_lat, geo_lng: place.geo_lng,
              phone: place.phone, website: place.website,
              rating: place.rating, price_level: place.price_level || 2,
              opening_hours: place.opening_hours, photo_references: place.photo_references || []
            }
          } : r));
        } else {
          setRestaurants(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'error', errorMessage: 'Niet gevonden op Google' } : r));
        }
      } catch (error) {
        console.error('Error enriching restaurant:', error);
        setRestaurants(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'error', errorMessage: 'API fout' } : r));
      }

      completed++;
      setProgress(Math.round((completed / total) * 100));
      if (i < restaurants.length - 1) await new Promise(resolve => setTimeout(resolve, 300));
    }

    // After enrichment, check for duplicates using place_id against existing DB
    await checkDuplicatesByPlaceId();

    setIsProcessing(false);
    setCurrentStep('importing');
  };

  const checkDuplicatesByPlaceId = async () => {
    // Fetch all existing restaurant addresses for matching
    // We match on place_id (via google_place_id) or name+address combo
    const existingPlaceIds = new Set<string>();
    const existingNameAddress = new Set<string>();
    let from = 0;
    while (true) {
      const { data } = await supabase
        .from('restaurants')
        .select('name, address, google_place_id')
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      for (const r of data) {
        if (r.google_place_id) existingPlaceIds.add(r.google_place_id);
        if (r.name && r.address) {
          existingNameAddress.add(`${r.name.toLowerCase().trim()}|${r.address.toLowerCase().trim()}`);
        }
      }
      if (data.length < 1000) break;
      from += 1000;
    }

    let dupes = 0;
    setRestaurants(prev => prev.map(r => {
      if (r.status !== 'success' || !r.enrichedData) return r;

      const placeIdMatch = r.enrichedData.place_id && existingPlaceIds.has(r.enrichedData.place_id);
      const nameAddrMatch = r.enrichedData.address &&
        existingNameAddress.has(`${r.name.toLowerCase().trim()}|${r.enrichedData.address.toLowerCase().trim()}`);

      if (placeIdMatch || nameAddrMatch) {
        dupes++;
        return { ...r, status: 'duplicate' as const, errorMessage: 'Bestaat al in database (zelfde locatie)' };
      }
      return r;
    }));

    setDuplicateCount(dupes);
    if (dupes > 0) {
      toast.warning(`${dupes} duplicaten gevonden op basis van locatie (ketens met meerdere vestigingen worden correct herkend)`);
    }
  };

  const importRestaurants = async () => {
    setIsProcessing(true);
    setProgress(0);

    const successfulRestaurants = restaurants.filter(r => r.status === 'success' && r.enrichedData);
    const total = successfulRestaurants.length;
    let imported = 0;
    let errors = 0;

    for (const restaurant of successfulRestaurants) {
      try {
        let cityId: string;
        const { data: existingCity } = await supabase
          .from('cities')
          .select('id')
          .eq('name', restaurant.city)
          .maybeSingle();

        if (existingCity) {
          cityId = existingCity.id;
        } else {
          const { data: newCity, error: cityError } = await supabase
            .from('cities')
            .insert({
              name: restaurant.city,
              slug: restaurant.city.toLowerCase().replace(/\s+/g, '-'),
              country_code: 'NL'
            })
            .select('id')
            .single();
          if (cityError) throw cityError;
          cityId = newCity.id;
        }

        const { data: existingRestaurant } = await supabase
          .from('restaurants')
          .select('id')
          .eq('name', restaurant.name)
          .eq('city_id', cityId)
          .maybeSingle();

        if (existingRestaurant) {
          await supabase
            .from('restaurants')
            .update({
              address: restaurant.enrichedData!.address,
              geo_lat: restaurant.enrichedData!.geo_lat,
              geo_lng: restaurant.enrichedData!.geo_lng,
              phone: restaurant.enrichedData!.phone,
              website_url: restaurant.enrichedData!.website,
              rating: restaurant.enrichedData!.rating || 0,
              price_level: restaurant.enrichedData!.price_level,
              opening_hours: restaurant.enrichedData!.opening_hours
                ? { weekday_text: restaurant.enrichedData!.opening_hours }
                : null,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingRestaurant.id);
        } else {
          const slug = restaurant.name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-');

          const { data: newRestaurant, error: insertError } = await supabase
            .from('restaurants')
            .insert({
              name: restaurant.name,
              slug: slug,
              city_id: cityId,
              address: restaurant.enrichedData!.address,
              geo_lat: restaurant.enrichedData!.geo_lat,
              geo_lng: restaurant.enrichedData!.geo_lng,
              phone: restaurant.enrichedData!.phone,
              website_url: restaurant.enrichedData!.website,
              rating: restaurant.enrichedData!.rating || 0,
              price_level: restaurant.enrichedData!.price_level,
              opening_hours: restaurant.enrichedData!.opening_hours
                ? { weekday_text: restaurant.enrichedData!.opening_hours }
                : null,
              is_active: true
            })
            .select('id')
            .single();

          if (!insertError && newRestaurant && restaurant.enrichedData!.photo_references.length > 0) {
            supabase.functions.invoke('fetch-google-photos', {
              body: {
                place_id: restaurant.enrichedData!.place_id,
                photo_references: restaurant.enrichedData!.photo_references,
                restaurant_id: newRestaurant.id,
                max_photos: 5
              }
            }).catch(err => console.error('Failed to fetch photos:', err));
          }
        }

        imported++;
      } catch (error) {
        console.error('Error importing restaurant:', restaurant.name, error);
        errors++;
      }

      setProgress(Math.round(((imported + errors) / total) * 100));
    }

    setIsProcessing(false);
    setCurrentStep('done');

    if (errors === 0) {
      toast.success(`${imported} restaurants geïmporteerd!`);
    } else {
      toast.warning(`${imported} geïmporteerd, ${errors} mislukt`);
    }

    onSuccess();
  };

  const reset = () => {
    setRestaurants([]);
    setCurrentStep('upload');
    setProgress(0);
    setDuplicateCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const successCount = restaurants.filter(r => r.status === 'success').length;
  const errorCount = restaurants.filter(r => r.status === 'error').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Bulk Restaurant Import
        </CardTitle>
        <CardDescription>
          Upload een CSV bestand met restaurantnamen en steden. We verrijken de data automatisch via Google Places en controleren op duplicaten via locatie-ID.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Upload */}
        {currentStep === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Upload een CSV bestand met kolommen: <strong>naam, stad</strong>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                CSV selecteren
              </Button>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="font-medium mb-2">Voorbeeld CSV formaat:</p>
              <code className="block bg-background p-2 rounded text-xs">
                naam,stad<br />
                De Kas,Amsterdam<br />
                Restaurant Blauw,Amsterdam<br />
                HanTing Cuisine,Rotterdam
              </code>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {currentStep === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {restaurants.length} restaurants gevonden
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={reset}>Annuleren</Button>
                <Button onClick={enrichWithGooglePlaces}>
                  Verrijken met Google Places
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-4 space-y-2">
                {restaurants.map((r, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <div>
                      <span className="font-medium">{r.name}</span>
                      <span className="text-muted-foreground ml-2">• {r.city}</span>
                    </div>
                    <Badge variant="outline">Wachten</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Step 3: Enriching */}
        {currentStep === 'enriching' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Verrijken met Google Places data...</span>
            </div>

            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-center">{progress}%</p>

            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-4 space-y-2">
                {restaurants.map((r, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <div>
                      <span className="font-medium">{r.name}</span>
                      <span className="text-muted-foreground ml-2">• {r.city}</span>
                    </div>
                    {r.status === 'pending' && <Badge variant="outline">Wachten</Badge>}
                    {r.status === 'enriching' && (
                      <Badge variant="secondary">
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        Ophalen...
                      </Badge>
                    )}
                    {r.status === 'success' && (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Gevonden
                      </Badge>
                    )}
                    {r.status === 'error' && (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        {r.errorMessage}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Step 4: Import confirmation */}
        {currentStep === 'importing' && !isProcessing && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">Verrijking & duplicaatcontrole voltooid</p>
                <p className="text-sm text-muted-foreground">
                  {successCount} nieuw • {duplicateCount} duplicaten • {errorCount} niet gevonden
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="default">{successCount} nieuw</Badge>
                {duplicateCount > 0 && <Badge variant="secondary">{duplicateCount} duplicaten</Badge>}
                {errorCount > 0 && <Badge variant="destructive">{errorCount} mislukt</Badge>}
              </div>
            </div>

            {duplicateCount > 0 && (
              <div className="bg-muted/50 border border-border rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Duplicaten op basis van locatie</p>
                  <p className="text-muted-foreground">
                    {duplicateCount} restaurant(s) bestaan al in de database (zelfde Google Place ID of adres).
                    Ketens met meerdere vestigingen worden correct als aparte locaties herkend.
                  </p>
                </div>
              </div>
            )}

            <ScrollArea className="h-[250px] border rounded-lg">
              <div className="p-4 space-y-2">
                {restaurants.filter(r => r.status === 'success').map((r, idx) => (
                  <div key={idx} className="p-3 bg-primary/5 border border-primary/20 rounded">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{r.name}</span>
                      <CheckCircle className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{r.enrichedData?.address}</p>
                  </div>
                ))}
                {restaurants.filter(r => r.status === 'duplicate').map((r, idx) => (
                  <div key={`dup-${idx}`} className="p-3 bg-muted/50 border border-border rounded opacity-60">
                    <div className="flex items-center justify-between">
                      <span className="font-medium line-through">{r.name}</span>
                      <Badge variant="secondary">Duplicaat</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{r.enrichedData?.address}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} className="flex-1">Annuleren</Button>
              <Button onClick={importRestaurants} className="flex-1" disabled={successCount === 0}>
                {successCount} restaurants importeren
              </Button>
            </div>
          </div>
        )}

        {/* Importing progress */}
        {currentStep === 'importing' && isProcessing && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Restaurants importeren...</span>
            </div>
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-center">{progress}%</p>
          </div>
        )}

        {/* Step 5: Done */}
        {currentStep === 'done' && (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Import voltooid!</h3>
            <p className="text-muted-foreground mb-6">
              De restaurants zijn succesvol geïmporteerd met verrijkte data van Google Places.
            </p>
            <Button onClick={reset}>Nieuwe import starten</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
