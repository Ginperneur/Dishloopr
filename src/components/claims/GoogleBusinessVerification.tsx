import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ExternalLink, 
  CheckCircle2, 
  Loader2, 
  Copy, 
  ClipboardCheck,
  AlertCircle,
  Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface GoogleBusinessVerificationProps {
  claimId: string;
  restaurantId: string;
  restaurantName: string;
  onBack: () => void;
  onVerified: () => void;
}

export function GoogleBusinessVerification({
  claimId,
  restaurantId,
  restaurantName,
  onBack,
  onVerified,
}: GoogleBusinessVerificationProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'intro' | 'code_entry' | 'verifying'>('intro');
  const [verificationCode, setVerificationCode] = useState('');
  const [expectedCode, setExpectedCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate a unique verification code for this user/restaurant combination
  const generateVerificationCode = async () => {
    setGenerating(true);
    try {
      // Generate a unique code based on user ID and timestamp
      const code = `DISH-${user?.id?.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
      setExpectedCode(code);
      
      // Store the expected code in the claim for later verification
      const { error } = await supabase
        .from('restaurant_claims')
        .update({
          verification_proof: { 
            method: 'google_business',
            expected_code: code,
            generated_at: new Date().toISOString()
          }
        })
        .eq('id', claimId);

      if (error) throw error;
      
      setStep('code_entry');
    } catch (error) {
      console.error('Error generating code:', error);
      toast.error('Kon verificatiecode niet genereren');
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(expectedCode);
    setCopied(true);
    toast.success('Code gekopieerd!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async () => {
    if (!verificationCode.trim()) {
      toast.error('Voer de verificatiecode in');
      return;
    }

    // Check if the entered code matches (case-insensitive)
    if (verificationCode.trim().toUpperCase() !== expectedCode.toUpperCase()) {
      toast.error('De code komt niet overeen. Controleer je Google Business profiel.');
      return;
    }

    setVerifying(true);
    try {
      // Update the claim with verification completed
      const { error: claimError } = await supabase
        .from('restaurant_claims')
        .update({
          status: 'verified',
          verification_method: 'google_business',
          verification_completed_at: new Date().toISOString(),
          verification_proof: {
            method: 'google_business',
            verified_code: verificationCode,
            verified_at: new Date().toISOString()
          },
          is_primary: true,
        })
        .eq('id', claimId);

      if (claimError) throw claimError;

      // Update restaurant status to verified_owner
      const { error: restaurantError } = await supabase
        .from('restaurants')
        .update({ 
          claim_status: 'verified_owner',
          updated_at: new Date().toISOString()
        })
        .eq('id', restaurantId);

      if (restaurantError) throw restaurantError;

      // Add user as primary owner in managers table
      const { error: managerError } = await supabase
        .from('restaurant_managers')
        .upsert({
          restaurant_id: restaurantId,
          user_id: user?.id,
          role: 'primary_owner',
          accepted_at: new Date().toISOString(),
        }, { onConflict: 'restaurant_id,user_id' });

      if (managerError) console.error('Error adding manager:', managerError);

      // Give user the owner role if they don't have it
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', user?.id)
        .eq('role', 'owner')
        .maybeSingle();

      if (!existingRole) {
        await supabase
          .from('user_roles')
          .insert({ user_id: user?.id, role: 'owner' });
      }

      // Mark any other claims as superseded
      await supabase
        .from('restaurant_claims')
        .update({ status: 'superseded' })
        .eq('restaurant_id', restaurantId)
        .neq('id', claimId);

      // Log activity
      await supabase
        .from('claim_activity_logs')
        .insert({
          actor_id: user?.id,
          actor_role: 'user',
          restaurant_id: restaurantId,
          claim_id: claimId,
          action_type: 'VERIFICATION_COMPLETED',
          action_category: 'verification',
          after_data: { method: 'google_business' },
        });

      toast.success('Verificatie geslaagd! Je bent nu geverifieerde eigenaar.');
      onVerified();
    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Verificatie mislukt. Probeer het opnieuw.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Google Business Profile Verificatie</h3>
          <p className="text-sm text-muted-foreground">
            Bewijs eigenaarschap via je Google Business profiel
          </p>
        </div>
      </div>

      {step === 'intro' && (
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium">Zo werkt het:</p>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>We genereren een unieke verificatiecode voor jou</li>
              <li>Voeg deze code toe aan je Google Business profiel beschrijving</li>
              <li>Voer dezelfde code hier in om te bevestigen</li>
              <li>Na verificatie kun je de code weer verwijderen</li>
            </ol>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50 border border-accent">
            <AlertCircle className="h-5 w-5 text-accent-foreground flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Vereisten</p>
              <p className="text-muted-foreground">
                Je moet toegang hebben tot het Google Business profiel van <strong>{restaurantName}</strong>
              </p>
            </div>
          </div>

          <Button 
            onClick={generateVerificationCode} 
            disabled={generating} 
            className="w-full"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Code genereren...
              </>
            ) : (
              'Start verificatie'
            )}
          </Button>

          <Button variant="outline" onClick={onBack} className="w-full">
            Terug naar methodes
          </Button>
        </div>
      )}

      {step === 'code_entry' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Stap 1: Kopieer deze verificatiecode</Label>
            <div className="flex gap-2">
              <Input 
                value={expectedCode} 
                readOnly 
                className="font-mono text-lg font-bold tracking-wider"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={copyCode}
              >
                {copied ? (
                  <ClipboardCheck className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Stap 2: Voeg toe aan Google Business</Label>
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
              <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                <li>Ga naar <a href="https://business.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Google Business <ExternalLink className="h-3 w-3" /></a></li>
                <li>Selecteer je restaurant "{restaurantName}"</li>
                <li>Ga naar "Info bewerken" of "Profiel bewerken"</li>
                <li>Plak de code in het "Beschrijving" veld</li>
                <li>Sla de wijzigingen op</li>
              </ol>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="verify-code">Stap 3: Bevestig de code</Label>
            <Input
              id="verify-code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
              placeholder="Voer de code in die je hebt toegevoegd"
              className="font-mono tracking-wider"
            />
            <p className="text-xs text-muted-foreground">
              Typ dezelfde code over die je aan je Google Business profiel hebt toegevoegd
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('intro')}>
              Terug
            </Button>
            <Button 
              onClick={handleVerify} 
              disabled={verifying || !verificationCode.trim()} 
              className="flex-1"
            >
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifiëren...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Verifiëren
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Na succesvolle verificatie kun je de code weer verwijderen uit je Google Business profiel
          </p>
        </div>
      )}
    </motion.div>
  );
}
