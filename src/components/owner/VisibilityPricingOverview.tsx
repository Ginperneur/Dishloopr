import { Sparkles, Crown, Rocket, Mail, ChefHat, MapPin, TrendingUp, Zap, Flame, ArrowRight, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useFeaturedMarketplace } from '@/hooks/useFeaturedMarketplace';

interface Props {
  onNavigatePro?: () => void;
}

/**
 * Inviting marketplace-hero bovenaan de Promoties-tab. Toont alles wat
 * een eigenaar kan aanschaffen, met heldere voordelen en prijzen — bedoeld
 * om te informeren én uit te dagen om te upgraden.
 */
export function VisibilityPricingOverview({ onNavigatePro }: Props = {}) {
  const { ambiancePricing } = useFeaturedMarketplace();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const products = [
    {
      id: 'pro',
      icon: Crown,
      title: 'Owner Pro',
      tagline: 'Inzichten + Markt + onbeperkte tags',
      price: '€29',
      unit: '/maand',
      sub: 'of €290/jaar — 2 maanden gratis',
      badge: { label: 'Beste waarde', tone: 'bg-primary text-primary-foreground' },
      benefits: ['Volledige analytics & funnels', 'Concurrentie en marktdata', 'Onbeperkt concept-tags'],
      cta: 'Word Pro',
      action: () => onNavigatePro?.(),
      accent: 'from-amber-400 to-orange-500',
    },
    {
      id: 'featured-marketplace',
      icon: Sparkles,
      title: 'Premium Zoekplek',
      tagline: 'Vast bovenaan per stad + keuken',
      price: 'vanaf €99',
      unit: '/maand',
      sub: 'Marktprijs — schaarste per categorie',
      badge: { label: 'Meest verkocht', tone: 'bg-orange-500 text-white' },
      benefits: ['Top of search in jouw niche', '+50% klikken gemiddeld', 'Tot 3 maanden vooraf vastleggen'],
      cta: 'Bekijk plekken',
      action: () => scrollTo('promo-featured'),
      accent: 'from-pink-500 to-rose-500',
    },
    {
      id: 'ambiance',
      icon: MapPin,
      title: 'Ambiance Add-ons',
      tagline: 'Word gevonden op sfeer',
      price: '1e tag gratis',
      unit: '',
      sub: 'Extra tags doorlopend, maandelijks opzegbaar',
      badge: { label: 'Doorlopend', tone: 'bg-emerald-500 text-white' },
      benefits: ['Romantisch, trendy, business…', 'Bereik gasten op intentie', 'Voor altijd actief'],
      cta: 'Kies sfeer',
      action: () => scrollTo('promo-featured'),
      accent: 'from-violet-500 to-fuchsia-500',
    },
    {
      id: 'listings',
      icon: TrendingUp,
      title: 'Listing Boosts',
      tagline: 'Eenmalige 30-dagen boost',
      price: '€49 – €99',
      unit: '',
      sub: 'Featured €49 · Top €99',
      benefits: ['Snel meer zichtbaarheid', 'Geen abonnement', 'Direct actief na betaling'],
      cta: 'Boost nu',
      action: () => scrollTo('promo-listings'),
      accent: 'from-sky-500 to-blue-600',
    },
    {
      id: 'sponsored',
      icon: ChefHat,
      title: 'Sponsor een Gerecht',
      tagline: 'Push je signature dish',
      price: 'per dag',
      unit: '',
      sub: 'Kies duur en stad',
      benefits: ['Specifiek gerecht promoten', 'Korte campagnes mogelijk', 'Top of category'],
      cta: 'Sponsor gerecht',
      action: () => scrollTo('promo-sponsored'),
      accent: 'from-amber-500 to-yellow-600',
    },
    {
      id: 'newsletter',
      icon: Mail,
      title: 'Nieuwsbrief Plaatsing',
      tagline: 'Bereik foodies in hun inbox',
      price: '€15 – €40',
      unit: '',
      sub: 'Stad €15 · Provincie €20 · NL €40',
      benefits: ['Hoge engagement', 'Geografisch te targeten', 'Eenmalige kosten'],
      cta: 'Plan plaatsing',
      action: () => scrollTo('promo-newsletter'),
      accent: 'from-teal-500 to-cyan-600',
    },
  ];

  return (
    <Card className="border-primary/30 overflow-hidden">
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b border-primary/20 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground inline-flex items-center justify-center shrink-0 shadow-md">
            <Rocket className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-lg leading-tight">Groei-shop voor jouw restaurant</h3>
              <Badge className="bg-orange-500 text-white border-0 inline-flex items-center gap-1">
                <Flame className="h-3 w-3" /> Live marktprijzen
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Alles wat je kunt aanschaffen om meer gasten te bereiken — in één overzicht.
              Klik op een product om direct te activeren.
            </p>
          </div>
        </div>
      </div>

      <CardContent className="p-0">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
          {products.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.id}
                className="group relative bg-card p-5 flex flex-col hover:bg-accent/30 transition-colors"
              >
                {p.badge && (
                  <span className={`absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.badge.tone}`}>
                    {p.badge.label}
                  </span>
                )}
                <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${p.accent} text-white inline-flex items-center justify-center shadow-sm mb-3`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h4 className="font-bold text-base leading-tight">{p.title}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{p.tagline}</p>

                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-xl font-bold">{p.price}</span>
                  {p.unit && <span className="text-xs text-muted-foreground">{p.unit}</span>}
                </div>
                <p className="text-[11px] text-muted-foreground">{p.sub}</p>

                <ul className="mt-3 space-y-1 flex-1">
                  {p.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  size="sm"
                  variant={p.badge?.label === 'Beste waarde' ? 'default' : 'outline'}
                  onClick={p.action}
                  className="mt-4 w-full justify-between group-hover:border-primary"
                >
                  {p.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>

        {ambiancePricing.length > 0 && (
          <div className="px-5 py-3 border-t bg-muted/30">
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              <span className="inline-flex items-center gap-1 font-medium text-muted-foreground">
                <Zap className="h-3 w-3 text-primary" /> Ambiance tarieven:
              </span>
              {ambiancePricing.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1 bg-background px-2 py-0.5 rounded-full border">
                  <span className="capitalize">{a.ambiance_tag}</span>
                  <strong className="text-foreground">€{a.monthly_price}/m</strong>
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}