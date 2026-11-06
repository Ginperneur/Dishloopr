import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Download, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface QRCodeGeneratorProps {
  restaurantSlug: string;
  restaurantName: string;
  /** Target of the code; defaults to the restaurant page. */
  url?: string;
  title?: string;
  description?: string;
  /** Line printed under the name on the downloaded image. */
  caption?: string;
}

/** A real, scannable QR code (the previous version drew a decorative pattern that phones could not read). */
export function QRCodeGenerator({
  restaurantSlug,
  restaurantName,
  url = `https://dishloopr.com/restaurant/${restaurantSlug}?utm_source=qr`,
  title = 'QR-code voor gasten',
  description = 'Print deze QR-code en plaats hem op tafel, bij de kassa of op je menukaart. Gasten scannen hem en komen direct op je Dishloopr-pagina.',
  caption = 'Scan voor menu & reviews',
}: QRCodeGeneratorProps) {
  const [copied, setCopied] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(url, { width: 600, margin: 2, errorCorrectionLevel: 'M' })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [url]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link gekopieerd!');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = () => {
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, 600, 600);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(restaurantName, canvas.width / 2, 650);
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#666';
      ctx.fillText(caption, canvas.width / 2, 690);
      const link = document.createElement('a');
      link.download = `${restaurantSlug}-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = dataUrl;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <QrCode className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>

        <div className="flex justify-center p-4 bg-white rounded-xl">
          {dataUrl
            ? <img src={dataUrl} alt={`QR-code naar ${url}`} width={180} height={180} className="block" />
            : <div className="h-[180px] w-[180px] animate-pulse rounded bg-muted" />}
        </div>

        <div className="flex gap-2">
          <Button onClick={downloadQR} variant="outline" className="flex-1 gap-2" disabled={!dataUrl}>
            <Download className="h-4 w-4" />
            Download
          </Button>
          <Button onClick={copyLink} variant="outline" className="flex-1 gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Gekopieerd' : 'Kopieer link'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
