import { useEffect, useState } from 'react';
import { Bell, Check, MessageSquare, CreditCard, Shield, Sparkles, Info, BellOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_META: Record<string, { label: string; icon: typeof Info; tint: string }> = {
  review: { label: 'Reviews', icon: MessageSquare, tint: 'text-primary' },
  payment: { label: 'Betalingen', icon: CreditCard, tint: 'text-emerald-600' },
  claim: { label: 'Verificatie', icon: Shield, tint: 'text-blue-600' },
  marketing: { label: 'Marketing', icon: Sparkles, tint: 'text-amber-600' },
};
const DEFAULT_META = { label: 'Overig', icon: Info, tint: 'text-muted-foreground' };

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('owner_notifications' as any)
      .select('id, type, title, body, link, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setItems((data as any as Notification[]) || []);
  };

  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('owner-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'owner_notifications', filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const unread = items.filter(i => !i.is_read).length;

  const markRead = async (id: string) => {
    await supabase.from('owner_notifications' as any).update({ is_read: true }).eq('id', id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_read: true } : i));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('owner_notifications' as any).update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setItems(prev => prev.map(i => ({ ...i, is_read: true })));
  };

  // Group by type, preserving original ordering within a group
  const groups = items.reduce<Record<string, Notification[]>>((acc, n) => {
    const key = TYPE_META[n.type] ? n.type : 'other';
    (acc[key] ||= []).push(n);
    return acc;
  }, {});
  const groupOrder = Object.keys(groups).sort((a, b) => {
    // Unread groups first, then by latest item desc
    const aLatest = new Date(groups[a][0].created_at).getTime();
    const bLatest = new Date(groups[b][0].created_at).getTime();
    return bLatest - aLatest;
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative h-9 w-9" aria-label={`Meldingen${unread > 0 ? ` (${unread} ongelezen)` : ''}`}>
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center" variant="destructive">
              {unread > 9 ? '9+' : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Meldingen</p>
            {unread > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{unread} nieuw</Badge>
            )}
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-xs">
              <Check className="h-3 w-3 mr-1" /> Alles gelezen
            </Button>
          )}
        </div>
        <div className="max-h-[28rem] overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <div className="h-10 w-10 rounded-full bg-muted mx-auto flex items-center justify-center mb-3">
                <BellOff className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">Geen meldingen</p>
              <p className="text-xs text-muted-foreground max-w-[16rem] mx-auto">
                Nieuwe reviews, betalingen en claim-updates verschijnen hier.
              </p>
            </div>
          ) : (
            groupOrder.map((key) => {
              const meta = TYPE_META[key] || DEFAULT_META;
              const groupItems = groups[key];
              const groupUnread = groupItems.filter(g => !g.is_read).length;
              const Icon = meta.icon;
              return (
                <div key={key} className="border-b last:border-0">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 sticky top-0 z-10">
                    <Icon className={cn('h-3.5 w-3.5', meta.tint)} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {meta.label}
                    </span>
                    {groupUnread > 0 && (
                      <span className="text-[10px] text-primary font-medium ml-auto">{groupUnread} nieuw</span>
                    )}
                  </div>
                  {groupItems.map((n) => {
                    const content = (
                      <div className={cn('px-3 py-2.5 border-t border-border/40 hover:bg-muted/50 cursor-pointer transition-colors', !n.is_read && 'bg-primary/5')}>
                        <div className="flex items-start gap-2">
                          {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{n.title}</p>
                            {n.body && <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: nl })}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                    return n.link ? (
                      <Link key={n.id} to={n.link} onClick={() => { markRead(n.id); setOpen(false); }}>
                        {content}
                      </Link>
                    ) : (
                      <div key={n.id} onClick={() => markRead(n.id)}>{content}</div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}