import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Sparkles, 
  Filter,
  MessageSquareText,
  BarChart3,
  Loader2,
  Copy,
  Check
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  useReviewIntelligence, 
  type Sentiment, 
  type ReviewCategory, 
  type TemplateType 
} from '@/hooks/useReviewIntelligence';
import type { ReviewWithProfile } from '@/hooks/useOwnerDashboard';

interface ReviewIntelligenceProps {
  reviews: ReviewWithProfile[];
  onApplyTemplate: (reviewId: string, text: string) => void;
}

const SENTIMENT_CONFIG: Record<Sentiment, { icon: typeof TrendingUp; color: string; bgColor: string; label: string }> = {
  positive: { icon: TrendingUp, color: 'text-green-600', bgColor: 'bg-green-500/10 border-green-500/20', label: 'Positief' },
  neutral: { icon: Minus, color: 'text-amber-600', bgColor: 'bg-amber-500/10 border-amber-500/20', label: 'Neutraal' },
  negative: { icon: TrendingDown, color: 'text-red-600', bgColor: 'bg-red-500/10 border-red-500/20', label: 'Negatief' },
};

const CATEGORY_LABELS: Record<ReviewCategory, string> = {
  food: 'Eten & Drinken',
  service: 'Bediening',
  ambiance: 'Sfeer',
  price: 'Prijs',
  location: 'Locatie',
  hygiene: 'Hygiëne',
};

