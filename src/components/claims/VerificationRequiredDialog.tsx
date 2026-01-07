import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  CreditCard, 
  Globe, 
  FileCode, 
  ExternalLink, 
  CheckCircle2, 
  Loader2,
  Copy,
  ArrowRight,
  Lock
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useClaimVerification } from '@/hooks/useClaimVerification';
import { VerificationMethod, VerificationTriggerAction } from '@/types/claims';
import { toast } from 'sonner';

interface VerificationRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claimId?: string;
  restaurantId: string;
  restaurantName: string;
  restaurantWebsite?: string | null;
  triggerAction?: VerificationTriggerAction;
  onVerified?: () => void;
  onVerificationComplete?: () => void;
}

const actionLabels: Record<VerificationTriggerAction, string> = {
  publish_profile_changes: 'profielwijzigingen publiceren',
  reply_to_review: 'reageren op reviews',
  purchase_visibility: 'promoties kopen',
  invite_manager: 'managers uitnodigen',
  access_detailed_analytics: 'gedetailleerde analytics bekijken',
};

export function VerificationRequiredDialog({
  open,
  onOpenChange,
  claimId,
  restaurantId,
  restaurantName,
  restaurantWebsite,
  triggerAction = 'access_detailed_analytics',
  onVerified,
  onVerificationComplete,
}: VerificationRequiredDialogProps) {
  const handleVerified = () => {
    onVerified?.();
    onVerificationComplete?.();
  };
  const {
    state,
    startVerification,
    getDnsVerificationDetails,
    getHtmlVerificationDetails,
    verifyDnsRecord,
    verifyHtmlFile,
    reset,
  } = useClaimVerification();

  const [selectedMethod, setSelectedMethod] = useState<VerificationMethod | null>(null);
  const [dnsDetails, setDnsDetails] = useState<{ txtRecord: string; domain: string } | null>(null);
  const [htmlDetails, setHtmlDetails] = useState<{ fileName: string; fileContent: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleSelectMethod = async (method: VerificationMethod) => {
    setSelectedMethod(method);
    await startVerification(claimId, method);

    if (method === 'dns_txt') {
      const details = await getDnsVerificationDetails(restaurantId);
      setDnsDetails(details);
    } else if (method === 'html_file') {
      const details = await getHtmlVerificationDetails(restaurantId);
      setHtmlDetails(details);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    let success = false;

    try {
      if (selectedMethod === 'dns_txt' && dnsDetails) {
        success = await verifyDnsRecord(claimId, dnsDetails.domain);
      } else if (selectedMethod === 'html_file' && restaurantWebsite) {
        success = await verifyHtmlFile(claimId, restaurantWebsite);
      } else if (selectedMethod === 'micro_payment') {
        // In production, this would initiate a Stripe payment flow
        toast.info('Micro-betaling verificatie wordt binnenkort beschikbaar');
        success = false;
      } else if (selectedMethod === 'google_business') {
        toast.info('Google Business verificatie wordt binnenkort beschikbaar');
        success = false;
      }

      if (success) {
        handleVerified();
        onOpenChange(false);
      }
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} gekopieerd!`);
  };

  const handleClose = () => {
    reset();
    setSelectedMethod(null);
    setDnsDetails(null);
    setHtmlDetails(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Verificatie vereist</DialogTitle>
              <DialogDescription>
                Om {actionLabels[triggerAction]} moet je eigenaarschap verifiëren
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Trust message */}
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                Verificatie beschermt restaurants en gasten tegen misbruik. 
                Na verificatie krijg je volledige toegang tot alle eigenaarsfuncties.
              </span>
            </p>
          </div>

          <AnimatePresence mode="wait">
            {!selectedMethod ? (
              <motion.div
                key="select"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <h3 className="font-semibold">Kies een verificatiemethode</h3>

                <div className="grid gap-3">
                  {/* Micro-payment */}
                  <button
                    onClick={() => handleSelectMethod('micro_payment')}
                    className="flex items-start gap-4 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                  >
                    <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Micro-betaling</span>
                        <Badge variant="secondary" className="text-xs">Snelst</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Betaal €1 (wordt teruggestort als tegoed). Directe verificatie.
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </button>

                  {/* DNS Verification */}
                  {restaurantWebsite && (
                    <button
                      onClick={() => handleSelectMethod('dns_txt')}
                      className="flex items-start gap-4 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                    >
                      <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                        <Globe className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <span className="font-medium">DNS TXT Record</span>
                        <p className="text-sm text-muted-foreground mt-1">
                          Voeg een TXT record toe aan je domein. Vereist DNS toegang.
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  )}

                  {/* HTML File */}
                  {restaurantWebsite && (
                    <button
                      onClick={() => handleSelectMethod('html_file')}
                      className="flex items-start gap-4 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                    >
                      <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                        <FileCode className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <span className="font-medium">HTML Bestand</span>
                        <p className="text-sm text-muted-foreground mt-1">
                          Upload een verificatiebestand naar je website root.
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  )}

                  {/* Google Business */}
                  <button
                    onClick={() => handleSelectMethod('google_business')}
                    className="flex items-start gap-4 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left opacity-50"
                    disabled
                  >
                    <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                      <ExternalLink className="h-5 w-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Google Business Profile</span>
                        <Badge variant="outline" className="text-xs">Binnenkort</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Koppel je geverifieerde Google Business profiel.
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
              </motion.div>
            ) : selectedMethod === 'dns_txt' && dnsDetails ? (
              <motion.div
                key="dns"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <h3 className="font-semibold">DNS TXT Record Verificatie</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>1. Voeg dit TXT record toe aan je domein</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={dnsDetails.txtRecord} 
                        readOnly 
                        className="font-mono text-sm"
                      />
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => copyToClipboard(dnsDetails.txtRecord, 'TXT record')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>2. Domein</Label>
                    <Input value={dnsDetails.domain} readOnly />
                  </div>

                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <p className="text-muted-foreground">
                      Het kan tot 24 uur duren voordat DNS wijzigingen doorwerken. 
                      Je kunt later terugkomen om de verificatie af te ronden.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setSelectedMethod(null)}>
                    Terug
                  </Button>
                  <Button onClick={handleVerify} disabled={verifying} className="flex-1">
                    {verifying ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Controleren...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Verifiëren
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            ) : selectedMethod === 'html_file' && htmlDetails ? (
              <motion.div
                key="html"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <h3 className="font-semibold">HTML Bestand Verificatie</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>1. Maak een bestand aan met deze naam</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={htmlDetails.fileName} 
                        readOnly 
                        className="font-mono text-sm"
                      />
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => copyToClipboard(htmlDetails.fileName, 'Bestandsnaam')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>2. Zet deze inhoud in het bestand</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={htmlDetails.fileContent} 
                        readOnly 
                        className="font-mono text-xs"
                      />
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => copyToClipboard(htmlDetails.fileContent, 'Bestandsinhoud')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>3. Upload naar je website root</Label>
                    <p className="text-sm text-muted-foreground">
                      Het bestand moet bereikbaar zijn op: {restaurantWebsite}/{htmlDetails.fileName}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setSelectedMethod(null)}>
                    Terug
                  </Button>
                  <Button onClick={handleVerify} disabled={verifying} className="flex-1">
                    {verifying ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Controleren...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Verifiëren
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            ) : selectedMethod === 'micro_payment' ? (
              <motion.div
                key="payment"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <h3 className="font-semibold">Micro-betaling Verificatie</h3>

                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    Micro-betaling verificatie wordt binnenkort beschikbaar. 
                    Probeer een andere verificatiemethode.
                  </p>
                </div>

                <Button variant="outline" onClick={() => setSelectedMethod(null)} className="w-full">
                  Terug naar methodes
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
