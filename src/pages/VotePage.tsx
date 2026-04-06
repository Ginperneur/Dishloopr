import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Users, Star, MapPin, Check, ThumbsUp } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ListRestaurant {
  restaurant_id: string;
  restaurants: {
    name: string;
    slug: string;
    rating: number;
    review_count: number;
    address: string;
    images: string[] | null;
    cuisines: string[] | null;
  };
}

interface Vote {
  restaurant_id: string;
  voter_name: string;
}

export default function VotePage() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [list, setList] = useState<any>(null);
  const [restaurants, setRestaurants] = useState<ListRestaurant[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [voterName, setVoterName] = useState('');
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (shareCode) fetchData();
  }, [shareCode]);

  const fetchData = async () => {
    const { data: listData } = await supabase
      .from('shared_lists' as any)
      .select('*')
      .eq('share_code', shareCode)
      .single();

    if (!listData) {
      setLoading(false);
      return;
    }
    setList(listData);

    const { data: rData } = await supabase
      .from('shared_list_restaurants' as any)
      .select('restaurant_id, restaurants(name, slug, rating, review_count, address, images, cuisines)')
      .eq('list_id', (listData as any).id);

    if (rData) setRestaurants(rData as any);

    const { data: vData } = await supabase
      .from('shared_list_votes' as any)
      .select('restaurant_id, voter_name')
      .eq('list_id', (listData as any).id);

    if (vData) setVotes(vData as any);
    setLoading(false);
  };

  const submitVote = async () => {
    if (!voterName.trim()) {
      toast.error('Vul je naam in');
      return;
    }
    if (!selectedId) {
      toast.error('Kies een restaurant');
      return;
    }

    const { error } = await supabase.from('shared_list_votes' as any).insert({
      list_id: list.id,
      restaurant_id: selectedId,
      voter_name: voterName.trim(),
    } as any);

    if (error) {
      if (error.code === '23505') {
        toast.error('Je hebt al gestemd!');
      } else {
        toast.error('Kon stem niet opslaan');
      }
      return;
    }

    setHasVoted(true);
    toast.success('Stem opgeslagen!');
    fetchData();
  };

  // Count votes per restaurant
  const voteCounts = new Map<string, { count: number; voters: string[] }>();
  votes.forEach(v => {
    const existing = voteCounts.get(v.restaurant_id) || { count: 0, voters: [] };
    existing.count++;
    existing.voters.push(v.voter_name);
    voteCounts.set(v.restaurant_id, existing);
  });

  // Sort by votes
  const sortedRestaurants = [...restaurants].sort((a, b) => {
    const aVotes = voteCounts.get(a.restaurant_id)?.count || 0;
    const bVotes = voteCounts.get(b.restaurant_id)?.count || 0;
    return bVotes - aVotes;
  });

  if (loading) {
    return (
      <Layout>
        <div className="container py-16 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  if (!list) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <h1 className="text-2xl font-bold mb-2">Lijst niet gevonden</h1>
          <p className="text-muted-foreground">Deze stemlink is verlopen of bestaat niet.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-6 px-4 max-w-lg mx-auto">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold">{list.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {votes.length} {votes.length === 1 ? 'stem' : 'stemmen'} uitgebracht
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {sortedRestaurants.map((item) => {
            const r = item.restaurants;
            const voteData = voteCounts.get(item.restaurant_id);
            const isSelected = selectedId === item.restaurant_id;

            return (
              <button
                key={item.restaurant_id}
                onClick={() => !hasVoted && setSelectedId(item.restaurant_id)}
                disabled={hasVoted}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{r.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-rating text-rating" />
                        <span className="text-xs">{Number(r.rating).toFixed(1)}</span>
                      </div>
                      {r.cuisines?.[0] && (
                        <Badge variant="secondary" className="text-[10px] capitalize">{r.cuisines[0]}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{r.address?.split(',')[0]}</span>
                    </div>
                  </div>
                  <div className="text-center shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      voteData && voteData.count > 0
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {voteData?.count || 0}
                    </div>
                    {voteData && voteData.voters.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1 max-w-[80px] truncate">
                        {voteData.voters.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {!hasVoted ? (
          <Card>
            <CardContent className="py-4 space-y-3">
              <Input
                placeholder="Je naam"
                value={voterName}
                onChange={e => setVoterName(e.target.value)}
              />
              <Button onClick={submitVote} className="w-full gap-2" disabled={!selectedId || !voterName.trim()}>
                <ThumbsUp className="h-4 w-4" />
                Stem uitbrengen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="text-center p-4 rounded-xl bg-primary/5 border border-primary/20">
            <Check className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="font-medium text-sm">Je stem is opgeslagen!</p>
            <p className="text-xs text-muted-foreground mt-1">De resultaten worden live bijgewerkt.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
