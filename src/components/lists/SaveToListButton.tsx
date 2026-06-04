import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookmarkPlus, Check, Plus, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUserLists } from '@/hooks/useUserLists';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface SaveToListButtonProps {
  restaurantId: string;
  className?: string;
  variant?: 'overlay' | 'inline';
}

export function SaveToListButton({ restaurantId, className, variant = 'overlay' }: SaveToListButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { lists, addToList, removeFromList, createList, loading } = useUserLists();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('📍');
  const [busy, setBusy] = useState<string | null>(null);

  const isIn = (listId: string) => lists.find((l) => l.id === listId)?.restaurant_ids?.includes(restaurantId);
  const savedCount = lists.filter((l) => l.restaurant_ids?.includes(restaurantId)).length;

  const handleTrigger = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error('Log in om in lijsten op te slaan');
      navigate('/login');
      return;
    }
    setOpen((v) => !v);
  };

  const toggleList = async (listId: string) => {
    setBusy(listId);
    if (isIn(listId)) {
      await removeFromList(listId, restaurantId);
    } else {
      await addToList(listId, restaurantId);
      toast.success('Opgeslagen in lijst');
    }
    setBusy(null);
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    const created = await createList({ name: trimmed, emoji: newEmoji });
    if (created) {
      await addToList(created.id, restaurantId);
      setNewName('');
      setNewEmoji('📍');
    }
    setCreating(false);
  };

  const overlayBtn = (
    <motion.button
      onClick={handleTrigger}
      whileTap={{ scale: 0.9 }}
      aria-label="Opslaan in lijst"
      className={`absolute top-3 right-14 p-2 rounded-full backdrop-blur transition-colors ${
        savedCount > 0 ? 'bg-primary text-primary-foreground' : 'bg-background/80 hover:bg-background'
      } ${className || ''}`}
    >
      <BookmarkPlus className="h-4 w-4" />
    </motion.button>
  );

  const inlineBtn = (
    <Button
      type="button"
      variant={savedCount > 0 ? 'default' : 'outline'}
      size="sm"
      onClick={handleTrigger}
      className={className}
    >
      <BookmarkPlus className="h-4 w-4 mr-1.5" />
      {savedCount > 0 ? `In ${savedCount} lijst${savedCount > 1 ? 'en' : ''}` : 'In lijst'}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{variant === 'overlay' ? overlayBtn : inlineBtn}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-0"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="p-3 border-b">
          <h4 className="font-semibold text-sm">Opslaan in lijst</h4>
          <p className="text-xs text-muted-foreground mt-0.5">Bewaar dit restaurant in een eigen mapje.</p>
        </div>

        <div className="max-h-60 overflow-y-auto py-1">
          {loading ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Laden…
            </div>
          ) : lists.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">Nog geen lijsten. Maak hieronder je eerste.</p>
          ) : (
            lists.map((l) => {
              const inList = !!isIn(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggleList(l.id)}
                  disabled={busy === l.id}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{l.emoji || '📍'}</span>
                    <span className="truncate">{l.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      ({l.item_count || 0})
                    </span>
                  </span>
                  {busy === l.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : inList ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="p-3 border-t space-y-2">
          <div className="flex gap-2">
            <Input
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value.slice(0, 4))}
              className="w-12 text-center text-base"
              maxLength={4}
            />
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nieuwe lijst (bv. Rotterdam)"
              maxLength={60}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={!newName.trim() || creating}
            onClick={handleCreate}
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Maak nieuwe lijst
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}