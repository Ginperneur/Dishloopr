import { useState, useEffect } from 'react';
import { History, Loader2, Filter, User, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';

interface LogEntry {
  id: string;
  user_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: any;
  created_at: string;
  user_email?: string;
}

export function AuditTrail() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('admin_activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (entityFilter !== 'all') query = query.eq('entity_type', entityFilter);
      if (actionFilter !== 'all') query = query.eq('action_type', actionFilter);

      const { data } = await query;
      if (!data) { setLogs([]); setLoading(false); return; }

      // Fetch user emails
      const userIds = [...new Set(data.map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.email || p.name || 'Onbekend']) || []);

      setLogs(data.map(d => ({
        ...d,
        user_email: profileMap.get(d.user_id) || d.user_id.slice(0, 8),
      })));
    } catch (err) {
      console.error('Audit trail error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, entityFilter, actionFilter]);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'update': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'delete': return 'bg-destructive/10 text-destructive';
      case 'approve': return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'reject': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Zojuist';
    if (diffMin < 60) return `${diffMin}m geleden`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}u geleden`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d geleden`;
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Audit Trail
        </CardTitle>
        <CardDescription>Alle admin-acties chronologisch bijgehouden</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={entityFilter} onValueChange={v => { setEntityFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Entiteit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle entiteiten</SelectItem>
              <SelectItem value="restaurant">Restaurant</SelectItem>
              <SelectItem value="dish">Gerecht</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="user">Gebruiker</SelectItem>
              <SelectItem value="role">Rol</SelectItem>
              <SelectItem value="claim">Claim</SelectItem>
              <SelectItem value="collection">Collectie</SelectItem>
              <SelectItem value="setting">Instelling</SelectItem>
              <SelectItem value="menu_item">Menu item</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Actie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle acties</SelectItem>
              <SelectItem value="create">Aangemaakt</SelectItem>
              <SelectItem value="update">Bijgewerkt</SelectItem>
              <SelectItem value="delete">Verwijderd</SelectItem>
              <SelectItem value="approve">Goedgekeurd</SelectItem>
              <SelectItem value="reject">Afgewezen</SelectItem>
              <SelectItem value="activate">Geactiveerd</SelectItem>
              <SelectItem value="deactivate">Gedeactiveerd</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Geen activiteiten gevonden</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tijd</TableHead>
                  <TableHead>Gebruiker</TableHead>
                  <TableHead>Actie</TableHead>
                  <TableHead>Entiteit</TableHead>
                  <TableHead>Naam</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(log.created_at)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs max-w-[120px] truncate">
                      {log.user_email}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action_type)}`}>
                        {log.action_type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{log.entity_type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium text-sm max-w-[200px] truncate">
                      {log.entity_name || '-'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {log.details && Object.keys(log.details).length > 0
                        ? JSON.stringify(log.details).slice(0, 80)
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Pagina {page + 1} • {logs.length} resultaten
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Vorige
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={logs.length < PAGE_SIZE}
                >
                  Volgende
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
