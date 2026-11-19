import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { PaidLabel } from '@/components/paid/PaidLabel';

/** For guests: what the paid places are and what they are not. Linked from every "Waarom zie ik dit?". */
export default function PaidPlacesPage() {
  return (
    <Layout>
      <SEOHead title="Betaalde plekken op Dishloopr" description="Zo werken Topplek, Uitgelicht en de Stadsspotlight, en waarom de rest van de lijst eerlijk op beoordeling blijft." />
      <article className="container max-w-2xl space-y-8 py-12">
        <header className="space-y-3">
          <h1 className="font-display text-4xl font-bold tracking-tight">Betaalde plekken</h1>
          <p className="text-lg text-muted-foreground">Restaurants kunnen betalen om bovenaan te staan. Je ziet altijd welke plekken betaald zijn.</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Welke plekken zijn betaald?</h2>
          <ul className="space-y-3">
            <li className="flex flex-col gap-1.5"><PaidLabel kind="topplek" /><span>Eén restaurant per pagina, bovenaan op een gerecht-, keuken- of romantisch-pagina, bovenaan bij zoeken, op de kaart en op de homepage van de stad.</span></li>
            <li className="flex flex-col gap-1.5"><PaidLabel kind="uitgelicht" /><span>Drie restaurants per pagina, direct onder de Topplek. Ze wisselen elke dag van volgorde.</span></li>
            <li className="flex flex-col gap-1.5"><PaidLabel kind="spotlight" /><span>Drie restaurants per stad per week op de homepage, met een eigen reden zoals een nieuw menu.</span></li>
          </ul>
          <p>Evenementen en de stadsnieuwsbrief zijn ook door restaurants geplaatst en staan zo vermeld.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Wat je erop kunt vertrouwen</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Een restaurant kan alleen betalen voor een pagina waar het echt op hoort: het gerecht staat op de eigen kaart, of de keuken zit in de kaart.</li>
            <li>Een sfeer zoals romantisch telt alleen als die niet gekocht is.</li>
            <li>Er komen pas betaalde plekken op een pagina als er minstens 10 restaurants op staan.</li>
            <li>Onder de betaalde plekken staat de gewone lijst, op volgorde van beoordeling. Betalen verandert die volgorde nooit.</li>
            <li>Claimen en je eigen pagina beheren is voor restaurants altijd gratis.</li>
          </ul>
        </section>

        <p className="text-sm text-muted-foreground">Heb je een restaurant? <Link to="/voor-restaurants/pakketten" className="text-primary underline">Bekijk de pakketten</Link>.</p>
      </article>
    </Layout>
  );
}
