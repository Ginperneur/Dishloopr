import { useState } from 'react';
import { Compass, Sparkles, Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SurpriseMe } from '@/components/ai/SurpriseMe';
import { FoodMatchFlow } from './FoodMatchFlow';

export function RestaurantFinder() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'choose' | 'match'>('choose');
  const [surprise, setSurprise] = useState(false);
  const close = (v: boolean) => { setOpen(v); if (!v) setMode('choose'); };

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} className="group text-primary hover:text-primary hover:bg-primary/5 font-medium min-h-[44px]">
        <Compass className="w-4 h-4 mr-2 transition-transform group-hover:rotate-45" />
        {t('ai.restaurantFinder', 'Restaurant Finder')}
      </Button>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-md rounded-3xl border-primary/20 p-6 sm:p-8 max-h-[92vh] overflow-y-auto">
          {mode === 'choose' ? (
            <>
              <div className="text-center mb-6">
                <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-[0_10px_30px_-8px_hsl(var(--primary)/0.6)]">
                  <Compass className="h-7 w-7 text-primary-foreground" />
                </div>
                <DialogTitle className="font-display text-3xl font-bold tracking-tight">Restaurant Finder</DialogTitle>
                <DialogDescription className="mt-1">Hoe wil je jouw plek vinden?</DialogDescription>
              </div>
              <div className="grid gap-3">
                <button onClick={() => { close(false); setSurprise(true); }} className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left transition hover:border-primary/50 hover:shadow-lg">
                  <span className="h-12 w-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center"><Sparkles className="h-6 w-6 text-primary" /></span>
                  <span><span className="block font-display text-lg font-semibold">Verras me</span><span className="text-sm text-muted-foreground">Laat ons een gerecht voor je kiezen</span></span>
                </button>
                <button onClick={() => setMode('match')} className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card p-5 text-left transition hover:shadow-[0_12px_32px_-12px_hsl(var(--primary)/0.7)]">
                  <span className="h-12 w-12 shrink-0 rounded-xl bg-primary flex items-center justify-center"><Heart className="h-6 w-6 text-primary-foreground fill-current" /></span>
                  <span><span className="block font-display text-lg font-semibold">Food Match</span><span className="text-sm text-muted-foreground">Swipe alleen of met vrienden naar 2 restaurants</span></span>
                </button>
              </div>
            </>
          ) : (
            <>
              <DialogTitle className="sr-only">Food Match</DialogTitle>
              <DialogDescription className="sr-only">Beantwoord een paar vragen voor twee restaurantsuggesties</DialogDescription>
              <FoodMatchFlow onBack={() => setMode('choose')} />
            </>
          )}
        </DialogContent>
      </Dialog>

      <SurpriseMe open={surprise} onClose={() => setSurprise(false)} />
    </>
  );
}
