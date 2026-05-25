import { useState, useEffect } from 'react';
import { Star, MessageSquare, Lock, Sparkles, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ReviewCardProps {
  review: any;
  onRespond: (reviewId: string, response: string) => Promise<boolean>;
  canRespond: boolean;
  restaurantId?: string;
  restaurantName?: string;
}

export function ReviewCard({ review, onRespond, canRespond, restaurantId, restaurantName }: ReviewCardProps) {
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [response, setResponse] = useState(review.owner_response || '');
  const [submitting, setSubmitting] = useState(false);
  const [templates, setTemplates] = useState<Array<{ id: string; title: string; body: string; sentiment: string | null }>>([]);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!restaurantId || !showResponseForm) return;
    (supabase as any).from('response_templates')
      .select('id, title, body, sentiment')
      .eq('restaurant_id', restaurantId)
      .order('use_count', { ascending: false })
      .then(({ data }: any) => setTemplates(data || []));
  }, [restaurantId, showResponseForm]);

  const sentimentBucket = review.rating >= 4 ? 'positive' : review.rating === 3 ? 'neutral' : 'negative';
  const filteredTemplates = templates.filter(t => !t.sentiment || t.sentiment === sentimentBucket);

  const applyTemplate = async (t: { id: string; body: string }) => {
    setResponse(t.body);
  };

  const generateAI = async (tone: 'warm' | 'professional' | 'apologetic') => {
    if (!restaurantName) { toast.error('Restaurant ontbreekt'); return; }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-review-response', {
        body: {
          reviewText: review.body || review.title || '',
          rating: review.rating,
          restaurantName,
          tone,
        },
      });
      if (error || !data?.response) throw new Error(error?.message || 'Geen antwoord');
      setResponse(data.response);
      toast.success('AI-suggestie ingevuld');
    } catch (e: any) {
      toast.error(e.message || 'AI mislukt');
    } finally {
      setAiLoading(false);
    }
  };

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
                <div className="flex flex-wrap gap-2">
                  {filteredTemplates.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline"><FileText className="h-3.5 w-3.5 mr-1" />Template</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="max-w-xs">
                        <DropdownMenuLabel>Kies een template</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {filteredTemplates.map(t => (
                          <DropdownMenuItem key={t.id} onClick={() => applyTemplate(t)} className="flex-col items-start">
                            <span className="font-medium">{t.title}</span>
                            <span className="text-xs text-muted-foreground line-clamp-2">{t.body}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" disabled={aiLoading}>
                        {aiLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                        AI-suggestie
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => generateAI('warm')}>Warm & persoonlijk</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => generateAI('professional')}>Beleefd & professioneel</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => generateAI('apologetic')}>Verontschuldigend</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Textarea
                  placeholder="Schrijf een reactie op deze review..."
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  rows={4}
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
