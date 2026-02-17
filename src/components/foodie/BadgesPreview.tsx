import { Link } from 'react-router-dom';
import { Award, ChevronRight } from 'lucide-react';

interface Badge {
  badge_type: string;
  progress: number;
  target: number;
  earned_at: string | null;
}

interface BadgesPreviewProps {
  badges: Badge[];
}

export function BadgesPreview({ badges }: BadgesPreviewProps) {
  if (badges.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-base sm:text-lg font-semibold">Badges</h2>
        <Link to="/insights?tab=badges" className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1">
          Alle <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {badges.slice(0, 6).map((badge) => {
          const isEarned = !!badge.earned_at;
          return (
            <div
              key={badge.badge_type}
              className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center ${
                isEarned ? 'border-primary/30 bg-primary/5' : 'border-border bg-card opacity-50'
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                isEarned ? 'bg-primary/20' : 'bg-muted'
              }`}>
                <Award className={`h-3.5 w-3.5 ${isEarned ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground">
                {badge.progress}/{badge.target}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
