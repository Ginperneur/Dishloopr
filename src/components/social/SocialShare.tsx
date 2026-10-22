import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Share2, Facebook, Twitter, Linkedin, Link2, Mail, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SocialShareProps {
  url?: string;
  title: string;
  description?: string;
  hashtags?: string[];
  variant?: 'button' | 'icon';
  className?: string;
  onShare?: () => void;
}

export function SocialShare({ 
  url, 
  title, 
  description = '', 
  hashtags = ['dishloopr', 'restaurant'],
  variant = 'button',
  className = '',
  onShare,
}: SocialShareProps) {
  // Always share the production URL, not preview URLs
  const currentPath = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';
  const baseShareUrl = url || `https://dishloopr.com${currentPath}`;

  const withUtm = (source: string, medium: string, campaign = 'share') => {
    try {
      const u = new URL(baseShareUrl);
      if (!u.searchParams.get('utm_source')) u.searchParams.set('utm_source', source);
      if (!u.searchParams.get('utm_medium')) u.searchParams.set('utm_medium', medium);
      if (!u.searchParams.get('utm_campaign')) u.searchParams.set('utm_campaign', campaign);
      return u.toString();
    } catch {
      return baseShareUrl;
    }
  };

  const shareUrl = withUtm('direct', 'share');
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);
  const hashtagString = hashtags.join(',');

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(withUtm('facebook', 'social'))}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(withUtm('twitter', 'social'))}&text=${encodedTitle}&hashtags=${hashtagString}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(withUtm('linkedin', 'social'))}`,
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodeURIComponent(withUtm('whatsapp', 'messaging'))}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedDescription}%0A%0A${encodeURIComponent(withUtm('email', 'email'))}`,
  };

  const handleShare = (platform: keyof typeof shareLinks) => {
    onShare?.();
    const link = shareLinks[platform];
    window.open(link, '_blank', 'width=600,height=400,noopener,noreferrer');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(withUtm('copy-link', 'share'));
      onShare?.();
      toast.success('Link gekopieerd naar klembord');
    } catch {
      toast.error('Kon link niet kopiëren');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: withUtm('native', 'share'),
        });
        onShare?.();
      } catch (error) {
        // User cancelled or share failed
        if ((error as Error).name !== 'AbortError') {
          console.error('Share failed:', error);
        }
      }
    }
  };

  // Use native share on mobile if available
  const canUseNativeShare = typeof navigator !== 'undefined' && navigator.share;

  if (canUseNativeShare && variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNativeShare}
        className={className}
        aria-label="Delen"
      >
        <Share2 className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'icon' ? (
          <Button variant="ghost" size="icon" className={className} aria-label="Delen">
            <Share2 className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" className={`gap-2 ${className}`}>
            <Share2 className="h-4 w-4" />
            Delen
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => handleShare('facebook')} className="gap-2 cursor-pointer">
          <Facebook className="h-4 w-4 text-[#1877F2]" />
          Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare('twitter')} className="gap-2 cursor-pointer">
          <Twitter className="h-4 w-4 text-[#1DA1F2]" />
          X (Twitter)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare('linkedin')} className="gap-2 cursor-pointer">
          <Linkedin className="h-4 w-4 text-[#0A66C2]" />
          LinkedIn
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare('whatsapp')} className="gap-2 cursor-pointer">
          <MessageCircle className="h-4 w-4 text-[#25D366]" />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare('email')} className="gap-2 cursor-pointer">
          <Mail className="h-4 w-4" />
          Email
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyLink} className="gap-2 cursor-pointer">
          <Link2 className="h-4 w-4" />
          Kopieer link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
