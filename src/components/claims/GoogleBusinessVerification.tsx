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

  const generateVerificationCode = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-claim', {
        body: { action: 'start_google_verification', claimId },
      });
      if (error) throw error;
      const payload = data as any;
      if (payload?.error) throw new Error(payload.error);
      if (!payload?.code) throw new Error('Geen code ontvangen');
      setExpectedCode(payload.code);
      setStep('code_entry');
    } catch (err: any) {
      console.error('Error generating code:', err);
      toast.error(err?.message || 'Kon verificatiecode niet genereren');
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

    // Local sanity-check only — real check happens server-side after manual admin review.
    if (verificationCode.trim().toUpperCase() !== expectedCode.toUpperCase()) {
      toast.error('De code komt niet overeen. Controleer je Google Business profiel.');
      return;
    }

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-claim', {
        body: { action: 'submit_google_for_review', claimId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success('Aanvraag ingediend! Een admin controleert je Google Business profiel binnen 1-2 werkdagen.');
      onVerified();
    } catch (err: any) {
      console.error('Verification error:', err);
      toast.error(err?.message || 'Verificatie mislukt.');
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
