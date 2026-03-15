import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, UtensilsCrossed, UserCircle } from 'lucide-react';
import { z } from 'zod';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/dishloopr-logo.png';

const loginSchema = z.object({
  email: z.string().email('Ongeldig e-mailadres'),
  password: z.string().min(6, 'Wachtwoord moet minimaal 6 tekens bevatten'),
});

const signupSchema = z.object({
  name: z.string().min(2, 'Naam moet minimaal 2 tekens bevatten'),
  email: z.string().email('Ongeldig e-mailadres'),
  password: z.string().min(6, 'Wachtwoord moet minimaal 6 tekens bevatten'),
});

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, loading, signIn, signUp } = useAuth();
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [accountType, setAccountType] = useState<'user' | 'restaurant'>('user');

  // Redirect if already logged in
  useEffect(() => {
    if (user && !loading) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!validation.success) {
      toast({
        variant: 'destructive',
        title: 'Validatiefout',
        description: validation.error.errors[0].message,
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);

    if (error) {
      let message = 'Er is een fout opgetreden bij het inloggen.';
      if (error.message.includes('Invalid login credentials')) {
        message = 'Ongeldige e-mail of wachtwoord.';
      } else if (error.message.includes('Email not confirmed')) {
        message = 'Bevestig eerst je e-mailadres.';
      }
      toast({
        variant: 'destructive',
        title: 'Inloggen mislukt',
        description: message,
      });
    } else {
      toast({
        title: 'Welkom terug!',
        description: 'Je bent succesvol ingelogd.',
      });
      navigate('/');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = signupSchema.safeParse({ 
      name: signupName, 
      email: signupEmail, 
      password: signupPassword 
    });
    if (!validation.success) {
      toast({
        variant: 'destructive',
        title: 'Validatiefout',
        description: validation.error.errors[0].message,
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName, accountType);
    setIsLoading(false);

    if (error) {
      let message = 'Er is een fout opgetreden bij het registreren.';
      if (error.message.includes('User already registered')) {
        message = 'Dit e-mailadres is al geregistreerd.';
      }
      toast({
        variant: 'destructive',
        title: 'Registratie mislukt',
        description: message,
      });
    } else {
      const isRestaurant = accountType === 'restaurant';
      toast({
        title: 'Bijna klaar!',
        description: isRestaurant
          ? 'Check je e-mail om je account te bevestigen. Daarna kun je je restaurant claimen.'
          : 'Check je e-mail om je account te bevestigen.',
        duration: 10000,
      });
      setSignupName('');
      setSignupEmail('');
      setSignupPassword('');
      setAccountType('user');
    }
  };

  if (loading) {
    return (
      <Layout showFooter={false}>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout showFooter={false}>
      <div className="min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-4rem)] flex items-center justify-center py-8 md:py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-6 md:mb-8">
            <Link to="/" className="inline-block mb-4 md:mb-6">
              <img src={logo} alt="Dishloopr" className="h-12 md:h-16 w-auto mx-auto" />
            </Link>
            <h1 className="text-xl md:text-2xl font-bold">{t('hero.title')}</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1 md:mt-2 px-4">{t('hero.subtitle')}</p>
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 md:p-8">
            <Tabs defaultValue={initialTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-5 md:mb-6">
                <TabsTrigger value="login" className="text-sm md:text-base">{t('nav.login')}</TabsTrigger>
                <TabsTrigger value="signup" className="text-sm md:text-base">{t('nav.signup')}</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="naam@voorbeeld.nl"
                        className="pl-10 h-11 text-base"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-sm">Wachtwoord</Label>
                      <Link 
                        to="/forgot-password" 
                        className="text-xs text-primary hover:underline"
                      >
                        Wachtwoord vergeten?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="pl-10 pr-10 h-11 text-base"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-11" size="lg" disabled={isLoading}>
                    {isLoading ? t('common.loading') : t('nav.login')}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  {/* Account Type Selector */}
                  <div className="space-y-2">
                    <Label className="text-sm">Ik ben een...</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setAccountType('user')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                          accountType === 'user'
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border hover:border-muted-foreground/30'
                        }`}
                      >
                        <UserCircle className={`h-7 w-7 ${accountType === 'user' ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div className="text-center">
                          <p className={`text-sm font-medium ${accountType === 'user' ? 'text-foreground' : 'text-muted-foreground'}`}>Foodie</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Ontdek & review</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountType('restaurant')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                          accountType === 'restaurant'
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border hover:border-muted-foreground/30'
                        }`}
                      >
                        <UtensilsCrossed className={`h-7 w-7 ${accountType === 'restaurant' ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div className="text-center">
                          <p className={`text-sm font-medium ${accountType === 'restaurant' ? 'text-foreground' : 'text-muted-foreground'}`}>Eigenaar</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Beheer je restaurant</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-sm">Naam</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Je naam"
                        className="pl-10 h-11 text-base"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-sm">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="naam@voorbeeld.nl"
                        className="pl-10 h-11 text-base"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-sm">Wachtwoord</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="pl-10 pr-10 h-11 text-base"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-11" size="lg" disabled={isLoading}>
                    {isLoading ? t('common.loading') : t('nav.signup')}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
