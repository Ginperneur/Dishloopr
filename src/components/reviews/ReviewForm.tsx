import { useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

interface ReviewFormProps {
  onSubmit: (data: { rating: number; title: string; body: string }) => Promise<boolean>;
  submitting: boolean;
}

export function ReviewForm({ onSubmit, submitting }: ReviewFormProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  if (!user) {
    return (
      <div className="p-6 rounded-xl bg-muted/50 text-center">
        <p className="text-muted-foreground mb-4">Log in om een review te schrijven</p>
        <Button asChild>
          <Link to="/login">Inloggen</Link>
        </Button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;
    
    const success = await onSubmit({ rating, title, body });
    if (success) {
      setRating(0);
      setTitle('');
      setBody('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 rounded-xl bg-muted/50 space-y-4">
      <h3 className="font-semibold">Schrijf een review</h3>
      
      {/* Star Rating */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-1 transition-transform hover:scale-110"
          >
            <Star
              className={`h-6 w-6 transition-colors ${
                star <= (hoverRating || rating)
                  ? 'fill-rating text-rating'
                  : 'text-muted-foreground'
              }`}
            />
          </button>
        ))}
        <span className="ml-2 text-sm text-muted-foreground">
          {rating > 0 ? `${rating}/5` : 'Selecteer rating'}
        </span>
      </div>

      <Input
        placeholder="Titel van je review"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />

      <Textarea
        placeholder="Deel je ervaring..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        required
      />

      <Button type="submit" disabled={rating === 0 || submitting}>
        {submitting ? 'Plaatsen...' : 'Review plaatsen'}
      </Button>
    </form>
  );
}
