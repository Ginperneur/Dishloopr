import { motion } from 'framer-motion';
import { Layout } from '@/components/layout/Layout';
import { CollectionsGrid } from '@/components/collections/CollectionsGrid';
import { SEOHead, createBreadcrumbSchema } from '@/components/seo/SEOHead';
import { useTranslation } from 'react-i18next';

export default function CollectionsPage() {
  const { t } = useTranslation();
  
  const breadcrumbData = createBreadcrumbSchema([
    { name: 'Home', url: 'https://dishloopr.com' },
    { name: t('footer.collections', 'Collecties'), url: 'https://dishloopr.com/collections' },
  ]);

  return (
    <Layout>
      <SEOHead
        title={t('collections.seoTitle', 'Restaurant Collecties - Samengestelde Lijsten | Dishloopr')}
        description={t('collections.seoDescription', 'De beste ramen, pizza, sushi, smashburgers en meer: per gerecht de best beoordeelde restaurants van Nederland, en per stad. Ook halal, glutenvrij, all you can eat en shared dining.')}
        keywords={['collecties', 'restaurant lijsten', 'curated', 'beste restaurants', 'Nederland', 'eten', 'uit eten', 'amsterdam', 'rotterdam']}
        structuredData={breadcrumbData}
        canonical="https://dishloopr.com/collections"
      />

      <div className="container py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            {t('collections.title', 'Collecties')}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            {t('collections.subtitle', 'Per gerecht de restaurants waar gasten het meest over te spreken zijn. Je ziet eerst heel Nederland; kies daarna je stad voor de top 15 bij jou in de buurt. Ook voor halal, glutenvrij, all you can eat en shared dining.')}
          </p>
        </motion.div>

        <CollectionsGrid />
      </div>
    </Layout>
  );
}
