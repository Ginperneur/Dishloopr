import { Layout } from '@/components/layout/Layout';
import { motion } from 'framer-motion';
import { SEOHead, createBreadcrumbSchema } from '@/components/seo/SEOHead';

export default function PrivacyPage() {
  return (
    <Layout>
      <SEOHead
        title="Privacybeleid | Dishloopr"
        description="Lees ons privacybeleid en ontdek hoe Dishloopr omgaat met je persoonsgegevens. Wij respecteren je privacy en voldoen aan de AVG."
        keywords={['privacy', 'privacybeleid', 'AVG', 'GDPR', 'persoonsgegevens']}
        canonical="https://dishloopr.com/privacy"
        structuredData={createBreadcrumbSchema([
          { name: 'Home', url: 'https://dishloopr.com' },
          { name: 'Privacybeleid', url: 'https://dishloopr.com/privacy' },
        ])}
      />
      <div className="container py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto"
        >
          <h1 className="text-4xl font-bold mb-2">Privacybeleid</h1>
          <p className="text-sm text-muted-foreground mb-8">Laatst bijgewerkt: 21 oktober 2026</p>
          
          <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Inleiding</h2>
              <p className="text-muted-foreground leading-relaxed">
                Dishloopr respecteert je privacy en verwerkt persoonsgegevens in overeenstemming met de 
                Algemene Verordening Gegevensbescherming (AVG). Dit privacybeleid beschrijft welke gegevens 
                wij verzamelen en hoe wij deze gebruiken.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">1a. Verwerkingsverantwoordelijke</h2>
              <p className="text-muted-foreground leading-relaxed">
                Verwerkingsverantwoordelijke in de zin van de AVG is Dishloopr, gevestigd in Nederland (KvK-nummer: [KvK-nummer], vestigingsadres: [vestigingsadres]).
                Voor vragen of verzoeken kun je contact opnemen via{' '}
                <a href="mailto:privacy@dishloopr.com" className="text-primary hover:underline">privacy@dishloopr.com</a>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">1b. Grondslagen voor verwerking (AVG art. 6)</h2>
              <ul className="text-muted-foreground space-y-2">
                <li><strong>Uitvoering overeenkomst:</strong> account, reviews, favorieten, lijsten.</li>
                <li><strong>Gerechtvaardigd belang:</strong> beveiliging, fraudepreventie, productverbetering en geaggregeerde analyse.</li>
                <li><strong>Toestemming:</strong> optionele analytics, marketing e-mails en cookies (in te trekken via je instellingen of de cookie-banner).</li>
                <li><strong>Wettelijke verplichting:</strong> fiscale en boekhoudkundige bewaarplicht voor betaalde diensten.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. Welke gegevens verzamelen wij?</h2>
              <ul className="text-muted-foreground space-y-2">
                <li><strong>Accountgegevens:</strong> naam, e-mailadres, en eventueel profielfoto</li>
                <li><strong>Gebruiksgegevens:</strong> zoekopdrachten, bezochte pagina's, en interacties. Zoekopdrachten worden zonder naam of IP-adres opgeslagen om de zoekfunctie te verbeteren, maximaal 12 maanden.</li>
                <li><strong>Reviews:</strong> door jou geplaatste beoordelingen en foto's</li>
                <li><strong>Technische gegevens:</strong> IP-adres, browsertype, en apparaatinformatie</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2a. Gegevens van restaurants</h2>
              <p className="text-muted-foreground leading-relaxed">
                Wij tonen openbare bedrijfsinformatie van restaurants (naam, adres, menukaart, prijzen, openingstijden,
                foto's en beoordelingen), afkomstig uit Google Places en de eigen website van het restaurant. Om eigenaren
                te benaderen bewaren wij het zakelijke contactadres van de website (grondslag: gerechtvaardigd belang).
                Elke e-mail bevat een afmeldlink. Via{' '}
                <a href="/voor-restaurants/afmelden" className="text-primary hover:underline">/voor-restaurants/afmelden</a>{' '}
                kan een restaurant gegevens laten aanpassen of verwijderen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. Waarvoor gebruiken wij je gegevens?</h2>
              <ul className="text-muted-foreground space-y-2">
                <li>Het leveren en verbeteren van onze diensten</li>
                <li>Personalisatie van je ervaring</li>
                <li>Communicatie over je account en onze diensten</li>
                <li>Analyse en verbetering van het platform</li>
                <li>Fraudepreventie en beveiliging</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Delen met derden</h2>
              <p className="text-muted-foreground leading-relaxed">
                Wij verkopen je gegevens niet aan derden. Wij delen gegevens alleen met:
              </p>
              <ul className="text-muted-foreground space-y-2 mt-2">
                <li><strong>Supabase</strong> (database, authenticatie, opslag, edge functions) — verwerker, EU-regio.</li>
                <li><strong>Resend</strong> — transactionele en marketing e-mails.</li>
                <li><strong>Stripe</strong> — betalingen voor premium diensten en abonnementen.</li>
                <li><strong>Google Maps & Places</strong> — kaarten en restaurantverrijking.</li>
                <li><strong>Google (Gemini)</strong> — uitlezen en vertalen van menukaarten.</li>
                <li><strong>Cloudflare</strong> — hosting (in de toekomst).</li>
                <li><strong>Lovable AI Gateway</strong> — AI-functies zoals "Surprise Me" en classificatie.</li>
                <li>Wanneer wettelijk vereist of ter bescherming van rechten.</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Sommige verwerkers (bv. Stripe, Google) kunnen gegevens buiten de EER verwerken. Doorgifte vindt plaats
                op basis van Standard Contractual Clauses (SCC's) van de Europese Commissie.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Cookies</h2>
              <p className="text-muted-foreground leading-relaxed">
                Wij gebruiken cookies om de website te laten functioneren, je voorkeuren te onthouden, 
                en om te begrijpen hoe de website wordt gebruikt. Je kunt cookies beheren via je browserinstellingen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Je rechten</h2>
              <p className="text-muted-foreground leading-relaxed">
                Je hebt het recht om:
              </p>
              <ul className="text-muted-foreground space-y-2 mt-2">
                <li>Inzage, rectificatie of verwijdering van je gegevens (AVG art. 15–17).</li>
                <li>Beperking van of bezwaar tegen de verwerking (art. 18, 21).</li>
                <li>Gegevensoverdraagbaarheid in een gangbaar formaat (art. 20).</li>
                <li>Toestemming op elk moment in te trekken zonder gevolgen voor eerdere verwerkingen.</li>
                <li>Een klacht in te dienen bij de Autoriteit Persoonsgegevens (autoriteitpersoonsgegevens.nl).</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-2">
                Verzoeken kun je sturen naar <a href="mailto:privacy@dishloopr.com" className="text-primary hover:underline">privacy@dishloopr.com</a>.
                Wij reageren binnen 30 dagen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Beveiliging</h2>
              <p className="text-muted-foreground leading-relaxed">
                Wij nemen passende maatregelen om je gegevens te beschermen tegen ongeautoriseerde toegang, 
                verlies of misbruik, waaronder encryptie en beveiligde verbindingen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Bewaartermijn</h2>
              <ul className="text-muted-foreground space-y-2">
                <li><strong>Accountgegevens:</strong> zolang het account bestaat; verwijderd binnen 30 dagen na opzegging.</li>
                <li><strong>Reviews & content:</strong> behouden (geanonimiseerd) na accountverwijdering om de integriteit van de site te bewaren.</li>
                <li><strong>Logs & beveiligingsgegevens:</strong> maximaal 12 maanden.</li>
                <li><strong>Facturen & betalingsgegevens:</strong> 7 jaar (fiscale bewaarplicht).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8a. Geautomatiseerde besluitvorming</h2>
              <p className="text-muted-foreground leading-relaxed">
                Dishloopr gebruikt AI om gerechten te classificeren en aanbevelingen te genereren. Er vindt
                geen geautomatiseerde besluitvorming plaats met rechtsgevolgen of vergelijkbaar significante
                gevolgen voor jou in de zin van AVG art. 22.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Contact</h2>
              <p className="text-muted-foreground leading-relaxed">
              Voor vragen over dit privacybeleid of je gegevens kun je contact opnemen via{' '}
                <a href="mailto:privacy@dishloopr.com" className="text-primary hover:underline">
                  privacy@dishloopr.com
                </a>
              </p>
            </section>

          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
