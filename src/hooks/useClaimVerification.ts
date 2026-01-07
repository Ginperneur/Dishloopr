import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { VerificationMethod, VerificationTriggerAction } from '@/types/claims';
import { toast } from 'sonner';

interface VerificationState {
  isVerifying: boolean;
  currentMethod: VerificationMethod | null;
  verificationStep: 'select' | 'in_progress' | 'complete' | 'failed';
  verificationData: Record<string, unknown>;
}

interface UseClaimVerificationResult {
  state: VerificationState;
  
  // Check if action requires verification
  requiresVerification: (restaurantId: string, action: VerificationTriggerAction) => Promise<boolean>;
  
  // Start verification process
  startVerification: (claimId: string, method: VerificationMethod) => Promise<boolean>;
  
  // Complete verification
  completeVerification: (claimId: string, proof: Record<string, unknown>) => Promise<boolean>;
  
  // Get DNS verification details
  getDnsVerificationDetails: (restaurantId: string) => Promise<{ txtRecord: string; domain: string } | null>;
  
  // Get HTML verification details
  getHtmlVerificationDetails: (restaurantId: string) => Promise<{ fileName: string; fileContent: string } | null>;
  
  // Verify DNS record
  verifyDnsRecord: (claimId: string, domain: string) => Promise<boolean>;
  
  // Verify HTML file
  verifyHtmlFile: (claimId: string, url: string) => Promise<boolean>;
  
  // Reset state
  reset: () => void;
}

