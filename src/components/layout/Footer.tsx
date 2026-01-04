import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import logo from '@/assets/dishloopr-logo.png';

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img src={logo} alt="Dishloopr" className="h-10 w-auto" />
            </Link>
            <p className="text-sm text-muted-foreground">
              {t('hero.subtitle')}
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4">Dishloopr</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/search" className="hover:text-foreground transition-colors">{t('nav.discover')}</Link></li>
              <li><Link to="/about" className="hover:text-foreground transition-colors">{t('footer.about')}</Link></li>
              <li><Link to="/contact" className="hover:text-foreground transition-colors">{t('footer.contact')}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">{t('footer.forRestaurants')}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/claim" className="hover:text-foreground transition-colors">{t('footer.claimRestaurant')}</Link></li>
              <li><Link to="/dashboard" className="hover:text-foreground transition-colors">{t('nav.dashboard')}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/terms" className="hover:text-foreground transition-colors">{t('footer.terms')}</Link></li>
              <li><Link to="/privacy" className="hover:text-foreground transition-colors">{t('footer.privacy')}</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Dishloopr. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
