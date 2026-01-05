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
    reviewer_level: string | null;
    total_reviews: number | null;
  };
  helpful_count?: number;
  user_has_voted?: boolean;
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
  }, [restaurantId, user]);

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
      setLoading(false);
      return;
    }

    if (data) {
      // Fetch profiles separately
      const userIds = [...new Set(data.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, reviewer_level, total_reviews')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Fetch helpful vote counts
      const reviewIds = data.map(r => r.id);
      const { data: voteCounts } = await supabase
        .from('helpful_votes')
        .select('review_id')
        .in('review_id', reviewIds);

      // Count votes per review
      const voteCountMap = new Map<string, number>();
      voteCounts?.forEach(vote => {
        voteCountMap.set(vote.review_id, (voteCountMap.get(vote.review_id) || 0) + 1);
      });

      // Check if current user has voted
      let userVotes = new Set<string>();
      if (user) {
        const { data: userVoteData } = await supabase
          .from('helpful_votes')
          .select('review_id')
          .eq('user_id', user.id)
          .in('review_id', reviewIds);
        
        userVotes = new Set(userVoteData?.map(v => v.review_id) || []);
      }
      
      setReviews(data.map(review => ({
        ...review,
        profile: profileMap.get(review.user_id) as ReviewWithProfile['profile'],
        helpful_count: voteCountMap.get(review.id) || 0,
        user_has_voted: userVotes.has(review.id),
      })));
    }
    setLoading(false);
  };

  const submitReview = async (data: { 
    rating: number; 
    title: string; 
    body: string;
    photos?: string[];
    dishRatings?: { dishId: string; rating: number }[];
  }) => {
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
      photos: data.photos || [],
      status: 'published',
    };

    const { data: insertedReview, error } = await supabase
      .from('reviews')
      .insert(review)
      .select('id')
      .single();

    if (error || !insertedReview) {
      console.error('Error submitting review:', error);
      toast.error('Kon review niet plaatsen');
      setSubmitting(false);
      return false;
    }

    // Submit dish ratings if provided
    if (data.dishRatings && data.dishRatings.length > 0) {
      const dishRatingInserts = data.dishRatings.map(dr => ({
        review_id: insertedReview.id,
        dish_id: dr.dishId,
        rating: dr.rating
      }));

      const { error: drError } = await supabase
        .from('dish_ratings')
        .insert(dishRatingInserts);

      if (drError) {
        console.error('Error submitting dish ratings:', drError);
        // Don't fail the whole review for this
      }
    }

    toast.success('Review geplaatst!');
    await fetchReviews();
    setSubmitting(false);
    return true;
  };

  return { reviews, loading, submitting, submitReview, refetch: fetchReviews };
}
