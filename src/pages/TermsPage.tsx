import { Layout } from '@/components/layout/Layout';
import { motion } from 'framer-motion';
import { SEOHead, createBreadcrumbSchema } from '@/components/seo/SEOHead';

export default function TermsPage() {
  return (
    <Layout>
      <SEOHead
        title="Algemene Voorwaarden | Dishloopr"
        description="Lees de algemene voorwaarden van Dishloopr. Deze voorwaarden zijn van toepassing op het gebruik van onze website en diensten."
        keywords={['algemene voorwaarden', 'terms', 'gebruiksvoorwaarden', 'dishloopr']}
        canonical="https://dishloopr.com/terms"
        structuredData={createBreadcrumbSchema([
          { name: 'Home', url: 'https://dishloopr.com' },
          { name: 'Algemene Voorwaarden', url: 'https://dishloopr.com/terms' },
        ])}
      />
      <div className="container py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto"
        >
          <h1 className="text-4xl font-bold mb-2">Algemene Voorwaarden</h1>
          <p className="text-sm text-muted-foreground mb-8">Laatst bijgewerkt: 4 mei 2026</p>
          
          <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Algemeen</h2>
              <p className="text-muted-foreground leading-relaxed">
                Deze algemene voorwaarden zijn van toepassing op het gebruik van de website en diensten van Dishloopr. 
                Door gebruik te maken van onze diensten, ga je akkoord met deze voorwaarden.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. Diensten</h2>
              <p className="text-muted-foreground leading-relaxed">
                Dishloopr is een platform dat gebruikers helpt restaurants te vinden op basis van specifieke gerechten. 
                Wij bieden een zoekmachine, reviews en informatie over restaurants. De informatie op ons platform is 
                met zorg samengesteld, maar wij garanderen niet de volledigheid of juistheid ervan.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. Gebruikersaccount</h2>
              <p className="text-muted-foreground leading-relaxed">
                Voor bepaalde functies is een account vereist. Je bent verantwoordelijk voor het geheimhouden van 
                je inloggegevens en voor alle activiteiten onder je account. Meld ongeautoriseerd gebruik direct bij ons.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Reviews en Content</h2>
              <p className="text-muted-foreground leading-relaxed">
                Bij het plaatsen van reviews verleen je Dishloopr het recht deze te publiceren en te gebruiken. 
                Reviews moeten eerlijk, respectvol en relevant zijn. Wij behouden het recht om reviews te verwijderen 
                die niet aan onze richtlijnen voldoen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Restauranteigenaren</h2>
              <p className="text-muted-foreground leading-relaxed">
                Restauranteigenaren kunnen hun restaurant claimen en beheren via ons platform. 
                Voor premium listings en advertenties gelden aanvullende voorwaarden en tarieven.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Aansprakelijkheid</h2>
              <p className="text-muted-foreground leading-relaxed">
                Dishloopr is niet aansprakelijk voor schade voortvloeiend uit het gebruik van onze diensten, 
                voor zover wettelijk toegestaan. Wij zijn niet verantwoordelijk voor de diensten van de 
                vermelde restaurants.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Wijzigingen</h2>
              <p className="text-muted-foreground leading-relaxed">
                Wij behouden het recht deze voorwaarden te wijzigen. Belangrijke wijzigingen worden via 
                de website of e-mail gecommuniceerd.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7a. Herroepingsrecht (consumenten)</h2>
              <p className="text-muted-foreground leading-relaxed">
                Consumenten in de EU hebben in principe 14 dagen herroepingsrecht bij online aankopen.
                Bij betaalde digitale diensten (zoals premium-listings, claim-verificatie en nieuwsbriefcampagnes)
                start de dienst direct na betaling op jouw uitdrukkelijk verzoek; je doet daarmee afstand van het
                herroepingsrecht voor reeds geleverde dienstdelen. Reeds gepubliceerde plaatsingen en verstuurde
                campagnes worden niet gerestitueerd.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7b. Toepasselijk recht en geschillen</h2>
              <p className="text-muted-foreground leading-relaxed">
                Op deze voorwaarden is Nederlands recht van toepassing. Geschillen worden voorgelegd aan de
                bevoegde rechter in Nederland, tenzij dwingend consumentenrecht anders bepaalt. Consumenten
                kunnen ook gebruik maken van het ODR-platform van de Europese Commissie
                (ec.europa.eu/consumers/odr).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Contact</h2>
              <p className="text-muted-foreground leading-relaxed">
              Voor vragen over deze voorwaarden kun je contact opnemen via{' '}
                <a href="mailto:info@dishloopr.com" className="text-primary hover:underline">
                  info@dishloopr.com
                </a>
              </p>
            </section>

            <p className="text-sm text-muted-foreground pt-8 border-t border-border">
              Laatste update: januari 2026
            </p>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
