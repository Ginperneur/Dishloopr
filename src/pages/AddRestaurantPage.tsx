import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Store, MapPin, Phone, Globe, Upload, Loader2, CheckCircle, ArrowLeft, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface FormData {
  name: string;
  address: string;
  postalCode: string;
  cityId: string;
  phone: string;
  website: string;
  cuisines: string[];
  priceLevel: number;
  notes: string;
}

export default function AddRestaurantPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    address: '',
    postalCode: '',
    cityId: '',
    phone: '',
    website: '',
    cuisines: [],
    priceLevel: 2,
    notes: '',
  });

  useState(() => {
    const fetchCities = async () => {
      const { data } = await supabase
        .from('cities')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      setCities(data || []);
    };
    fetchCities();
  });

  const cuisineOptions = [
    'Italiaans', 'Frans', 'Japans', 'Chinees', 'Mexicaans', 'Thais', 'Indiaas', 
    'Grieks', 'Turks', 'Koreaans', 'Vietnamees', 'Amerikaans', 'Nederlands', 
    'Mediterraans', 'Fusion', 'Steakhouse', 'Seafood', 'Vegetarisch', 'Vegan'
  ];

  const handleCuisineToggle = (cuisine: string) => {
    setFormData(prev => ({
      ...prev,
      cuisines: prev.cuisines.includes(cuisine)
        ? prev.cuisines.filter(c => c !== cuisine)
        : [...prev.cuisines, cuisine]
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      const maxSize = 10 * 1024 * 1024; // 10MB
      return validTypes.includes(file.type) && file.size <= maxSize;
    });
    setProofFiles(prev => [...prev, ...validFiles].slice(0, 5));
  };

  const removeFile = (index: number) => {
    setProofFiles(prev => prev.filter((_, i) => i !== index));
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Je moet ingelogd zijn');
      return;
    }

    if (!formData.name || !formData.address || !formData.cityId) {
      toast.error('Vul alle verplichte velden in');
      return;
    }

    setLoading(true);

    try {
      const slug = generateSlug(formData.name) + '-' + Date.now().toString(36);

      // Create the restaurant
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .insert({
          name: formData.name,
          slug,
          address: formData.address,
          postal_code: formData.postalCode || null,
          city_id: formData.cityId,
          phone: formData.phone || null,
          website_url: formData.website || null,
          cuisines: formData.cuisines,
          price_level: formData.priceLevel,
          claimed_by_owner_id: user.id,
          claim_status: 'claimed_unverified',
          is_active: false, // Needs admin approval
        })
        .select('id')
        .single();

      if (restaurantError) throw restaurantError;

      // Create a claim request for admin review
      const { data: claimRequest, error: claimError } = await supabase
        .from('claim_requests')
        .insert({
          restaurant_id: restaurant.id,
          user_id: user.id,
          notes: formData.notes || 'Nieuw restaurant toegevoegd door eigenaar',
          status: 'pending',
        })
        .select('id')
        .single();

      if (claimError) throw claimError;

      // Upload proof files if any
      if (proofFiles.length > 0) {
        const uploadedUrls: string[] = [];
        
        for (const file of proofFiles) {
          const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('menus')
            .upload(`claim-documents/${claimRequest.id}/${fileName}`, file);
          
          if (!uploadError && uploadData) {
            uploadedUrls.push(uploadData.path);
          }
        }

        if (uploadedUrls.length > 0) {
          await supabase
            .from('claim_requests')
            .update({ proof_documents: uploadedUrls })
            .eq('id', claimRequest.id);
        }
      }

      // Give user owner role if they don't have it
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'owner')
        .maybeSingle();

      if (!existingRole) {
        await supabase
          .from('user_roles')
          .insert({ user_id: user.id, role: 'owner' });
      }

      setSubmitted(true);
      toast.success('Restaurant ingediend voor review!');

    } catch (error: any) {
      console.error('Error submitting restaurant:', error);
      toast.error('Er ging iets mis: ' + (error.message || 'Probeer het opnieuw'));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <SEOHead title="Restaurant Toevoegen | Dishloopr" description="Log in om je restaurant toe te voegen aan Dishloopr." />
        <div className="container py-16">
          <Card className="max-w-md mx-auto">
            <CardContent className="py-12 text-center">
              <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-bold mb-2">Log in om door te gaan</h2>
              <p className="text-muted-foreground mb-6">
                Je moet ingelogd zijn om een restaurant toe te voegen.
              </p>
              <Button asChild>
                <Link to="/login?redirect=/add-restaurant">Inloggen</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (submitted) {
    return (
      <Layout>
        <SEOHead title="Restaurant Ingediend | Dishloopr" description="Je restaurant is ingediend voor review." />
        <div className="container py-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md mx-auto"
          >
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="py-12 text-center">
                <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Restaurant Ingediend!</h2>
                <p className="text-muted-foreground mb-6">
                  Je restaurant is ingediend voor review. We nemen zo snel mogelijk contact met je op 
                  om de eigendomsverificatie te voltooien.
                </p>
                <div className="space-y-3">
                  <Button asChild className="w-full">
                    <Link to="/owner">Naar mijn dashboard</Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/for-restaurants">Terug naar informatie</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEOHead 
        title="Restaurant Toevoegen | Dishloopr"
        description="Voeg je restaurant toe aan Dishloopr en bereik nieuwe gasten"
      />
      
      <div className="container py-8 max-w-2xl">
        <Button 
          variant="ghost" 
          className="mb-4"
          onClick={() => navigate('/for-restaurants')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mb-8">
            <Badge variant="secondary" className="mb-2">Nieuw restaurant</Badge>
            <h1 className="text-3xl font-bold mb-2">Voeg je restaurant toe</h1>
            <p className="text-muted-foreground">
              Staat je restaurant nog niet op Dishloopr? Voeg het hier toe en krijg direct toegang tot je dashboard.
            </p>
          </div>

          {/* Info card */}
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Hoe werkt het?</p>
                  <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                    <li>Vul de gegevens van je restaurant in</li>
                    <li>Upload een KVK-uittreksel of ander bewijs</li>
                    <li>Ons team reviewt je aanvraag (binnen 24-48 uur)</li>
                    <li>Na goedkeuring krijg je volledige toegang</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Restaurant Gegevens
              </CardTitle>
              <CardDescription>
                Alle velden met * zijn verplicht
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Naam restaurant *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Bijv. Restaurant De Gouden Lepel"
                  />
                </div>

                <div>
                  <Label htmlFor="address">Adres *</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Straatnaam 123"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="postalCode">Postcode</Label>
                    <Input
                      id="postalCode"
                      value={formData.postalCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, postalCode: e.target.value }))}
                      placeholder="1234 AB"
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">Stad *</Label>
                    <Select 
                      value={formData.cityId} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, cityId: value }))}
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">Telefoonnummer</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+31 20 123 4567"
                    />
                  </div>
                  <div>
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div>
                  <Label>Prijsniveau</Label>
                  <div className="flex gap-2 mt-2">
                    {[1, 2, 3, 4].map(level => (
                      <Button
                        key={level}
                        type="button"
                        variant={formData.priceLevel === level ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, priceLevel: level }))}
                      >
                        {'€'.repeat(level)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Keuken type(s)</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {cuisineOptions.map(cuisine => (
                      <Badge
                        key={cuisine}
                        variant={formData.cuisines.includes(cuisine) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => handleCuisineToggle(cuisine)}
                      >
                        {cuisine}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Proof documents */}
              <div className="pt-4 border-t">
                <Label>Bewijsdocumenten (KVK-uittreksel, etc.)</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Upload een KVK-uittreksel of ander bewijs dat je de eigenaar bent. Max 5 bestanden, 10MB per bestand.
                </p>
                
                <div className="space-y-2">
                  <label className="flex items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col items-center">
                      <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                      <span className="text-sm text-muted-foreground">Klik om bestanden te uploaden</span>
                      <span className="text-xs text-muted-foreground">PDF, JPG, PNG, WEBP</span>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      multiple
                      onChange={handleFileChange}
                    />
                  </label>

                  {proofFiles.length > 0 && (
                    <div className="space-y-1">
                      {proofFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                          <span className="truncate flex-1">{file.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Additional notes */}
              <div>
                <Label htmlFor="notes">Aanvullende informatie (optioneel)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Bijv. wanneer je restaurant is geopend, speciale kenmerken, etc."
                  rows={3}
                />
              </div>

              {/* Submit */}
              <Button 
                className="w-full" 
                size="lg"
                onClick={handleSubmit}
                disabled={loading || !formData.name || !formData.address || !formData.cityId}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Bezig met indienen...
                  </>
                ) : (
                  <>
                    <Store className="h-4 w-4 mr-2" />
                    Restaurant Indienen
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}
