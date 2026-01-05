import { Layout } from '@/components/layout/Layout';
import { motion } from 'framer-motion';
import { CheckCircle, TrendingUp, MessageSquare, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

export default function ClaimPage() {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const benefits = [
    {
      icon: CheckCircle,
      title: 'Verificatiebadge',
      description: 'Laat gasten zien dat je profiel officieel is geverifieerd.'
    },
    {
      icon: TrendingUp,
      title: 'Meer zichtbaarheid',
      description: 'Word beter gevonden door potentiële gasten via onze zoekmachine.'
    },
    {
      icon: MessageSquare,
      title: 'Reageer op reviews',
      description: 'Bouw vertrouwen door professioneel te reageren op feedback.'
    },
    {
      icon: BarChart3,
      title: 'Inzichten & analytics',
      description: 'Bekijk hoeveel mensen je restaurant bekijken en hoe ze je vinden.'
    }
  ];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success('Claim aanvraag ontvangen! We nemen binnen 2 werkdagen contact met je op.');
    setIsSubmitting(false);
    (e.target as HTMLFormElement).reset();
  };

  return (
    <Layout>
      <div className="container py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Claim je restaurant
          </h1>
          <p className="text-xl text-muted-foreground">
            Neem de controle over je Dishloopr profiel en bereik meer gasten.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-card border border-border rounded-xl p-6 text-center"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <benefit.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{benefit.title}</h3>
              <p className="text-sm text-muted-foreground">{benefit.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="max-w-xl mx-auto"
        >
          {!user ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">Log eerst in</h2>
              <p className="text-muted-foreground mb-6">
                Je moet ingelogd zijn om je restaurant te claimen.
              </p>
              <Link to="/login">
                <Button size="lg">Inloggen of registreren</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-8 space-y-6">
              <h2 className="text-2xl font-bold text-center mb-2">Claim aanvragen</h2>
              <p className="text-muted-foreground text-center text-sm mb-6">
                Vul onderstaand formulier in. We verifiëren je aanvraag binnen 2 werkdagen.
              </p>

              <div className="space-y-2">
                <Label htmlFor="restaurantName">Restaurantnaam</Label>
                <Input 
                  id="restaurantName" 
                  name="restaurantName" 
                  required 
                  placeholder="De naam van je restaurant" 
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Stad</Label>
                  <Input id="city" name="city" required placeholder="Amsterdam" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefoonnummer</Label>
                  <Input id="phone" name="phone" type="tel" required placeholder="+31 20 123 4567" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role">Jouw rol</Label>
                <Input 
                  id="role" 
                  name="role" 
                  required 
                  placeholder="Bijv. Eigenaar, Manager, Marketing" 
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Extra informatie (optioneel)</Label>
                <Textarea 
                  id="notes" 
                  name="notes" 
                  placeholder="Vertel ons meer over je restaurant of hoe we je kunnen verifiëren..."
                  rows={4}
                />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? 'Verzenden...' : 'Claim aanvragen'}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Door te claimen ga je akkoord met onze{' '}
                <Link to="/terms" className="text-primary hover:underline">voorwaarden</Link>.
              </p>
            </form>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
