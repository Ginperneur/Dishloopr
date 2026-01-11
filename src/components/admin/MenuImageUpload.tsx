import { useState, useRef } from 'react';
import { Upload, Camera, Loader2, Check, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MenuImageUploadProps {
  restaurantId: string;
  restaurantName: string;
  onSuccess: () => void;
}

type UploadStatus = 'idle' | 'uploading' | 'parsing' | 'success' | 'error';

export function MenuImageUpload({ restaurantId, restaurantName, onSuccess }: MenuImageUploadProps) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    added: string[];
    existing: string[];
    errors: string[];
    totalProcessed: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Alleen afbeeldingen zijn toegestaan (JPG, PNG, WebP)');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Bestand is te groot (max 20MB)');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Start processing
    await processImage(file);
  };

  const processImage = async (file: File) => {
    setStatus('uploading');
    setProgress(20);
    setError(null);
    setResult(null);

    try {
      // Convert image to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Bestand lezen mislukt'));
        reader.readAsDataURL(file);
      });

      setProgress(40);
      setStatus('parsing');

      // Call edge function with base64 image
      const { data, error: parseError } = await supabase.functions.invoke('parse-menu-image', {
        body: { 
          restaurantId, 
          imageBase64: base64 
        }
      });

      if (parseError) {
        throw new Error(parseError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setProgress(100);
      setStatus('success');
      setResult(data);
      
      toast.success(`${data.added.length} nieuwe gerechten toegevoegd!`);
      onSuccess();

    } catch (err) {
      console.error('Menu image upload error:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Onbekende fout');
      toast.error('Menu verwerken mislukt');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processImageUrl = async () => {
    if (!imageUrl.trim()) {
      toast.error('Voer een afbeelding URL in');
      return;
    }

    setStatus('uploading');
    setProgress(20);
    setError(null);
    setResult(null);
    setPreviewUrl(imageUrl);

    try {
      setProgress(40);
      setStatus('parsing');

      // Call edge function with image URL
      const { data, error: parseError } = await supabase.functions.invoke('parse-menu-image', {
        body: { 
          restaurantId, 
          imageUrl: imageUrl.trim() 
        }
      });

      if (parseError) {
        throw new Error(parseError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setProgress(100);
      setStatus('success');
      setResult(data);
      
      toast.success(`${data.added.length} nieuwe gerechten toegevoegd!`);
      onSuccess();

    } catch (err) {
      console.error('Menu image URL error:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Onbekende fout');
      toast.error('Menu verwerken mislukt');
    }
  };

  const resetUpload = () => {
    setStatus('idle');
    setProgress(0);
    setResult(null);
    setError(null);
    setPreviewUrl(null);
    setImageUrl('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Menu Foto Scannen
        </CardTitle>
      </CardHeader>
      <CardContent>
        {status === 'idle' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload een foto van het menu of plak een URL. AI zal automatisch alle gerechten herkennen.
            </p>
            
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">Foto uploaden</TabsTrigger>
                <TabsTrigger value="url">Via URL</TabsTrigger>
              </TabsList>
              
              <TabsContent value="upload" className="mt-4">
                <div 
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="font-medium">Klik om een foto te uploaden</p>
                  <p className="text-sm text-muted-foreground mt-1">JPG, PNG of WebP (max 20MB)</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </TabsContent>
              
              <TabsContent value="url" className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="imageUrl">Afbeelding URL</Label>
                  <Input
                    id="imageUrl"
                    type="url"
                    placeholder="https://example.com/menu.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <Button 
                  onClick={processImageUrl} 
                  className="w-full"
                  disabled={!imageUrl.trim()}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Menu Scannen
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {(status === 'uploading' || status === 'parsing') && (
          <div className="space-y-4 py-4">
            {previewUrl && (
              <div className="relative w-full h-32 rounded-lg overflow-hidden bg-muted mb-4">
                <img 
                  src={previewUrl} 
                  alt="Menu preview" 
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>
                {status === 'uploading' ? 'Afbeelding voorbereiden...' : 'Gerechten herkennen met AI...'}
              </span>
            </div>
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground">
              Dit kan even duren afhankelijk van de grootte en complexiteit van het menu.
            </p>
          </div>
        )}

        {status === 'success' && result && (
          <div className="space-y-4 py-4">
            {previewUrl && (
              <div className="relative w-full h-24 rounded-lg overflow-hidden bg-muted mb-4">
                <img 
                  src={previewUrl} 
                  alt="Menu preview" 
                  className="w-full h-full object-contain opacity-50"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 text-green-600">
              <Check className="h-5 w-5" />
              <span className="font-medium">Menu foto succesvol gescand!</span>
            </div>
            
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-green-500/10 text-center">
                <p className="text-2xl font-bold text-green-600">{result.added.length}</p>
                <p className="text-muted-foreground text-xs">Nieuw</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10 text-center">
                <p className="text-2xl font-bold text-blue-600">{result.existing.length}</p>
                <p className="text-muted-foreground text-xs">Bestaand</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 text-center">
                <p className="text-2xl font-bold text-amber-600">{result.totalProcessed}</p>
                <p className="text-muted-foreground text-xs">Totaal</p>
              </div>
            </div>

            {result.added.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Toegevoegde gerechten:</p>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {result.added.map((dish, i) => (
                    <span key={i} className="text-xs bg-green-500/10 text-green-700 px-2 py-1 rounded">
                      {dish}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.errors.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 text-amber-600">Niet verwerkt:</p>
                <div className="flex flex-wrap gap-1">
                  {result.errors.map((dish, i) => (
                    <span key={i} className="text-xs bg-amber-500/10 text-amber-700 px-2 py-1 rounded">
                      {dish}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Button variant="outline" onClick={resetUpload} className="w-full">
              Nog een foto scannen
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4 py-4">
            {previewUrl && (
              <div className="relative w-full h-24 rounded-lg overflow-hidden bg-muted mb-4">
                <img 
                  src={previewUrl} 
                  alt="Menu preview" 
                  className="w-full h-full object-contain opacity-50"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Er ging iets mis</span>
            </div>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={resetUpload} className="w-full">
              Opnieuw proberen
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
