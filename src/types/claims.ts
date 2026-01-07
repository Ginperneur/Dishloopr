// Restaurant Claim Types
export type RestaurantClaimStatus = 'unclaimed' | 'claimed_unverified' | 'verified_owner' | 'disputed' | 'locked';

export type VerificationMethod = 'micro_payment' | 'dns_txt' | 'html_file' | 'google_business';

export type ManagerRole = 'viewer' | 'editor' | 'finance' | 'primary_owner';

export type ClaimStatus = 'pending' | 'email_verified' | 'phone_verified' | 'verified' | 'rejected' | 'superseded';

export interface RestaurantClaim {
  id: string;
  restaurant_id: string;
  user_id: string;
  status: ClaimStatus;
  is_primary: boolean;
  
  // Verification
  email_verified: boolean;
  email_verified_at: string | null;
  phone_number: string | null;
  phone_verified: boolean;
  phone_verified_at: string | null;
  
  // Upgrade verification
  verification_method: VerificationMethod | null;
  verification_started_at: string | null;
  verification_completed_at: string | null;
  verification_proof: Record<string, unknown>;
  
  // Admin
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  
  created_at: string;
  updated_at: string;
}

export interface RestaurantManager {
  id: string;
  restaurant_id: string;
  user_id: string;
  role: ManagerRole;
  invited_by: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RestaurantPendingEdit {
  id: string;
  restaurant_id: string;
  submitted_by: string;
  proposed_changes: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'auto_applied';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClaimActivityLog {
  id: string;
  actor_id: string;
  actor_role: 'user' | 'owner' | 'admin' | 'system';
  restaurant_id: string | null;
  claim_id: string | null;
  action_type: string;
  action_category: 'claim' | 'verification' | 'access' | 'edit' | 'payment' | 'admin';
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// Permission helpers
export interface ClaimPermissions {
  canViewPublicData: boolean;
  canViewRestrictedDashboard: boolean;
  canProposeEdits: boolean;
  canPublishEdits: boolean;
  canReplyToReviews: boolean;
  canPurchaseListings: boolean;
  canInviteManagers: boolean;
  canViewDishAnalytics: boolean;
  canViewTagPerformance: boolean;
  canViewCompetitiveData: boolean;
}

export function getClaimPermissions(claimStatus: RestaurantClaimStatus, userRole?: ManagerRole): ClaimPermissions {
  const basePermissions: ClaimPermissions = {
    canViewPublicData: true,
    canViewRestrictedDashboard: false,
    canProposeEdits: false,
    canPublishEdits: false,
    canReplyToReviews: false,
    canPurchaseListings: false,
    canInviteManagers: false,
    canViewDishAnalytics: false,
    canViewTagPerformance: false,
    canViewCompetitiveData: false,
  };

  switch (claimStatus) {
    case 'unclaimed':
      return basePermissions;

    case 'claimed_unverified':
      return {
        ...basePermissions,
        canViewRestrictedDashboard: true,
        canProposeEdits: true,
      };

    case 'verified_owner':
      if (!userRole) return basePermissions;
      
      const isOwnerOrEditor = ['primary_owner', 'editor'].includes(userRole);
      const isOwnerOrFinance = ['primary_owner', 'finance'].includes(userRole);
      const isPrimaryOwner = userRole === 'primary_owner';

      return {
        canViewPublicData: true,
        canViewRestrictedDashboard: true,
        canProposeEdits: true,
        canPublishEdits: isOwnerOrEditor,
        canReplyToReviews: isOwnerOrEditor,
        canPurchaseListings: isOwnerOrFinance,
        canInviteManagers: isPrimaryOwner,
        canViewDishAnalytics: true,
        canViewTagPerformance: true,
        canViewCompetitiveData: isPrimaryOwner,
      };

    case 'disputed':
    case 'locked':
      return {
        ...basePermissions,
        canViewRestrictedDashboard: true,
        // All sensitive actions locked during dispute
      };

    default:
      return basePermissions;
  }
}

// Verification trigger actions
export const VERIFICATION_TRIGGER_ACTIONS = [
  'publish_profile_changes',
  'reply_to_review',
  'purchase_visibility',
  'invite_manager',
  'access_detailed_analytics',
] as const;

export type VerificationTriggerAction = typeof VERIFICATION_TRIGGER_ACTIONS[number];
