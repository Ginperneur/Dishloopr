import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Store, Link2 } from 'lucide-react';

interface Chain {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  website_url: string | null;
  is_active: boolean;
  created_at: string;
  restaurant_count?: number;
}

interface Restaurant {
  id: string;
  name: string;
  chain_id: string | null;
  city: { name: string } | null;
}

export function ChainsManager() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingChain, setEditingChain] = useState<Chain | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedChain, setSelectedChain] = useState<Chain | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch chains with restaurant count
    const { data: chainsData, error: chainsError } = await supabase
      .from('restaurant_chains')
      .select('*')
      .order('name');

    if (chainsError) {
      toast.error('Fout bij laden ketens');
      console.error(chainsError);
    } else {
      // Get restaurant counts per chain
      const { data: countData } = await supabase
        .from('restaurants')
        .select('chain_id')
        .not('chain_id', 'is', null);
      
      const counts: Record<string, number> = {};
      countData?.forEach(r => {
        if (r.chain_id) {
          counts[r.chain_id] = (counts[r.chain_id] || 0) + 1;
        }
      });
      
      setChains((chainsData || []).map(c => ({
        ...c,
        restaurant_count: counts[c.id] || 0
      })));
    }

    // Fetch restaurants for linking
    const { data: restaurantsData } = await supabase
      .from('restaurants')
      .select('id, name, chain_id, cities:city_id(name)')
      .eq('is_active', true)
      .order('name');
    
    setRestaurants(restaurantsData?.map(r => ({
      ...r,
      city: r.cities as { name: string } | null
    })) || []);
    
    setLoading(false);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!editingChain) {
      setSlug(generateSlug(value));
    }
  };

  const resetForm = () => {
    setName('');
    setSlug('');
    setDescription('');
    setWebsiteUrl('');
    setLogoUrl('');
    setIsActive(true);
    setEditingChain(null);
  };

  const openEditDialog = (chain: Chain) => {
    setEditingChain(chain);
    setName(chain.name);
    setSlug(chain.slug);
    setDescription(chain.description || '');
    setWebsiteUrl(chain.website_url || '');
    setLogoUrl(chain.logo_url || '');
    setIsActive(chain.is_active);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !slug.trim()) {
      toast.error('Naam en slug zijn verplicht');
      return;
    }

    const chainData = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      website_url: websiteUrl.trim() || null,
      logo_url: logoUrl.trim() || null,
      is_active: isActive
    };

    if (editingChain) {
      const { error } = await supabase
        .from('restaurant_chains')
        .update(chainData)
        .eq('id', editingChain.id);

      if (error) {
        toast.error('Fout bij bijwerken: ' + error.message);
      } else {
        toast.success('Keten bijgewerkt');
        setIsDialogOpen(false);
        resetForm();
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from('restaurant_chains')
        .insert(chainData);

      if (error) {
        toast.error('Fout bij toevoegen: ' + error.message);
      } else {
        toast.success('Keten toegevoegd');
        setIsDialogOpen(false);
        resetForm();
        fetchData();
      }
    }
  };

  const handleDelete = async (chain: Chain) => {
    if (!confirm(`Weet je zeker dat je "${chain.name}" wilt verwijderen?`)) return;

    const { error } = await supabase
      .from('restaurant_chains')
      .delete()
      .eq('id', chain.id);

    if (error) {
      toast.error('Fout bij verwijderen: ' + error.message);
    } else {
      toast.success('Keten verwijderd');
      fetchData();
    }
  };

  const linkRestaurantToChain = async (restaurantId: string, chainId: string | null) => {
    const { error } = await supabase
      .from('restaurants')
      .update({ chain_id: chainId })
      .eq('id', restaurantId);

    if (error) {
      toast.error('Fout bij koppelen: ' + error.message);
    } else {
      toast.success(chainId ? 'Restaurant gekoppeld aan keten' : 'Restaurant losgekoppeld van keten');
      fetchData();
    }
  };

  const getChainRestaurants = (chainId: string) => {
    return restaurants.filter(r => r.chain_id === chainId);
  };

  const getUnlinkedRestaurants = () => {
    return restaurants.filter(r => !r.chain_id);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Ketens & Groepen
            </CardTitle>
            <CardDescription>
              Beheer restaurant ketens met meerdere vestigingen
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nieuwe keten
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingChain ? 'Keten bewerken' : 'Nieuwe keten toevoegen'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Naam *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="bijv. Mood"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug *</Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="bijv. mood"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Beschrijving</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Korte beschrijving van de keten..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="websiteUrl">Website URL</Label>
                  <Input
                    id="websiteUrl"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://..."
                    type="url"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Logo URL</Label>
                  <Input
                    id="logoUrl"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://..."
                    type="url"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="isActive">Actief</Label>
                  <Switch
                    id="isActive"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}>
                    Annuleren
                  </Button>
                  <Button type="submit">
                    {editingChain ? 'Bijwerken' : 'Toevoegen'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {chains.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Store className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nog geen ketens toegevoegd</p>
            <p className="text-sm">Voeg een keten toe om restaurants te groeperen</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Naam</TableHead>
                <TableHead>Vestigingen</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chains.map((chain) => (
                <TableRow key={chain.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {chain.logo_url ? (
                        <img 
                          src={chain.logo_url} 
                          alt={chain.name}
                          className="h-8 w-8 rounded object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                          <Store className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{chain.name}</p>
                        <p className="text-xs text-muted-foreground">/{chain.slug}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {chain.restaurant_count || 0} vestiging{(chain.restaurant_count || 0) !== 1 ? 'en' : ''}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={chain.is_active ? 'default' : 'secondary'}>
                      {chain.is_active ? 'Actief' : 'Inactief'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedChain(chain);
                          setLinkDialogOpen(true);
                        }}
                        title="Vestigingen beheren"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(chain)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(chain)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Link restaurants dialog */}
        <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Vestigingen van {selectedChain?.name}
              </DialogTitle>
            </DialogHeader>
            
            {selectedChain && (
              <div className="space-y-6">
                {/* Current linked restaurants */}
                <div>
                  <h4 className="font-medium mb-3">Gekoppelde vestigingen</h4>
                  {getChainRestaurants(selectedChain.id).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nog geen vestigingen gekoppeld
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {getChainRestaurants(selectedChain.id).map(r => (
                        <div 
                          key={r.id} 
                          className="flex items-center justify-between p-2 border rounded"
                        >
                          <div>
                            <p className="font-medium">{r.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {r.city?.name || 'Geen stad'}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => linkRestaurantToChain(r.id, null)}
                            className="text-destructive"
                          >
                            Loskoppelen
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Available restaurants to link */}
                <div>
                  <h4 className="font-medium mb-3">Beschikbare restaurants</h4>
                  {getUnlinkedRestaurants().length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Alle restaurants zijn al gekoppeld
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {getUnlinkedRestaurants().map(r => (
                        <div 
                          key={r.id} 
                          className="flex items-center justify-between p-2 border rounded"
                        >
                          <div>
                            <p className="font-medium">{r.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {r.city?.name || 'Geen stad'}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => linkRestaurantToChain(r.id, selectedChain.id)}
                          >
                            Koppelen
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
