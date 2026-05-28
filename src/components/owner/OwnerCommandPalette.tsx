import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Megaphone,
  TrendingUp,
  Receipt,
  Store,
  ExternalLink,
  Share2,
  Plus,
  Search,
} from 'lucide-react';

export interface OwnerCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab: string;
  onChangeTab: (tab: string) => void;
  restaurants: { id: string; name: string; slug: string }[];
  selectedRestaurantId?: string;
  onSelectRestaurant: (id: string) => void;
  onOpenShare?: () => void;
}

const TABS = [
  { id: 'overview', label: 'Overzicht', icon: LayoutDashboard, shortcut: '1' },
  { id: 'content', label: 'Content', icon: FileText, shortcut: '2' },
  { id: 'insights', label: 'Inzichten', icon: BarChart3, shortcut: '3' },
  { id: 'marketing', label: 'Marketing', icon: Megaphone, shortcut: '4' },
  { id: 'market', label: 'Markt', icon: TrendingUp, shortcut: '5' },
  { id: 'invoices', label: 'Facturen', icon: Receipt, shortcut: '6' },
];

export function OwnerCommandPalette({
  open,
  onOpenChange,
  activeTab,
  onChangeTab,
  restaurants,
  selectedRestaurantId,
  onSelectRestaurant,
  onOpenShare,
}: OwnerCommandPaletteProps) {
  const navigate = useNavigate();
  const selected = restaurants.find((r) => r.id === selectedRestaurantId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (!open && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        const tab = TABS.find((t) => t.shortcut === e.key);
        if (tab) {
          e.preventDefault();
          onChangeTab(tab.id);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onChangeTab, onOpenChange]);

  const run = (fn: () => void) => {
    fn();
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Zoek een sectie, restaurant of actie..." />
      <CommandList>
        <CommandEmpty>Geen resultaten gevonden.</CommandEmpty>

        <CommandGroup heading="Navigatie">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <CommandItem
                key={tab.id}
                value={`tab-${tab.id} ${tab.label}`}
                onSelect={() => run(() => onChangeTab(tab.id))}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>{tab.label}</span>
                {isActive && (
                  <span className="ml-2 text-xs text-muted-foreground">(huidig)</span>
                )}
                <CommandShortcut>⌘⇧{tab.shortcut}</CommandShortcut>
              </CommandItem>
            );
          })}
        </CommandGroup>

        {restaurants.length > 1 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Wissel restaurant">
              {restaurants.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`restaurant-${r.name}`}
                  onSelect={() => run(() => onSelectRestaurant(r.id))}
                >
                  <Store className="mr-2 h-4 w-4" />
                  <span className="truncate">{r.name}</span>
                  {r.id === selectedRestaurantId && (
                    <span className="ml-2 text-xs text-muted-foreground">(actief)</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Acties">
          {selected && (
            <CommandItem
              value="open-public-page"
              onSelect={() => run(() => navigate(`/restaurant/${selected.slug}`))}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              <span>Open publieke pagina</span>
            </CommandItem>
          )}
          {onOpenShare && (
            <CommandItem value="share-restaurant" onSelect={() => run(onOpenShare)}>
              <Share2 className="mr-2 h-4 w-4" />
              <span>Deel restaurant</span>
            </CommandItem>
          )}
          <CommandItem
            value="add-restaurant"
            onSelect={() => run(() => navigate('/restaurant-toevoegen'))}
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>Voeg restaurant toe</span>
          </CommandItem>
          <CommandItem
            value="search-public"
            onSelect={() => run(() => navigate('/zoeken'))}
          >
            <Search className="mr-2 h-4 w-4" />
            <span>Open zoekpagina</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}