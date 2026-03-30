import { useState, useEffect } from 'react';
import { Bell, Send, RefreshCw, Check, Clock, AlertCircle, Users, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface QueueItem {
  id: string;
  user_id: string;
  restaurant_id: string;
  notification_type: string;
  sent_at: string | null;
  created_at: string;
  profile?: { name: string | null; email: string | null };
  restaurant?: { name: string };
}

export function NotificationManager() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent'>('all');
  const [stats, setStats] = useState({ total: 0, pending: 0, sent: 0 });

  useEffect(() => { fetchQueue(); }, [filter]);

  const fetchQueue = async () => {
    setLoading(true);
    let query = supabase
      .from('notification_queue')
      .select('*, profile:profiles(name, email), restaurant:restaurants(name)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (filter === 'pending') query = query.is('sent_at', null);
    if (filter === 'sent') query = query.not('sent_at', 'is', null);

    const { data, error } = await query;
    if (!error) setQueue((data || []) as unknown as QueueItem[]);

    // Stats
    const [{ count: total }, { count: pending }, { count: sent }] = await Promise.all([
      supabase.from('notification_queue').select('id', { count: 'exact', head: true }),
      supabase.from('notification_queue').select('id', { count: 'exact', head: true }).is('sent_at', null),
      supabase.from('notification_queue').select('id', { count: 'exact', head: true }).not('sent_at', 'is', null),
    ]);
    setStats({ total: total || 0, pending: pending || 0, sent: sent || 0 });
    setLoading(false);
  };

  const processQueue = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-new-restaurant-notifications');
      if (error) throw error;
      const result = data as { processed?: number; total?: number };
      toast.success(`${result.processed || 0} notificaties verstuurd van ${result.total || 0}`);
      await fetchQueue();
    } catch (e) {
      toast.error('Fout bij versturen van notificaties');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString('nl-NL', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Mail className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Totaal</p>
          </CardContent>
        </Card>
        <Card className="border-orange-500/30">
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-orange-500" />
            <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Wachtend</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/30">
          <CardContent className="p-4 text-center">
            <Check className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
            <p className="text-xs text-muted-foreground">Verstuurd</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notificatie Wachtrij
              </CardTitle>
              <CardDescription>
                Beheer en verstuur e-mailnotificaties naar gebruikers
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alles</SelectItem>
                  <SelectItem value="pending">Wachtend</SelectItem>
                  <SelectItem value="sent">Verstuurd</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchQueue} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button onClick={processQueue} disabled={sending || stats.pending === 0} size="sm">
                <Send className={`h-4 w-4 mr-1 ${sending ? 'animate-pulse' : ''}`} />
                Verstuur ({stats.pending})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Geen notificaties in de wachtrij</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gebruiker</TableHead>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Aangemaakt</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{item.profile?.name || 'Onbekend'}</p>
                        <p className="text-xs text-muted-foreground">{item.profile?.email || '-'}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{item.restaurant?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{item.notification_type}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(item.created_at)}</TableCell>
                    <TableCell>
                      {item.sent_at ? (
                        <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                          <Check className="h-3 w-3 mr-1" /> Verstuurd
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-orange-600 border-orange-500/30">
                          <Clock className="h-3 w-3 mr-1" /> Wachtend
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
