import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OwnerResponseProps {
  reviewId: string;
  existingResponse?: string | null;
  responseDate?: string | null;
  canRespond?: boolean;
  onResponseAdded?: () => void;
}

export function OwnerResponse({
  reviewId,
  existingResponse,
  responseDate,
  canRespond = false,
  onResponseAdded,
}: OwnerResponseProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [response, setResponse] = useState(existingResponse || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!response.trim()) {
      toast.error('Voer een reactie in');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('reviews')
        .update({
          owner_response: response.trim(),
          owner_response_at: new Date().toISOString(),
        })
        .eq('id', reviewId);

      if (error) throw error;

      toast.success('Reactie geplaatst');
      setIsEditing(false);
      onResponseAdded?.();
    } catch (error) {
      console.error('Owner response error:', error);
      toast.error('Kon reactie niet plaatsen');
    } finally {
      setSubmitting(false);
    }
  };

  // Show existing response
  if (existingResponse && !isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 ml-4 pl-4 border-l-2 border-primary/30 bg-primary/5 rounded-r-lg p-4"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
            <MessageCircle className="h-3 w-3 text-primary" />
          </div>
          <span className="text-sm font-semibold text-primary">Reactie van eigenaar</span>
          {responseDate && (
            <span className="text-xs text-muted-foreground">
              {new Date(responseDate).toLocaleDateString('nl-NL')}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{existingResponse}</p>
        {canRespond && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-xs"
            onClick={() => setIsEditing(true)}
          >
            Bewerken
          </Button>
        )}
      </motion.div>
    );
  }

  // Show response form for owners
  if (canRespond) {
    return (
      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="editing"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 ml-4 pl-4 border-l-2 border-primary/30"
          >
            <Textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Schrijf een reactie op deze review..."
              className="min-h-[80px] text-sm"
            />
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitting || !response.trim()}
              >
                <Send className="h-3 w-3 mr-1" />
                {submitting ? 'Plaatsen...' : 'Plaats reactie'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  setResponse(existingResponse || '');
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Annuleren
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="text-xs"
            >
              <MessageCircle className="h-3 w-3 mr-1" />
              Reageer als eigenaar
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return null;
}
