import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogOut, User, Store, Shield, Heart, Search, BarChart3 } from 'lucide-react';
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })
        .then(({ data }) => setIsAdmin(data === true));
      
      // Fetch avatar
      supabase.from('profiles').select('avatar_url').eq('id', user.id).single()
        .then(({ data }) => setAvatarUrl(data?.avatar_url || null));
    } else {
      setIsAdmin(false);
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

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="container flex h-14 md:h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center shrink-0 mr-8" aria-label="Ga naar home">
          <img
            src={logo}
            alt="Dishloopr"
            className="h-9 md:h-11 w-auto"
            loading="eager"
            decoding="async"
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            to="/search"
            className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
          >
            {t('nav.discover')}
          </Link>
          <Link
            to="/collections"
            className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
          >
            Collections
          </Link>
          {user && (
            <Link
              to="/favorites"
              className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Heart className="h-4 w-4" />
              {t('nav.favorites')}
            </Link>
          )}
          {user && (
            <Link
              to="/dashboard"
              className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/admin"
              className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          )}

          {/* Language Switcher */}
          <div className="flex items-center gap-1 border border-border rounded-lg px-1 py-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => i18n.changeLanguage(lang.code)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  i18n.language === lang.code
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          {/* Theme Toggle */}
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
                  <Link to="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Mijn Profiel
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
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/for-restaurants" className="cursor-pointer">
                    <Store className="mr-2 h-4 w-4" />
                    {t('footer.forRestaurants')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" className="cursor-pointer">
                    <Store className="mr-2 h-4 w-4" />
                    {t('nav.dashboard')}
                  </Link>
                </DropdownMenuItem>
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
                  Uitloggen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to="/login">{t('nav.login')}</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/login">{t('nav.signup')}</Link>
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
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-border bg-background overflow-hidden"
          >
            <nav className="container py-4 flex flex-col gap-2">
              <Link
                to="/search"
                className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Search className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{t('nav.discover')}</span>
              </Link>

              {user && (
                <>
                  <Link
                    to="/favorites"
                    className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Heart className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{t('nav.favorites')}</span>
                  </Link>
                  <Link
                    to="/profile"
                    className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <User className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">Mijn Profiel</span>
                  </Link>
                  <Link
                    to="/insights"
                    className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <BarChart3 className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">Inzichten</span>
                  </Link>
                  <Link
                    to="/dashboard"
                    className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Store className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{t('nav.dashboard')}</span>
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Admin Panel</span>
                    </Link>
                  )}
                </>
              )}

              {/* Mobile Language Switcher */}
              <div className="px-3 py-3">
                <p className="text-xs text-muted-foreground mb-2">Taal</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        i18n.changeLanguage(lang.code);
                      }}
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

              <div className="border-t border-border my-2" />

              {user ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 px-3 py-2 bg-muted rounded-lg">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={avatarUrl || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.user_metadata?.name || 'Gebruiker'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <Button variant="destructive" onClick={handleSignOut} className="w-full">
                    <LogOut className="mr-2 h-4 w-4" />
                    Uitloggen
                  </Button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" asChild>
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                      {t('nav.login')}
                    </Link>
                  </Button>
                  <Button className="flex-1" asChild>
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                      {t('nav.signup')}
                    </Link>
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