export function useClaimVerification(): UseClaimVerificationResult {
  const { user } = useAuth();
  const [state, setState] = useState<VerificationState>({
    isVerifying: false,
    currentMethod: null,
    verificationStep: 'select',
    verificationData: {},
  });

  const requiresVerification = useCallback(async (
    restaurantId: string, 
    action: VerificationTriggerAction
  ): Promise<boolean> => {
    if (!user) return true;

    try {
      // Check if user is already verified owner
      const { data: isVerified } = await supabase.rpc('is_verified_owner', {
        _user_id: user.id,
        _restaurant_id: restaurantId
      });

      if (isVerified) return false;

      // Check if restaurant is in verified state
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('claim_status')
        .eq('id', restaurantId)
        .single();

      if (restaurant?.claim_status === 'verified_owner') {
        // User is not the verified owner, they need to claim first
        return true;
      }

      // All trigger actions require verification for unverified claimants
      return true;
    } catch (error) {
      console.error('Error checking verification requirement:', error);
      return true;
    }
  }, [user]);

  const startVerification = useCallback(async (
    claimId: string, 
    method: VerificationMethod
  ): Promise<boolean> => {
    if (!user) return false;

    setState(prev => ({
      ...prev,
      isVerifying: true,
      currentMethod: method,
      verificationStep: 'in_progress',
    }));

    try {
      const { error } = await supabase
        .from('restaurant_claims')
        .update({
          verification_method: method,
          verification_started_at: new Date().toISOString(),
        })
        .eq('id', claimId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Log activity
      await supabase
        .from('claim_activity_logs')
        .insert({
          actor_id: user.id,
          actor_role: 'user',
          claim_id: claimId,
          action_type: 'VERIFICATION_STARTED',
          action_category: 'verification',
          after_data: { method },
        });

      return true;
    } catch (error) {
      console.error('Error starting verification:', error);
      setState(prev => ({ ...prev, verificationStep: 'failed' }));
      return false;
    }
  }, [user]);

  const completeVerification = useCallback(async (
    claimId: string, 
    proof: Record<string, unknown>
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      // Get the claim details
      const { data: claim, error: claimError } = await supabase
        .from('restaurant_claims')
        .select('restaurant_id, verification_method')
        .eq('id', claimId)
        .eq('user_id', user.id)
        .single();

      if (claimError || !claim) throw claimError || new Error('Claim not found');

      // Update claim to verified
      const { error: updateError } = await supabase
        .from('restaurant_claims')
        .update({
          status: 'verified',
          verification_completed_at: new Date().toISOString(),
          verification_proof: JSON.parse(JSON.stringify(proof)),
          is_primary: true,
        })
        .eq('id', claimId);

      if (updateError) throw updateError;

      // Update restaurant status
      await supabase
        .from('restaurants')
        .update({ claim_status: 'verified_owner' as const })
        .eq('id', claim.restaurant_id);

      // Add user as primary owner in managers table
      await supabase
        .from('restaurant_managers')
        .insert([{
          restaurant_id: claim.restaurant_id,
          user_id: user.id,
          role: 'primary_owner' as const,
          accepted_at: new Date().toISOString(),
        }]);

      // Give user the owner role if they don't have it
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'owner')
        .maybeSingle();

      if (!existingRole) {
        await supabase
          .from('user_roles')
          .insert({ user_id: user.id, role: 'owner' });
      }

      // Mark any other claims as superseded
      await supabase
        .from('restaurant_claims')
        .update({ status: 'superseded' })
        .eq('restaurant_id', claim.restaurant_id)
        .neq('id', claimId);

      // Update user claim limits
      await supabase
        .from('user_claim_limits')
        .update({
          active_unverified_claims: 0,
        })
        .eq('user_id', user.id);

      // Log activity
      await supabase
        .from('claim_activity_logs')
        .insert([{
          actor_id: user.id,
          actor_role: 'user' as const,
          restaurant_id: claim.restaurant_id,
          claim_id: claimId,
          action_type: 'VERIFICATION_COMPLETED',
          action_category: 'verification' as const,
          after_data: JSON.parse(JSON.stringify({ method: claim.verification_method, proof })),
        }]);

      setState(prev => ({ ...prev, verificationStep: 'complete' }));
      toast.success('Verificatie geslaagd! Je bent nu geverifieerde eigenaar.');
      return true;
    } catch (error) {
      console.error('Error completing verification:', error);
      setState(prev => ({ ...prev, verificationStep: 'failed' }));
      toast.error('Verificatie mislukt. Probeer het opnieuw.');
      return false;
    }
  }, [user]);

  const getDnsVerificationDetails = useCallback(async (
    restaurantId: string
  ): Promise<{ txtRecord: string; domain: string } | null> => {
    if (!user) return null;

    try {
      // Get restaurant website
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('website_url')
        .eq('id', restaurantId)
        .single();

      if (!restaurant?.website_url) return null;

      // Extract domain from URL
      const url = new URL(restaurant.website_url);
      const domain = url.hostname;

      // Generate unique verification code
      const verificationCode = `dishloopr-verify=${user.id.slice(0, 8)}`;

      setState(prev => ({
        ...prev,
        verificationData: { domain, txtRecord: verificationCode },
      }));

      return { txtRecord: verificationCode, domain };
    } catch (error) {
      console.error('Error getting DNS verification details:', error);
      return null;
    }
  }, [user]);

  const getHtmlVerificationDetails = useCallback(async (
    restaurantId: string
  ): Promise<{ fileName: string; fileContent: string } | null> => {
    if (!user) return null;

    try {
      const fileName = `dishloopr-${user.id.slice(0, 8)}.html`;
      const fileContent = `<!-- Dishloopr Verification -->\n<meta name="dishloopr-site-verification" content="${user.id}" />`;

      setState(prev => ({
        ...prev,
        verificationData: { fileName, fileContent },
      }));

      return { fileName, fileContent };
    } catch (error) {
      console.error('Error getting HTML verification details:', error);
      return null;
    }
  }, [user]);

  const verifyDnsRecord = useCallback(async (
    claimId: string, 
    domain: string
  ): Promise<boolean> => {
    // In production, this would call an edge function to verify DNS
    // For now, we'll simulate verification
    toast.info('DNS verificatie wordt gecontroleerd...');
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // For demo purposes, always succeed
    return completeVerification(claimId, { method: 'dns_txt', domain });
  }, [completeVerification]);

  const verifyHtmlFile = useCallback(async (
    claimId: string, 
    url: string
  ): Promise<boolean> => {
    // In production, this would call an edge function to verify HTML file
    toast.info('HTML bestand wordt gecontroleerd...');
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // For demo purposes, always succeed
    return completeVerification(claimId, { method: 'html_file', url });
  }, [completeVerification]);

  const reset = useCallback(() => {
    setState({
      isVerifying: false,
      currentMethod: null,
      verificationStep: 'select',
      verificationData: {},
    });
  }, []);

  return {
    state,
    requiresVerification,
    startVerification,
    completeVerification,
    getDnsVerificationDetails,
    getHtmlVerificationDetails,
    verifyDnsRecord,
    verifyHtmlFile,
    reset,
  };
}
