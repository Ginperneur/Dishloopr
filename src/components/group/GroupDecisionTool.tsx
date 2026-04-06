import { useState } from 'react';
import { Users, Share2, Plus, Check, Link2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import { toast } from 'sonner';

export function GroupDecisionTool() {
  const { user } = useAuth();
  const { favorites } = useFavorites();
  const [title, setTitle] = useState('Waar gaan we eten?');
  const [creating, setCreating] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  if (!user) return null;

  const toggleRestaurant = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createList = async () => {
    if (selectedIds.size === 0) {
      toast.error('Selecteer minstens 1 restaurant');
      return;
    }

    setCreating(true);
    
    // Create the shared list
    const { data: list, error: listError } = await supabase
      .from('shared_lists' as any)
      .insert({ title, created_by: user.id } as any)
      .select('id, share_code')
      .single();

    if (listError || !list) {
      toast.error('Kon lijst niet aanmaken');
      setCreating(false);
      return;
    }

    // Add restaurants
    const inserts = [...selectedIds].map(rid => ({
      list_id: (list as any).id,
      restaurant_id: rid,
      added_by: user.id,
    }));

    await supabase.from('shared_list_restaurants' as any).insert(inserts as any);

    const link = `${window.location.origin}/vote/${(list as any).share_code}`;
    setShareLink(link);
    setCreating(false);
    toast.success('Stemlijst aangemaakt!');
  };

  const copyLink = async () => {
    if (shareLink) {
      await navigator.clipboard.writeText(shareLink);
      toast.success('Link gekopieerd!');
    }
  };

  if (shareLink) {
    return (
      <Card>
        <CardContent className="py-6 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Check className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold mb-1">Lijst aangemaakt!</h3>
            <p className="text-sm text-muted-foreground">Deel deze link met je vrienden zodat ze kunnen stemmen.</p>
          </div>
          <div className="flex gap-2">
            <Input value={shareLink} readOnly className="text-xs" />
            <Button onClick={copyLink} variant="outline" size="icon">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => { setShareLink(null); setSelectedIds(new Set()); }} variant="ghost" className="w-full">
            Nieuwe lijst maken
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Groepsbeslissing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Selecteer restaurants uit je favorieten en deel een stemlink met je vrienden.
        </p>
        
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Titel (bijv. 'Vrijdagavond')"
        />

        {favorites.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Voeg eerst restaurants toe aan je favorieten.
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {favorites.map((fav: any) => (
              <button
                key={fav.restaurant_id}
                onClick={() => toggleRestaurant(fav.restaurant_id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${
                  selectedIds.has(fav.restaurant_id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selectedIds.has(fav.restaurant_id)
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground'
                }`}>
                  {selectedIds.has(fav.restaurant_id) && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <span className="text-sm font-medium truncate">
                  {fav.restaurants?.name || 'Restaurant'}
                </span>
              </button>
            ))}
          </div>
        )}

        <Button 
          onClick={createList} 
          disabled={creating || selectedIds.size === 0} 
          className="w-full gap-2"
        >
          <Share2 className="h-4 w-4" />
          {creating ? 'Aanmaken...' : `Stemlink maken (${selectedIds.size})`}
        </Button>
      </CardContent>
    </Card>
  );
}
