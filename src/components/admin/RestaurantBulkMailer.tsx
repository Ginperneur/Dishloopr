import { useState, useEffect } from 'react';
import { Mail, Send, Users, Loader2, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface City { id: string; name: string }

interface Filters {
  city_ids: string[];
  cuisines: string[];
  claim_status: string | null;
  only_active: boolean;
  only_claimed: boolean;
}

export function RestaurantBulkMailer() {
  const [cities, setCities] = useState<City[]>([]);
  const [allCuisines, setAllCuisines] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>({
    city_ids: [],
    cuisines: [],
    claim_status: null,
    only_active: true,
    only_claimed: true,
  });
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [preview, setPreview] = useState<{ recipient_count: number; restaurant_count: number } | null>(null);
  const [loading, setLoading] = useState<'preview' | 'test' | 'send' | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: cs } = await supabase.from('cities').select('id, name').order('name');
      setCities(cs || []);
      const { data: rs } = await supabase.from('restaurants').select('cuisines').limit(1000);
      const set = new Set<string>();
      (rs || []).forEach((r: any) => (r.cuisines || []).forEach((c: string) => set.add(c)));
      setAllCuisines(Array.from(set).sort());
    })();
  }, []);

  const toggle = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const fetchPreview = async () => {
    setLoading('preview');
    setPreview(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-restaurant-bulk-email', {
        body: { filters, preview_only: true },
      });
      if (error) throw error;
      setPreview(data);
    } catch (e: any) {
      toast.error(e.message || 'Voorbeeld ophalen mislukt');
    } finally {
      setLoading(null);
    }
  };

  const sendTest = async () => {
    if (!testEmail || !subject || !html) {
      toast.error('Vul test e-mail, onderwerp en inhoud in');
      return;
    }
    setLoading('test');
    try {
      const { data, error } = await supabase.functions.invoke('send-restaurant-bulk-email', {
        body: { filters, subject, html, test_email: testEmail },
      });
      if (error) throw error;
      if (data?.test_sent) toast.success(`Test verstuurd naar ${testEmail}`);
      else toast.error('Test versturen mislukt');
    } catch (e: any) {
      toast.error(e.message || 'Fout');
    } finally {
      setLoading(null);
    }
  };

  const sendBulk = async () => {
    if (!subject || !html) {
      toast.error('Vul onderwerp en inhoud in');
      return;
    }
    if (!preview || preview.recipient_count === 0) {
      toast.error('Bekijk eerst het voorbeeld');
      return;
    }
    if (!confirmSend) {
      setConfirmSend(true);
      return;
    }
    setLoading('send');
    setConfirmSend(false);
    try {
      const { data, error } = await supabase.functions.invoke('send-restaurant-bulk-email', {
        body: { filters, subject, html },
      });
      if (error) throw error;
      toast.success(`Verstuurd: ${data.sent} • Mislukt: ${data.failed}`);
      setPreview(null);
    } catch (e: any) {
      toast.error(e.message || 'Verzenden mislukt');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Bulk e-mail naar restaurants
          </CardTitle>
          <CardDescription>
            Verstuur een e-mail naar restauranthouders op basis van filters. Alleen geclaimde restaurants met een gekoppelde eigenaar ontvangen de mail.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Filters</h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Claim status</Label>
                <Select
                  value={filters.claim_status ?? 'any'}
                  onValueChange={(v) =>
                    setFilters((f) => ({ ...f, claim_status: v === 'any' ? null : v }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Alle</SelectItem>
                    <SelectItem value="unclaimed">Niet geclaimd</SelectItem>
                    <SelectItem value="pending_verification">In afwachting</SelectItem>
                    <SelectItem value="verified_owner">Geverifieerd</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2 justify-end">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={filters.only_active}
                    onCheckedChange={(v) => setFilters((f) => ({ ...f, only_active: !!v }))}
                  />
                  Alleen actieve restaurants
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={filters.only_claimed}
                    onCheckedChange={(v) => setFilters((f) => ({ ...f, only_claimed: !!v }))}
                  />
                  Alleen met gekoppelde eigenaar
                </label>
              </div>
            </div>

            <div>
              <Label className="text-xs">Steden ({filters.city_ids.length})</Label>
              <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto p-2 border rounded-md">
                {cities.map((c) => (
                  <Badge
                    key={c.id}
                    variant={filters.city_ids.includes(c.id) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setFilters((f) => ({ ...f, city_ids: toggle(f.city_ids, c.id) }))}
                  >
                    {c.name}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">Keukens ({filters.cuisines.length})</Label>
              <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto p-2 border rounded-md">
                {allCuisines.map((c) => (
                  <Badge
                    key={c}
                    variant={filters.cuisines.includes(c) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setFilters((f) => ({ ...f, cuisines: toggle(f.cuisines, c) }))}
                  >
                    {c}
                  </Badge>
                ))}
              </div>
            </div>

            <Button variant="outline" onClick={fetchPreview} disabled={loading === 'preview'}>
              {loading === 'preview' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
              Bekijk aantal ontvangers
            </Button>

            {preview && (
              <Alert>
                <Users className="h-4 w-4" />
                <AlertDescription>
                  <strong>{preview.recipient_count}</strong> unieke ontvangers van <strong>{preview.restaurant_count}</strong> matchende restaurants
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Email content */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-sm">E-mail inhoud</h3>
            <div>
              <Label className="text-xs">Onderwerp</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Bijv. Nieuwe Dishloopr functies voor jouw restaurant" />
            </div>
            <div>
              <Label className="text-xs">HTML inhoud</Label>
              <Textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                rows={12}
                placeholder="<h1>Hallo</h1><p>...</p>"
                className="font-mono text-xs"
              />
            </div>
          </div>

          {/* Test & Send */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">Test e-mail adres</Label>
                <Input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="jij@dishloopr.com" />
              </div>
              <Button variant="outline" onClick={sendTest} disabled={loading === 'test'}>
                {loading === 'test' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Stuur test
              </Button>
            </div>

            <Button
              className="w-full"
              variant={confirmSend ? 'destructive' : 'default'}
              onClick={sendBulk}
              disabled={loading === 'send' || !preview || preview.recipient_count === 0}
            >
              {loading === 'send' ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verzenden...</>
              ) : confirmSend ? (
                <><Send className="h-4 w-4 mr-2" /> Klik nogmaals om {preview?.recipient_count} mails te versturen</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Verstuur bulk e-mail</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}