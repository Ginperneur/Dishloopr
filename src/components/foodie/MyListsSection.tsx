import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ChevronRight, FolderOpen, Loader2, Globe, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUserLists } from '@/hooks/useUserLists';

const MAX_VISIBLE = 6;

export function MyListsSection() {
  const { lists, loading, createList } = useUserLists();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📍');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setEmoji('📍');
    setDescription('');
    setIsPublic(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    const result = await createList({ name, emoji, description, is_public: isPublic });
    setSubmitting(false);
    if (result) {
      setOpen(false);
      resetForm();
    }
  };

  const visible = lists.slice(0, MAX_VISIBLE);
  const hasMore = lists.length > MAX_VISIBLE;

  return (
    <section aria-labelledby="my-lists-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="my-lists-heading" className="text-lg sm:text-xl font-semibold">
          Mijn lijstjes
        </h2>
        {lists.length > 0 && (
          <Link
            to="/lists"
            className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1 min-h-[44px] px-1"
          >
            {hasMore ? 'Alle lijsten' : 'Beheer'} <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 sm:h-28 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-3">
            <FolderOpen className="w-6 h-6 text-primary" />
          </div>
          <p className="font-medium mb-1 text-sm">Nog geen lijstjes</p>
          <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
            Verzamel restaurants in eigen mapjes — bv. <em>Nog te bezoeken</em>, <em>Date night</em>.
          </p>
          <Button onClick={() => setOpen(true)} className="min-h-[44px]">
            <Plus className="w-4 h-4 mr-1.5" /> Maak je eerste lijst
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {visible.map((l) => (
            <Link
              key={l.id}
              to={`/lists/${l.id}`}
              className="group relative rounded-2xl border border-border bg-card hover:border-primary/40 transition-colors p-3 sm:p-4 min-h-[104px] flex flex-col justify-between"
            >
              <span
                className="absolute left-0 top-3 bottom-3 w-1 rounded-r bg-primary"
                aria-hidden
              />
              <div className="flex items-start gap-2 pl-2">
                <span className="text-xl sm:text-2xl leading-none">{l.emoji || '📍'}</span>
                <h3 className="font-semibold text-sm sm:text-base line-clamp-2 flex-1">
                  {l.name}
                </h3>
              </div>
              <div className="flex items-center justify-between text-[11px] sm:text-xs text-muted-foreground pl-2 mt-2">
                <span>
                  {l.item_count || 0} restaurant{(l.item_count || 0) === 1 ? '' : 's'}
                </span>
                <span className="flex items-center gap-1">
                  {l.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                </span>
              </div>
            </Link>
          ))}

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors p-3 sm:p-4 min-h-[104px] flex flex-col items-center justify-center text-primary gap-1.5"
            aria-label="Nieuwe lijst maken"
          >
            <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-xs sm:text-sm font-medium">Nieuwe lijst</span>
          </button>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe lijst</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
                className="w-14 text-center text-lg"
                aria-label="Emoji"
              />
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Naam (bv. Rotterdam)"
                maxLength={60}
              />
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschrijving (optioneel)"
              maxLength={280}
              rows={2}
            />
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm">Openbaar</Label>
                <p className="text-xs text-muted-foreground">
                  Iedereen met de link kan deze lijst zien.
                </p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuleer
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Aanmaken
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}