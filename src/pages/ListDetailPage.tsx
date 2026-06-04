import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Globe, Lock, Loader2, Share2, FolderOpen, Pencil } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DatabaseRestaurantCard } from '@/components/restaurant/DatabaseRestaurantCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserLists } from '@/hooks/useUserLists';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

import { openConfirm } from '@/components/ui/confirm-dialog';
type Restaurant = Database['public']['Tables']['restaurants']['Row'];

interface ListMeta {
  id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  is_public: boolean;
  user_id: string;
}

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { updateList, deleteList } = useUserLists();

  const [list, setList] = useState<ListMeta | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📍');
  const [isPublic, setIsPublic] = useState(false);

  const isOwner = !!user && list?.user_id === user.id;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      setLoading(true);
      const { data: listData, error: listErr } = await supabase
        .from('user_lists')
        .select('id, name, emoji, description, is_public, user_id')
        .eq('id', id)
        .maybeSingle();
      if (cancelled) return;
      if (listErr || !listData) {
        setLoading(false);
        return;
      }
      setList(listData as ListMeta);
      setName(listData.name);
      setEmoji(listData.emoji || '📍');
      setIsPublic(listData.is_public);

      const { data: items } = await supabase
        .from('user_list_items')
        .select('restaurant_id, added_at')
        .eq('list_id', id)
        .order('added_at', { ascending: false });
      const ids = (items || []).map((i) => i.restaurant_id);
      if (ids.length) {
        const { data: rests } = await supabase.from('restaurants').select('*').in('id', ids);
        if (!cancelled) {
          const orderMap = new Map(ids.map((rid, idx) => [rid, idx]));
          setRestaurants(
            (rests || []).sort(
              (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)
            ) as Restaurant[]
          );
        }
      } else if (!cancelled) {
        setRestaurants([]);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSave = async () => {
    if (!list) return;
    const ok = await updateList(list.id, { name: name.trim(), emoji, is_public: isPublic });
    if (ok) {
      setList({ ...list, name: name.trim(), emoji, is_public: isPublic });
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!list) return;
    if (!(await openConfirm(`Lijst "${list.name}" verwijderen?`))) return;
    const ok = await deleteList(list.id);
    if (ok) navigate('/lists');
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link gekopieerd');
    } catch {
      toast.error('Kon link niet kopiëren');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!list) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <h1 className="text-xl font-semibold mb-2">Lijst niet gevonden</h1>
          <p className="text-muted-foreground mb-4">Deze lijst bestaat niet of is privé.</p>
          <Button asChild>
            <Link to="/lists">Terug naar mijn lijstjes</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEOHead
        title={`${list.name} | Dishloopr`}
        description={list.description || `Restaurantlijst op Dishloopr.`}
        noindex={!list.is_public}
      />
      <div className="container py-6 md:py-10">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/lists">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Mijn lijstjes
          </Link>
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-start justify-between gap-3 mb-6"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-3xl">{list.emoji || '📍'}</span>
              <h1 className="text-2xl md:text-3xl font-bold">{list.name}</h1>
            </div>
            {list.description && (
              <p className="text-muted-foreground text-sm md:text-base">{list.description}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
              <span>{restaurants.length} restaurant{restaurants.length === 1 ? '' : 's'}</span>
              <span className="flex items-center gap-1">
                {list.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {list.is_public ? 'Openbaar' : 'Privé'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {list.is_public && (
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-1.5" /> Deel
              </Button>
            )}
            {isOwner && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="w-4 h-4 mr-1.5" /> Bewerk
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive">
                  Verwijder
                </Button>
              </>
            )}
          </div>
        </motion.div>

        {restaurants.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-muted rounded-2xl">
            <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium mb-1">Deze lijst is nog leeg</p>
            <p className="text-sm text-muted-foreground mb-4">
              Tik op het bladwijzer-icoon bij een restaurant om hem hier toe te voegen.
            </p>
            <Button asChild>
              <Link to="/search">Restaurants zoeken</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {restaurants.map((r, i) => (
              <DatabaseRestaurantCard key={r.id} restaurant={r} index={i} />
            ))}
          </div>
        )}
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lijst bewerken</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
                className="w-14 text-center text-lg"
              />
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm">Openbaar</Label>
                <p className="text-xs text-muted-foreground">Iedereen met de link kan deze lijst zien.</p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Annuleer
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}