import { useState, useRef, useEffect } from 'react';
import { Star, Camera, X, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { DishRatingSelector } from './DishRatingSelector';
import { TagValidator } from './TagValidator';
import { useDishRatings } from '@/hooks/useDishRatings';
import type { ReviewSubmission } from '@/hooks/useReviews';

interface DishRating {
  dishId: string;
  dishName: string;
  rating: number;
}

interface ReviewFormProps {
  onSubmit: (data: ReviewSubmission) => Promise<boolean>;
  submitting: boolean;
  restaurantId?: string;
  ambienceTags?: string[];
  cuisines?: string[];
}

export function ReviewForm({ 
  onSubmit, 
  submitting, 
  restaurantId,
  ambienceTags = [],
  cuisines = []
}: ReviewFormProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dishRatings, setDishRatings] = useState<DishRating[]>([]);
  // What the review is about: one or more dishes from the menu, or the restaurant as a whole.
  const [about, setAbout] = useState<'dish' | 'restaurant' | null>(null);
  const [aspects, setAspects] = useState<{ service?: number; atmosphere?: number; value?: number }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { 
    availableDishes, 
    userTagConfirmations, 
    confirmTag 
  } = useDishRatings(restaurantId || '');
  const mode = about ?? (availableDishes.length > 0 ? 'dish' : 'restaurant');

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newPhotos: string[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        toast.error('Alleen afbeeldingen zijn toegestaan');
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error('Afbeelding mag max 5MB zijn');
        continue;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from('review-photos')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Kon foto niet uploaden');
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('review-photos')
        .getPublicUrl(data.path);

      newPhotos.push(urlData.publicUrl);
    }

    setPhotos((prev) => [...prev, ...newPhotos]);
    setUploading(false);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'restaurant' && rating === 0) return;
    if (mode === 'dish' && dishRatings.length === 0) return;
    
    const success = await onSubmit({ 
      aboutRestaurant: mode === 'restaurant',
      rating: mode === 'restaurant' ? rating : undefined,
      title, 
      body, 
      photos,
      dishRatings: dishRatings.map(dr => ({ dishId: dr.dishId, rating: dr.rating })),
      aspects: mode === 'restaurant' ? aspects : undefined,
    });
    if (success) {
      setRating(0);
      setTitle('');
      setBody('');
      setPhotos([]);
      setDishRatings([]);
      setAspects({});
    }
  };

  const hasPhotos = photos.length > 0;

  return (
    <form onSubmit={handleSubmit} className="p-4 md:p-6 rounded-xl bg-muted/50 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm md:text-base">Schrijf een review</h3>
        {hasPhotos && (
          <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
            <Camera className="h-3 w-3" />
            <span>+Foto bonus</span>
          </div>
        )}
      </div>
      
      {/* What the review is about */}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Waar gaat je review over?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            { id: 'dish', title: 'Een gerecht', text: 'Kies wat je at van de kaart' },
            { id: 'restaurant', title: 'Het restaurant', text: 'Sfeer, service en het geheel' },
          ] as const).map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => setAbout(o.id)}
              aria-pressed={mode === o.id}
              disabled={o.id === 'dish' && availableDishes.length === 0}
              className={`min-h-16 rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-50 ${mode === o.id ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'bg-background hover:bg-muted'}`}
            >
              <span className="block text-sm font-semibold">{o.title}</span>
              <span className="block text-xs text-muted-foreground">{o.text}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {mode === 'dish' ? (
        <>
          <DishRatingSelector
            availableDishes={availableDishes}
            selectedRatings={dishRatings}
            onChange={setDishRatings}
            alwaysOpen
            label="Kies je gerecht en geef het sterren"
          />
          <div className="space-y-1.5">
            <label htmlFor="dish-review-body" className="text-sm font-medium">
              Vertel er iets over <span className="font-normal text-muted-foreground">(mag ook leeg)</span>
            </label>
            <Textarea
              id="dish-review-body"
              placeholder="Bijvoorbeeld: de smaak, de portie, de prijs"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="text-base"
            />
          </div>
          <p className="text-xs text-muted-foreground">Je review telt mee voor dit gerecht op deze pagina en in de collecties waar het gerecht in staat.</p>
        </>
      ) : (
        <>
      {/* Star Rating */}
      <div className="flex items-center gap-0.5 md:gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`${star} ${star === 1 ? 'ster' : 'sterren'} voor het restaurant`}
            className="p-0.5 md:p-1 transition-transform hover:scale-110"
          >
            <Star
              className={`h-7 w-7 md:h-6 md:w-6 transition-colors ${
                star <= (hoverRating || rating)
                  ? 'fill-rating text-rating'
                  : 'text-muted-foreground'
              }`}
            />
          </button>
        ))}
        <span className="ml-2 text-xs md:text-sm text-muted-foreground">
          {rating > 0 ? `${rating}/5` : 'Selecteer rating'}
        </span>
      </div>

      <Input
        placeholder="Titel van je review (optioneel)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Titel van je review"
        className="text-base"
      />

      <Textarea
        placeholder="Deel je ervaring..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        required
        aria-label="Je review"
        className="text-base"
      />

      {/* Optional part scores */}
      <div className="grid gap-2 sm:grid-cols-3">
        {([
          { key: 'service', label: 'Service' },
          { key: 'atmosphere', label: 'Sfeer' },
          { key: 'value', label: 'Prijs en kwaliteit' },
        ] as const).map(a => (
          <div key={a.key} className="rounded-lg border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">{a.label} <span className="opacity-75">(optioneel)</span></p>
            <div className="flex" role="radiogroup" aria-label={a.label}>
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} type="button" role="radio" aria-checked={aspects[a.key] === star}
                  aria-label={`${star} ${star === 1 ? 'ster' : 'sterren'} voor ${a.label.toLowerCase()}`}
                  onClick={() => setAspects(prev => ({ ...prev, [a.key]: prev[a.key] === star ? undefined : star }))}
                  className="flex h-9 w-8 items-center justify-center">
                  <Star className={`h-5 w-5 ${star <= (aspects[a.key] ?? 0) ? 'fill-rating text-rating' : 'text-muted-foreground/40'}`} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Optional dish ratings next to a restaurant review */}
      {restaurantId && availableDishes.length > 0 && (
        <DishRatingSelector
          availableDishes={availableDishes}
          selectedRatings={dishRatings}
          onChange={setDishRatings}
          label="Ook een gerecht beoordelen?"
        />
      )}

      {/* Tag Validation Section */}
      {restaurantId && user && (ambienceTags.length > 0 || cuisines.length > 0) && (
        <div className="space-y-2">
          {ambienceTags.length > 0 && (
            <TagValidator
              tags={ambienceTags}
              tagType="ambience"
              userConfirmations={userTagConfirmations}
              onConfirm={(tag, isConfirmed) => confirmTag(tag, 'ambience', isConfirmed)}
            />
          )}
          {cuisines.length > 0 && (
            <TagValidator
              tags={cuisines}
              tagType="cuisine"
              userConfirmations={userTagConfirmations}
              onConfirm={(tag, isConfirmed) => confirmTag(tag, 'cuisine', isConfirmed)}
            />
          )}
        </div>
      )}
        </>
      )}

      {/* Photo Upload Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Foto's toevoegen
            <span className="text-xs text-muted-foreground font-normal">(aanbevolen)</span>
          </label>
        </div>

        {/* Photo Preview Grid */}
        <AnimatePresence>
          {photos.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-3 gap-2"
            >
              {photos.map((photo, index) => (
                <motion.div
                  key={photo}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative aspect-square rounded-lg overflow-hidden group"
                >
                  <img
                    src={photo}
                    alt={`Review foto ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute top-1 right-1 p-1 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotoUpload}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full border-dashed"
        >
          {uploading ? (
            'Uploaden...'
          ) : (
            <>
              <ImageIcon className="h-4 w-4 mr-2" />
              {photos.length > 0 ? 'Meer foto\'s toevoegen' : 'Voeg foto\'s toe'}
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Reviews met foto's krijgen extra zichtbaarheid
        </p>
      </div>

      <Button type="submit" disabled={(mode === 'restaurant' ? rating === 0 : dishRatings.length === 0) || submitting} className="min-h-11 w-full md:w-auto">
        {submitting ? 'Plaatsen...' : 'Review plaatsen'}
      </Button>
    </form>
  );
}
