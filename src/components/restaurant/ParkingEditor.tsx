import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Car, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseParkingInfo, type ParkingInfo } from '@/lib/parking';

export function ParkingEditor({ restaurantId, onSaved }: { restaurantId: string; onSaved?: () => void }) {
  const { t } = useTranslation();
  const id = useId();
  const [info, setInfo] = useState<ParkingInfo>(() => parseParkingInfo(null));
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    supabase.from('restaurants').select('parking_info').eq('id', restaurantId).single().then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setLoadFailed(true); toast.error(t('parking.loadError')); }
      else setInfo(parseParkingInfo(data?.parking_info));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [restaurantId, t]);

  const save = async () => {
    if (info.garage_address.trim() && !info.garage_name.trim()) {
      toast.error(t('parking.garageRequired'));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('save_restaurant_parking', {
        p_restaurant_id: restaurantId,
        p_own_parking: info.own_parking,
        p_street_parking: info.street_parking,
        p_garage_name: info.garage_name.trim(),
        p_garage_address: info.garage_address.trim(),
        p_notes: info.notes.trim(),
      });
      if (error) throw error;
      toast.success(t('parking.saved'));
      onSaved?.();
    } catch { toast.error(t('parking.saveError')); }
    finally { setSaving(false); }
  };

  return (
    <section aria-label={t('parking.title')} className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2"><Car className="h-5 w-5 text-primary" />{t('parking.title')}</h3>
      {loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : loadFailed ? (
        <p className="text-sm text-destructive">{t('parking.loadError')}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['own_parking', 'street_parking'] as const).map(key => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`${id}-${key}`}>{t(key === 'own_parking' ? 'parking.own' : 'parking.street')}</Label>
                <Select value={info[key] === null ? 'unknown' : info[key] ? 'yes' : 'no'} onValueChange={value => setInfo(prev => ({ ...prev, [key]: value === 'unknown' ? null : value === 'yes' }))}>
                  <SelectTrigger id={`${id}-${key}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">{t('parking.unspecified')}</SelectItem>
                    <SelectItem value="yes">{t('parking.yes')}</SelectItem>
                    <SelectItem value="no">{t('parking.no')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-garage`}>{t('parking.garage')}</Label>
            <Input id={`${id}-garage`} value={info.garage_name} maxLength={200} onChange={e => setInfo(prev => ({ ...prev, garage_name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-address`}>{t('parking.garageAddress')}</Label>
            <Input id={`${id}-address`} value={info.garage_address} maxLength={300} onChange={e => setInfo(prev => ({ ...prev, garage_address: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-notes`}>{t('parking.notes')}</Label>
            <Textarea id={`${id}-notes`} rows={3} value={info.notes} maxLength={2000} onChange={e => setInfo(prev => ({ ...prev, notes: e.target.value }))} />
          </div>
          <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? t('parking.saving') : t('common.save')}</Button>
        </>
      )}
    </section>
  );
}