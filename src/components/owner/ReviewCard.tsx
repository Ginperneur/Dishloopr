import { useState } from 'react';
import { Star, MessageSquare, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface ReviewCardProps {
  review: any;
  onRespond: (reviewId: string, response: string) => Promise<boolean>;
  canRespond: boolean;
}

export function ReviewCard({ review, onRespond, canRespond }: ReviewCardProps) {
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [response, setResponse] = useState(review.owner_response || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    const success = await onRespond(review.id, response);
    if (success) {
      toast.success('Reactie geplaatst');
      setShowResponseForm(false);
    } else {
      toast.error('Kon reactie niet plaatsen');
    }
    setSubmitting(false);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-semibold">{review.profile?.name || 'Anoniem'}</p>
            <p className="text-sm text-muted-foreground">
              {new Date(review.created_at).toLocaleDateString('nl-NL')}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${
                  i < review.rating ? 'fill-rating text-rating' : 'text-muted-foreground'
                }`}
              />
            ))}
          </div>
        </div>

        {review.title && <h4 className="font-medium mb-1">{review.title}</h4>}
        {review.body && <p className="text-muted-foreground mb-3">{review.body}</p>}

        <Badge variant={review.status === 'published' ? 'default' : 'secondary'}>
          {review.status === 'published' ? 'Gepubliceerd' : review.status === 'pending' ? 'In afwachting' : 'Gemarkeerd'}
        </Badge>

        {review.owner_response ? (
          <div className="mt-4 p-3 rounded-lg bg-muted border-l-2 border-primary">
            <p className="text-sm font-medium mb-1">Jouw reactie</p>
            <p className="text-sm text-muted-foreground">{review.owner_response}</p>
          </div>
        ) : canRespond ? (
          <div className="mt-4">
            {showResponseForm ? (
              <div className="space-y-3">
                <Textarea
                  placeholder="Schrijf een reactie op deze review..."
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button onClick={handleSubmit} disabled={submitting || !response.trim()}>
                    {submitting ? 'Plaatsen...' : 'Reactie plaatsen'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowResponseForm(false)}>
                    Annuleren
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowResponseForm(true)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Reageren
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <p className="text-sm text-yellow-600 flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Verificatie vereist om te reageren
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
