import { useState } from 'react';
import { Share2, MessageCircle, Copy, QrCode, MapPin, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QRCodeGenerator } from './QRCodeGenerator';
import { toast } from 'sonner';

interface QuickShareMenuProps {
  restaurantSlug: string;
  restaurantName: string;
  address?: string | null;
}

export function QuickShareMenu({ restaurantSlug, restaurantName, address }: QuickShareMenuProps) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const url = `https://dishloopr.com/restaurant/${restaurantSlug}`;

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link gekopieerd');
    setTimeout(() => setCopied(false), 1500);
  };

  const whatsapp = () => {
    const text = `Bekijk ${restaurantName} op Dishloopr: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const maps = () => {
    const q = encodeURIComponent(`${restaurantName} ${address || ''}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Delen</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={whatsapp} className="gap-2">
            <MessageCircle className="h-4 w-4" /> Deel op WhatsApp
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copy} className="gap-2">
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Gekopieerd' : 'Kopieer link'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setQrOpen(true)} className="gap-2">
            <QrCode className="h-4 w-4" /> Toon QR-code
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={maps} className="gap-2">
            <MapPin className="h-4 w-4" /> Open op Google Maps
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR-code voor {restaurantName}</DialogTitle>
          </DialogHeader>
          <QRCodeGenerator restaurantSlug={restaurantSlug} restaurantName={restaurantName} />
        </DialogContent>
      </Dialog>
    </>
  );
}