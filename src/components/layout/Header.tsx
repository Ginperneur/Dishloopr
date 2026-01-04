import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Menu, X, LogOut, User, Store } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/dishloopr-logo.png';

const languages = [
  { code: 'nl', label: 'NL' },
  { code: 'en', label: 'EN' },
  { code: 'de', label: 'DE' },
  { code: 'es', label: 'ES' },
  { code: 'fr', label: 'FR' },
];

export function Header() {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="Dishloopr" className="h-10 w-auto" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            to="/search"
            className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
          >
            {t('nav.discover')}
          </Link>

          {/* Language Switcher */}
          <div className="flex items-center gap-1 border border-border rounded-lg px-1 py-1">
            {languages.map((lang) => (
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

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
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
                  <Link to="/owner" className="cursor-pointer">
                    <Store className="mr-2 h-4 w-4" />
                    Owner Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    {t('nav.dashboard')}
                  </Link>
                </DropdownMenuItem>
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
          className="md:hidden p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden border-t border-border bg-background"
        >
          <nav className="container py-4 flex flex-col gap-4">
            <Link
              to="/search"
              className="text-sm font-medium py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.discover')}
            </Link>

            {/* Mobile Language Switcher */}
            <div className="flex items-center gap-2">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    i18n.changeLanguage(lang.code);
                    setMobileMenuOpen(false);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    i18n.language === lang.code
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            {user ? (
              <div className="flex flex-col gap-3 pt-2">
                <div className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{user.user_metadata?.name || 'Gebruiker'}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <Button variant="outline" asChild>
                  <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                    {t('nav.dashboard')}
                  </Link>
                </Button>
                <Button variant="destructive" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Uitloggen
                </Button>
              </div>
            ) : (
              <div className="flex gap-3 pt-2">
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
    </motion.header>
  );
}
