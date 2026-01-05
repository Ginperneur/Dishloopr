import { useState } from 'react';
import { ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface HelpfulButtonProps {
  reviewId: string;
  initialCount: number;
  hasVoted?: boolean;
}

export function HelpfulButton({ reviewId, initialCount, hasVoted = false }: HelpfulButtonProps) {
  const { user } = useAuth();
  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(hasVoted);
  const [loading, setLoading] = useState(false);

  const handleVote = async () => {
    if (!user) {
      toast.error('Log in om te stemmen');
      return;
    }

    setLoading(true);

    try {
      if (voted) {
        // Remove vote
        const { error } = await supabase
          .from('helpful_votes')
          .delete()
          .eq('review_id', reviewId)
          .eq('user_id', user.id);

        if (error) throw error;
        setCount(c => Math.max(0, c - 1));
        setVoted(false);
      } else {
        // Add vote
        const { error } = await supabase
          .from('helpful_votes')
          .insert({ review_id: reviewId, user_id: user.id });

        if (error) throw error;
        setCount(c => c + 1);
        setVoted(true);
      }
    } catch (error) {
      console.error('Vote error:', error);
      toast.error('Kon stem niet verwerken');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleVote}
      disabled={loading}
      className={cn(
        'gap-1.5 text-muted-foreground hover:text-foreground',
        voted && 'text-primary hover:text-primary'
      )}
    >
      <ThumbsUp className={cn('h-4 w-4', voted && 'fill-current')} />
      <span>{count > 0 ? count : ''}</span>
      <span className="hidden sm:inline">Nuttig</span>
    </Button>
  );
}
