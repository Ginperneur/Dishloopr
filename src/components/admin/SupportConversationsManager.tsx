import { useEffect, useState } from 'react';
import { Loader2, Inbox, MessageSquare, Check, ChevronDown, ChevronUp, Bot, User as UserIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Conversation {
  id: string;
  title: string | null;
  user_id: string | null;
  session_id: string | null;
  escalated: boolean;
  escalated_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  profile?: { name: string | null; email: string | null } | null;
}

interface Message {
  id: string;
  role: string;
  content: string;
  needs_human: boolean;
  created_at: string;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function SupportConversationsManager() {
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [messagesLoading, setMessagesLoading] = useState<string | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    let query = supabase
      .from('support_conversations')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(200);
    if (filter === 'open') {
      query = query.eq('escalated', true).is('resolved_at', null);
    }
    const { data, error } = await query;
    if (error) {
      toast.error('Kon support-gesprekken niet ophalen');
      setLoading(false);
      return;
    }
    const rows = (data || []) as Conversation[];
    const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))] as string[];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);
      const byId = new Map((profiles || []).map(p => [p.id, p]));
      rows.forEach(r => {
        if (r.user_id) r.profile = byId.get(r.user_id) ?? null;
      });
    }
    setItems(rows);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [filter]);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!messages[id]) {
      setMessagesLoading(id);
      const { data, error } = await supabase
        .from('support_messages')
        .select('id, role, content, needs_human, created_at')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });
      setMessagesLoading(null);
      if (error) {
        toast.error('Kon berichten niet ophalen');
        return;
      }
      setMessages(prev => ({ ...prev, [id]: (data || []) as Message[] }));
    }
  };

  const markResolved = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase
      .from('support_conversations')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', id);
    setBusyId(null);
    if (error) {
      toast.error('Kon niet markeren als afgehandeld');
      return;
    }
    toast.success('Gemarkeerd als afgehandeld');
    if (filter === 'open') {
      setItems(prev => prev.filter(c => c.id !== id));
    } else {
      setItems(prev => prev.map(c => c.id === id ? { ...c, resolved_at: new Date().toISOString() } : c));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Support Chat
          </CardTitle>
          <CardDescription>
            Gesprekken die de AI-klantenservice niet zelf kon oplossen (betalingen, bugs, klachten, account-problemen).
          </CardDescription>
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as 'open' | 'all')}>
          <TabsList>
            <TabsTrigger value="open">Open & geëscaleerd</TabsTrigger>
            <TabsTrigger value="all">Alles</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Laden…
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Inbox className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>{filter === 'open' ? 'Geen openstaande escalaties' : 'Nog geen gesprekken'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(conv => {
              const contact = conv.profile?.name || conv.profile?.email
                || (conv.user_id ? 'Gebruiker (geen profiel)' : 'Anonieme bezoeker');
              const isExpanded = expandedId === conv.id;
              return (
                <div key={conv.id} className="border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleExpand(conv.id)}
                    className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-accent/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {conv.escalated && !conv.resolved_at && (
                          <Badge variant="destructive" className="text-[10px]">Escalatie</Badge>
                        )}
                        {conv.resolved_at && (
                          <Badge variant="outline" className="text-[10px]">Afgehandeld</Badge>
                        )}
                        <span className="text-sm font-medium truncate">{conv.title || '(geen titel)'}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {contact} · {formatDate(conv.created_at)}
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                  </button>
                  {isExpanded && (
                    <div className="border-t bg-muted/20 p-3 space-y-3">
                      {messagesLoading === conv.id ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                          <Loader2 className="h-4 w-4 animate-spin" /> Berichten laden…
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {(messages[conv.id] || []).map(m => (
                            <div key={m.id} className="flex gap-2 text-sm">
                              {m.role === 'assistant'
                                ? <Bot className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                                : <UserIcon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />}
                              <div className="min-w-0">
                                <p className="whitespace-pre-wrap">{m.content}</p>
                                <p className="text-[10px] text-muted-foreground">{formatDate(m.created_at)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {!conv.resolved_at && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markResolved(conv.id)}
                          disabled={busyId === conv.id}
                        >
                          {busyId === conv.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                          Markeer als afgehandeld
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
