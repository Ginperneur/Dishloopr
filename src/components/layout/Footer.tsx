import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Instagram, Mail, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import logo from '@/assets/dishloopr-logo.png';

export function Footer() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsLoading(true);
    // Simulate newsletter signup
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.success(t('footer.newsletterSuccess', 'Bedankt! Je bent aangemeld voor de nieuwsbrief.'));
    setEmail('');
    setIsLoading(false);
  };

  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container px-4 md:px-6 py-10 md:py-16">
        {/* Newsletter Section */}
        <div className="mb-10 md:mb-14 pb-8 md:pb-10 border-b border-border">
          <div className="max-w-xl mx-auto text-center">
            <h3 className="text-lg md:text-xl font-bold mb-2">
              {t('footer.newsletterTitle', 'Blijf op de hoogte')}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('footer.newsletterSubtitle', 'Ontvang wekelijks de beste restaurant tips en nieuwe gerechten in je inbox.')}
            </p>
            <form onSubmit={handleNewsletterSubmit} className="flex gap-2 max-w-md mx-auto">
              <Input
                type="email"
                placeholder={t('footer.emailPlaceholder', 'Je e-mailadres')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
                required
              />
              <Button type="submit" disabled={isLoading} className="gap-1">
                {isLoading ? '...' : t('footer.subscribe', 'Aanmelden')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 md:gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-3 md:mb-4">
              <img src={logo} alt="Dishloopr" className="h-8 md:h-10 w-auto" />
            </Link>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed mb-4 max-w-xs">
              {t('hero.subtitle')}
            </p>
            
            {/* Social Links */}
            <div className="flex gap-3">
              <a 
                href="https://instagram.com/dishloopr" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a 
                href="https://tiktok.com/@dishloopr" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
                aria-label="TikTok"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
              </a>
              <a 
                href="mailto:info@dishloopr.com" 
                className="p-2 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
                aria-label="Email"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-3 md:mb-4 text-sm md:text-base">Dishloopr</h4>
            <ul className="space-y-2 text-xs md:text-sm text-muted-foreground">
              <li><Link to="/search" className="hover:text-foreground transition-colors">{t('nav.discover')}</Link></li>
              <li><Link to="/collections" className="hover:text-foreground transition-colors">{t('footer.collections', 'Collecties')}</Link></li>
              <li><Link to="/about" className="hover:text-foreground transition-colors">{t('footer.about')}</Link></li>
              <li><Link to="/contact" className="hover:text-foreground transition-colors">{t('footer.contact')}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3 md:mb-4 text-sm md:text-base">{t('footer.forRestaurants')}</h4>
            <ul className="space-y-2 text-xs md:text-sm text-muted-foreground">
              <li><Link to="/for-restaurants" className="hover:text-foreground transition-colors">{t('footer.howItWorks')}</Link></li>
              <li><Link to="/claim" className="hover:text-foreground transition-colors">{t('footer.claimRestaurant')}</Link></li>
              <li><Link to="/dashboard" className="hover:text-foreground transition-colors">{t('nav.dashboard')}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3 md:mb-4 text-sm md:text-base">Legal</h4>
            <ul className="space-y-2 text-xs md:text-sm text-muted-foreground">
              <li><Link to="/terms" className="hover:text-foreground transition-colors">{t('footer.terms')}</Link></li>
              <li><Link to="/privacy" className="hover:text-foreground transition-colors">{t('footer.privacy')}</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 md:mt-10 pt-6 md:pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs md:text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Dishloopr. {t('footer.allRights', 'Alle rechten voorbehouden.')}</p>
          <p className="text-center md:text-right">
            🇳🇱 {t('footer.madeIn', 'Gemaakt in Nederland')}
          </p>
        </div>
      </div>
    </footer>
  );
}
