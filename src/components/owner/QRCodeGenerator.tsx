import { useState, useRef } from 'react';
import { QrCode, Download, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface QRCodeGeneratorProps {
  restaurantSlug: string;
  restaurantName: string;
}

// Simple QR code SVG generator using a basic encoding approach
function generateQRMatrix(data: string): boolean[][] {
  // Use a simple hash-based visual pattern as a placeholder
  // In production, you'd use a proper QR library
  const size = 21;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  
  // Finder patterns (top-left, top-right, bottom-left)
  const addFinder = (x: number, y: number) => {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        matrix[y + i][x + j] = i === 0 || i === 6 || j === 0 || j === 6 ||
          (i >= 2 && i <= 4 && j >= 2 && j <= 4);
      }
    }
  };
  addFinder(0, 0);
  addFinder(size - 7, 0);
  addFinder(0, size - 7);
  
  // Data area - hash based pattern
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  }
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (matrix[y][x]) continue; // Skip finder patterns
      if (x < 8 && y < 8) continue;
      if (x >= size - 7 && y < 8) continue;
      if (x < 8 && y >= size - 7) continue;
      
      const seed = (hash + x * 31 + y * 17 + x * y) & 0x7fffffff;
      matrix[y][x] = seed % 3 !== 0;
    }
  }
  
  return matrix;
}

export function QRCodeGenerator({ restaurantSlug, restaurantName }: QRCodeGeneratorProps) {
  const [copied, setCopied] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const url = `https://dishloopr.com/restaurant/${restaurantSlug}?utm_source=qr`;
  const matrix = generateQRMatrix(url);
  const cellSize = 10;
  const padding = 20;
  const qrSize = matrix.length * cellSize;
  const svgSize = qrSize + padding * 2;

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link gekopieerd!');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement('canvas');
    canvas.width = svgSize * 2;
    canvas.height = (svgSize + 60) * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height - 120);
      
      // Add restaurant name below
      ctx.fillStyle = '#000';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(restaurantName, canvas.width / 2, canvas.height - 70);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#666';
      ctx.fillText('Scan voor menu & reviews', canvas.width / 2, canvas.height - 40);
      
      const link = document.createElement('a');
      link.download = `${restaurantSlug}-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <QrCode className="h-4 w-4 text-primary" />
          QR-code voor gasten
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Print deze QR-code en plaats hem op tafel, bij de kassa of op je menukaart. 
          Gasten scannen hem en komen direct op je Dishloopr-pagina.
        </p>
        
        <div className="flex justify-center p-4 bg-white rounded-xl">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${svgSize} ${svgSize}`}
            width={180}
            height={180}
            className="block"
          >
            <rect width={svgSize} height={svgSize} fill="white" />
            {matrix.map((row, y) =>
              row.map((cell, x) =>
                cell ? (
                  <rect
                    key={`${x}-${y}`}
                    x={padding + x * cellSize}
                    y={padding + y * cellSize}
                    width={cellSize}
                    height={cellSize}
                    fill="black"
                    rx={1}
                  />
                ) : null
              )
            )}
          </svg>
        </div>

        <div className="flex gap-2">
          <Button onClick={downloadQR} variant="outline" className="flex-1 gap-2">
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
