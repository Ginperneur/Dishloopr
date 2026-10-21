import { Header } from './Header';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';
import { lazy } from 'react';
import { AfterIdle } from '@/components/util/AfterIdle';

const SupportChat = lazy(() => import('@/components/support/SupportChat').then((m) => ({ default: m.SupportChat })));

interface LayoutProps {
  children: React.ReactNode;
  showFooter?: boolean;
}

export function Layout({ children, showFooter = true }: LayoutProps) {
  return (
    <div className="min-h-[100svh] flex flex-col w-full max-w-full overflow-x-hidden">
      {/* Skip to content - accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Ga naar inhoud
      </a>
      <Header />
      <main 
        id="main-content"
        className="flex-1 w-full max-w-full overflow-x-hidden page-transition has-bottom-nav"
      >
        {children}
      </main>
      {showFooter && <Footer />}
      <BottomNav />
      <AfterIdle timeout={3000}><SupportChat /></AfterIdle>
    </div>
  );
}
