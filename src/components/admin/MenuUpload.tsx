import { useState, useRef } from 'react';
import { Upload, FileText, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MenuUploadProps {
  restaurantId: string;
  restaurantName: string;
  onSuccess: () => void;
}

type UploadStatus = 'idle' | 'uploading' | 'parsing' | 'success' | 'error';

export function MenuUpload({ restaurantId, restaurantName, onSuccess }: MenuUploadProps) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    addedDishes: string[];
    existingDishes: string[];
    totalProcessed: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractTextFromPdf = async (file: File): Promise<string> => {
    // For now, we'll upload the file and use a simple text extraction
    // In production, you might want to use a PDF parsing library
    const formData = new FormData();
    formData.append('file', file);
    
    // Upload to storage first
    const fileName = `${restaurantId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('menus')
      .upload(fileName, file);

    if (uploadError) {
      throw new Error(`Upload mislukt: ${uploadError.message}`);
    }

    // For PDF text extraction, we'll use the file reader and a basic approach
    // The AI can work with raw PDF content to some extent
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Convert to text - for PDFs this gives us limited but useful text
        const text = reader.result as string;
        // Extract readable text from PDF (basic approach)
        const cleanText = text
          .replace(/[^\x20-\x7E\n\r]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        resolve(cleanText);
      };
      reader.onerror = () => reject(new Error('Bestand lezen mislukt'));
      reader.readAsText(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Alleen PDF bestanden zijn toegestaan');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Bestand is te groot (max 20MB)');
      return;
    }

    setStatus('uploading');
    setProgress(20);
    setError(null);
    setResult(null);

    try {
      // Extract text from PDF
      setProgress(40);
      const menuText = await extractTextFromPdf(file);
      
      if (menuText.length < 50) {
        throw new Error('Kon geen tekst uit het PDF extraheren. Probeer een ander bestand.');
      }

      setStatus('parsing');
      setProgress(60);

      // Call edge function to parse menu with AI
      const { data, error: parseError } = await supabase.functions.invoke('parse-menu', {
        body: { menuText, restaurantId }
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
      
      toast.success(`${data.addedDishes.length} nieuwe gerechten toegevoegd!`);
      onSuccess();

    } catch (err) {
      console.error('Menu upload error:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Onbekende fout');
      toast.error('Menu verwerken mislukt');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetUpload = () => {
    setStatus('idle');
    setProgress(0);
    setResult(null);
    setError(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Menu PDF Importeren
        </CardTitle>
      </CardHeader>
      <CardContent>
        {status === 'idle' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload een PDF van het menu. AI zal automatisch alle gerechten herkennen en toevoegen met synoniemen.
            </p>
            <div 
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Klik om een PDF te uploaden</p>
              <p className="text-sm text-muted-foreground mt-1">Max 20MB</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {(status === 'uploading' || status === 'parsing') && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>
                {status === 'uploading' ? 'Menu uploaden...' : 'Gerechten herkennen met AI...'}
              </span>
            </div>
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground">
              Dit kan even duren afhankelijk van de grootte van het menu.
            </p>
          </div>
        )}

        {status === 'success' && result && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 text-green-600">
              <Check className="h-5 w-5" />
              <span className="font-medium">Menu succesvol verwerkt!</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-green-500/10">
                <p className="text-2xl font-bold text-green-600">{result.addedDishes.length}</p>
                <p className="text-muted-foreground">Nieuwe gerechten</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10">
                <p className="text-2xl font-bold text-blue-600">{result.existingDishes.length}</p>
                <p className="text-muted-foreground">Bestaande gekoppeld</p>
              </div>
            </div>

            {result.addedDishes.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Toegevoegde gerechten:</p>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {result.addedDishes.map((dish, i) => (
                    <span key={i} className="text-xs bg-muted px-2 py-1 rounded">
                      {dish}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Button variant="outline" onClick={resetUpload} className="w-full">
              Nog een menu uploaden
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4 py-4">
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
