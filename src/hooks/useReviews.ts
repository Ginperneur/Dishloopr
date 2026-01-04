import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Review = Database['public']['Tables']['reviews']['Row'];
type ReviewInsert = Database['public']['Tables']['reviews']['Insert'];

export interface ReviewWithProfile extends Review {
  profile?: {
    name: string | null;
    avatar_url: string | null;
  };
}

export function useReviews(restaurantId: string | undefined) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (restaurantId) {
      fetchReviews();
    }
  }, [restaurantId]);

  const fetchReviews = async () => {
    if (!restaurantId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error);
    } else if (data) {
      // Fetch profiles separately
      const userIds = [...new Set(data.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      setReviews(data.map(review => ({
        ...review,
        profile: profileMap.get(review.user_id) as { name: string | null; avatar_url: string | null } | undefined
      })));
    }
    setLoading(false);
  };

  const submitReview = async (data: { rating: number; title: string; body: string }) => {
    if (!user) {
      toast.error('Log in om een review te schrijven');
      return false;
    }

    if (!restaurantId) return false;

    setSubmitting(true);

    const review: ReviewInsert = {
      restaurant_id: restaurantId,
      user_id: user.id,
      rating: data.rating,
      title: data.title,
      body: data.body,
      status: 'published', // Auto-publish for now
    };

    const { error } = await supabase.from('reviews').insert(review);

    if (error) {
      console.error('Error submitting review:', error);
      toast.error('Kon review niet plaatsen');
      setSubmitting(false);
      return false;
    }

    toast.success('Review geplaatst!');
    await fetchReviews();
    setSubmitting(false);
    return true;
  };

  return { reviews, loading, submitting, submitReview, refetch: fetchReviews };
}
