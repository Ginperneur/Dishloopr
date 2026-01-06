import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/dishloopr-logo.png';

type ConfirmationStatus = 'loading' | 'success' | 'error';

export default function EmailConfirmPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<ConfirmationStatus>('loading');

  useEffect(() => {
    // Wait for auth state to settle
    if (loading) return;

    // Check URL hash for error
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const error = hashParams.get('error');
    const errorDescription = hashParams.get('error_description');

    if (error) {
      console.error('Email confirmation error:', error, errorDescription);
      setStatus('error');
      return;
    }

    // If user is authenticated after callback, confirmation was successful
    if (user) {
      setStatus('success');
      // Auto-redirect after 3 seconds
      const timer = setTimeout(() => {
        navigate('/');
      }, 3000);
      return () => clearTimeout(timer);
    }

    // Still loading or waiting for auth
    const timer = setTimeout(() => {
      if (!user) {
        setStatus('error');
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [user, loading, navigate]);

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
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 md:p-8">
            {status === 'loading' && (
              <div className="text-center py-8">
                <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
                <h2 className="text-lg font-semibold mb-2">E-mail wordt geverifieerd...</h2>
                <p className="text-muted-foreground">
                  Even geduld, we verifiëren je e-mailadres.
                </p>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center py-4">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">E-mail bevestigd!</h2>
                <p className="text-muted-foreground mb-6">
                  Je account is nu actief. Welkom bij Dishloopr!
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  Je wordt automatisch doorgestuurd...
                </p>
                <Button asChild className="w-full">
                  <Link to="/">Naar de homepage</Link>
                </Button>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center py-4">
                <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Verificatie mislukt</h2>
                <p className="text-muted-foreground mb-6">
                  De bevestigingslink is verlopen of ongeldig. Vraag een nieuwe link aan.
                </p>
                <div className="space-y-3">
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/login">Opnieuw registreren</Link>
                  </Button>
                  <Button asChild className="w-full">
                    <Link to="/">Naar de homepage</Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
