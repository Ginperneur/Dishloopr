import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { restaurantSchema, validateWithErrors } from '@/lib/validations';

interface City {
  id: string;
  name: string;
}

interface AddRestaurantModalProps {
  onSuccess: () => void;
}

export function AddRestaurantModal({ onSuccess }: AddRestaurantModalProps) {
  const [open, setOpen] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    address: '',
    postal_code: '',
    city_id: '',
    phone: '',
    website_url: '',
    price_level: '2'
  });

  useEffect(() => {
    fetchCities();
  }, []);

  const fetchCities = async () => {
    const { data } = await supabase.from('cities').select('id, name').order('name');
    setCities(data || []);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prepare data with slug
    const dataToValidate = {
      ...formData,
      slug: formData.slug || generateSlug(formData.name),
      price_level: formData.price_level
    };

    // Validate input
    const validation = validateWithErrors(restaurantSchema, dataToValidate);
    if (!validation.success) {
      for (const err of validation.errors) {
        toast.error(err);
      }
      return;
    }

    setLoading(true);
    const validatedData = validation.data;

    const { data: newRestaurant, error } = await supabase.from('restaurants').insert({
      name: validatedData.name,
      slug: validatedData.slug,
      address: validatedData.address,
      postal_code: validatedData.postal_code || null,
      city_id: validatedData.city_id,
      phone: validatedData.phone || null,
      website_url: validatedData.website_url || null,
      price_level: validatedData.price_level,
      is_active: true
    }).select('id').single();

    setLoading(false);

    if (error) {
      toast.error('Restaurant toevoegen mislukt: ' + error.message);
    } else {
      toast.success('Restaurant toegevoegd!');

      // Auto-scrape menu if website URL is provided
      if (validatedData.website_url && newRestaurant?.id) {
        toast.info('Menu wordt automatisch gescraped...');
        supabase.functions.invoke('scrape-menu', {
          body: { restaurantId: newRestaurant.id, websiteUrl: validatedData.website_url },
        }).then(({ data, error: scrapeError }) => {
          if (scrapeError || !data?.success) {
            toast.warning('Menu scraping mislukt, je kunt dit later opnieuw proberen.');
          } else {
            toast.success(`${data.results?.added || 0} gerechten gevonden via website!`);
          }
        });
      }

      setFormData({
        name: '',
        slug: '',
        address: '',
        postal_code: '',
        city_id: '',
        phone: '',
        website_url: '',
        price_level: '2'
      });
      setOpen(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nieuw Restaurant
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Restaurant toevoegen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Naam *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Restaurant naam"
              />
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="restaurant-naam"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="address">Adres *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Straatnaam 123"
              />
            </div>

            <div>
              <Label htmlFor="postal_code">Postcode</Label>
              <Input
                id="postal_code"
                value={formData.postal_code}
                onChange={(e) => setFormData(prev => ({ ...prev, postal_code: e.target.value }))}
                placeholder="1234 AB"
              />
            </div>

            <div>
              <Label htmlFor="city">Stad *</Label>
              <Select
                value={formData.city_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, city_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer stad" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="phone">Telefoon</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+31 20 123 4567"
              />
            </div>

            <div>
              <Label htmlFor="price_level">Prijsniveau</Label>
              <Select
                value={formData.price_level}
                onValueChange={(value) => setFormData(prev => ({ ...prev, price_level: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">€</SelectItem>
                  <SelectItem value="2">€€</SelectItem>
                  <SelectItem value="3">€€€</SelectItem>
                  <SelectItem value="4">€€€€</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="website_url">Website</Label>
              <Input
                id="website_url"
                value={formData.website_url}
                onChange={(e) => setFormData(prev => ({ ...prev, website_url: e.target.value }))}
                placeholder="https://restaurant.nl"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Bezig...' : 'Toevoegen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
