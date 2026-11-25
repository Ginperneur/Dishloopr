import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CookingPot, Fish, Flame, Leaf, Pizza, Soup, Sun, UtensilsCrossed, Wine, type LucideIcon } from 'lucide-react';
import { moodBackground, moodTheme, type MoodTheme } from '@/lib/moodImage';

const ICONS: Record<MoodTheme, LucideIcon> = {
  italiaans: Pizza, vis: Fish, aziatisch: Soup, kruiden: CookingPot, zuiden: Sun,
  grill: Flame, eetcafe: Wine, groen: Leaf, neutraal: UtensilsCrossed,
};

interface MoodImageProps {
  /** Stable seed, normally the restaurant id (or slug when no id is at hand). */
  seed: string;
  name: string;
  cuisinePrimary?: string | null;
  cuisines?: string[] | null;
  /** card: list cards; hero: restaurant page; thumb: small tiles without a label. */
  size?: 'card' | 'hero' | 'thumb';
  /** Where the label sits, so it never covers a badge the surface already puts in a corner. */
  labelAt?: 'bottom-left' | 'bottom-right' | 'top-right';
}

/** Fills its (relative) parent with the restaurant's sfeerbeeld. See src/lib/moodImage.ts. */
export function MoodImage({ seed, name, cuisinePrimary, cuisines, size = 'card', labelAt = 'bottom-left' }: MoodImageProps) {
  const { t } = useTranslation();
  const theme = moodTheme(cuisinePrimary, cuisines);
  const background = useMemo(() => moodBackground(seed, theme), [seed, theme]);
  const Icon = ICONS[theme];
  const label = size === 'hero'
    ? t('restaurant.moodImageNoPhotos', "Sfeerbeeld · nog geen eigen foto's")
    : t('restaurant.moodImage', 'Sfeerbeeld');
  const circle = size === 'thumb' ? 'h-8 w-8' : size === 'hero' ? 'h-20 w-20' : 'h-14 w-14';
  const icon = size === 'thumb' ? 'h-4 w-4' : size === 'hero' ? 'h-9 w-9' : 'h-7 w-7';
  const corner = { 'bottom-left': 'bottom-3 left-3', 'bottom-right': 'bottom-3 right-3', 'top-right': 'top-3 right-3' }[labelAt];

  return (
    <div
      role="img"
      aria-label={t('restaurant.moodImageAlt', { defaultValue: 'Sfeerbeeld, nog geen eigen foto van {{name}}', name })}
      className="absolute inset-0 overflow-hidden"
      style={{ background }}
      data-mood-theme={theme}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(0,0,0,0.45),transparent_60%)]" aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <span className={`${circle} flex items-center justify-center rounded-full border border-white/35 bg-white/15`}>
          <Icon className={`${icon} text-white/90`} strokeWidth={1.6} />
        </span>
      </div>
      {size !== 'thumb' && (
        <span className={`absolute ${corner} rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white`} aria-hidden="true">
          {label}
        </span>
      )}
    </div>
  );
}
