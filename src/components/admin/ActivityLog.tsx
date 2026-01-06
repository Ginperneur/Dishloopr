import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Search, RefreshCw } from 'lucide-react';

const ITEMS_PER_PAGE = 20;

const actionTypeLabels: Record<string, string> = {
  create: 'Aangemaakt',
  update: 'Bijgewerkt',
  delete: 'Verwijderd',
  activate: 'Geactiveerd',
  deactivate: 'Gedeactiveerd',
  approve: 'Goedgekeurd',
  reject: 'Afgewezen',
  assign: 'Toegewezen',
  remove: 'Verwijderd',
};

const entityTypeLabels: Record<string, string> = {
  restaurant: 'Restaurant',
  dish: 'Gerecht',
  city: 'Stad',
  user: 'Gebruiker',
  role: 'Rol',
  review: 'Review',
  claim: 'Claim',
  collection: 'Collectie',
  sponsored_product: 'Gesponsord Product',
};

const actionTypeColors: Record<string, string> = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  activate: 'bg-emerald-100 text-emerald-800',
  deactivate: 'bg-orange-100 text-orange-800',
  approve: 'bg-green-100 text-green-800',
  reject: 'bg-red-100 text-red-800',
  assign: 'bg-purple-100 text-purple-800',
  remove: 'bg-red-100 text-red-800',
};

export function ActivityLog() {
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-activity-logs', page, entityFilter],
    queryFn: async () => {
      let query = supabase
        .from('admin_activity_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

      if (entityFilter !== 'all') {
        query = query.eq('entity_type', entityFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { logs: data || [], count: count || 0 };
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['admin-profiles-for-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email');
      if (error) throw error;
      return data || [];
    },
  });

  const getUserName = (userId: string) => {
    const profile = profiles?.find((p) => p.id === userId);
    return profile?.name || profile?.email || userId.slice(0, 8);
  };

  const filteredLogs = data?.logs.filter((log) =>
    searchTerm
      ? log.entity_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getUserName(log.user_id).toLowerCase().includes(searchTerm.toLowerCase())
      : true
  );

  const totalPages = Math.ceil((data?.count || 0) / ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek op naam of gebruiker..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter op type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle types</SelectItem>
            {Object.entries(entityTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Gebruiker</TableHead>
              <TableHead>Actie</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Naam</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredLogs?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Geen activiteiten gevonden
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs?.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(log.created_at), 'dd MMM HH:mm', { locale: nl })}
                  </TableCell>
                  <TableCell className="font-medium">
                    {getUserName(log.user_id)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={actionTypeColors[log.action_type] || ''}
                    >
                      {actionTypeLabels[log.action_type] || log.action_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {entityTypeLabels[log.entity_type] || log.entity_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {log.entity_name || '-'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {log.details && Object.keys(log.details).length > 0
                      ? JSON.stringify(log.details)
                      : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Pagina {page + 1} van {totalPages} ({data?.count} resultaten)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
