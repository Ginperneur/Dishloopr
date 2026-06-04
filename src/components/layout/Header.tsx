import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogOut, User, Store, Shield, Heart, Search, BarChart3, Utensils, BookOpen, PartyPopper } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import logo from '@/assets/dishloopr-logo.png';
import { LANGUAGES } from '@/lib/constants';

export function Header() {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  // Scroll-shrink behavior on mobile
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on Escape for a11y
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (user) {
      // Batch all queries in parallel
      const accountType = user.user_metadata?.account_type;
      
      Promise.all([
        supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
        supabase.from('profiles').select('avatar_url').eq('id', user.id).single(),
        accountType === 'restaurant' 
          ? Promise.resolve({ data: [{ id: 'owner' }] }) 
          : supabase.from('restaurant_managers').select('id').eq('user_id', user.id).limit(1),
      ]).then(([adminRes, profileRes, managerRes]) => {
        setIsAdmin(adminRes.data === true);
        setAvatarUrl(profileRes.data?.avatar_url || null);
        setIsOwner(accountType === 'restaurant' || (managerRes.data?.length || 0) > 0);
      });
    } else {
      setIsAdmin(false);
      setIsOwner(false);
      setAvatarUrl(null);
    }
  }, [user]);

  const userInitials = user?.user_metadata?.name
    ? user.user_metadata.name.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || 'U';

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
  };

  // Determine dashboard link based on account type
  const dashboardLink = isOwner ? '/dashboard' : '/my-dashboard';
  const dashboardLabel = isOwner ? 'Restaurant Dashboard' : 'Mijn Dashboard';
  const DashboardIcon = isOwner ? Store : Utensils;

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={`sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-top transition-[border-color,box-shadow] ${
        scrolled ? 'border-border shadow-sm' : 'border-border/40'
      }`}
    >
      <div
        className={`container flex items-center justify-between px-4 transition-[height] duration-200 ${
          scrolled ? 'h-12 md:h-14' : 'h-14 md:h-16'
        }`}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center shrink-0" aria-label="Ga naar home">
          <img
            src={logo}
            alt="Dishloopr"
            className={`w-auto transition-[height] duration-200 ${
              scrolled ? 'h-7 md:h-8' : 'h-8 md:h-10'
            }`}
            loading="eager"
            decoding="async"
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-4 lg:gap-6" aria-label={t('nav.mainNavigation', 'Hoofdnavigatie')}>
          <Link to="/search" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
            {t('nav.discover')}
          </Link>
          <Link to="/collections" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
            {t('nav.collections')}
          </Link>
          <Link to="/search?featured=true" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
            {t('nav.featured')}
          </Link>
          <Link to="/events" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors flex items-center gap-1.5">
            <PartyPopper className="h-4 w-4" />
            {t('nav.events', 'Events & Acties')}
          </Link>
          {user && (
            <Link to="/favorites" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors flex items-center gap-1.5">
              <Heart className="h-4 w-4" />
              {t('nav.favorites')}
            </Link>
          )}
          {isAdmin && (
            <Link to="/admin" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors flex items-center gap-1.5">
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          )}

          {/* Language Switcher */}
          <div className="flex items-center gap-0.5 border border-border rounded-lg px-1 py-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => i18n.changeLanguage(lang.code)}
                aria-label={`${t('home.language', 'Taal')}: ${lang.label}`}
                aria-pressed={i18n.language === lang.code}
                className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                  i18n.language === lang.code
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {lang.code.toUpperCase()}
              </button>
            ))}
          </div>

          <ThemeToggle />

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={avatarUrl || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center gap-2 p-2">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user.user_metadata?.name || 'Gebruiker'}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={dashboardLink} className="cursor-pointer">
                    <DashboardIcon className="mr-2 h-4 w-4" />
                    {dashboardLabel}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    {t('home.myProfile')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/favorites" className="cursor-pointer">
                    <Heart className="mr-2 h-4 w-4" />
                    Favorieten
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/insights" className="cursor-pointer">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Inzichten
                  </Link>
                </DropdownMenuItem>
                {!isOwner && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/for-restaurants" className="cursor-pointer">
                        <Store className="mr-2 h-4 w-4" />
                        {t('footer.forRestaurants')}
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="cursor-pointer">
                      <Shield className="mr-2 h-4 w-4" />
                      Admin Panel
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to="/login?tab=login">{t('nav.login')}</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/login?tab=signup">{t('nav.signup')}</Link>
              </Button>
            </>
          )}
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 -mr-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Menu sluiten' : 'Menu openen'}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.mainNavigation', 'Hoofdnavigatie')}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-border bg-background overflow-y-auto max-h-[calc(100svh-3.5rem)] pb-[calc(5rem+env(safe-area-inset-bottom))]"
          >
            <nav className="container py-4 flex flex-col gap-2 px-4">
              <Link to="/search" className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileMenuOpen(false)}>
                <Search className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{t('nav.discover')}</span>
              </Link>
              <Link to="/collections" className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileMenuOpen(false)}>
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{t('nav.collections')}</span>
              </Link>
              <Link to="/events" className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileMenuOpen(false)}>
                <PartyPopper className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{t('nav.events', 'Events & Acties')}</span>
              </Link>

              {user && (
                <>
                  <Link to={dashboardLink} className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileMenuOpen(false)}>
                    <DashboardIcon className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{dashboardLabel}</span>
                  </Link>
                  <Link to="/favorites" className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileMenuOpen(false)}>
                    <Heart className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{t('nav.favorites')}</span>
                  </Link>
                  <Link to="/profile" className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileMenuOpen(false)}>
                    <User className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{t('home.myProfile')}</span>
                  </Link>
                  <Link to="/insights" className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileMenuOpen(false)}>
                    <BarChart3 className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{t('nav.insights')}</span>
                  </Link>
                  {isAdmin && (
                    <Link to="/admin" className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileMenuOpen(false)}>
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Admin Panel</span>
                    </Link>
                  )}
                </>
              )}

              {/* Mobile Language Switcher */}
              <div className="px-3 py-3">
                <p className="text-xs text-muted-foreground mb-2">{t('home.language')}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => i18n.changeLanguage(lang.code)}
                      aria-label={`${t('home.language', 'Taal')}: ${lang.label}`}
                      aria-pressed={i18n.language === lang.code}
                      className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                        i18n.language === lang.code
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-muted-foreground">{t('common.theme', 'Thema')}</span>
                <ThemeToggle />
              </div>

              <div className="border-t border-border my-2" />

              {user ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 px-3 py-2 bg-muted rounded-lg">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={avatarUrl || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground">{userInitials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.user_metadata?.name || t('home.user')}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <Button variant="destructive" onClick={handleSignOut} className="w-full">
                    <LogOut className="mr-2 h-4 w-4" />
                    {t('nav.logout')}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" asChild>
                    <Link to="/login?tab=login" onClick={() => setMobileMenuOpen(false)}>{t('nav.login')}</Link>
                  </Button>
                  <Button className="flex-1" asChild>
                    <Link to="/login?tab=signup" onClick={() => setMobileMenuOpen(false)}>{t('nav.signup')}</Link>
                  </Button>
                </div>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
