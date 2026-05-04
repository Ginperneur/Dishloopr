import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { Instagram, Mail, ArrowRight } from 'lucide-react';
import { TikTokIcon } from '@/components/icons/TikTokIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/dishloopr-logo.png';

export function Footer() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [seoLinks, setSeoLinks] = useState<{ slug: string; label: string }[]>([]);

  useEffect(() => {
    async function fetchTopPages() {
      const { data } = await supabase
        .from('seo_landing_pages')
        .select('slug, h1_title')
        .eq('is_active', true)
        .limit(12);
      
      if (data) {
        setSeoLinks(data.map(p => ({ slug: p.slug, label: p.h1_title })));
      }
    }
    fetchTopPages();
  }, []);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .upsert({ email, is_active: true }, { onConflict: 'email' });
      
      if (error) throw error;
      toast.success(t('footer.newsletterSuccess', 'Bedankt! Je bent aangemeld voor de nieuwsbrief.'));
      setEmail('');
    } catch (err: any) {
      if (err.code === '23505') {
        toast.info('Je bent al aangemeld voor de nieuwsbrief!');
        setEmail('');
      } else {
        toast.error('Er ging iets mis. Probeer het opnieuw.');
      }
    }
    setIsLoading(false);
  };

  return (
    <footer className="border-t border-border bg-muted/30 w-full">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-16">
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
                <TikTokIcon />
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
            <h4 className="font-semibold mb-3 md:mb-4 text-sm md:text-base">{t('footer.brand', 'Dishloopr')}</h4>
            <ul className="space-y-2 text-xs md:text-sm text-muted-foreground">
              <li><Link to="/search" className="hover:text-foreground transition-colors">{t('nav.discover')}</Link></li>
              <li><Link to="/collections" className="hover:text-foreground transition-colors">{t('footer.collections', 'Collecties')}</Link></li>
              <li><Link to="/events" className="hover:text-foreground transition-colors">{t('nav.events', 'Events')}</Link></li>
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

            <h4 className="font-semibold mt-5 mb-3 text-sm md:text-base">{t('footer.legal', 'Juridisch')}</h4>
            <ul className="space-y-2 text-xs md:text-sm text-muted-foreground">
              <li><Link to="/terms" className="hover:text-foreground transition-colors">{t('footer.terms')}</Link></li>
              <li><Link to="/privacy" className="hover:text-foreground transition-colors">{t('footer.privacy')}</Link></li>
            </ul>
          </div>

          {/* Steden — expanded for SEO crawl paths */}
          <div>
            <h4 className="font-semibold mb-3 md:mb-4 text-sm md:text-base">{t('footer.cities', 'Steden')}</h4>
            <ul className="space-y-2 text-xs md:text-sm text-muted-foreground">
              <li><Link to="/steden" className="hover:text-foreground transition-colors font-medium">{t('footer.allCities', 'Alle steden')}</Link></li>
              <li><Link to="/steden/amsterdam" className="hover:text-foreground transition-colors">Amsterdam</Link></li>
              <li><Link to="/steden/rotterdam" className="hover:text-foreground transition-colors">Rotterdam</Link></li>
              <li><Link to="/steden/den-haag" className="hover:text-foreground transition-colors">Den Haag</Link></li>
              <li><Link to="/steden/utrecht" className="hover:text-foreground transition-colors">Utrecht</Link></li>
              <li><Link to="/steden/groningen" className="hover:text-foreground transition-colors">Groningen</Link></li>
              <li><Link to="/steden/eindhoven" className="hover:text-foreground transition-colors">Eindhoven</Link></li>
            </ul>

            <h4 className="font-semibold mt-5 mb-3 text-sm md:text-base">{t('footer.popularDishes', 'Populaire gerechten')}</h4>
            <ul className="space-y-2 text-xs md:text-sm text-muted-foreground">
              <li><Link to="/eten" className="hover:text-foreground transition-colors font-medium">Alle gerechten</Link></li>
              <li><Link to="/search?dish=sushi" className="hover:text-foreground transition-colors">Sushi</Link></li>
              <li><Link to="/search?dish=ramen" className="hover:text-foreground transition-colors">Ramen</Link></li>
              <li><Link to="/search?dish=pizza" className="hover:text-foreground transition-colors">Pizza</Link></li>
              <li><Link to="/search?dish=burger" className="hover:text-foreground transition-colors">Burgers</Link></li>
            </ul>
          </div>
        </div>

        {/* SEO Links Section */}
        {seoLinks.length > 0 && (
          <div className="mt-8 md:mt-10 pt-6 md:pt-8 border-t border-border">
            <h4 className="font-semibold mb-3 text-sm md:text-base">{t('footer.popularDishes', 'Populaire gerechten per stad')}</h4>
            <div className="flex flex-wrap gap-2">
              {seoLinks.map(link => (
                <Link
                  key={link.slug}
                  to={`/eten/${link.slug}`}
                  className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-border mt-8 md:mt-10 pt-6 md:pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs md:text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Dishloopr. {t('footer.allRights', 'Alle rechten voorbehouden.')}</p>
          <p className="text-center md:text-right">
            🇳🇱 {t('footer.madeIn', 'Gemaakt in Nederland')}
            <span> · KvK 82000611</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