export function ReviewIntelligence({ reviews, onApplyTemplate }: ReviewIntelligenceProps) {
  const { result, analyzing, analyzeReviews, getAllTemplates } = useReviewIntelligence();
  const [sentimentFilter, setSentimentFilter] = useState<Sentiment | 'all'>('all');
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);

  useEffect(() => {
    if (reviews.length > 0 && !result && !analyzing) {
      analyzeReviews(reviews);
    }
  }, [reviews]);

  const handleCopyTemplate = (type: TemplateType, reviewId?: string) => {
    const templates = getAllTemplates();
    const text = templates[type].nl;
    
    if (reviewId) {
      onApplyTemplate(reviewId, text);
    } else {
      navigator.clipboard.writeText(text);
      setCopiedTemplate(type);
      setTimeout(() => setCopiedTemplate(null), 2000);
      toast.success('Template gekopieerd');
    }
  };

  const filteredReviews = reviews.map((review, index) => {
    const analysis = result?.analyses?.find(a => a.index === index);
    return { review, analysis };
  }).filter(({ analysis }) => {
    if (sentimentFilter === 'all') return true;
    return analysis?.sentiment === sentimentFilter;
  });

  return (
    <div className="space-y-6">
      {/* Analysis Trigger */}
      {!result && !analyzing && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6 text-center">
            <Brain className="h-10 w-10 mx-auto text-primary mb-3" />
            <h3 className="font-semibold mb-2">Review Intelligence</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Analyseer al je reviews automatisch op sentiment, categorieën en krijg actie-inzichten.
            </p>
            <Button onClick={() => analyzeReviews(reviews)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Start Analyse
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {analyzing && (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 mx-auto text-primary animate-spin mb-3" />
            <p className="font-medium">Reviews worden geanalyseerd...</p>
            <p className="text-sm text-muted-foreground mt-1">Dit duurt enkele seconden</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">
              <BarChart3 className="h-4 w-4 mr-1" />
              Overzicht
            </TabsTrigger>
            <TabsTrigger value="reviews">
              <Filter className="h-4 w-4 mr-1" />
              Per Review
            </TabsTrigger>
            <TabsTrigger value="templates">
              <MessageSquareText className="h-4 w-4 mr-1" />
              Templates
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Sentiment Distribution */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Sentiment Verdeling</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(['positive', 'neutral', 'negative'] as Sentiment[]).map((s) => {
                  const config = SENTIMENT_CONFIG[s];
                  const count = result.summary.sentimentDistribution[s];
                  const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0;
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <div className={`flex items-center gap-1.5 w-24 ${config.color}`}>
                        <config.icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{config.label}</span>
                      </div>
                      <div className="flex-1">
                        <Progress value={pct} className="h-2" />
                      </div>
                      <span className="text-sm font-medium w-16 text-right">{count} ({pct}%)</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Top Categories */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Meest Besproken Onderwerpen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {result.summary.topCategories.map((cat, i) => {
                    const sentConfig = SENTIMENT_CONFIG[cat.sentiment];
                    return (
                      <Badge key={i} variant="outline" className={`${sentConfig.bgColor} ${sentConfig.color}`}>
                        {CATEGORY_LABELS[cat.category] || cat.category} ({cat.count}×)
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Action Items */}
            {result.summary.actionItems.length > 0 && (
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Aanbevolen Acties
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.summary.actionItems.map((item, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-start gap-2 text-sm"
                      >
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        {item}
                      </motion.li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Button variant="outline" size="sm" onClick={() => analyzeReviews(reviews)}>
              <Brain className="h-4 w-4 mr-2" />
              Opnieuw analyseren
            </Button>
          </TabsContent>

          {/* Per Review Tab */}
          <TabsContent value="reviews" className="space-y-4">
            {/* Filter */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={sentimentFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSentimentFilter('all')}
              >
                Alle ({reviews.length})
              </Button>
              {(['positive', 'neutral', 'negative'] as Sentiment[]).map(s => {
                const count = result.summary.sentimentDistribution[s];
                const config = SENTIMENT_CONFIG[s];
                return (
                  <Button
                    key={s}
                    variant={sentimentFilter === s ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSentimentFilter(s)}
                    className={sentimentFilter !== s ? config.color : ''}
                  >
                    <config.icon className="h-3.5 w-3.5 mr-1" />
                    {config.label} ({count})
                  </Button>
                );
              })}
            </div>

            {/* Review Cards with Badges */}
            <AnimatePresence mode="popLayout">
              {filteredReviews.map(({ review, analysis }, i) => {
                const sentiment = analysis?.sentiment || 'neutral';
                const sentConfig = SENTIMENT_CONFIG[sentiment];
                return (
                  <motion.div
                    key={review.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Card className={`border ${sentConfig.bgColor}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">
                              {review.profile?.name || 'Anoniem'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(review.created_at).toLocaleDateString('nl-NL')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={`${sentConfig.bgColor} ${sentConfig.color} text-xs`}>
                              <sentConfig.icon className="h-3 w-3 mr-1" />
                              {sentConfig.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {review.rating}★
                            </Badge>
                          </div>
                        </div>

                        {review.title && <p className="font-medium text-sm mb-1">{review.title}</p>}
                        {review.body && <p className="text-sm text-muted-foreground line-clamp-2">{review.body}</p>}

                        {/* Category Tags */}
                        {analysis?.categories && analysis.categories.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {analysis.categories.map(cat => (
                              <Badge key={cat} variant="secondary" className="text-xs">
                                {CATEGORY_LABELS[cat] || cat}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Quick Template Suggestion */}
                        {!review.owner_response && analysis?.suggestedTemplate && (
                          <div className="mt-3 pt-3 border-t">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCopyTemplate(analysis.suggestedTemplate!, review.id)}
                            >
                              <MessageSquareText className="h-3.5 w-3.5 mr-1" />
                              Template: {getAllTemplates()[analysis.suggestedTemplate].label}
                            </Button>
                          </div>
                        )}

                        {review.owner_response && (
                          <div className="mt-3 p-2 rounded bg-muted text-xs">
                            <p className="font-medium mb-0.5">Jouw reactie:</p>
                            <p className="text-muted-foreground line-clamp-2">{review.owner_response}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Snelle Antwoordtemplates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(Object.entries(getAllTemplates()) as [TemplateType, { nl: string; label: string }][]).map(([type, template]) => (
                  <div key={type} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary">{template.label}</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyTemplate(type)}
                      >
                        {copiedTemplate === type ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{template.nl}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
