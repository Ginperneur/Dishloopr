import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  ExternalLink, 
  Globe, 
  FileText,
  CheckCircle,
  XCircle,
  Sparkles,
  Save,
  X,
  ChevronDown,
  Wand2,
  Loader2,
  Zap
} from 'lucide-react';
import { QuickSeoPageWizard } from './QuickSeoPageWizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useSeoLandingPages } from '@/hooks/useSeoLandingPage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FAQ {
  question: string;
  answer: string;
}

interface PageForm {
  slug: string;
  dish_id: string | null;
  city_id: string | null;
  meta_title: string;
  meta_description: string;
  h1_title: string;
  intro_text: string;
  extended_description: string;
  faq_content: FAQ[];
  keywords: string[];
  is_active: boolean;
}

const defaultForm: PageForm = {
  slug: '',
  dish_id: null,
  city_id: null,
  meta_title: '',
  meta_description: '',
  h1_title: '',
  intro_text: '',
  extended_description: '',
  faq_content: [],
  keywords: [],
  is_active: true,
};

export function SeoLandingPagesManager() {
  const { t } = useTranslation();
  const { pages, loading, updatePage, createPage, deletePage, fetchPages } = useSeoLandingPages();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPage, setEditingPage] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [form, setForm] = useState<PageForm>(defaultForm);
  const [dishes, setDishes] = useState<{ id: string; name: string }[]>([]);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [generatingFaq, setGeneratingFaq] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    async function fetchOptions() {
      const [dishesRes, citiesRes] = await Promise.all([
        supabase.from('dishes').select('id, name').eq('is_active', true).order('name'),
        supabase.from('cities').select('id, name').eq('is_active', true).order('name'),
      ]);
      if (dishesRes.data) setDishes(dishesRes.data);
      if (citiesRes.data) setCities(citiesRes.data);
    }
    fetchOptions();
  }, []);

  const filteredPages = pages.filter(page =>
    page.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    page.h1_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    page.dish?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    page.city?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (page: typeof pages[0]) => {
    setEditingPage(page.id);
    setForm({
      slug: page.slug,
      dish_id: page.dish_id,
      city_id: page.city_id,
      meta_title: page.meta_title,
      meta_description: page.meta_description,
      h1_title: page.h1_title,
      intro_text: page.intro_text || '',
      extended_description: page.extended_description || '',
      faq_content: page.faq_content || [],
      keywords: page.keywords || [],
      is_active: page.is_active,
    });
  };

  const handleSave = async () => {
    if (!editingPage) return;
    setSaving(true);

    const { error } = await updatePage(editingPage, form);
    
    if (error) {
      toast.error('Fout bij opslaan');
    } else {
      toast.success('Pagina opgeslagen');
      setEditingPage(null);
    }
    setSaving(false);
  };

  const handleCreate = async () => {
    if (!form.slug || !form.h1_title) {
      toast.error('Slug en titel zijn verplicht');
      return;
    }

    setSaving(true);
    const { error } = await createPage({
      ...form,
      is_auto_generated: false,
    } as any);

    if (error) {
      toast.error('Fout bij aanmaken');
    } else {
      toast.success('Pagina aangemaakt');
      setIsCreateDialogOpen(false);
      setForm(defaultForm);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze pagina wilt verwijderen?')) return;

    const { error } = await deletePage(id);
    if (error) {
      toast.error('Fout bij verwijderen');
    } else {
      toast.success('Pagina verwijderd');
    }
  };

  const addFaq = () => {
    setForm(prev => ({
      ...prev,
      faq_content: [...prev.faq_content, { question: '', answer: '' }],
    }));
  };

  const updateFaq = (index: number, field: 'question' | 'answer', value: string) => {
    setForm(prev => ({
      ...prev,
      faq_content: prev.faq_content.map((faq, i) =>
        i === index ? { ...faq, [field]: value } : faq
      ),
    }));
  };

  const removeFaq = (index: number) => {
    setForm(prev => ({
      ...prev,
      faq_content: prev.faq_content.filter((_, i) => i !== index),
    }));
  };

  const generateSlug = () => {
    const dish = dishes.find(d => d.id === form.dish_id);
    const city = cities.find(c => c.id === form.city_id);
    if (dish && city) {
      const slug = `${dish.name.toLowerCase().replace(/\s+/g, '-')}-${city.name.toLowerCase()}`;
      setForm(prev => ({ ...prev, slug }));
    }
  };

  const generateFaqWithAI = async (pageId: string, dishName: string, cityName: string) => {
    setGeneratingFaq(pageId);
    try {
      const { data, error } = await supabase.functions.invoke('generate-seo-faq', {
        body: { pageId, dishName, cityName }
      });

      if (error) throw error;

      if (data?.error) {
        if (data.error.includes('Rate limit')) {
          toast.error('AI rate limit bereikt, probeer het later opnieuw');
        } else if (data.error.includes('credits')) {
          toast.error('AI credits op, voeg credits toe aan je workspace');
        } else {
          throw new Error(data.error);
        }
        return;
      }

      toast.success(`${data.faqs?.length || 0} FAQ's gegenereerd!`);
      fetchPages();
      
      // If editing this page, update form with new FAQs
      if (editingPage === pageId && data.faqs) {
        setForm(prev => ({ ...prev, faq_content: data.faqs }));
        setFaqOpen(true);
      }
    } catch (error) {
      console.error('FAQ generation error:', error);
      toast.error('Fout bij genereren FAQ\'s');
    } finally {
      setGeneratingFaq(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek op slug, titel, gerecht of stad..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setWizardOpen(true)} variant="default">
            <Zap className="h-4 w-4 mr-2" />
            Quick SEO Page
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)} variant="outline">
          <Plus className="h-4 w-4 mr-2" />
            Nieuwe pagina
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-card">
          <p className="text-sm text-muted-foreground">Totaal pagina's</p>
          <p className="text-2xl font-bold">{pages.length}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <p className="text-sm text-muted-foreground">Actief</p>
          <p className="text-2xl font-bold text-green-600">
            {pages.filter(p => p.is_active).length}
          </p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <p className="text-sm text-muted-foreground">Auto-gegenereerd</p>
          <p className="text-2xl font-bold text-blue-600">
            {pages.filter(p => p.is_auto_generated).length}
          </p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <p className="text-sm text-muted-foreground">Handmatig</p>
          <p className="text-2xl font-bold text-purple-600">
            {pages.filter(p => !p.is_auto_generated).length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pagina</TableHead>
              <TableHead>Gerecht</TableHead>
              <TableHead>Stad</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="w-[120px]">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Laden...
                </TableCell>
              </TableRow>
            ) : filteredPages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Geen pagina's gevonden
                </TableCell>
              </TableRow>
            ) : (
              filteredPages.map(page => (
                <TableRow key={page.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{page.h1_title}</p>
                      <p className="text-sm text-muted-foreground">/eten/{page.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell>{page.dish?.name || '-'}</TableCell>
                  <TableCell>{page.city?.name || '-'}</TableCell>
                  <TableCell>
                    {page.is_active ? (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Actief
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Inactief
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {page.is_auto_generated ? (
                      <Badge variant="outline" className="gap-1">
                        <Sparkles className="h-3 w-3" />
                        Auto
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <FileText className="h-3 w-3" />
                        Handmatig
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(page)}
                        title="Bewerken"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {page.dish?.name && page.city?.name && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => generateFaqWithAI(page.id, page.dish!.name, page.city!.name)}
                          disabled={generatingFaq === page.id}
                          title="Genereer FAQ met AI"
                          className="text-purple-600 hover:text-purple-700"
                        >
                          {generatingFaq === page.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Wand2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        title="Bekijken"
                      >
                        <a href={`/eten/${page.slug}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(page.id)}
                        className="text-destructive hover:text-destructive"
                        title="Verwijderen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingPage} onOpenChange={() => setEditingPage(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              SEO Pagina bewerken
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Slug (URL)</Label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 bg-muted rounded-l-md border border-r-0">
                    <span className="text-sm text-muted-foreground">/eten/</span>
                  </div>
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm(prev => ({ ...prev, slug: e.target.value }))}
                    className="rounded-l-none"
                    placeholder="ramen-amsterdam"
                  />
                </div>
              </div>

              <div>
                <Label>Gerecht</Label>
                <Select
                  value={form.dish_id || ''}
                  onValueChange={(v) => setForm(prev => ({ ...prev, dish_id: v || null }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer gerecht" />
                  </SelectTrigger>
                  <SelectContent>
                    {dishes.map(dish => (
                      <SelectItem key={dish.id} value={dish.id}>
                        {dish.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Stad</Label>
                <Select
                  value={form.city_id || ''}
                  onValueChange={(v) => setForm(prev => ({ ...prev, city_id: v || null }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer stad" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map(city => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* SEO Meta */}
            <div className="space-y-4">
              <h3 className="font-semibold">SEO Meta Tags</h3>
              <div>
                <Label>Meta Title (max 60 karakters)</Label>
                <Input
                  value={form.meta_title}
                  onChange={(e) => setForm(prev => ({ ...prev, meta_title: e.target.value }))}
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {form.meta_title.length}/60 karakters
                </p>
              </div>
              <div>
                <Label>Meta Description (max 160 karakters)</Label>
                <Textarea
                  value={form.meta_description}
                  onChange={(e) => setForm(prev => ({ ...prev, meta_description: e.target.value }))}
                  maxLength={160}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {form.meta_description.length}/160 karakters
                </p>
              </div>
            </div>

            {/* Page Content */}
            <div className="space-y-4">
              <h3 className="font-semibold">Pagina Content</h3>
              <div>
                <Label>H1 Titel</Label>
                <Input
                  value={form.h1_title}
                  onChange={(e) => setForm(prev => ({ ...prev, h1_title: e.target.value }))}
                />
              </div>
              <div>
                <Label>Intro Tekst</Label>
                <Textarea
                  value={form.intro_text}
                  onChange={(e) => setForm(prev => ({ ...prev, intro_text: e.target.value }))}
                  rows={3}
                />
              </div>
              <div>
                <Label>Uitgebreide Beschrijving</Label>
                <Textarea
                  value={form.extended_description}
                  onChange={(e) => setForm(prev => ({ ...prev, extended_description: e.target.value }))}
                  rows={4}
                />
              </div>
            </div>

            {/* FAQ */}
            <Collapsible open={faqOpen} onOpenChange={setFaqOpen}>
              <div className="flex items-center justify-between">
                <CollapsibleTrigger className="flex items-center gap-2 font-semibold">
                  <ChevronDown className={`h-4 w-4 transition-transform ${faqOpen ? 'rotate-180' : ''}`} />
                  FAQ's ({form.faq_content.length})
                </CollapsibleTrigger>
                {form.dish_id && form.city_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const dish = dishes.find(d => d.id === form.dish_id);
                      const city = cities.find(c => c.id === form.city_id);
                      if (dish && city && editingPage) {
                        generateFaqWithAI(editingPage, dish.name, city.name);
                      }
                    }}
                    disabled={generatingFaq === editingPage}
                  >
                    {generatingFaq === editingPage ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-2" />
                    )}
                    Genereer met AI
                  </Button>
                )}
              </div>
              <CollapsibleContent className="space-y-4 mt-4">
                {form.faq_content.map((faq, index) => (
                  <div key={index} className="p-4 rounded-lg border space-y-3">
                    <div className="flex justify-between items-start">
                      <Label>Vraag {index + 1}</Label>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFaq(index)}
                        className="h-6 w-6"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <Input
                      value={faq.question}
                      onChange={(e) => updateFaq(index, 'question', e.target.value)}
                      placeholder="Vraag..."
                    />
                    <Textarea
                      value={faq.answer}
                      onChange={(e) => updateFaq(index, 'answer', e.target.value)}
                      placeholder="Antwoord..."
                      rows={2}
                    />
                  </div>
                ))}
                <Button variant="outline" onClick={addFaq} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  FAQ toevoegen
                </Button>
              </CollapsibleContent>
            </Collapsible>

            {/* Status */}
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_active: checked }))}
              />
              <Label>Pagina actief</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPage(null)}>
              Annuleren
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Opslaan...' : 'Opslaan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nieuwe SEO Pagina
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Gerecht</Label>
                <Select
                  value={form.dish_id || ''}
                  onValueChange={(v) => setForm(prev => ({ ...prev, dish_id: v || null }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer gerecht" />
                  </SelectTrigger>
                  <SelectContent>
                    {dishes.map(dish => (
                      <SelectItem key={dish.id} value={dish.id}>
                        {dish.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Stad</Label>
                <Select
                  value={form.city_id || ''}
                  onValueChange={(v) => setForm(prev => ({ ...prev, city_id: v || null }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer stad" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map(city => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label>Slug (URL)</Label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 bg-muted rounded-l-md border border-r-0">
                    <span className="text-sm text-muted-foreground">/eten/</span>
                  </div>
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm(prev => ({ ...prev, slug: e.target.value }))}
                    className="rounded-l-none flex-1"
                    placeholder="ramen-amsterdam"
                  />
                  <Button variant="outline" onClick={generateSlug} type="button">
                    Genereer
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <Label>H1 Titel *</Label>
              <Input
                value={form.h1_title}
                onChange={(e) => setForm(prev => ({ ...prev, h1_title: e.target.value }))}
                placeholder="Beste Ramen in Amsterdam"
              />
            </div>

            <div>
              <Label>Meta Title</Label>
              <Input
                value={form.meta_title}
                onChange={(e) => setForm(prev => ({ ...prev, meta_title: e.target.value }))}
                placeholder="Ramen Amsterdam | Beste Restaurants | Dishloopr"
              />
            </div>

            <div>
              <Label>Meta Description</Label>
              <Textarea
                value={form.meta_description}
                onChange={(e) => setForm(prev => ({ ...prev, meta_description: e.target.value }))}
                placeholder="Ontdek de beste ramen restaurants in Amsterdam..."
                rows={2}
              />
            </div>

            <div>
              <Label>Intro Tekst</Label>
              <Textarea
                value={form.intro_text}
                onChange={(e) => setForm(prev => ({ ...prev, intro_text: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); setForm(defaultForm); }}>
              Annuleren
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              <Plus className="h-4 w-4 mr-2" />
              {saving ? 'Aanmaken...' : 'Aanmaken'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick SEO Page Wizard */}
      <QuickSeoPageWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSuccess={fetchPages}
      />
    </div>
  );
}
