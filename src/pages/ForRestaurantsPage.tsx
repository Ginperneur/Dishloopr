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
        title={`${t('forRestaurants.forOwners')} | Dishloopr`}
        description={t('forRestaurants.pageDescription')}
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
                {t('forRestaurants.forOwners')}
              </Badge>
              <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {t('forRestaurants.pageTitle')}
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
                {t('forRestaurants.heroSubtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="gap-2">
                  <Link to="/claim">
                    {t('forRestaurants.claimYourRestaurant')}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/contact">
                    {t('forRestaurants.questionsContact')}
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
                <span>{t('forRestaurants.secureVerification')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span>{t('forRestaurants.multipleManagers')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                <span>{t('forRestaurants.privacyGuaranteed')}</span>
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
                      <h3 className="font-semibold text-lg mb-2">{t('forRestaurants.whyVerification')}</h3>
                      <p className="text-muted-foreground">
                        {t('forRestaurants.whyVerificationDesc')}
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
                  <h2 className="text-2xl md:text-3xl font-bold">{t('forRestaurants.step1Title')}</h2>
                </div>
              </div>
              
              <p className="text-lg text-muted-foreground mb-8">
                {t('forRestaurants.step1Desc')}
              </p>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Mail className="h-5 w-5 text-primary" />
                      {t('forRestaurants.duringClaim')}
                    </h3>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{t('forRestaurants.confirmEmail')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Phone className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span>{t('forRestaurants.verifyPhone')}</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-4">{t('forRestaurants.limitedAccess')}</h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-green-600 mb-2">✓ {t('forRestaurants.canSee')}</p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                          <li>• {t('forRestaurants.publicInfo')}</li>
                          <li>• {t('forRestaurants.basicOverview')}</li>
                        </ul>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-red-600 mb-2">✗ {t('forRestaurants.cannotYet')}</p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                          <li>• {t('forRestaurants.profileChanges')}</li>
                          <li>• {t('forRestaurants.respondReviews')}</li>
                          <li>• {t('forRestaurants.paidVisibility')}</li>
                          <li>• {t('forRestaurants.detailedStats')}</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-muted/50 border-dashed">
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground italic">
                    💡 {t('forRestaurants.claimNotControl')}
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
                  <h2 className="text-2xl md:text-3xl font-bold">{t('forRestaurants.step2Title')}</h2>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div>
                  <h3 className="font-semibold mb-4">{t('forRestaurants.wantTo')}</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>{t('forRestaurants.adjustProfile')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>{t('forRestaurants.respondReviews')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>{t('forRestaurants.insightPerDish')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>{t('forRestaurants.buyFeatured')}</span>
                    </li>
                  </ul>
                  <p className="mt-4 text-muted-foreground">
                    {t('forRestaurants.extraVerification')}
                  </p>
                </div>

                <Card className="border-primary/20">
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-4">{t('forRestaurants.verificationMethods')}</h3>
                    <ul className="space-y-4">
                      <li className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                          <CreditCard className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">{t('forRestaurants.microPayment')}</p>
                          <p className="text-sm text-muted-foreground">{t('forRestaurants.microPaymentDesc')}</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <Globe className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{t('forRestaurants.websiteVerification')}</p>
                          <p className="text-sm text-muted-foreground">{t('forRestaurants.websiteVerificationDesc')}</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium">{t('forRestaurants.businessProfile')}</p>
                          <p className="text-sm text-muted-foreground">{t('forRestaurants.businessProfileDesc')}</p>
                        </div>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <CardContent className="p-6">
                  <p className="text-center font-medium text-green-800 dark:text-green-200">
                    ✓ {t('forRestaurants.afterVerification')}
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
                <h2 className="text-2xl md:text-3xl font-bold">{t('forRestaurants.multipleEmployees')}</h2>
              </div>

              <p className="text-lg text-muted-foreground mb-8">
                {t('forRestaurants.multipleEmployeesDesc')}
              </p>

              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4">{t('forRestaurants.verifiedManagerCan')}</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>{t('forRestaurants.inviteOthers')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>{t('forRestaurants.assignRoles')}</span>
                    </li>
                  </ul>
                  <p className="mt-4 text-muted-foreground">
                    {t('forRestaurants.controlClear')}
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
                <h2 className="text-2xl md:text-3xl font-bold">{t('forRestaurants.multipleClaims')}</h2>
              </div>

              <p className="text-lg text-muted-foreground mb-8">
                {t('forRestaurants.multipleClaimsOk')}
              </p>

              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-6 text-center">
                    <XCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="font-medium">{t('forRestaurants.claimNoPower')}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-3" />
                    <p className="font-medium">{t('forRestaurants.onlyVerified')}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <Shield className="h-8 w-8 text-primary mx-auto mb-3" />
                    <p className="font-medium">{t('forRestaurants.conflictReview')}</p>
                  </CardContent>
                </Card>
              </div>

              <p className="text-center text-muted-foreground mt-6">
                {t('forRestaurants.rightPeopleAccess')}
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
                <h2 className="text-2xl md:text-3xl font-bold">{t('forRestaurants.transparencySecurity')}</h2>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <Card className="border-primary/20">
                  <CardContent className="p-6">
                    <Lock className="h-8 w-8 text-primary mb-4" />
                    <h3 className="font-semibold mb-2">{t('forRestaurants.dataProtected')}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t('forRestaurants.dataProtectedDesc')}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-primary/20">
                  <CardContent className="p-6">
                    <CheckCircle2 className="h-8 w-8 text-primary mb-4" />
                    <h3 className="font-semibold mb-2">{t('forRestaurants.auditTrail')}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t('forRestaurants.auditTrailDesc')}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-primary/20">
                  <CardContent className="p-6">
                    <AlertTriangle className="h-8 w-8 text-primary mb-4" />
                    <h3 className="font-semibold mb-2">{t('forRestaurants.reportAbuse')}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t('forRestaurants.reportAbuseDesc')}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="mt-8 bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
                <CardContent className="p-8 text-center">
                  <p className="text-lg font-medium mb-4">
                    {t('forRestaurants.protectAll')}
                  </p>
                  <Button asChild size="lg" className="gap-2">
                    <Link to="/claim">
                      {t('forRestaurants.startClaiming')}
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
