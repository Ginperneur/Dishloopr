import { motion } from 'framer-motion';
import { Layout } from '@/components/layout/Layout';
import { CollectionsGrid } from '@/components/collections/CollectionsGrid';
import { SEOHead } from '@/components/seo/SEOHead';

export default function CollectionsPage() {
  return (
    <Layout>
      <SEOHead
        title="Collecties - Curated Restaurant Lijsten | Dishloopr"
        description="Ontdek onze handgeselecteerde restaurant collecties. Van de beste ramen in Amsterdam tot romantische Italianen in Rotterdam - vind de perfecte plek voor elke gelegenheid."
        keywords={['collecties', 'restaurant lijsten', 'curated', 'beste restaurants', 'Nederland', 'eten', 'uit eten']}
      />

      <div className="container py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Collecties</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Door onze redactie handgeselecteerde restaurant lijsten voor elke gelegenheid. 
            Van hidden gems tot romantische plekjes - wij hebben het voor je uitgezocht.
          </p>
        </motion.div>

        <CollectionsGrid />
      </div>
    </Layout>
  );
}
