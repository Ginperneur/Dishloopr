import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { ImageOff, RefreshCw, Eye, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface BrokenImage {
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  imageUrl: string;
  imageIndex: number;
  status: number | 'error';
}

export function BrokenImageChecker() {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [checked, setChecked] = useState(0);
  const [brokenImages, setBrokenImages] = useState<BrokenImage[]>([]);
  const [scanComplete, setScanComplete] = useState(false);

  const checkImage = (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      // Timeout after 8 seconds
      setTimeout(() => resolve(false), 8000);
      img.src = url;
    });
  };

  const runScan = async () => {
    setScanning(true);
    setBrokenImages([]);
    setScanComplete(false);
    setChecked(0);
    setProgress(0);

    // Fetch all restaurants with images
    let allRestaurants: any[] = [];
    let from = 0;
    while (true) {
      const { data } = await supabase
        .from('restaurants')
        .select('id, name, slug, images')
        .not('images', 'is', null)
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      allRestaurants = allRestaurants.concat(data);
      if (data.length < 1000) break;
      from += 1000;
    }

    // Flatten to individual images
    const imageChecks: { restaurantId: string; restaurantName: string; restaurantSlug: string; imageUrl: string; imageIndex: number }[] = [];
    allRestaurants.forEach((r: any) => {
      (r.images || []).forEach((url: string, idx: number) => {
        if (url) imageChecks.push({ restaurantId: r.id, restaurantName: r.name, restaurantSlug: r.slug, imageUrl: url, imageIndex: idx });
      });
    });

    setTotal(imageChecks.length);
    const broken: BrokenImage[] = [];

    // Check in batches of 10
    for (let i = 0; i < imageChecks.length; i += 10) {
      const batch = imageChecks.slice(i, i + 10);
      const results = await Promise.all(
        batch.map(async (item) => {
          const ok = await checkImage(item.imageUrl);
          return { ...item, ok };
        })
      );

      results.forEach(r => {
        if (!r.ok) {
          broken.push({ ...r, status: 'error' });
        }
      });

      const done = Math.min(i + 10, imageChecks.length);
      setChecked(done);
      setProgress(Math.round((done / imageChecks.length) * 100));
      setBrokenImages([...broken]);
    }

    setScanComplete(true);
    setScanning(false);
    if (broken.length === 0) {
      toast.success('Geen kapotte afbeeldingen gevonden!');
    } else {
      toast.warning(`${broken.length} kapotte afbeeldingen gevonden`);
    }
  };

  const removeImage = async (restaurantId: string, imageIndex: number) => {
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('images')
      .eq('id', restaurantId)
      .single();

    if (!restaurant?.images) return;

    const updatedImages = restaurant.images.filter((_: string, i: number) => i !== imageIndex);
    const { error } = await supabase
      .from('restaurants')
      .update({ images: updatedImages })
      .eq('id', restaurantId);

    if (error) {
      toast.error('Verwijderen mislukt');
    } else {
      toast.success('Afbeelding verwijderd');
      setBrokenImages(prev => prev.filter(b => !(b.restaurantId === restaurantId && b.imageIndex === imageIndex)));
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ImageOff className="h-5 w-5" />
              Broken Image Checker
            </CardTitle>
            <CardDescription>
              Scan alle restaurant-afbeeldingen op dode links
            </CardDescription>
          </div>
          <Button onClick={runScan} disabled={scanning}>
            <RefreshCw className={`h-4 w-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scannen...' : 'Start scan'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {scanning && (
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span>Bezig met scannen...</span>
              <span className="text-muted-foreground">{checked}/{total}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {scanComplete && brokenImages.length === 0 && (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
            <p className="font-medium">Alle afbeeldingen zijn OK!</p>
            <p className="text-sm text-muted-foreground">{total} afbeeldingen gescand</p>
          </div>
        )}

        {brokenImages.length > 0 && (
          <div>
            <Badge variant="destructive" className="mb-3">{brokenImages.length} kapotte afbeeldingen</Badge>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="w-24">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brokenImages.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <p className="font-medium text-sm">{item.restaurantName}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-muted-foreground truncate max-w-[300px]" title={item.imageUrl}>{item.imageUrl}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(`/restaurant/${item.restaurantSlug}`, '_blank')}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeImage(item.restaurantId, item.imageIndex)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {!scanning && !scanComplete && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Klik op "Start scan" om alle restaurant-afbeeldingen te controleren
          </p>
        )}
      </CardContent>
    </Card>
  );
}
