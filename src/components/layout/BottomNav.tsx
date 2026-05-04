import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Heart, User, Map } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/search', icon: Search, label: 'Zoeken' },
  { path: '/search?view=map', icon: Map, label: 'Kaart' },
  { path: '/favorites', icon: Heart, label: 'Favorieten', requiresAuth: true },
  { path: '/profile', icon: User, label: 'Profiel', requiresAuth: true },
];

export function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();

  // Don't show on admin, login, or restaurant pages
  const hiddenPaths = ['/admin', '/login', '/dashboard', '/forgot-password', '/reset-password', '/email-confirm'];
  if (hiddenPaths.some(p => location.pathname.startsWith(p))) return null;

  const items = NAV_ITEMS.filter(item => !item.requiresAuth || user);

  // Add login item if not authenticated
  if (!user) {
    items.push({ path: '/login', icon: User, label: 'Inloggen' });
  }

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-lg border-t border-border safe-area-bottom"
      aria-label="Mobiele navigatie"
    >
      <div className="flex items-center justify-around h-14 px-1">
        {items.map((item) => {
          // Strip query for path comparison
          const itemPath = item.path.split('?')[0];
          const itemQuery = item.path.includes('?view=map');
          const currentQuery = location.search.includes('view=map');
          let isActive = false;
          if (itemQuery) {
            // Map tab is active only when on /search with view=map
            isActive = location.pathname === '/search' && currentQuery;
          } else if (itemPath === '/search') {
            // Search tab is active on /search WITHOUT view=map
            isActive = location.pathname === '/search' && !currentQuery;
          } else {
            isActive = location.pathname === itemPath ||
              (itemPath !== '/' && location.pathname.startsWith(itemPath));
          }
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 min-w-[3rem] py-1 px-2 rounded-lg transition-colors',
                'active:scale-95 touch-manipulation',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground'
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5px]')} />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
