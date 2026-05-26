import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Award } from 'lucide-react';
import { toast } from 'sonner';

export function LoyaltyProgramManager({ restaurantId }: { restaurantId: string }) {
  const [program, setProgram] = useState<any>(null);
  const [stampsRequired, setStampsRequired] = useState(10);
  const [reward, setReward] = useState('Gratis hoofdgerecht');
  const [active, setActive] = useState(true);
  const [stats, setStats] = useState({ totalStamps: 0, uniqueUsers: 0, rewardsRedeemed: 0 });

  const load = async () => {
    const { data } = await (supabase as any).from('loyalty_programs').select('*').eq('restaurant_id', restaurantId).maybeSingle();
    if (data) {
      setProgram(data);
      setStampsRequired(data.stamps_required);
      setReward(data.reward_description);
      setActive(data.is_active);
    }
    const { data: stampsData } = await (supabase as any).from('loyalty_stamps').select('user_id, redeemed').eq('restaurant_id', restaurantId);
    if (stampsData) {
      const users = new Set(stampsData.map((s: any) => s.user_id));
      setStats({
        totalStamps: stampsData.length,
        uniqueUsers: users.size,
        rewardsRedeemed: stampsData.filter((s: any) => s.redeemed).length,
      });
    }
  };

  useEffect(() => { load(); }, [restaurantId]);

  const save = async () => {
    const payload = {
      restaurant_id: restaurantId,
      stamps_required: stampsRequired,
      reward_description: reward,
      is_active: active,
    };
    const { error } = program
      ? await (supabase as any).from('loyalty_programs').update(payload).eq('id', program.id)
      : await (supabase as any).from('loyalty_programs').insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success('Stempelkaart opgeslagen');
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Award className="h-5 w-5 text-primary" /> Stempelkaart / Loyalty
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg border">
            <p className="text-2xl font-bold">{stats.uniqueUsers}</p>
            <p className="text-xs text-muted-foreground">Loyale gasten</p>
          </div>
          <div className="text-center p-3 rounded-lg border">
            <p className="text-2xl font-bold">{stats.totalStamps}</p>
            <p className="text-xs text-muted-foreground">Stempels uitgereikt</p>
          </div>
          <div className="text-center p-3 rounded-lg border">
            <p className="text-2xl font-bold">{stats.rewardsRedeemed}</p>
            <p className="text-xs text-muted-foreground">Beloningen ingewisseld</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Aantal stempels nodig</Label>
            <Input type="number" min={1} max={50} value={stampsRequired} onChange={(e) => setStampsRequired(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Beloning</Label>
            <Input value={reward} onChange={(e) => setReward(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <p className="text-sm font-medium">Stempelkaart actief</p>
            <p className="text-xs text-muted-foreground">Gasten kunnen punten sparen</p>
          </div>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>
        <Button onClick={save} className="w-full">Opslaan</Button>
      </CardContent>
    </Card>
  );
}