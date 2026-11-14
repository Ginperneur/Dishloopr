import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Crown, Gavel, HelpCircle, ShieldCheck, TrendingUp, Zap } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { auctionOutcome, formatEuroCents } from '@/lib/promoSlots';

const EXAMPLE = [
  { name: 'Restaurant A', cents: 4000 },
  { name: 'Restaurant B', cents: 3000 },
  { name: 'Restaurant C', cents: 2500 },
  { name: 'Restaurant D', cents: 2000 },
];

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{n}</span>
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        <div className="text-sm text-muted-foreground space-y-2">{children}</div>
      </div>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border bg-card p-4">
      <summary className="cursor-pointer list-none font-medium flex items-center justify-between gap-3">
        {q}<span className="text-muted-foreground transition-transform group-open:rotate-45 text-xl leading-none" aria-hidden>+</span>
      </summary>
      <div className="mt-2 text-sm text-muted-foreground space-y-2">{children}</div>
    </details>
  );
}

/** Explains paid places, demand prices, bids and the quarterly auction to restaurant owners. */
export default function PlacesExplainedPage() {
  const example = auctionOutcome(EXAMPLE, 3, 1500);
  const [bids, setBids] = useState(['40', '30', '25', '20']);
  const own = useMemo(() => auctionOutcome(
    bids.map((b, i) => ({ name: `Bod ${i + 1}`, cents: Math.round(Number(b.replace(',', '.')) * 100) }))
      .filter(b => Number.isFinite(b.cents) && b.cents >= 1500),
    3, 1500), [bids]);

  return (
    <Layout>
      <SEOHead
        title="Zo werken plekken, prijzen en bieden | Dishloopr voor restaurants"
        description="Uitleg voor restaurants: hoe Uitgelicht en Vraag doorsturen werken, hoe de prijs ontstaat, hoe bieden werkt en wat de veiling per kwartaal betekent."
      />
      <div className="container max-w-3xl py-12 md:py-16 space-y-14">
        <header className="space-y-4">
          <Badge variant="secondary">Voor restaurants</Badge>
          <h1 className="font-display text-4xl font-bold leading-tight md:text-5xl">Zo werken plekken, prijzen en bieden</h1>
          <p className="text-lg text-muted-foreground">
            Met een betaalde plek sta je vooraan wanneer gasten een gerecht zoeken dat jij serveert. Het aantal plekken is beperkt,
            zodat een plek ook echt iets oplevert. Hieronder lees je hoe je een plek krijgt, wat het kost en hoe je hem houdt.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold">Twee soorten plekken</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card><CardContent className="space-y-2 p-5">
              <p className="flex items-center gap-2 font-semibold"><Crown className="h-5 w-5 text-primary" />Uitgelicht</p>
              <p className="text-sm text-muted-foreground">Je staat bovenaan een gerechtpagina in je stad, bijvoorbeeld bij pizza in Utrecht. Per pagina zijn er 5 plekken. Prijs vanaf €99 per maand.</p>
            </CardContent></Card>
            <Card><CardContent className="space-y-2 p-5">
              <p className="flex items-center gap-2 font-semibold"><Zap className="h-5 w-5 text-primary" />Vraag doorsturen</p>
              <p className="text-sm text-muted-foreground">Is een ander restaurant met hetzelfde gerecht gesloten of vol, dan sturen we de gast naar jou door. Per gerecht per stad zijn er 3 plekken. Prijs vanaf €15 per maand per gerecht.</p>
            </CardContent></Card>
          </div>
          <p className="text-sm text-muted-foreground">
            Gasten zien altijd dat een plek betaald is: je staat er met het label Gesponsord of Uitgelicht. Zo blijft Dishloopr eerlijk voor gasten, en daarmee waardevol voor jou.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold"><TrendingUp className="h-6 w-6 text-primary" />Hoe de prijs ontstaat</h2>
          <p className="text-muted-foreground">
            Elke combinatie van gerecht en stad heeft een eigen prijs, de lijstprijs. Die hangt af van twee dingen die we zelf meten:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li><strong className="text-foreground">Hoe vaak gasten erop zoeken.</strong> Veel zoekopdrachten naar sushi in Amsterdam betekent veel gasten, dus een hogere prijs.</li>
            <li><strong className="text-foreground">Hoeveel restaurants het gerecht serveren.</strong> Meer restaurants betekent meer vraag naar dezelfde plekken.</li>
          </ul>
          <p className="text-muted-foreground">
            Rustige combinaties blijven op de basisprijs (€15 of €99). Drukke combinaties worden in stappen van €5 duurder, tot maximaal vijf keer de basisprijs.
            Je ziet de lijstprijs altijd voordat je iets koopt of biedt.
          </p>
        </section>

        <section className="space-y-6">
          <h2 className="font-display text-2xl font-bold">Zo krijg je een plek</h2>
          <Step n={1} title="Is er een plek vrij? Dan koop je hem direct">
            <p>Je betaalt de lijstprijs per maand en je staat meteen live. Maandelijks opzegbaar.</p>
          </Step>
          <Step n={2} title="Alles bezet? Dan bied je">
            <p>Je vult het bedrag in dat je <strong className="text-foreground">maximaal</strong> per maand wilt betalen, minimaal de lijstprijs. Je komt daarmee op de wachtlijst. Bieden kost niets: je betaalt pas als je een plek krijgt.</p>
          </Step>
          <Step n={3} title="Komt er een plek vrij, dan gaat die naar het hoogste bod">
            <p>Je krijgt een melding en hebt 7 dagen om af te ronden. Doe je dat niet, dan gaat de plek naar het volgende bod.</p>
          </Step>
          <Step n={4} title="Elk kwartaal is er een veiling">
            <p>Op 1 januari, 1 april, 1 juli en 1 oktober bekijken we elke combinatie waar biedingen op staan. Wie een plek heeft, doet mee met de lijstprijs, of met een eigen hoger bod. De hoogste bieders houden of krijgen een plek.</p>
          </Step>
        </section>

        <section className="space-y-4">
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold"><Gavel className="h-6 w-6 text-primary" />Wat je betaalt na een veiling</h2>
          <p className="text-muted-foreground">
            Je betaalt <strong className="text-foreground">nooit je eigen bod</strong>. Alle winnaars betalen hetzelfde bedrag: het hoogste bod dat net niet won, en minimaal de lijstprijs.
            Daardoor kun je gewoon bieden wat een plek je echt waard is. Hoger bieden verhoogt je kans, maar niet je prijs.
          </p>
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="text-sm font-semibold">Voorbeeld: Vraag doorsturen voor biefstuk in Den Haag, 3 plekken, lijstprijs €15</p>
              <ul className="divide-y text-sm">
                {EXAMPLE.map(b => {
                  const wins = example.winners.some(w => w.name === b.name);
                  return (
                    <li key={b.name} className="flex items-center justify-between py-2">
                      <span>{b.name} biedt {formatEuroCents(b.cents)}</span>
                      <Badge variant={wins ? 'default' : 'secondary'}>{wins ? `Plek, betaalt ${formatEuroCents(example.priceCents)}` : 'Op de wachtlijst'}</Badge>
                    </li>
                  );
                })}
              </ul>
              <p className="text-sm text-muted-foreground">
                A, B en C krijgen een plek en betalen alle drie {formatEuroCents(example.priceCents)} per maand: het bod van D, het hoogste bod dat net niet won.
                D blijft op de wachtlijst en krijgt de eerste plek die vrijkomt.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/30">
            <CardContent className="space-y-4 p-5">
              <p className="text-sm font-semibold">Probeer het zelf (3 plekken, lijstprijs €15)</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {bids.map((b, i) => (
                  <div key={i} className="space-y-1">
                    <Label htmlFor={`bid-${i}`} className="text-xs">Bod {i + 1} (€)</Label>
                    <Input id={`bid-${i}`} inputMode="decimal" value={b} className="min-h-11"
                      onChange={e => setBids(prev => prev.map((x, j) => (j === i ? e.target.value : x)))} />
                  </div>
                ))}
              </div>
              <p className="text-sm" role="status">
                {own.winners.length === 0
                  ? 'Vul biedingen in van minimaal €15.'
                  : `${own.winners.map(w => w.name).join(', ')} ${own.winners.length === 1 ? 'krijgt' : 'krijgen'} een plek en ${own.winners.length === 1 ? 'betaalt' : 'betalen'} ${formatEuroCents(own.priceCents)} per maand.`}
                {own.losers.length > 0 && ` ${own.losers.map(l => l.name).join(', ')} ${own.losers.length === 1 ? 'blijft' : 'blijven'} op de wachtlijst.`}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold"><CalendarClock className="h-6 w-6 text-primary" />Je plek houden</h2>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li><strong className="text-foreground">Niemand biedt?</strong> Dan loopt je plek gewoon door. Wel kan de lijstprijs elk kwartaal meebewegen met de vraag; dat zie je vooraf in je dashboard en op je factuur.</li>
            <li><strong className="text-foreground">Wil je je plek zeker houden?</strong> Bied zelf hoger dan de lijstprijs. Je betaalt alleen meer als anderen ook hoger bieden.</li>
            <li><strong className="text-foreground">Ben je overboden?</strong> Dan houd je je plek tot het eind van de maand waarvoor je al betaald hebt. Je krijgt een melding en kunt direct opnieuw bieden.</li>
            <li><strong className="text-foreground">Wil je stoppen?</strong> Zeg op wanneer je wilt via je dashboard; je plek loopt dan af aan het eind van je betaalde maand.</li>
          </ul>
        </section>

        <section className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-6">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold"><ShieldCheck className="h-5 w-5 text-primary" />Founding Partners</h2>
          <p className="text-sm text-muted-foreground">
            Neem je Uitgelicht tot en met 5 januari 2027, dan word je Founding Partner. Je betaalt €59 per maand (of €590 per jaar) en je plek valt
            tot en met 31 december 2027 buiten de veiling: niemand kan je overbieden en je prijs verandert niet. Je Founding Partner badge blijft altijd staan.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold"><HelpCircle className="h-6 w-6 text-primary" />Veelgestelde vragen</h2>
          <Faq q="Betaal ik ooit meer dan mijn bod?">
            <p>Nee. Je bod is je maximum. Meestal betaal je minder: het hoogste bod dat net niet won, of de lijstprijs.</p>
          </Faq>
          <Faq q="Kost bieden geld?">
            <p>Nee. Je betaalt pas als je een plek krijgt en je afrekent. Je kunt een bod altijd aanpassen of intrekken.</p>
          </Faq>
          <Faq q="Waarom zijn er maar 3 of 5 plekken?">
            <p>Zodat elke plek echt opvalt. Bij onbeperkt veel plekken zou elke betaler minder gasten krijgen.</p>
          </Faq>
          <Faq q="Kan ik voor elke stad kiezen bij Vraag doorsturen?">
            <p>Ja. Je kiest een stad en een gerecht van je eigen menu. Elk gerecht in elke stad is een aparte plek met een eigen prijs. Biefstuk en sushi in Den Haag zijn dus twee plekken.</p>
          </Faq>
          <Faq q="Wat ziet de gast?">
            <p>De gast ziet je restaurant bovenaan met het label Gesponsord of Uitgelicht. Zijn er geen betalende restaurants, dan tonen we gewoon de best passende restaurants.</p>
          </Faq>
          <Faq q="Zijn de prijzen inclusief btw?">
            <p>Nee, alle prijzen zijn exclusief btw.</p>
          </Faq>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="min-h-12 rounded-full"><Link to="/voor-restaurants/pakketten">Bekijk de pakketten</Link></Button>
          <Button asChild size="lg" variant="outline" className="min-h-12 rounded-full"><Link to="/owner-dashboard?tab=promotions">Naar Promoties in je dashboard</Link></Button>
        </div>
      </div>
    </Layout>
  );
}
