import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { User, Users, ArrowLeft, Copy, MessageCircle, Star, Loader2, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { AMBIENCES, FOOD_CATEGORIES } from '@/lib/foodMatch';
import { optimizedImage } from '@/lib/imageUrl';
import { SwipeDeck } from './SwipeDeck';
import { matchRestaurants, type MatchResult } from './matchRestaurants';
import { toast } from 'sonner';

type Step = 'company' | 'name' | 'city' | 'ambience' | 'dishes' | 'wait' | 'result';
interface Answer { name: string; ambiences: string[]; dishes: string[] }

function token(): string {
  const k = 'dl_food_match_token';
  try {
    let t = localStorage.getItem(k);
    if (!t) { t = crypto.randomUUID(); localStorage.setItem(k, t); }
    return t;
  } catch { return crypto.randomUUID(); }
}

const Option = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick}
    className={`relative min-h-[64px] rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${active
      ? 'border-primary bg-primary/10 shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.7)] scale-[1.02]'
      : 'border-border bg-card hover:border-primary/50'}`}>
    {active && <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />}
    {children}
  </button>
);

export function FoodMatchFlow({ guestCode, onBack }: { guestCode?: string; onBack?: () => void }) {
  const isGuest = !!guestCode;
  const [step, setStep] = useState<Step>(isGuest ? 'name' : 'company');
  const [group, setGroup] = useState(isGuest);
  const [name, setName] = useState('');
  const [cityId, setCityId] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [ambiences, setAmbiences] = useState<string[]>([]);
  const [code, setCode] = useState<string | null>(guestCode ?? null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('cities').select('id,name').eq('is_active', true).order('name').then(({ data }) => setCities(data ?? []));
  }, []);

  // Prefill the name from the signed-in account; only ask when there is none.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle();
      const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
      const found = (profile?.name || meta?.full_name || meta?.name || '').trim();
      if (!cancelled && found) setName((n) => (n.trim() ? n : found));
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!guestCode) return;
    supabase.rpc('food_match_get' as never, { p_code: guestCode } as never).then(({ data }) => {
      const d = data as unknown as { city_id: string } | null;
      if (d?.city_id) setCityId(d.city_id); else toast.error('Deze sessie bestaat niet meer');
    });
  }, [guestCode]);

  const refresh = async (c: string) => {
    const { data } = await supabase.rpc('food_match_get' as never, { p_code: c } as never);
    const d = data as unknown as { answers: Answer[] } | null;
    if (d) setAnswers(d.answers);
    return d?.answers ?? [];
  };

  useEffect(() => {
    if (step !== 'wait' || !code) return;
    refresh(code);
    const id = setInterval(() => refresh(code), 3000);
    return () => clearInterval(id);
  }, [step, code]);

  const showResults = async (lists: Answer[]) => {
    setStep('result'); setLoading(true);
    try {
      setResults(await matchRestaurants(cityId, lists.map((a) => a.dishes), lists.map((a) => a.ambiences)));
    } catch { setResults([]); } finally { setLoading(false); }
  };

  const finishDishes = async (dishes: string[]) => {
    const me: Answer = { name: name || 'Ik', ambiences, dishes };
    if (!group) return showResults([me]);
    setLoading(true);
    try {
      let c = code;
      if (!c) {
        const { data, error } = await supabase.rpc('food_match_create' as never, { p_city_id: cityId, p_host_name: name } as never);
        if (error) throw error;
        c = data as unknown as string; setCode(c);
      }
      const { error } = await supabase.rpc('food_match_submit' as never, { p_code: c, p_token: token(), p_name: name, p_ambiences: ambiences, p_dishes: dishes } as never);
      if (error) throw error;
      setStep('wait');
    } catch { toast.error('Opslaan lukte niet, probeer opnieuw'); } finally { setLoading(false); }
  };

  const shareUrl = code ? `${window.location.origin}/food-match/${code}` : '';
  const order: Step[] = isGuest ? ['name', 'ambience', 'dishes', 'wait', 'result'] : group
    ? ['company', 'city', 'ambience', 'dishes', 'wait', 'result'] : ['company', 'city', 'ambience', 'dishes', 'result'];
  const progress = ((order.indexOf(step) + 1) / order.length) * 100;
  const back = () => {
    const i = order.indexOf(step);
    if (i <= 0 || step === 'wait' || step === 'result') onBack?.(); else setStep(order[i - 1]);
  };
  const cityName = useMemo(() => cities.find((c) => c.id === cityId)?.name, [cities, cityId]);

  const Title = ({ k, sub }: { k: string; sub?: string }) => (
    <div className="mb-6 text-center">
      <h3 className="font-display text-2xl md:text-3xl font-bold tracking-tight">{k}</h3>
      {sub && <p className="text-sm text-muted-foreground mt-1">{sub}</p>}
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        {onBack || order.indexOf(step) > 0 ? (
          <button onClick={back} aria-label="Terug" className="h-11 w-11 rounded-full border border-border flex items-center justify-center hover:border-primary/50"><ArrowLeft className="h-4 w-4" /></button>
        ) : null}
        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
          <motion.div className="h-full bg-gradient-to-r from-primary to-primary/60" animate={{ width: `${progress}%` }} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
          {step === 'company' && (
            <>
              <Title k="Met wie ga je eten?" />
              <div className="grid grid-cols-2 gap-3">
                <Option active={!group} onClick={() => { setGroup(false); setStep('city'); }}>
                  <User className="h-7 w-7 text-primary mb-2" /><p className="font-display font-semibold">Alleen</p><p className="text-xs text-muted-foreground">Ik kies zelf</p>
                </Option>
                <Option active={group} onClick={() => setGroup(true)}>
                  <Users className="h-7 w-7 text-primary mb-2" /><p className="font-display font-semibold">Met vrienden</p><p className="text-xs text-muted-foreground">Iedereen stemt mee</p>
                </Option>
              </div>
              {group && (
                <div className="mt-5 space-y-3">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jouw naam" maxLength={40} className="h-12 rounded-xl" />
                  <Button className="w-full h-12 rounded-xl" disabled={!name.trim()} onClick={() => setStep('city')}>Verder</Button>
                </div>
              )}
            </>
          )}

          {step === 'name' && (
            <>
              <Title k="Je bent uitgenodigd!" sub="Stem mee waar jullie gaan eten" />
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jouw naam" maxLength={40} className="h-12 rounded-xl mb-3" />
              <Button className="w-full h-12 rounded-xl" disabled={!name.trim() || !cityId} onClick={() => setStep('ambience')}>Start</Button>
            </>
          )}

          {step === 'city' && (
            <>
              <Title k="In welke stad?" />
              <Input value={cityQuery} onChange={(e) => setCityQuery(e.target.value)} placeholder="Typ een stad…" autoFocus className="h-12 rounded-xl mb-3" aria-label="Zoek stad" />
              <div className="grid grid-cols-2 gap-2 max-h-[45vh] overflow-y-auto pr-1">
                {cities.filter((c) => c.name.toLowerCase().includes(cityQuery.trim().toLowerCase())).map((c) => (
                  <Option key={c.id} active={cityId === c.id} onClick={() => { setCityId(c.id); setStep('ambience'); }}>
                    <span className="font-medium">{c.name}</span>
                  </Option>
                ))}
                {cityQuery && !cities.some((c) => c.name.toLowerCase().includes(cityQuery.trim().toLowerCase())) && (
                  <p className="col-span-2 py-6 text-center text-sm text-muted-foreground">Geen stad gevonden</p>
                )}
              </div>
            </>
          )}

          {step === 'ambience' && (
            <>
              <Title k="Welke sfeer?" sub="Kies er één of meer" />
              <div className="grid grid-cols-2 gap-3">
                {AMBIENCES.map((a) => (
                  <Option key={a.id} active={ambiences.includes(a.id)} onClick={() => setAmbiences((p) => p.includes(a.id) ? p.filter((x) => x !== a.id) : [...p, a.id])}>
                    <span className="flex items-center gap-2"><span className="text-2xl" aria-hidden>{a.emoji}</span><span className="font-medium text-sm">{a.id}</span></span>
                  </Option>
                ))}
              </div>
              <Button className="w-full h-12 rounded-xl mt-5" onClick={() => setStep('dishes')}>{ambiences.length ? 'Verder' : 'Maakt niet uit'}</Button>
            </>
          )}

          {step === 'dishes' && (
            <>
              <Title k="Waar heb je zin in?" sub="Swipe rechts voor lekker, links voor nee" />
              {loading ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /> : <SwipeDeck items={FOOD_CATEGORIES} onDone={finishDishes} />}
            </>
          )}

          {step === 'wait' && (
            <>
              <Title k={isGuest ? 'Je stem is binnen!' : 'Nodig je vrienden uit'} sub={cityName ? `Eten in ${cityName}` : undefined} />
              {!isGuest && (
                <div className="flex gap-2 mb-5">
                  <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => { navigator.clipboard?.writeText(shareUrl); toast.success('Link gekopieerd'); }}><Copy className="h-4 w-4 mr-2" />Kopieer link</Button>
                  <Button asChild variant="outline" className="flex-1 h-12 rounded-xl">
                    <a href={`https://wa.me/?text=${encodeURIComponent(`Stem mee waar we gaan eten: ${shareUrl}`)}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4 mr-2" />WhatsApp</a>
                  </Button>
                </div>
              )}
              <div className="rounded-2xl border border-border bg-muted/40 p-4 mb-5">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">{answers.length} gestemd</p>
                <ul className="space-y-2">
                  {answers.map((a, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm"><span className="h-8 w-8 rounded-full bg-primary/15 text-primary font-semibold flex items-center justify-center">{a.name.slice(0, 1).toUpperCase()}</span>{a.name}<Check className="h-4 w-4 text-primary ml-auto" /></li>
                  ))}
                </ul>
              </div>
              <Button className="w-full h-12 rounded-xl" onClick={async () => showResults(await refresh(code!))}><Sparkles className="h-4 w-4 mr-2" />Toon resultaat</Button>
            </>
          )}

          {step === 'result' && (
            <>
              <Title k="Jullie match" sub={group ? `Op basis van ${answers.length || 1} stemmen` : 'Twee restaurants die bij je passen'} />
              {loading ? (
                <div className="py-12 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /><p className="text-sm text-muted-foreground mt-3">Matches zoeken…</p></div>
              ) : results && results.length ? (
                <div className="space-y-4">
                  {results.map((r, i) => (
                    <motion.div key={r.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }}>
                      <Link to={`/restaurant/${r.slug}`} className="block overflow-hidden rounded-3xl border border-primary/20 bg-card shadow-xl transition hover:-translate-y-0.5">
                        <div className="relative aspect-[16/9] bg-gradient-to-br from-primary/30 to-muted">
                          {r.image && <img src={optimizedImage(r.image, { width: 640 })} alt={r.name} width={640} height={360} loading="lazy" className="h-full w-full object-cover" />}
                          <span className="absolute top-3 left-3 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold">#{i + 1} match</span>
                        </div>
                        <div className="p-4">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-display text-xl font-bold">{r.name}</h4>
                            {r.rating ? <span className="flex items-center gap-1 text-sm"><Star className="h-4 w-4 fill-primary text-primary" />{r.rating.toFixed(1)}</span> : null}
                          </div>
                          {r.reasons.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{r.reasons.slice(0, 5).map((x) => <span key={x} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{x}</span>)}</div>}
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-8">Geen match gevonden in deze stad. Probeer andere gerechten.</p>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
