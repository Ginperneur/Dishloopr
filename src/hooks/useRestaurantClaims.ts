import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  RestaurantClaim, 
  RestaurantClaimStatus, 
  ManagerRole,
  ClaimPermissions,
  getClaimPermissions 
} from '@/types/claims';
import { toast } from 'sonner';

interface UseRestaurantClaimsResult {
  // User's claims
  userClaims: RestaurantClaim[];
  loading: boolean;
  
  // Check claim status for a restaurant
  getRestaurantClaimStatus: (restaurantId: string) => Promise<{
    status: RestaurantClaimStatus;
    hasPendingClaim: boolean;
    isUserClaimant: boolean;
    userRole: ManagerRole | null;
  }>;
  
  // Check if user can create a new claim
  canCreateClaim: () => Promise<boolean>;
  
  // Create initial claim
  createClaim: (restaurantId: string, phoneNumber?: string) => Promise<{ success: boolean; claimId?: string; error?: string }>;
  
  // Get permissions for a restaurant
  getPermissions: (restaurantId: string) => Promise<ClaimPermissions>;
  
  // Log activity
  logClaimActivity: (params: {
    restaurantId?: string;
    claimId?: string;
    actionType: string;
    actionCategory: 'claim' | 'verification' | 'access' | 'edit' | 'payment' | 'admin';
    beforeData?: Record<string, unknown>;
    afterData?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
  
  refetch: () => Promise<void>;
}

export function useRestaurantClaims(): UseRestaurantClaimsResult {
  const { user } = useAuth();
  const [userClaims, setUserClaims] = useState<RestaurantClaim[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserClaims = useCallback(async () => {
    if (!user) {
      setUserClaims([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('restaurant_claims')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to match our types
      const transformedClaims: RestaurantClaim[] = (data || []).map(claim => ({
        id: claim.id,
        restaurant_id: claim.restaurant_id,
        user_id: claim.user_id,
        status: claim.status as RestaurantClaim['status'],
        is_primary: claim.is_primary,
        email_verified: claim.email_verified,
        email_verified_at: claim.email_verified_at,
        phone_number: claim.phone_number,
        phone_verified: claim.phone_verified,
        phone_verified_at: claim.phone_verified_at,
        verification_method: claim.verification_method as RestaurantClaim['verification_method'],
        verification_started_at: claim.verification_started_at,
        verification_completed_at: claim.verification_completed_at,
        verification_proof: (claim.verification_proof as Record<string, unknown>) || {},
        admin_notes: claim.admin_notes,
        reviewed_by: claim.reviewed_by,
        reviewed_at: claim.reviewed_at,
        created_at: claim.created_at,
        updated_at: claim.updated_at,
      }));
      setUserClaims(transformedClaims);
    } catch (error) {
      console.error('Error fetching user claims:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserClaims();
  }, [fetchUserClaims]);

  const getRestaurantClaimStatus = useCallback(async (restaurantId: string): Promise<{
    status: RestaurantClaimStatus;
    hasPendingClaim: boolean;
    isUserClaimant: boolean;
    userRole: ManagerRole | null;
  }> => {
    try {
      // Get restaurant claim status
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('claim_status')
        .eq('id', restaurantId)
        .single();

      if (restaurantError) throw restaurantError;

      const status = (restaurant?.claim_status || 'unclaimed') as RestaurantClaimStatus;

      // Check if user has a pending claim
      let hasPendingClaim = false;
      let isUserClaimant = false;
      let userRole: ManagerRole | null = null;

      if (user) {
        // Check for claims
        const { data: claims } = await supabase
          .from('restaurant_claims')
          .select('status')
          .eq('restaurant_id', restaurantId)
          .eq('user_id', user.id);

        hasPendingClaim = claims?.some(c => ['pending', 'email_verified', 'phone_verified'].includes(c.status)) || false;
        isUserClaimant = (claims?.length || 0) > 0;

        // Check for manager role
        const { data: manager } = await supabase
          .from('restaurant_managers')
          .select('role')
          .eq('restaurant_id', restaurantId)
          .eq('user_id', user.id)
          .maybeSingle();

        userRole = manager?.role as ManagerRole | null;
      }

      return { status, hasPendingClaim, isUserClaimant, userRole };
    } catch (error) {
      console.error('Error getting restaurant claim status:', error);
      return { status: 'unclaimed', hasPendingClaim: false, isUserClaimant: false, userRole: null };
    }
  }, [user]);

  const canCreateClaim = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase.rpc('can_create_claim', {
        _user_id: user.id
      });

      if (error) throw error;
      return data === true;
    } catch (error) {
      console.error('Error checking claim limit:', error);
      return false;
    }
  }, [user]);

  const createClaim = useCallback(async (
    restaurantId: string, 
    phoneNumber?: string
  ): Promise<{ success: boolean; claimId?: string; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Je moet ingelogd zijn om te claimen' };
    }

    try {
      // Check if user can create claim
      const canClaim = await canCreateClaim();
      if (!canClaim) {
        return { 
          success: false, 
          error: 'Je hebt het maximum aantal onverifieerde claims bereikt (max 2)' 
        };
      }

      // Check if restaurant is already verified
      const { status, hasPendingClaim } = await getRestaurantClaimStatus(restaurantId);
      
      if (hasPendingClaim) {
        return { success: false, error: 'Je hebt al een lopende claim voor dit restaurant' };
      }

      // Create the claim
      const { data: claim, error } = await supabase
        .from('restaurant_claims')
        .insert({
          restaurant_id: restaurantId,
          user_id: user.id,
          phone_number: phoneNumber || null,
          email_verified: true, // Supabase auth ensures email is verified
          email_verified_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) throw error;

      // Update or create user claim limits
      await supabase
        .from('user_claim_limits')
        .upsert({
          user_id: user.id,
          active_unverified_claims: 1,
          total_claims_attempted: 1,
          last_claim_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      // Update restaurant status if unclaimed
      if (status === 'unclaimed') {
        await supabase
          .from('restaurants')
          .update({ claim_status: 'claimed_unverified' })
          .eq('id', restaurantId);
      }

      // Log activity
      await logClaimActivity({
        restaurantId,
        claimId: claim.id,
        actionType: 'CLAIM_INITIATED',
        actionCategory: 'claim',
        afterData: { status: 'pending', email_verified: true },
      });

      await fetchUserClaims();
      return { success: true, claimId: claim.id };
    } catch (error: any) {
      console.error('Error creating claim:', error);
      return { success: false, error: error.message || 'Er ging iets mis' };
    }
  }, [user, canCreateClaim, getRestaurantClaimStatus, fetchUserClaims]);

  const getPermissions = useCallback(async (restaurantId: string): Promise<ClaimPermissions> => {
    const { status, userRole } = await getRestaurantClaimStatus(restaurantId);
    return getClaimPermissions(status, userRole || undefined);
  }, [getRestaurantClaimStatus]);

  const logClaimActivity = useCallback(async (params: {
    restaurantId?: string;
    claimId?: string;
    actionType: string;
    actionCategory: 'claim' | 'verification' | 'access' | 'edit' | 'payment' | 'admin';
    beforeData?: Record<string, unknown>;
    afterData?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) => {
    if (!user) return;

    try {
      await supabase
        .from('claim_activity_logs')
        .insert([{
          actor_id: user.id,
          actor_role: 'user' as const,
          restaurant_id: params.restaurantId || null,
          claim_id: params.claimId || null,
          action_type: params.actionType,
          action_category: params.actionCategory,
          before_data: params.beforeData ? JSON.parse(JSON.stringify(params.beforeData)) : null,
          after_data: params.afterData ? JSON.parse(JSON.stringify(params.afterData)) : null,
          metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : {},
        }]);
    } catch (error) {
      console.error('Error logging claim activity:', error);
    }
  }, [user]);

  return {
    userClaims,
    loading,
    getRestaurantClaimStatus,
    canCreateClaim,
    createClaim,
    getPermissions,
    logClaimActivity,
    refetch: fetchUserClaims,
  };
}
