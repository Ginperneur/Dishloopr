import { motion } from 'framer-motion';
import { Search, MapPin, Utensils } from 'lucide-react';

const steps = [
  {
    icon: Search,
    title: 'Zoek op gerecht',
    description: 'Type waar je écht trek in hebt — sushi, ramen, een halal burger.',
  },
  {
    icon: MapPin,
    title: 'Kies een stad',
    description: 'Filter op buurt, sfeer of dieet. Zie alleen plekken die passen.',
  },
  {
    icon: Utensils,
    title: 'Eet wat je wil',
    description: 'Vergelijk menu’s, lees echte reviews en reserveer direct.',
  },
];

export function HowItWorks() {
  return (
    <section className="py-8 md:py-14">
      <div className="container px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6 md:mb-10"
        >
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold font-display">
            Hoe Dishloopr werkt
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-xl mx-auto">
            Geen restaurant-roulette meer. Vind in drie stappen het gerecht waar je nu zin in hebt.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto">
          {steps.map((step, idx) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08 }}
              className="relative p-5 md:p-6 rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-md transition-all"
            >
              <div className="absolute -top-3 left-5 inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {idx + 1}
              </div>
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary mb-3">
                <step.icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base md:text-lg mb-1">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}