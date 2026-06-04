import { Link } from 'react-router-dom';
import { Search, FolderOpen, Heart, Sparkles } from 'lucide-react';

export function QuickActions() {
  const actions = [
    { icon: Search, label: 'Ontdek', to: '/search', color: 'bg-primary/10 text-primary' },
    { icon: FolderOpen, label: 'Mijn lijstjes', to: '/lists', color: 'bg-blue-500/10 text-blue-500' },
    { icon: Heart, label: 'Favorieten', to: '/favorites', color: 'bg-rose-500/10 text-rose-500' },
    { icon: Sparkles, label: 'Inzichten', to: '/insights', color: 'bg-purple-500/10 text-purple-500' },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3">
      {actions.map((action) => (
        <Link
          key={action.to}
          to={action.to}
          className="flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-center group"
        >
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
            <action.icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <span className="text-[11px] sm:text-sm font-medium">{action.label}</span>
        </Link>
      ))}
    </div>
  );
}
