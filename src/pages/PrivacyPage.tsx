import { Layout } from '@/components/layout/Layout';
import { motion } from 'framer-motion';
import { SEOHead } from '@/components/seo/SEOHead';

export default function PrivacyPage() {
  return (
    <Layout>
      <SEOHead
        title="Privacybeleid | Dishloopr"
        description="Lees ons privacybeleid en ontdek hoe Dishloopr omgaat met je persoonsgegevens. Wij respecteren je privacy en voldoen aan de AVG."
        keywords={['privacy', 'privacybeleid', 'AVG', 'GDPR', 'persoonsgegevens']}
      />
      <div className="container py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto"
        >
          <h1 className="text-4xl font-bold mb-8">Privacybeleid</h1>
          
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
              <h2 className="text-2xl font-semibold mb-4">2. Welke gegevens verzamelen wij?</h2>
              <ul className="text-muted-foreground space-y-2">
                <li><strong>Accountgegevens:</strong> naam, e-mailadres, en eventueel profielfoto</li>
                <li><strong>Gebruiksgegevens:</strong> zoekopdrachten, bezochte pagina's, en interacties</li>
                <li><strong>Reviews:</strong> door jou geplaatste beoordelingen en foto's</li>
                <li><strong>Technische gegevens:</strong> IP-adres, browsertype, en apparaatinformatie</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. Waarvoor gebruiken wij je gegevens?</h2>
              <ul className="text-muted-foreground space-y-2">
                <li>Het leveren en verbeteren van onze diensten</li>
                <li>Personalisatie van je ervaring</li>
                <li>Communicatie over je account en onze diensten</li>
                <li>Analyse en verbetering van het platform</li>
                <li>Fraude preventie en beveiliging</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Delen met derden</h2>
              <p className="text-muted-foreground leading-relaxed">
                Wij verkopen je gegevens niet aan derden. Wij delen gegevens alleen met:
              </p>
              <ul className="text-muted-foreground space-y-2 mt-2">
                <li>Dienstverleners die ons helpen de service te leveren (hosting, analytics)</li>
                <li>Wanneer wettelijk vereist of ter bescherming van rechten</li>
              </ul>
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
                <li>Je gegevens in te zien, te corrigeren of te laten verwijderen</li>
                <li>Bezwaar te maken tegen verwerking</li>
                <li>Je toestemming in te trekken</li>
                <li>Een klacht in te dienen bij de Autoriteit Persoonsgegevens</li>
              </ul>
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
              <p className="text-muted-foreground leading-relaxed">
                Wij bewaren je gegevens niet langer dan noodzakelijk voor de doeleinden waarvoor ze zijn 
                verzameld, tenzij we wettelijk verplicht zijn ze langer te bewaren.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Contact</h2>
              <p className="text-muted-foreground leading-relaxed">
                Voor vragen over dit privacybeleid of je gegevens kun je contact opnemen via{' '}
                <a href="mailto:privacy@dishloopr.nl" className="text-primary hover:underline">
                  privacy@dishloopr.nl
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
