import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, FolderOpen, Trash2, Globe, Lock, Loader2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { useUserLists } from '@/hooks/useUserLists';
import { useAuth } from '@/contexts/AuthContext';

export default function ListsPage() {
  const { user } = useAuth();
  const { lists, loading, createList, deleteList } = useUserLists();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📍');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    const result = await createList({ name, emoji, description, is_public: isPublic });
    setSubmitting(false);
    if (result) {
      setOpen(false);
      setName('');
      setEmoji('📍');
      setDescription('');
      setIsPublic(false);
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="container py-16 text-center max-w-md mx-auto">
          <FolderOpen className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Mijn lijstjes</h1>
          <p className="text-muted-foreground mb-6">
            Log in om je eigen lijstjes te maken: "Nog te bezoeken", "Rotterdam", "Date night"…
          </p>
          <Button asChild>
            <Link to="/login">Inloggen</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEOHead title="Mijn lijstjes | Dishloopr" description="Beheer je eigen restaurantlijstjes." noindex />
      <div className="container py-6 md:py-12">
        <div className="flex items-start justify-between gap-4 mb-6 md:mb-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl md:text-4xl font-bold mb-1">Mijn lijstjes</h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Verzamel restaurants in eigen mapjes — bv. <em>Nog te bezoeken</em>, <em>Rotterdam</em>, <em>Date night</em>.
            </p>
          </motion.div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-1.5" />
                Nieuw
              </Button>
            </DialogTrigger>
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
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : lists.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-muted rounded-2xl">
            <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium mb-1">Nog geen lijsten</p>
            <p className="text-sm text-muted-foreground mb-4">Maak je eerste lijst om restaurants te verzamelen.</p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Eerste lijst maken
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lists.map((l, i) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="group relative rounded-2xl border bg-card hover:border-primary/40 transition-colors"
              >
                <Link to={`/lists/${l.id}`} className="block p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{l.emoji || '📍'}</span>
                    <h3 className="font-bold text-lg line-clamp-1 flex-1">{l.name}</h3>
                  </div>
                  {l.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{l.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      {l.item_count || 0} restaurant{(l.item_count || 0) === 1 ? '' : 's'}
                    </span>
                    <span className="flex items-center gap-1">
                      {l.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      {l.is_public ? 'Openbaar' : 'Privé'}
                    </span>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Lijst "${l.name}" verwijderen?`)) deleteList(l.id);
                  }}
                  className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                  aria-label="Verwijder lijst"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}