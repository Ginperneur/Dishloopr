import { Layout } from '@/components/layout/Layout';
import { motion } from 'framer-motion';
import { Mail, MessageSquare, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { toast } from 'sonner';
import { SEOHead } from '@/components/seo/SEOHead';

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success('Bericht verzonden! We nemen zo snel mogelijk contact met je op.');
    setIsSubmitting(false);
    (e.target as HTMLFormElement).reset();
  };

  return (
    <Layout>
      <SEOHead
        title="Contact | Dishloopr"
        description="Neem contact op met Dishloopr. Heb je vragen, feedback of wil je samenwerken? We horen graag van je!"
        keywords={['contact', 'dishloopr', 'vragen', 'feedback', 'samenwerken']}
      />
      <div className="container py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Neem contact op
          </h1>
          <p className="text-xl text-muted-foreground">
            Heb je een vraag, suggestie of wil je samenwerken? We horen graag van je.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-border rounded-xl p-6 text-center"
          >
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">E-mail</h3>
            <a href="mailto:info@dishloopr.nl" className="text-primary hover:underline">
              info@dishloopr.nl
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card border border-border rounded-xl p-6 text-center"
          >
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Support</h3>
            <p className="text-muted-foreground text-sm">
              Reactie binnen 24 uur
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border rounded-xl p-6 text-center"
          >
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Zakelijk</h3>
            <a href="mailto:partners@dishloopr.nl" className="text-primary hover:underline">
              partners@dishloopr.nl
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="max-w-xl mx-auto"
        >
          <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-8 space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Naam</Label>
                <Input id="name" name="name" required placeholder="Je naam" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" required placeholder="je@email.nl" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="subject">Onderwerp</Label>
              <Input id="subject" name="subject" required placeholder="Waar gaat je bericht over?" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="message">Bericht</Label>
              <Textarea 
                id="message" 
                name="message" 
                required 
                placeholder="Schrijf hier je bericht..."
                rows={5}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Verzenden...' : 'Verstuur bericht'}
            </Button>
          </form>
        </motion.div>
      </div>
    </Layout>
  );
}
