import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ClaimCodeForm, claimCall, type ClaimCodeState } from './ClaimCodeForm';

export function PendingClaimCodes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [claims, setClaims] = useState<(ClaimCodeState & { name: string })[]>([]);
  useEffect(() => {
    if (!user) return;
    let live = true;
    void (async () => {
      const { data } = await supabase.from('restaurant_claims').select('id, restaurant_id, restaurants(name)').eq('user_id', user.id).in('status', ['pending', 'email_verified', 'phone_verified']).eq('verification_method', 'domain_email');
      const states = await Promise.all((data || []).map(async row => {
        try { return { ...await claimCall({ action: 'code_status', claimId: row.id }), name: row.restaurants?.name || 'Restaurant' }; } catch { return null; }
      }));
      if (live) setClaims(states.filter((row): row is ClaimCodeState & { name: string } => row !== null));
    })();
    return () => { live = false; };
  }, [user]);
  return <>{claims.map(claim => <section key={claim.id} className="border-b py-6 space-y-3">
    <h2 className="text-xl font-bold">Claim in behandeling</h2><p>{claim.name}</p>
    <ClaimCodeForm initial={claim} onVerified={() => { setClaims(rows => rows.filter(row => row.id !== claim.id)); navigate('/owner-dashboard?welcome=1'); window.location.reload(); }} />
  </section>)}</>;
}