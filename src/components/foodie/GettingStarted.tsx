import { Link } from 'react-router-dom';
import { Check, Search, Star, Heart, UserCircle } from 'lucide-react';

interface GettingStartedProps {
  hasProfile: boolean;
  hasReviews: boolean;
  hasFavorites: boolean;
}

export function GettingStarted({ hasProfile, hasReviews, hasFavorites }: GettingStartedProps) {
  const steps = [
    { label: 'Maak je profiel aan', icon: UserCircle, done: hasProfile, to: '/profile' },
    { label: 'Zoek je eerste restaurant', icon: Search, done: hasReviews || hasFavorites, to: '/search' },
    { label: 'Schrijf je eerste review', icon: Star, done: hasReviews, to: '/search' },
    { label: 'Sla een favoriet op', icon: Heart, done: hasFavorites, to: '/search' },
  ];

  const completedCount = steps.filter(s => s.done).length;
  
  // Don't show if all completed
  if (completedCount === steps.length) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm sm:text-base font-semibold">Aan de slag 🚀</h2>
        <span className="text-xs text-muted-foreground">{completedCount}/{steps.length}</span>
      </div>
      <div className="space-y-2">
        {steps.map((step) => (
          <Link
            key={step.label}
            to={step.to}
            className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
              step.done 
                ? 'bg-primary/10 text-muted-foreground' 
                : 'bg-card border border-border hover:border-primary/30'
            }`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
              step.done ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}>
              {step.done ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <step.icon className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <span className={`text-sm ${step.done ? 'line-through' : 'font-medium'}`}>
              {step.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
