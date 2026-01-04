import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
    
    if (!formData.name || !formData.address || !formData.city_id) {
      toast.error('Vul alle verplichte velden in');
      return;
    }

    setLoading(true);

    const { error } = await supabase.from('restaurants').insert({
      name: formData.name,
      slug: formData.slug || generateSlug(formData.name),
      address: formData.address,
      postal_code: formData.postal_code || null,
      city_id: formData.city_id,
      phone: formData.phone || null,
      website_url: formData.website_url || null,
      price_level: parseInt(formData.price_level),
      is_active: true
    });

    setLoading(false);

    if (error) {
      toast.error('Restaurant toevoegen mislukt: ' + error.message);
    } else {
      toast.success('Restaurant toegevoegd!');
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
