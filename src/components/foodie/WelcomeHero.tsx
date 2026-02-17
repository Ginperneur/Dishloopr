import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WelcomeHeroProps {
  name: string | null;
  avatarUrl: string | null;
  email: string | undefined;
  level: string;
  levelLabel: string;
  levelColor: string;
  nextLevelLabel: string;
  reviewCount: number;
  nextLevelThreshold: number;
  hasNextLevel: boolean;
}

export function WelcomeHero({
  name, avatarUrl, email, level, levelLabel, levelColor,
  nextLevelLabel, reviewCount, nextLevelThreshold, hasNextLevel,
}: WelcomeHeroProps) {
  const userInitials = name
    ? name.slice(0, 2).toUpperCase()
    : email?.slice(0, 2).toUpperCase() || 'U';

  const levelProgress = Math.min((reviewCount / nextLevelThreshold) * 100, 100);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
      {/* Subtle gradient accent */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/3 pointer-events-none" />
      
      <div className="relative p-5 sm:p-6 md:p-8">
        <div className="flex items-start gap-4 sm:gap-5">
          <Avatar className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 ring-2 ring-primary/20">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-lg sm:text-xl font-bold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">
                Hoi, {name || 'Foodie'}!
              </h1>
              <Badge className={`${levelColor} shrink-0 text-[10px] sm:text-xs`}>
                {levelLabel}
              </Badge>
            </div>
            
            {hasNextLevel && (
              <div className="mt-2 max-w-xs">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                  <span>{Math.max(0, nextLevelThreshold - reviewCount)} reviews tot {nextLevelLabel}</span>
                  <span className="font-medium">{reviewCount}/{nextLevelThreshold}</span>
                </div>
                <Progress value={levelProgress} className="h-1.5" />
              </div>
            )}
          </div>

          <Button variant="ghost" size="icon" asChild className="shrink-0 hidden sm:flex">
            <Link to="/profile">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
