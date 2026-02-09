import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Mail, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DomainEmailVerificationProps {
  claimId: string;
  restaurantId: string;
  restaurantName: string;
  restaurantWebsite?: string | null;
  onBack: () => void;
  onVerified: () => void;
}

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function DomainEmailVerification({
  claimId,
  restaurantId,
  restaurantName,
  restaurantWebsite,
  onBack,
  onVerified,
}: DomainEmailVerificationProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'enter_email' | 'enter_code'>('enter_email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [expectedCode, setExpectedCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const expectedDomain = restaurantWebsite ? extractDomain(restaurantWebsite) : null;

  const getEmailDomain = (addr: string) => {
    const parts = addr.split('@');
    return parts.length === 2 ? parts[1].toLowerCase() : null;
  };

  const isDomainMatch = (addr: string) => {
    const emailDomain = getEmailDomain(addr);
    if (!emailDomain || !expectedDomain) return false;
    // Match exact or subdomain
    return emailDomain === expectedDomain || emailDomain.endsWith(`.${expectedDomain}`);
  };

  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      toast.error('Voer een geldig e-mailadres in');
      return;
    }

    if (!isDomainMatch(trimmed)) {
      toast.error(`Het e-mailadres moet eindigen op @${expectedDomain}`);
      return;
    }

    setSending(true);
    try {
      // Generate a 6-digit code
      const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
      setExpectedCode(generatedCode);

      // Store code in claim
      await supabase
        .from('restaurant_claims')
        .update({
          verification_method: 'domain_email',
          verification_started_at: new Date().toISOString(),
          verification_proof: {
            method: 'domain_email',
            email: trimmed,
            expected_code: generatedCode,
            sent_at: new Date().toISOString(),
          },
        })
        .eq('id', claimId);

      // Send the verification email via edge function
      const { error } = await supabase.functions.invoke('send-domain-verification', {
        body: { email: trimmed, code: generatedCode, restaurantName },
      });

      if (error) throw error;

      toast.success(`Verificatiecode verstuurd naar ${trimmed}`);
      setStep('enter_code');
    } catch (error) {
      console.error('Error sending verification email:', error);
      toast.error('Kon verificatie-e-mail niet versturen. Probeer het opnieuw.');
    } finally {
      setSending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.trim() !== expectedCode) {
      toast.error('Onjuiste code. Controleer je e-mail en probeer opnieuw.');
      return;
    }

    setVerifying(true);
    try {
      // Update claim to verified
      const { error: claimError } = await supabase
        .from('restaurant_claims')
        .update({
          status: 'verified',
          verification_method: 'domain_email',
          verification_completed_at: new Date().toISOString(),
          verification_proof: {
            method: 'domain_email',
            email: email.trim().toLowerCase(),
            verified_at: new Date().toISOString(),
          },
          is_primary: true,
        })
        .eq('id', claimId);

      if (claimError) throw claimError;

      // Update restaurant status
      await supabase
        .from('restaurants')
        .update({ claim_status: 'verified_owner', updated_at: new Date().toISOString() })
        .eq('id', restaurantId);

      // Add as primary owner
      await supabase
        .from('restaurant_managers')
        .upsert({
          restaurant_id: restaurantId,
          user_id: user?.id,
          role: 'primary_owner',
          accepted_at: new Date().toISOString(),
        }, { onConflict: 'restaurant_id,user_id' });

      // Give owner role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', user?.id)
        .eq('role', 'owner')
        .maybeSingle();

      if (!existingRole) {
        await supabase.from('user_roles').insert({ user_id: user?.id, role: 'owner' });
      }

      // Supersede other claims
      await supabase
        .from('restaurant_claims')
        .update({ status: 'superseded' })
        .eq('restaurant_id', restaurantId)
        .neq('id', claimId);

      // Log
      await supabase.from('claim_activity_logs').insert({
        actor_id: user?.id,
        actor_role: 'user',
        restaurant_id: restaurantId,
        claim_id: claimId,
        action_type: 'VERIFICATION_COMPLETED',
        action_category: 'verification',
        after_data: { method: 'domain_email', email: email.trim().toLowerCase() },
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
        <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
          <Mail className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h3 className="font-semibold">E-mail vanuit domein</h3>
          <p className="text-sm text-muted-foreground">
            Verifieer met een e-mailadres op het domein van het restaurant
          </p>
        </div>
      </div>

      {step === 'enter_email' && (
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium">Zo werkt het:</p>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Voer je zakelijke e-mailadres in (bijv. info@{expectedDomain || 'jouwrestaurant.nl'})</li>
              <li>We sturen een verificatiecode naar dat adres</li>
              <li>Voer de code in om je eigenaarschap te bevestigen</li>
            </ol>
          </div>

          {expectedDomain && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50 border border-accent">
              <AlertCircle className="h-5 w-5 text-accent-foreground flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Domein vereiste</p>
                <p className="text-muted-foreground">
                  Het e-mailadres moet eindigen op <strong>@{expectedDomain}</strong>
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="domain-email">Zakelijk e-mailadres</Label>
            <Input
              id="domain-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`bijv. info@${expectedDomain || 'restaurant.nl'}`}
            />
          </div>

          <Button
            onClick={handleSendCode}
            disabled={sending || !email.trim()}
            className="w-full"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Versturen...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                Verificatiecode versturen
              </>
            )}
          </Button>

          <Button variant="outline" onClick={onBack} className="w-full">
            Terug naar methodes
          </Button>
        </div>
      )}

      {step === 'enter_code' && (
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p>
              We hebben een 6-cijferige code gestuurd naar <strong className="text-foreground">{email}</strong>. 
              Controleer ook je spam-map.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="verify-domain-code">Verificatiecode</Label>
            <Input
              id="verify-domain-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              className="font-mono text-lg tracking-[0.5em] text-center"
              maxLength={6}
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('enter_email')}>
              Terug
            </Button>
            <Button
              onClick={handleVerifyCode}
              disabled={verifying || code.length !== 6}
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

          <button
            onClick={handleSendCode}
            className="text-xs text-muted-foreground hover:text-foreground underline mx-auto block"
          >
            Code niet ontvangen? Opnieuw versturen
          </button>
        </div>
      )}
    </motion.div>
  );
}
