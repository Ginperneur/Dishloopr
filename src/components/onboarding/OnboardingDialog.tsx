import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Search, Heart, Star, UtensilsCrossed, ArrowRight, Check } from 'lucide-react';

const STEPS = [
  {
    icon: Search,
    title: 'Zoek op gerecht',
    description: 'Typ het gerecht waar je zin in hebt en ontdek de beste restaurants bij jou in de buurt.',
  },
  {
    icon: Star,
    title: 'Lees & schrijf reviews',
    description: 'Deel je ervaringen en help anderen de beste plek te vinden.',
  },
  {
    icon: Heart,
    title: 'Sla favorieten op',
    description: 'Bewaar je lievelingsrestaurants en bouw je persoonlijke foodguide.',
  },
  {
    icon: UtensilsCrossed,
    title: 'Klaar om te ontdekken!',
    description: 'Je bent helemaal klaar. Begin met het zoeken naar je favoriete gerecht!',
  },
];

export function OnboardingDialog() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user) return;
    
    const checkOnboarding = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', user.id)
        .single();

      if (data) {
        const createdAt = new Date(data.created_at);
        const now = new Date();
        const diffMs = now.getTime() - createdAt.getTime();
        const diffMinutes = diffMs / (1000 * 60);
        
        // Show onboarding if account created less than 2 minutes ago
        // and hasn't been shown before
        const shown = localStorage.getItem(`onboarding-shown-${user.id}`);
        if (diffMinutes < 2 && !shown) {
          setOpen(true);
          localStorage.setItem(`onboarding-shown-${user.id}`, 'true');
        }
      }
    };

    checkOnboarding();
  }, [user]);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      setOpen(false);
      navigate('/search');
    }
  };

  const handleSkip = () => {
    setOpen(false);
  };

  const currentStep = STEPS[step];
  const Icon = currentStep.icon;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="p-8 text-center"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
              <Icon className="h-8 w-8 text-primary" />
            </div>
            
            <h2 className="text-xl font-bold mb-2">{currentStep.title}</h2>
            <p className="text-muted-foreground mb-8">{currentStep.description}</p>

            {/* Step indicators */}
            <div className="flex justify-center gap-2 mb-6">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all ${
                    i === step ? 'w-8 bg-primary' : i < step ? 'w-2 bg-primary/50' : 'w-2 bg-muted'
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-3 justify-center">
              {step < STEPS.length - 1 && (
                <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
                  Overslaan
                </Button>
              )}
              <Button onClick={handleNext} className="gap-2 min-w-[120px]">
                {step === STEPS.length - 1 ? (
                  <>
                    <Check className="h-4 w-4" />
                    Start ontdekken
                  </>
                ) : (
                  <>
                    Volgende
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
