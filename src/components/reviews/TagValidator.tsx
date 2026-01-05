import { useState } from 'react';
import { Check, X, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TagConfirmation {
  tag: string;
  tagType: string;
  isConfirmed: boolean;
}

interface TagValidatorProps {
  tags: string[];
  tagType: 'ambience' | 'cuisine';
  userConfirmations: TagConfirmation[];
  onConfirm: (tag: string, isConfirmed: boolean) => Promise<boolean>;
  disabled?: boolean;
}

export function TagValidator({ tags, tagType, userConfirmations, onConfirm, disabled }: TagValidatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const getUserConfirmation = (tag: string) => {
    return userConfirmations.find(c => c.tag === tag && c.tagType === tagType);
  };

  const handleConfirm = async (tag: string, isConfirmed: boolean) => {
    setLoading(tag);
    await onConfirm(tag, isConfirmed);
    setLoading(null);
  };

  if (tags.length === 0) return null;

  const confirmedCount = tags.filter(tag => getUserConfirmation(tag)?.isConfirmed === true).length;
  const disputedCount = tags.filter(tag => getUserConfirmation(tag)?.isConfirmed === false).length;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
        disabled={disabled}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">
            {tagType === 'ambience' ? 'Klopt de sfeer?' : 'Klopt de keuken?'}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3 w-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs max-w-[200px]">
                Help ons de tags te valideren door te bevestigen welke tags kloppen
              </p>
            </TooltipContent>
          </Tooltip>
          {(confirmedCount > 0 || disputedCount > 0) && (
            <div className="flex gap-1">
              {confirmedCount > 0 && (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  {confirmedCount} ✓
                </Badge>
              )}
              {disputedCount > 0 && (
                <Badge variant="secondary" className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  {disputedCount} ✗
                </Badge>
              )}
            </div>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-3 border-t">
              <p className="text-xs text-muted-foreground">
                Bevestig of betwist de tags op basis van je ervaring
              </p>
              
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => {
                  const confirmation = getUserConfirmation(tag);
                  const isLoading = loading === tag;
                  
                  return (
                    <div 
                      key={tag} 
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm border transition-colors ${
                        confirmation?.isConfirmed === true
                          ? 'bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700'
                          : confirmation?.isConfirmed === false
                          ? 'bg-red-100 border-red-300 dark:bg-red-900/30 dark:border-red-700'
                          : 'bg-muted border-muted-foreground/20'
                      }`}
                    >
                      <span className="capitalize">{tag}</span>
                      <div className="flex gap-0.5 ml-1">
                        <button
                          type="button"
                          onClick={() => handleConfirm(tag, true)}
                          disabled={isLoading || disabled}
                          className={`p-0.5 rounded transition-colors ${
                            confirmation?.isConfirmed === true
                              ? 'bg-green-500 text-white'
                              : 'hover:bg-green-100 dark:hover:bg-green-900/50'
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirm(tag, false)}
                          disabled={isLoading || disabled}
                          className={`p-0.5 rounded transition-colors ${
                            confirmation?.isConfirmed === false
                              ? 'bg-red-500 text-white'
                              : 'hover:bg-red-100 dark:hover:bg-red-900/50'
                          }`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
