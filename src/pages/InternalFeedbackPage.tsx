import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Star, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function InternalFeedbackPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const [restaurant, setRestaurant] = useState<{ name: string } | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    supabase.from('restaurants').select('name').eq('id', restaurantId).maybeSingle()
      .then(({ data }) => setRestaurant(data as any));
  }, [restaurantId]);

  const submit = async () => {
    if (rating === 0) { toast.error('Geef een sterrenrating'); return; }
    setSubmitting(true);
    const { error } = await (supabase as any).from('internal_feedback').insert({
      restaurant_id: restaurantId,
      rating,
      comment: comment.trim() || null,
      contact_email: email.trim() || null,
    });
    setSubmitting(false);
    if (error) { toast.error('Verzenden mislukt'); return; }
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 to-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {submitted ? 'Bedankt!' : `Feedback voor ${restaurant?.name || '...'}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
              <p className="text-sm text-muted-foreground">Je feedback is naar de eigenaar gestuurd. We waarderen het enorm!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Hoe was je ervaring?</p>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setRating(n)} type="button" aria-label={`${n} sterren`}>
                      <Star className={`h-9 w-9 transition ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted hover:text-amber-300'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                rows={4}
                placeholder="Vertel ons meer (optioneel)..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <Input
                type="email"
                placeholder="E-mail (optioneel, alleen als je een reactie wil)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button className="w-full" onClick={submit} disabled={submitting || rating === 0}>
                {submitting ? 'Verzenden…' : 'Versturen'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Dit is privé feedback voor de eigenaar — niet publiek zichtbaar op Dishloopr.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}