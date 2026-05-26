import { Crown, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useOwnerTier } from '@/hooks/useOwnerTier';

const PRO_BENEFITS = [
  'Conversie-funnel & zoektermen-heatmap',
  'AI antwoord-assistent voor reviews',
  'Team-beheer & medewerker-rollen',
  'Interne gast-feedback via QR',
  'Concurrent benchmark & marktinzicht',
  'AI Social-post Generator',
  'Loyalty stempelkaart',
];

export function UpgradeToProCard({ restaurantId }: { restaurantId: string }) {
  const { data: tier } = useOwnerTier(restaurantId);
  if (tier === 'pro') return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/10 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Crown className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-base mb-1">Upgrade naar Dishloopr Pro</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Ontgrendel geavanceerde analytics, AI-tools en marketingfuncties om meer gasten te bereiken.
            </p>
            <ul className="space-y-1.5 mb-4">
              {PRO_BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <Button className="w-full sm:w-auto" disabled>
              <Crown className="h-4 w-4 mr-1" />
              Binnenkort beschikbaar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}