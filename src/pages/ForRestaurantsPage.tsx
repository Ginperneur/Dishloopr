import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { 
  Unlock, 
  Lock, 
  Users, 
  AlertTriangle, 
  Shield, 
  CheckCircle2, 
  XCircle,
  ChevronRight,
  Mail,
  Phone,
  CreditCard,
  Globe,
  Building2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export default function ForRestaurantsPage() {
  const { t } = useTranslation();

  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
  };

  return (
    <Layout>
      <SEOHead
        title="Voor Restaurants | Dishloopr"
        description="Claim en beheer je restaurantprofiel op Dishloopr. Ontdek hoe je toegang krijgt tot analytics, reviews kunt beantwoorden en je zichtbaarheid kunt vergroten."
      />
      
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        {/* Hero Section */}
        <section className="relative py-16 md:py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
          <div className="container mx-auto px-4 relative">
            <motion.div 
              className="max-w-3xl mx-auto text-center"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge variant="secondary" className="mb-4">
                Voor restauranteigenaren
              </Badge>
              <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Restaurants claimen op Dishloopr
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
                Dishloopr toont restaurants die wij zelf verzamelen en beheren. 
                Restaurant­eigenaren en medewerkers kunnen hun restaurant claimen 
                om inzicht te krijgen en het profiel te beheren.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="gap-2">
                  <Link to="/claim">
                    Claim je restaurant
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/contact">
                    Vragen? Neem contact op
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Trust Banner */}
        <section className="py-8 bg-muted/50 border-y border-border">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span>Veilig verificatieproces</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span>Meerdere beheerders mogelijk</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                <span>Privacy gegarandeerd</span>
              </div>
            </div>
          </div>
        </section>

        {/* Intro Text */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <motion.div 
              className="max-w-3xl mx-auto"
              {...fadeIn}
            >
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-6 md:p-8">
                  <div className="flex gap-4">
                    <AlertTriangle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Waarom verificatie?</h3>
                      <p className="text-muted-foreground">
                        Om misbruik te voorkomen en eerlijkheid te garanderen, werkt Dishloopr 
                        met een stapsgewijs verificatieproces. Dit beschermt zowel restaurants 
                        als gasten.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* Step 1 */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <motion.div 
              className="max-w-4xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Unlock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <Badge variant="outline" className="mb-1">Stap 1</Badge>
                  <h2 className="text-2xl md:text-3xl font-bold">Restaurant claimen</h2>
                </div>
              </div>
              
              <p className="text-lg text-muted-foreground mb-8">
                Iedereen die bij een restaurant werkt (zoals een eigenaar, manager of bedrijfsleider) 
                kan een restaurant claimen.
              </p>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Mail className="h-5 w-5 text-primary" />
                      Tijdens het claimen
                    </h3>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Bevestig je e-mailadres</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Phone className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span>Verifieer een telefoonnummer via een eenmalige sms-code</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-4">Na deze stap krijg je beperkte toegang</h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-green-600 mb-2">✓ Wat je wél kunt zien:</p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                          <li>• Openbare restaurantinformatie</li>
                          <li>• Een basisoverzicht dat het restaurant actief is op Dishloopr</li>
                        </ul>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-red-600 mb-2">✗ Wat je nog niet kunt:</p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                          <li>• Profielwijzigingen live zetten</li>
                          <li>• Reageren op reviews</li>
                          <li>• Betaalde zichtbaarheid activeren</li>
                          <li>• Gedetailleerde statistieken bekijken</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-muted/50 border-dashed">
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground italic">
                    💡 Claimen betekent dus niet automatisch volledige controle.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* Step 2 */}
        <section className="py-12 md:py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <motion.div 
              className="max-w-4xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <Badge variant="outline" className="mb-1">Stap 2</Badge>
                  <h2 className="text-2xl md:text-3xl font-bold">Verifiëren (voor volledige toegang)</h2>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div>
                  <h3 className="font-semibold mb-4">Wil je:</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Je restaurantprofiel aanpassen</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Reageren op reviews</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Inzicht krijgen in prestaties per gerecht</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Uitgelichte plaatsingen kopen</span>
                    </li>
                  </ul>
                  <p className="mt-4 text-muted-foreground">
                    Dan vragen we om extra verificatie. Dit bewijst dat je daadwerkelijk 
                    bevoegd bent om namens het restaurant te handelen.
                  </p>
                </div>

                <Card className="border-primary/20">
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-4">Verificatiemethoden</h3>
                    <ul className="space-y-4">
                      <li className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                          <CreditCard className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">Verificatiebetaling</p>
                          <p className="text-sm text-muted-foreground">Een kleine betaling van €0,10</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <Globe className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">Website verificatie</p>
                          <p className="text-sm text-muted-foreground">Via de restaurantwebsite</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium">Bedrijfsprofiel koppeling</p>
                          <p className="text-sm text-muted-foreground">Koppeling met een bestaand bedrijfsprofiel</p>
                        </div>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <CardContent className="p-6">
                  <p className="text-center font-medium text-green-800 dark:text-green-200">
                    ✓ Na succesvolle verificatie word je aangemerkt als <strong>geverifieerde beheerder</strong>.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* Multiple Employees */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <motion.div 
              className="max-w-4xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold">Meerdere medewerkers</h2>
              </div>

              <p className="text-lg text-muted-foreground mb-8">
                Een restaurant kan meerdere beheerders hebben.
              </p>

              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4">De geverifieerde beheerder kan:</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Andere medewerkers uitnodigen</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Rollen toekennen (bijv. bekijken, bewerken of financieel beheer)</span>
                    </li>
                  </ul>
                  <p className="mt-4 text-muted-foreground">
                    Zo blijft controle duidelijk en veilig.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* Multiple Claims */}
        <section className="py-12 md:py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <motion.div 
              className="max-w-4xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold">Wat als meerdere mensen een restaurant claimen?</h2>
              </div>

              <p className="text-lg text-muted-foreground mb-8">
                Dat kan gebeuren — en dat is oké.
              </p>

              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-6 text-center">
                    <XCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="font-medium">Een claim geeft nooit automatisch macht</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-3" />
                    <p className="font-medium">Alleen geverifieerde beheerders kunnen beslissingen nemen</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <Shield className="h-8 w-8 text-primary mx-auto mb-3" />
                    <p className="font-medium">Bij conflicten bekijkt Dishloopr wie het sterkste bewijs heeft</p>
                  </CardContent>
                </Card>
              </div>

              <p className="text-center text-muted-foreground mt-6">
                Zo zorgen we dat altijd de juiste mensen toegang krijgen.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Security & Transparency */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <motion.div 
              className="max-w-4xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold">Transparantie & veiligheid</h2>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <Card className="border-primary/20">
                  <CardContent className="p-6">
                    <Lock className="h-8 w-8 text-primary mb-4" />
                    <h3 className="font-semibold mb-2">Data beschermd</h3>
                    <p className="text-sm text-muted-foreground">
                      Gevoelige data is alleen zichtbaar voor geverifieerde beheerders
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-primary/20">
                  <CardContent className="p-6">
                    <CheckCircle2 className="h-8 w-8 text-primary mb-4" />
                    <h3 className="font-semibold mb-2">Audit trail</h3>
                    <p className="text-sm text-muted-foreground">
                      Alle acties worden gelogd voor transparantie
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-primary/20">
                  <CardContent className="p-6">
                    <AlertTriangle className="h-8 w-8 text-primary mb-4" />
                    <h3 className="font-semibold mb-2">Misbruik melden</h3>
                    <p className="text-sm text-muted-foreground">
                      Misbruik kan altijd worden gemeld bij ons team
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="mt-8 bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
                <CardContent className="p-8 text-center">
                  <p className="text-lg font-medium mb-4">
                    Zo beschermen we restaurants, gasten én de betrouwbaarheid van Dishloopr.
                  </p>
                  <Button asChild size="lg" className="gap-2">
                    <Link to="/claim">
                      Start met claimen
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
