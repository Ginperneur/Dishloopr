import { useState } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence, PanInfo } from 'framer-motion';
import { Heart, X } from 'lucide-react';
import type { FoodCategory } from '@/lib/foodMatch';

interface Props { items: FoodCategory[]; onDone: (liked: string[]) => void }

function Card({ item, onSwipe }: { item: FoodCategory; onSwipe: (like: boolean) => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-14, 14]);
  const likeOpacity = useTransform(x, [20, 120], [0, 1]);
  const nopeOpacity = useTransform(x, [-120, -20], [1, 0]);
  const end = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 100) onSwipe(true);
    else if (info.offset.x < -100) onSwipe(false);
  };
  return (
    <motion.div
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={end}
      initial={{ scale: 0.92, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ x: x.get() >= 0 ? 400 : -400, opacity: 0, transition: { duration: 0.25 } }}
      className="absolute inset-0 cursor-grab active:cursor-grabbing rounded-3xl border border-primary/30 bg-gradient-to-br from-card via-card to-primary/10 shadow-2xl flex flex-col items-center justify-center select-none touch-pan-y"
    >
      <motion.span style={{ opacity: likeOpacity }} className="absolute top-5 left-5 rounded-lg border-2 border-primary px-3 py-1 font-display text-sm font-bold uppercase tracking-widest text-primary -rotate-12">Lekker</motion.span>
      <motion.span style={{ opacity: nopeOpacity }} className="absolute top-5 right-5 rounded-lg border-2 border-muted-foreground px-3 py-1 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground rotate-12">Nee</motion.span>
      <span className="text-8xl drop-shadow-lg mb-4" aria-hidden>{item.emoji}</span>
      <h3 className="font-display text-3xl font-bold">{item.label}</h3>
    </motion.div>
  );
}

export function SwipeDeck({ items, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const [liked, setLiked] = useState<string[]>([]);
  const current = items[index];
  const swipe = (like: boolean) => {
    const next = like ? [...liked, current.id] : liked;
    setLiked(next);
    if (index + 1 >= items.length) onDone(next); else setIndex(index + 1);
  };
  if (!current) return null;
  return (
    <div className="flex flex-col items-center">
      <p className="text-xs text-muted-foreground mb-3">{index + 1} / {items.length} · {liked.length} gekozen</p>
      <div className="relative w-full max-w-[280px] aspect-[3/4]">
        <AnimatePresence>
          <Card key={current.id} item={current} onSwipe={swipe} />
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-6 mt-6">
        <button aria-label="Nee" onClick={() => swipe(false)} className="h-14 w-14 rounded-full border border-border bg-card shadow-lg flex items-center justify-center text-muted-foreground transition hover:scale-110"><X className="h-6 w-6" /></button>
        <button aria-label="Lekker" onClick={() => swipe(true)} className="h-16 w-16 rounded-full bg-primary text-primary-foreground shadow-[0_10px_30px_-8px_hsl(var(--primary)/0.6)] flex items-center justify-center transition hover:scale-110"><Heart className="h-7 w-7 fill-current" /></button>
      </div>
      {liked.length > 0 && (
        <button onClick={() => onDone(liked)} className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline min-h-[44px]">Klaar, toon matches</button>
      )}
    </div>
  );
}
