import { Layout } from '@/components/layout/Layout';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Search, MapPin, Star, Users } from 'lucide-react';

export default function AboutPage() {
  const { t } = useTranslation();

  const features = [
    {
      icon: Search,
      title: 'Zoek op gerecht',
      description: 'Vind restaurants niet op basis van categorie, maar op het specifieke gerecht waar je zin in hebt.'
    },
    {
      icon: MapPin,
      title: 'Lokaal & relevant',
      description: 'Filter op stad en locatie om de beste opties in jouw buurt te ontdekken.'
    },
    {
      icon: Star,
      title: 'Eerlijke reviews',
      description: 'Lees echte ervaringen van andere gasten en deel je eigen mening.'
    },
    {
      icon: Users,
      title: 'Voor iedereen',
      description: 'Of je nu zoekt naar een romantisch diner of een familievriendelijk restaurant - wij helpen je vinden.'
    }
  ];

  return (
    <Layout>
      <div className="container py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Over <span className="text-primary">Dishloopr</span>
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Dishloopr is de snelste manier om restaurants te vinden op basis van het gerecht waar je zin in hebt, gefilterd op stad, sfeer en prijs.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-card border border-border rounded-xl p-6"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-muted/50 rounded-2xl p-8 md:p-12 text-center"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Onze missie</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Wij geloven dat de beste restaurantervaring begint bij het gerecht. Daarom hebben we Dishloopr gebouwd - 
            een platform dat je helpt precies te vinden waar je trek in hebt, zonder eindeloos te scrollen door categorieën. 
            Simpel, snel en persoonlijk.
          </p>
        </motion.div>
      </div>
    </Layout>
  );
}
