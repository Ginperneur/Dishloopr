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
          <p className="text-sm text-muted-foreground mb-6">Laatst bijgewerkt: 22 oktober 2026</p>
          <address className="not-italic text-muted-foreground mb-8 leading-relaxed">
            <strong className="text-foreground">Dishloopr</strong><br />
            KvK: 82000611<br />
            Vestigingsadres: [INVULLEN]<br />
            <a href="mailto:info@dishloopr.com" className="text-primary hover:underline">info@dishloopr.com</a>
          </address>
          
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
                Menukaarten en prijzen komen deels uit openbare bronnen en kunnen verouderd zijn.
                Vraag allergeneninformatie altijd na bij het restaurant.
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
                Onrechtmatige inhoud kun je melden via{' '}
                <a href="mailto:info@dishloopr.com" className="text-primary hover:underline">info@dishloopr.com</a>.
                Wij beoordelen meldingen binnen 5 werkdagen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Restauranteigenaren</h2>
              <p className="text-muted-foreground leading-relaxed">
                Restauranteigenaren kunnen hun restaurant gratis claimen en beheren via ons platform.
                Voor betaalde pakketten gelden aanvullende voorwaarden en tarieven, waaronder het artikel
                ‘Betaalde diensten voor restaurants’ hieronder.
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
                Claimen is gratis. Betaalde pakketten, zoals Founding Partner en Menuservice, worden aan
                restaurants aangeboden als zakelijke overeenkomsten. Voor deze zakelijke overeenkomsten
                geldt geen herroepingsrecht. Het wettelijke herroepingsrecht geldt uitsluitend voor consumenten;
                zij hebben bij overeenkomsten op afstand in beginsel 14 dagen bedenktijd, behoudens wettelijke uitzonderingen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7b. Toepasselijk recht en geschillen</h2>
              <p className="text-muted-foreground leading-relaxed">
                Op deze voorwaarden is Nederlands recht van toepassing. Geschillen worden voorgelegd aan de
                bevoegde rechter in Nederland, tenzij dwingend consumentenrecht anders bepaalt.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7c. Betaalde diensten voor restaurants</h2>
              <ol className="text-muted-foreground space-y-4 leading-relaxed">
                <li>
                  <strong>Founding Partner.</strong> Een uitgelichte plek op één gerechtpagina, altijd gemarkeerd
                  als ‘Uitgelicht’. Wij geven geen garantie op aantallen bezoekers. De prijs blijft vast zolang
                  het abonnement doorloopt. Facturering start op de launchdatum. Gaat de launch niet door vóór
                  [DATUM], dan ontvang je een volledige terugbetaling. Een maandabonnement is maandelijks
                  opzegbaar; een jaarabonnement loopt het jaar uit. Dishloopr mag misleidende plaatsingen
                  weigeren of beëindigen.
                </li>
                <li>
                  <strong>Menuservice.</strong> Levering vindt plaats binnen 3 werkdagen. Het restaurant controleert
                  de menukaart, prijzen en allergeneninformatie en blijft daarvoor verantwoordelijk.
                  Correcties binnen 14 dagen na levering zijn kosteloos.
                </li>
                <li>
                  <strong>Betaling en facturen.</strong> Betaling verloopt via Stripe. Facturen worden per e-mail
                  verstuurd. Bedragen zijn [INCLUSIEF/EXCLUSIEF] btw.
                </li>
                <li>
                  <strong>Zakelijke aansprakelijkheid.</strong> De aansprakelijkheid van Dishloopr tegenover
                  zakelijke klanten is beperkt tot het bedrag dat in de laatste 12 maanden voor de dienst is betaald.
                </li>
              </ol>
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

          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
