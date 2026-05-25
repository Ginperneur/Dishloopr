import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Download, ExternalLink, FileText, Loader2, Receipt } from 'lucide-react';
import { toast } from 'sonner';

interface InvoiceItem {
  id: string;
  date: number;
  amount: number;
  currency: string;
  status: string;
  description: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  source_type: string;
  restaurant_id: string | null;
}

const SOURCE_LABEL: Record<string, { label: string; color: string }> = {
  newsletter: { label: 'Nieuwsbrief', color: 'bg-blue-500/10 text-blue-700 border-blue-200' },
  featured: { label: 'Featured', color: 'bg-amber-500/10 text-amber-700 border-amber-200' },
  sponsored: { label: 'Sponsored', color: 'bg-purple-500/10 text-purple-700 border-purple-200' },
  verification: { label: 'Verificatie', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
  tag: { label: 'Tag', color: 'bg-pink-500/10 text-pink-700 border-pink-200' },
  listing: { label: 'Vermelding', color: 'bg-indigo-500/10 text-indigo-700 border-indigo-200' },
  other: { label: 'Overig', color: 'bg-muted text-muted-foreground border-border' },
};

export function InvoicesTab() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [restaurants, setRestaurants] = useState<Record<string, string>>({});
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [restaurantFilter, setRestaurantFilter] = useState<string>('all');

  useEffect(() => {
    void fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-owner-invoices', { body: {} });
      if (error) throw error;
      setInvoices(data?.invoices || []);
      setRestaurants(data?.restaurants || {});
    } catch (e: any) {
      toast.error('Kon facturen niet ophalen: ' + (e.message || 'Onbekende fout'));
    } finally {
      setLoading(false);
    }
  };

  const filtered = invoices.filter(i => {
    if (typeFilter !== 'all' && i.source_type !== typeFilter) return false;
    if (restaurantFilter !== 'all' && i.restaurant_id !== restaurantFilter) return false;
    return true;
  });

  const totalAmount = filtered.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Receipt className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Facturen & betalingen</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Alle facturen en bonnen van Dishloopr-betalingen (nieuwsbrief, featured spots, verificatie, tags en sponsored).
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[160px]">
          <label className="text-xs text-muted-foreground mb-1 block">Type</label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle types</SelectItem>
              {Object.entries(SOURCE_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {Object.keys(restaurants).length > 1 && (
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-muted-foreground mb-1 block">Restaurant</label>
            <Select value={restaurantFilter} onValueChange={setRestaurantFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle restaurants</SelectItem>
                {Object.entries(restaurants).map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={fetchInvoices} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
          Vernieuwen
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 mx-auto animate-spin mb-2" />
              Facturen laden…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Geen facturen gevonden.</p>
              <p className="text-xs mt-1">Zodra je een betaling doet, verschijnt deze hier.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3 text-sm">
                <span className="text-muted-foreground">{filtered.length} factu{filtered.length === 1 ? 'ur' : 'ren'}</span>
                <span className="font-medium">Totaal: €{totalAmount.toFixed(2)}</span>
              </div>
              <div className="divide-y">
                {filtered.map(inv => {
                  const label = SOURCE_LABEL[inv.source_type] || SOURCE_LABEL.other;
                  const date = new Date(inv.date * 1000);
                  return (
                    <div key={inv.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <Badge variant="outline" className={`text-xs ${label.color}`}>{label.label}</Badge>
                          {inv.restaurant_id && restaurants[inv.restaurant_id] && (
                            <span className="text-xs text-muted-foreground">{restaurants[inv.restaurant_id]}</span>
                          )}
                          <Badge variant="secondary" className="text-xs capitalize">{inv.status}</Badge>
                        </div>
                        <p className="text-sm font-medium truncate">{inv.description}</p>
                        <p className="text-xs text-muted-foreground">{date.toLocaleDateString('nl-NL', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4">
                        <span className="font-semibold text-sm whitespace-nowrap">€{inv.amount.toFixed(2)}</span>
                        <div className="flex gap-1">
                          {inv.invoice_pdf && (
                            <Button asChild variant="outline" size="sm">
                              <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer">
                                <Download className="h-3 w-3 mr-1" />PDF
                              </a>
                            </Button>
                          )}
                          {inv.hosted_invoice_url && (
                            <Button asChild variant="ghost" size="sm">
                              <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 mr-1" />Bekijk
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}