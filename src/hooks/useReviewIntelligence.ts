import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ReviewWithProfile } from '@/hooks/useOwnerDashboard';

export type Sentiment = 'positive' | 'neutral' | 'negative';
export type ReviewCategory = 'food' | 'service' | 'ambiance' | 'price' | 'location' | 'hygiene';
export type TemplateType = 'thank' | 'apologize' | 'invite_back';

export interface ReviewAnalysis {
  index: number;
  sentiment: Sentiment;
  categories: ReviewCategory[];
  suggestedTemplate: TemplateType | null;
}

export interface ReviewSummary {
  averageSentiment: Sentiment;
  sentimentDistribution: { positive: number; neutral: number; negative: number };
  topCategories: { category: ReviewCategory; count: number; sentiment: Sentiment }[];
  actionItems: string[];
}

export interface IntelligenceResult {
  analyses: ReviewAnalysis[];
  summary: ReviewSummary;
}

const RESPONSE_TEMPLATES: Record<TemplateType, { nl: string; label: string }> = {
  thank: {
    label: 'Bedanken',
    nl: 'Hartelijk dank voor je fijne review! We zijn blij dat je hebt genoten. We hopen je snel weer te verwelkomen! 🙏'
  },
  apologize: {
    label: 'Excuses',
    nl: 'Bedankt voor je feedback. Het spijt ons dat je ervaring niet aan je verwachtingen voldeed. We nemen je opmerkingen serieus en werken aan verbeteringen. We hopen het goed te mogen maken bij een volgend bezoek.'
  },
  invite_back: {
    label: 'Uitnodigen',
    nl: 'Dank je wel voor je bezoek en je eerlijke review! We waarderen je feedback en hebben er al van geleerd. Kom gerust nog eens langs – we staan open voor een tweede kans! 😊'
  }
};

export function useReviewIntelligence() {
  const [result, setResult] = useState<IntelligenceResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const analyzeReviews = useCallback(async (reviews: ReviewWithProfile[]) => {
    if (reviews.length === 0) return;

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-reviews', {
        body: {
          reviews: reviews.map(r => ({
            rating: r.rating,
            title: r.title,
            body: r.body,
          }))
        }
      });

      if (error) throw error;

      if (data?.analysis?.analyses && data?.analysis?.summary) {
        setResult(data.analysis);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Review analysis failed:', err);
      toast.error('Analyse kon niet worden uitgevoerd');
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const getTemplate = (type: TemplateType) => RESPONSE_TEMPLATES[type];
  const getAllTemplates = () => RESPONSE_TEMPLATES;

  return { result, analyzing, analyzeReviews, getTemplate, getAllTemplates };
}
