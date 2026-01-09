import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type EntityType = 'restaurant' | 'dish' | 'city' | 'user' | 'role' | 'review' | 'claim' | 'collection' | 'sponsored_product' | 'setting' | 'menu_item';
type ActionType = 'create' | 'update' | 'delete' | 'activate' | 'deactivate' | 'approve' | 'reject' | 'assign' | 'remove';

interface LogActivityParams {
  actionType: ActionType;
  entityType: EntityType;
  entityId?: string;
  entityName?: string;
  details?: Record<string, unknown>;
}

export function useActivityLog() {
  const { user } = useAuth();

  const logActivity = async ({
    actionType,
    entityType,
    entityId,
    entityName,
    details = {},
  }: LogActivityParams) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('admin_activity_logs')
        .insert([{
          user_id: user.id,
          action_type: actionType,
          entity_type: entityType,
          entity_id: entityId || null,
          entity_name: entityName || null,
          details: JSON.parse(JSON.stringify(details)),
        }]);

      if (error) {
        console.error('Failed to log activity:', error);
      }
    } catch (err) {
      console.error('Activity log error:', err);
    }
  };

  return { logActivity };
}
