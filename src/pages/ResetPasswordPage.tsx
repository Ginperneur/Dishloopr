import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, CheckCircle } from 'lucide-react';
import { z } from 'zod';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/dishloopr-logo.png';

const passwordSchema = z.object({
  password: z.string().min(6, 'Wachtwoord moet minimaal 6 tekens bevatten'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Wachtwoorden komen niet overeen',
  path: ['confirmPassword'],
});

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { updatePassword, session } = useAuth();
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Check if user came from password reset email
  useEffect(() => {
    if (!session) {
      // No session means user didn't come from reset email
      // They need to request a reset first
      const timer = setTimeout(() => {
        if (!session) {
          navigate('/forgot-password');
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = passwordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      toast({
        variant: 'destructive',
        title: 'Validatiefout',
        description: validation.error.errors[0].message,
      });
      return;
    }

    setIsLoading(true);
    const { error } = await updatePassword(password);
    setIsLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Fout',
        description: 'Kon wachtwoord niet wijzigen. Probeer het opnieuw.',
      });
    } else {
      setIsSuccess(true);
      toast({
        title: 'Wachtwoord gewijzigd!',
        description: 'Je kunt nu inloggen met je nieuwe wachtwoord.',
      });
    }
  };

  if (!session) {
    return (
      <Layout showFooter={false}>
        <div className="min-h-[calc(100svh-4rem)] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout showFooter={false}>
      <SEOHead
        title="Wachtwoord herstellen | Dishloopr"
        description="Stel een nieuw wachtwoord in voor je Dishloopr account."
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
            <h1 className="text-xl md:text-2xl font-bold">Nieuw wachtwoord instellen</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1 md:mt-2">
              Kies een sterk wachtwoord voor je account
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 md:p-8">
            {isSuccess ? (
              <div className="text-center py-4">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h2 className="text-lg font-semibold mb-2">Wachtwoord gewijzigd!</h2>
                <p className="text-muted-foreground mb-6">
                  Je wachtwoord is succesvol gewijzigd.
                </p>
                <Button asChild className="w-full">
                  <Link to="/login">Naar inloggen</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} method="post" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm">Nieuw wachtwoord</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      autoComplete="new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pl-10 pr-10 h-11 text-base"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm">Bevestig wachtwoord</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      autoComplete="new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pl-10 pr-10 h-11 text-base"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full h-11" size="lg" disabled={isLoading}>
                  {isLoading ? 'Bezig...' : 'Wachtwoord wijzigen'}
                </Button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
