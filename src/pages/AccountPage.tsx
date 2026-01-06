import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { motion } from 'framer-motion';
import { Lock, Trash2, ArrowLeft, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SEOHead } from '@/components/seo/SEOHead';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { z } from 'zod';

const passwordSchema = z.object({
  password: z.string().min(6, 'Wachtwoord moet minimaal 6 tekens bevatten'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Wachtwoorden komen niet overeen',
  path: ['confirmPassword'],
});

export default function AccountPage() {
  const { user, signOut, updatePassword } = useAuth();
  const navigate = useNavigate();
  
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = passwordSchema.safeParse({ 
      password: newPassword, 
      confirmPassword 
    });
    
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setSavingPassword(true);
    const { error } = await updatePassword(newPassword);
    setSavingPassword(false);

    if (error) {
      toast.error('Kon wachtwoord niet wijzigen. Probeer het opnieuw.');
    } else {
      toast.success('Wachtwoord succesvol gewijzigd!');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'VERWIJDEREN') {
      toast.error('Typ "VERWIJDEREN" om te bevestigen');
      return;
    }

    if (!user) return;

    setDeletingAccount(true);

    // Delete user data from profiles table (cascades to related tables)
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);

    if (deleteError) {
      console.error('Error deleting profile:', deleteError);
      toast.error('Kon account niet volledig verwijderen. Neem contact op met support.');
      setDeletingAccount(false);
      return;
    }

    // Sign out and redirect
    await signOut();
    toast.success('Je account is verwijderd.');
    navigate('/');
  };

  if (!user) {
    return (
      <Layout>
        <div className="container py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto text-center"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-4">Account Instellingen</h1>
            <p className="text-muted-foreground mb-6">
              Log in om je account instellingen te bekijken.
            </p>
            <Button asChild size="lg">
              <Link to="/login">Inloggen</Link>
            </Button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEOHead
        title="Account Instellingen | Dishloopr"
        description="Beheer je account instellingen, wijzig je wachtwoord of verwijder je account."
        noindex={true}
      />
      <div className="container py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto space-y-6"
        >
          <div className="flex items-center gap-4 mb-2">
            <Link 
              to="/profile" 
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Terug naar profiel
            </Link>
          </div>
          
          <h1 className="text-3xl font-bold">Account Instellingen</h1>

          {/* Change Password */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Wachtwoord wijzigen
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Kies een sterk wachtwoord dat je nergens anders gebruikt.
            </p>
            
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nieuw wachtwoord</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
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
                <Label htmlFor="confirmPassword">Bevestig wachtwoord</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                  />
                </div>
              </div>

              <Button type="submit" disabled={savingPassword || !newPassword || !confirmPassword}>
                {savingPassword ? 'Opslaan...' : 'Wachtwoord wijzigen'}
              </Button>
            </form>
          </div>

          {/* Delete Account */}
          <div className="bg-card border border-destructive/30 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Account verwijderen
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Als je je account verwijdert, worden al je gegevens permanent verwijderd. 
              Dit kan niet ongedaan worden gemaakt.
            </p>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  Account verwijderen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    Account definitief verwijderen?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-4">
                    <p>
                      Je staat op het punt om je account permanent te verwijderen. 
                      Dit verwijdert:
                    </p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>Je profielgegevens en foto's</li>
                      <li>Al je reviews en beoordelingen</li>
                      <li>Je favorieten en voorkeuren</li>
                      <li>Je badges en statistieken</li>
                    </ul>
                    <p className="font-medium">
                      Deze actie kan niet ongedaan worden gemaakt.
                    </p>
                    <div className="pt-2">
                      <Label htmlFor="deleteConfirm" className="text-foreground">
                        Typ <span className="font-mono font-bold">VERWIJDEREN</span> om te bevestigen
                      </Label>
                      <Input
                        id="deleteConfirm"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="VERWIJDEREN"
                        className="mt-2"
                      />
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>
                    Annuleren
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== 'VERWIJDEREN' || deletingAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deletingAccount ? 'Verwijderen...' : 'Definitief verwijderen'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
