import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Shield,
  UtensilsCrossed,
  BarChart3,
  Rocket,
  Crown,
  PartyPopper,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

interface OwnerTourProps {
  /** Stable per-user key so we only show the tour once after claim. */
  userId: string | undefined;
  /** When true, force-show even if previously dismissed (e.g. from a help button). */
  forceOpen?: boolean;
  onClose?: () => void;
}

const STEPS = [
  {
    icon: Shield,
    title: 'Welkom! Begin met verifiëren',
    body: 'Bevestig dat jij de eigenaar bent via domein, Google Business of een kleine eenmalige betaling. Dit ontgrendelt analytics en aankopen.',
  },
  {
    icon: UtensilsCrossed,
    title: 'Bevestig je gerechten & menu',
    body: 'Ga naar Content om je gerechten te bevestigen, foto\'s te uploaden en je menu compleet te maken. Hoe rijker je profiel, hoe beter je vindbaar bent.',
  },
  {
    icon: BarChart3,
    title: 'Bekijk je Inzichten',
    body: 'Onder Inzichten zie je weergaven, kliks, zoektermen en optimalisatietips. Inzichten + Markt zit in Owner Pro (€29/maand of €290/jaar).',
  },
  {
    icon: Rocket,
    title: 'Word zichtbaarder via Promoties',
    body: 'In het Promoties-tabblad activeer je Premium plekken, ambiance add-ons, listing-boosts en nieuwsbriefplaatsingen. Alle prijzen staan bovenaan.',
  },
  {
    icon: Crown,
    title: 'Owner Pro = alles erin',
    body: 'Eén Pro-abonnement ontgrendelt Inzichten, Markt, onbeperkte tags en extra automatisering. Featured plekken en listings zijn aparte producten.',
  },
  {
    icon: PartyPopper,
    title: 'Klaar — succes!',
    body: 'Je kunt deze rondleiding altijd opnieuw openen via het help-icoon (?) rechtsboven.',
  },
] as const;

export function OwnerTour({ userId, forceOpen, onClose }: OwnerTourProps) {
  const storageKey = userId ? `dishloopr.owner-tour.${userId}` : null;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setStep(0);
      setOpen(true);
      return;
    }
    if (!storageKey) return;
    if (typeof window === 'undefined') return;
    const seen = window.localStorage.getItem(storageKey);
    if (!seen) {
      setStep(0);
      setOpen(true);
    }
  }, [storageKey, forceOpen]);

  const finish = () => {
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, '1');
      } catch {}
    }
    setOpen(false);
    onClose?.();
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? finish() : setOpen(true))}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary text-primary-foreground inline-flex items-center justify-center shadow-lg shadow-primary/30 mb-2">
            <Icon className="h-7 w-7" />
          </div>
          <DialogTitle className="text-center text-xl">{current.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground text-center leading-relaxed px-2">
          {current.body}
        </p>

        {/* Dots */}
        <div className="flex items-center justify-center gap-1.5 py-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Terug
          </Button>
          <Button variant="ghost" size="sm" onClick={finish}>
            Overslaan
          </Button>
          {isLast ? (
            <Button size="sm" onClick={finish}>
              Aan de slag
            </Button>
          ) : (
            <Button size="sm" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              Volgende <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}