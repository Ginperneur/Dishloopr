import { supabase } from '@/integrations/supabase/client';

interface ClaimRequestRef {
  id: string;
  user_id: string;
  restaurant_id: string;
}

/**
 * Approve a claim request: mark it approved, link the owner to the restaurant,
 * add them as primary manager and give them the owner role. Used by the Claims
 * queue and the bulk action on Vandaag, so both grant the same access.
 */
export async function approveClaimRequest(request: ClaimRequestRef, adminNotes?: string | null) {
  const now = new Date().toISOString();

  const { error: claimError } = await supabase
    .from('claim_requests')
    .update({ status: 'approved', admin_notes: adminNotes || null, reviewed_at: now })
    .eq('id', request.id);
  if (claimError) throw claimError;

  const { error: restaurantError } = await supabase
    .from('restaurants')
    .update({
      claimed_by_owner_id: request.user_id,
      claim_status: 'verified_owner',
      is_active: true,
      updated_at: now,
    })
    .eq('id', request.restaurant_id);
  if (restaurantError) throw restaurantError;

  const { error: managerError } = await supabase
    .from('restaurant_managers')
    .upsert(
      { restaurant_id: request.restaurant_id, user_id: request.user_id, role: 'primary_owner', accepted_at: now },
      { onConflict: 'restaurant_id,user_id' },
    );
  if (managerError) console.error('Error adding manager:', managerError);

  const { data: existingRole } = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', request.user_id)
    .eq('role', 'owner')
    .maybeSingle();
  if (!existingRole) {
    await supabase.from('user_roles').insert({ user_id: request.user_id, role: 'owner' });
  }
}

/** Reject a claim request with optional notes. */
export async function rejectClaimRequest(requestId: string, adminNotes?: string | null) {
  const { error } = await supabase
    .from('claim_requests')
    .update({ status: 'rejected', admin_notes: adminNotes || null, reviewed_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw error;
}
