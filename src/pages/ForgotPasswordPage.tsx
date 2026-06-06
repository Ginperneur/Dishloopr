import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { z } from 'zod';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/dishloopr-logo.png';

const emailSchema = z.object({
  email: z.string().email('Ongeldig e-mailadres'),
});

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const { resetPassword } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = emailSchema.safeParse({ email });
    if (!validation.success) {
      toast({
        variant: 'destructive',
        title: 'Validatiefout',
        description: validation.error.errors[0].message,
      });
      return;
    }

    setIsLoading(true);
    const { error } = await resetPassword(email);
    setIsLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Fout',
        description: 'Kon geen reset e-mail versturen. Probeer het opnieuw.',
      });
    } else {
      setIsSuccess(true);
    }
  };

  return (
    <Layout showFooter={false}>
      <SEOHead
        title="Wachtwoord vergeten | Dishloopr"
        description="Vraag een nieuw wachtwoord aan voor je Dishloopr account."
        noindex
      />
      <div className="min-h-[calc(100svh-3.5rem)] md:min-h-[calc(100svh-4rem)] flex items-center justify-center py-8 md:py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-6 md:mb-8">
            <Link to="/" className="inline-block mb-4 md:mb-6">
              <img src={logo} alt="Dishloopr" className="h-12 md:h-16 w-auto mx-auto" />
            </Link>
            <h1 className="text-xl md:text-2xl font-bold">Wachtwoord vergeten?</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1 md:mt-2">
              Geen probleem, we sturen je een reset link
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 md:p-8">
            {isSuccess ? (
              <div className="text-center py-4">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h2 className="text-lg font-semibold mb-2">E-mail verzonden!</h2>
                <p className="text-muted-foreground mb-6">
                  We hebben een e-mail gestuurd naar <strong>{email}</strong> met instructies om je wachtwoord te resetten.
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  Geen e-mail ontvangen? Check je spam folder of probeer het opnieuw.
                </p>
                <div className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={() => setIsSuccess(false)}
                  >
                    Opnieuw proberen
                  </Button>
                  <Button asChild className="w-full">
                    <Link to="/login">Terug naar inloggen</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} method="post" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm">E-mailadres</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      autoComplete="email"
                      type="email"
                      placeholder="naam@voorbeeld.nl"
                      className="pl-10 h-11 text-base"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full h-11" size="lg" disabled={isLoading}>
                  {isLoading ? 'Bezig...' : 'Reset link versturen'}
                </Button>

                <div className="text-center pt-2">
                  <Link 
                    to="/login" 
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Terug naar inloggen
                  </Link>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
