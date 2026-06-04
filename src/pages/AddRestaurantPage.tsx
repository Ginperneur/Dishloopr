import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Store, MapPin, Phone, Globe, Upload, Loader2, CheckCircle, ArrowLeft, 
  Info, Search, Star, Clock, ChevronRight, FileEdit, Database, ExternalLink, Mail
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface GooglePlaceResult {
  place_id: string;
  name: string;
  address: string;
  geo_lat?: number;
  geo_lng?: number;
  phone?: string;
  website?: string;
  rating?: number;
  review_count?: number;
  price_level?: number;
  opening_hours?: string[];
  opening_hours_periods?: any[];
  photo_references?: string[];
  is_local?: boolean;
  restaurant_id?: string;
  claim_status?: string;
}

interface FormData {
  name: string;
  address: string;
  postalCode: string;
  cityName: string;
  phone: string;
  website: string;
  cuisines: string[];
  priceLevel: number;
  notes: string;
  geoLat: number | null;
  geoLng: number | null;
  placeId: string | null;
  openingHours: string[] | null;
  photoReferences: string[];
  googleRating: number | null;
}

type Step = 'search' | 'select' | 'details' | 'submitting' | 'done';

const CUISINE_OPTIONS = [
  'Italiaans', 'Frans', 'Japans', 'Chinees', 'Mexicaans', 'Thais', 'Indiaas',
  'Grieks', 'Turks', 'Koreaans', 'Vietnamees', 'Amerikaans', 'Nederlands',
  'Mediterraans', 'Fusion', 'Steakhouse', 'Seafood', 'Vegetarisch', 'Vegan'
];

export default function AddRestaurantPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Search state
  const [searchName, setSearchName] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [searchResults, setSearchResults] = useState<GooglePlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Flow state
  const [step, setStep] = useState<Step>('search');
  const [selectedResult, setSelectedResult] = useState<GooglePlaceResult | null>(null);
  const [isManualEntry, setIsManualEntry] = useState(false);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    name: '', address: '', postalCode: '', cityName: '', phone: '', website: '',
    cuisines: [], priceLevel: 2, notes: '',
    geoLat: null, geoLng: null, placeId: null,
    openingHours: null, photoReferences: [], googleRating: null,
  });

  // Proof docs
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [sendingMagicLink, setSendingMagicLink] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!searchName.trim()) {
      toast.error('Vul een restaurantnaam in');
      return;
    }

    setSearching(true);
    setHasSearched(true);
    setSearchResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('google-places-search', {
        body: { query: searchName.trim(), city: searchCity.trim() || undefined, includeLocal: true }
      });

      if (error) throw error;
      setSearchResults(data?.results || []);
    } catch (err) {
      console.error('Search error:', err);
      toast.error('Zoeken mislukt. Probeer het opnieuw.');
    } finally {
      setSearching(false);
    }
  }, [searchName, searchCity]);

  const handleSelectResult = (result: GooglePlaceResult) => {
    // If already in database & claimed, warn user
    if (result.is_local && result.claim_status === 'verified_owner') {
      toast.error('Dit restaurant is al geclaimd door een andere eigenaar.');
      return;
    }

    // If already in database but unclaimed, redirect to claim
    if (result.is_local && result.restaurant_id) {
      toast.info('Dit restaurant staat al op Dishloopr. Je kunt het claimen!');
      navigate(`/claim?restaurant=${result.restaurant_id}`);
      return;
    }

    setSelectedResult(result);

    // Extract city from address
    const addressParts = result.address?.split(',') || [];
    const cityFromAddress = addressParts.length >= 2
      ? addressParts[addressParts.length - 2]?.trim().replace(/^\d{4}\s?[A-Z]{2}\s*/, '') || ''
      : '';

    setFormData({
      name: result.name || '',
      address: result.address || '',
      postalCode: '',
      cityName: cityFromAddress || searchCity,
      phone: result.phone || '',
      website: result.website || '',
      cuisines: [],
      priceLevel: result.price_level || 2,
      notes: '',
      geoLat: result.geo_lat || null,
      geoLng: result.geo_lng || null,
      placeId: result.place_id || null,
      openingHours: result.opening_hours || null,
      photoReferences: result.photo_references || [],
      googleRating: result.rating || null,
    });

    setIsManualEntry(false);
    setStep('details');
  };

  const handleManualEntry = () => {
    setSelectedResult(null);
    setIsManualEntry(true);
    setFormData({
      name: searchName, address: '', postalCode: '', cityName: searchCity,
      phone: '', website: '', cuisines: [], priceLevel: 2, notes: '',
      geoLat: null, geoLng: null, placeId: null,
      openingHours: null, photoReferences: [], googleRating: null,
    });
    setStep('details');
  };

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
      return validTypes.includes(file.type) && file.size <= 10 * 1024 * 1024;
    });
    setProofFiles(prev => [...prev, ...validFiles].slice(0, 5));
  };

  const handleSubmit = async () => {
    if (!user) { toast.error('Je moet ingelogd zijn'); return; }
    if (!formData.name || !formData.address || !formData.cityName) {
      toast.error('Vul naam, adres en stad in');
      return;
    }

    setStep('submitting');
    setLoading(true);

    try {
      // Get or create city
      let cityId: string;
      const { data: existingCity } = await supabase
        .from('cities')
        .select('id')
        .ilike('name', formData.cityName.trim())
        .maybeSingle();

      if (existingCity) {
        cityId = existingCity.id;
      } else {
        const { data: newCity, error: cityError } = await supabase
          .from('cities')
          .insert({
            name: formData.cityName.trim(),
            slug: formData.cityName.trim().toLowerCase().replace(/\s+/g, '-'),
            country_code: 'NL'
          })
          .select('id')
          .single();

        if (cityError) throw cityError;
        cityId = newCity.id;
      }

      // Check duplicate
      const { data: duplicate } = await supabase
        .from('restaurants')
        .select('id, name, claim_status')
        .eq('city_id', cityId)
        .ilike('name', formData.name.trim())
        .maybeSingle();

      if (duplicate) {
        setStep('details');
        setLoading(false);
        if (duplicate.claim_status === 'verified_owner') {
          toast.error('Dit restaurant bestaat al en is geclaimd.');
        } else {
          toast.info('Dit restaurant bestaat al op Dishloopr!');
          navigate(`/claim?restaurant=${duplicate.id}`);
        }
        return;
      }

      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);

      // Create restaurant
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .insert({
          name: formData.name.trim(),
          slug,
          address: formData.address.trim(),
          postal_code: formData.postalCode || null,
          city_id: cityId,
          phone: formData.phone || null,
          website_url: formData.website || null,
          cuisines: formData.cuisines.length > 0 ? formData.cuisines : null,
          price_level: formData.priceLevel,
          geo_lat: formData.geoLat,
          geo_lng: formData.geoLng,
          opening_hours: formData.openingHours
            ? { weekday_text: formData.openingHours }
            : null,
          rating: formData.googleRating || 0,
          claimed_by_owner_id: user.id,
          claim_status: 'claimed_unverified',
          is_active: false,
          added_by_source: 'owner',
        })
        .select('id')
        .single();

      if (restaurantError) throw restaurantError;

      // Create claim request
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

      // Upload proof files
      if (proofFiles.length > 0) {
        const uploadedUrls: string[] = [];
        for (const file of proofFiles) {
          const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('menus')
            .upload(`claim-documents/${claimRequest.id}/${fileName}`, file);
          if (!uploadError && uploadData) uploadedUrls.push(uploadData.path);
        }
        if (uploadedUrls.length > 0) {
          await supabase
            .from('claim_requests')
            .update({ proof_documents: uploadedUrls })
            .eq('id', claimRequest.id);
        }
      }

      // Ensure user has owner role
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

      // Fetch Google photos in background if available
      if (formData.photoReferences.length > 0 && formData.placeId) {
        supabase.functions.invoke('fetch-google-photos', {
          body: {
            place_id: formData.placeId,
            photo_references: formData.photoReferences,
            restaurant_id: restaurant.id,
            max_photos: 5
          }
        }).catch(err => console.error('Failed to fetch photos:', err));
      }

      // Auto-detect reservation provider in background (Zenchef/TheFork/OpenTable/...)
      if (formData.website) {
        supabase.functions.invoke('detect-reservation-links', {
          body: { restaurantId: restaurant.id, forceRefresh: true },
        }).catch(err => console.error('Failed to detect reservation link:', err));
      }

      setStep('done');
      toast.success('Restaurant ingediend voor review!');
      // Auto-send magic link so the owner has a one-click way back to the dashboard
      sendMagicLink(true);
    } catch (error: any) {
      console.error('Error submitting:', error);
      toast.error('Er ging iets mis: ' + (error.message || 'Probeer het opnieuw'));
      setStep('details');
    } finally {
      setLoading(false);
    }
  };

  const sendMagicLink = useCallback(async (silent = false) => {
    if (!user?.email) return;
    setSendingMagicLink(true);
    try {
      const redirectUrl = `${window.location.origin}/owner`;
      const { error } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: { emailRedirectTo: redirectUrl, shouldCreateUser: false },
      });
      if (error) throw error;
      setMagicLinkSent(true);
      if (!silent) toast.success('Toegangslink verstuurd. Check je inbox!');
    } catch (err: any) {
      if (!silent) toast.error('Kon link niet versturen: ' + (err.message || 'probeer opnieuw'));
    } finally {
      setSendingMagicLink(false);
    }
  }, [user?.email]);

  // ─── Auth Guards ───────────────────────────────────────────
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
        <SEOHead title="Restaurant Toevoegen | Dishloopr" description="Log in om je restaurant toe te voegen aan Dishloopr." noindex />
        <div className="container py-16">
          <Card className="max-w-md mx-auto">
            <CardContent className="py-12 text-center">
              <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-bold mb-2">Log in om door te gaan</h2>
              <p className="text-muted-foreground mb-6">
                Maak een gratis account aan of log in om je restaurant toe te voegen. Na het toevoegen kun je eigenaarschap verifiëren.
              </p>
              <Button asChild>
                <Link to="/login?redirect=/add-restaurant">Inloggen of registreren</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // ─── Steps Progress ────────────────────────────────────────
  const stepLabels = ['Zoeken', 'Gegevens', 'Ingediend'];
  const stepIndex = step === 'search' || step === 'select' ? 0 : step === 'details' || step === 'submitting' ? 1 : 2;
  const progressPercent = ((stepIndex + 1) / stepLabels.length) * 100;

  return (
    <Layout>
      <SEOHead
        title="Restaurant Toevoegen | Dishloopr"
        description="Voeg je restaurant toe aan Dishloopr en bereik nieuwe gasten"
        noindex
      />

      <div className="container py-8 max-w-2xl">
        <Button variant="ghost" className="mb-4" onClick={() => step === 'details' && !loading ? setStep('search') : navigate('/for-restaurants')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {step === 'details' ? 'Terug naar zoeken' : 'Terug'}
        </Button>

        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            {stepLabels.map((label, i) => (
              <span key={label} className={i <= stepIndex ? 'text-primary font-medium' : ''}>
                {label}
              </span>
            ))}
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>

        <AnimatePresence mode="wait">
          {/* ─── STEP 1: SEARCH ─────────────────────────────────── */}
          {(step === 'search' || step === 'select') && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="mb-6">
                <Badge variant="secondary" className="mb-2">Stap 1</Badge>
                <h1 className="text-3xl font-bold mb-2">Zoek je restaurant</h1>
                <p className="text-muted-foreground">
                  Typ de naam van je restaurant en we zoeken het automatisch op. Na toevoegen kun je eigenaarschap verifiëren voor volledige dashboardtoegang.
                </p>
              </div>

              <Card className="mb-4">
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <Label htmlFor="search-name">Naam restaurant *</Label>
                    <Input
                      id="search-name"
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                      placeholder="Bijv. Restaurant De Gouden Lepel"
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                  </div>
                  <div>
                    <Label htmlFor="search-city">Stad (optioneel)</Label>
                    <Input
                      id="search-city"
                      value={searchCity}
                      onChange={(e) => setSearchCity(e.target.value)}
                      placeholder="Bijv. Amsterdam"
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleSearch}
                    disabled={searching || !searchName.trim()}
                  >
                    {searching ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" />Zoeken...</>
                    ) : (
                      <><Search className="h-4 w-4 mr-2" />Restaurant zoeken</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Search results */}
              {hasSearched && !searching && (
                <div className="space-y-3">
                  {searchResults.length > 0 ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {searchResults.length} resultaat/resultaten gevonden — klik om te selecteren
                      </p>
                      {searchResults.map((result) => (
                        <Card
                          key={result.place_id}
                          className="cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => handleSelectResult(result)}
                        >
                          <CardContent className="py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold truncate">{result.name}</h3>
                                  {result.is_local && (
                                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                                      <Database className="h-3 w-3 mr-1" />
                                      In database
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{result.address}</span>
                                </p>
                                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                  {result.rating && (
                                    <span className="flex items-center gap-1">
                                      <Star className="h-3 w-3 text-amber-500" />
                                      {result.rating}
                                    </span>
                                  )}
                                  {result.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {result.phone}
                                    </span>
                                  )}
                                  {result.price_level && (
                                    <span>{'€'.repeat(result.price_level)}</span>
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  ) : (
                    <Card className="border-dashed">
                      <CardContent className="py-8 text-center">
                        <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                        <p className="font-medium mb-1">Geen resultaten gevonden</p>
                        <p className="text-sm text-muted-foreground mb-4">
                          We konden je restaurant niet vinden. Je kunt het handmatig toevoegen.
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Manual entry fallback */}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleManualEntry}
                  >
                    <FileEdit className="h-4 w-4 mr-2" />
                    Handmatig invullen
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {/* ─── STEP 2: DETAILS ────────────────────────────────── */}
          {(step === 'details' || step === 'submitting') && (
            <motion.div
              key="details"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="mb-6">
                <Badge variant="secondary" className="mb-2">Stap 2</Badge>
                <h1 className="text-3xl font-bold mb-2">
                  {isManualEntry ? 'Vul je gegevens in' : 'Controleer & vul aan'}
                </h1>
                <p className="text-muted-foreground">
                  {isManualEntry
                    ? 'Vul de gegevens van je restaurant in.'
                    : 'We hebben de gegevens automatisch ingevuld. Controleer en vul aan waar nodig.'}
                </p>
              </div>

              {/* Auto-filled success banner */}
              {!isManualEntry && selectedResult && (
                <Card className="mb-4 border-green-500/30 bg-green-500/5">
                  <CardContent className="py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span>
                        <strong>{selectedResult.name}</strong> automatisch ingevuld via Google Places
                        {selectedResult.rating && <> • ⭐ {selectedResult.rating}</>}
                        {selectedResult.opening_hours && <> • Openingstijden gevonden</>}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="h-5 w-5" />
                    Restaurant Gegevens
                  </CardTitle>
                  <CardDescription>Velden met * zijn verplicht</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Basic info */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Naam restaurant *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Naam restaurant"
                      />
                    </div>

                    <div>
                      <Label htmlFor="address">Adres *</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Straatnaam 123, 1234 AB Amsterdam"
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
                        <Label htmlFor="cityName">Stad *</Label>
                        <Input
                          id="cityName"
                          value={formData.cityName}
                          onChange={(e) => setFormData(prev => ({ ...prev, cityName: e.target.value }))}
                          placeholder="Amsterdam"
                        />
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
                        {CUISINE_OPTIONS.map(cuisine => (
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

                  {/* Opening hours preview (if available) */}
                  {formData.openingHours && formData.openingHours.length > 0 && (
                    <div className="pt-4 border-t">
                      <Label className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4" />
                        Openingstijden (van Google)
                      </Label>
                      <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                        {formData.openingHours.map((hour, i) => (
                          <p key={i} className="text-muted-foreground">{hour}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Proof documents */}
                  <div className="pt-4 border-t">
                    <Label>Bewijsdocumenten (KVK-uittreksel, etc.)</Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      Upload een KVK-uittreksel of ander bewijs dat je de eigenaar bent. Max 5 bestanden, 10MB per bestand.
                    </p>
                    <label className="flex items-center justify-center w-full h-20 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col items-center">
                        <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                        <span className="text-sm text-muted-foreground">Klik om bestanden te uploaden</span>
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
                      <div className="space-y-1 mt-2">
                        {proofFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                            <span className="truncate flex-1">{file.name}</span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setProofFiles(prev => prev.filter((_, i) => i !== index))}>
                              ×
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <Label htmlFor="notes">Aanvullende informatie (optioneel)</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Bijv. speciale kenmerken, je rol in het restaurant, etc."
                      rows={3}
                    />
                  </div>

                  {/* Info */}
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="py-3">
                      <div className="flex gap-3">
                        <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-muted-foreground">
                          <p className="font-medium text-foreground mb-1">Wat gebeurt er na het indienen?</p>
                          <p>Ons team reviewt je aanvraag binnen 24-48 uur. Na goedkeuring wordt je restaurant zichtbaar en krijg je toegang tot het eigenaren dashboard.</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Submit */}
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleSubmit}
                    disabled={loading || !formData.name || !formData.address || !formData.cityName}
                  >
                    {loading ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" />Bezig met indienen...</>
                    ) : (
                      <><Store className="h-4 w-4 mr-2" />Restaurant Indienen</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ─── STEP 3: DONE ───────────────────────────────────── */}
          {step === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="border-green-500/30 bg-green-500/5">
                <CardContent className="py-12 text-center">
                  <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Restaurant Ingediend!</h2>
                  <p className="text-muted-foreground mb-2">
                    Je restaurant is ingediend voor review. We nemen binnen 24-48 uur contact met je op.
                  </p>
                  {formData.photoReferences.length > 0 && (
                    <p className="text-sm text-muted-foreground mb-6">
                      📸 Foto's worden automatisch opgehaald van Google.
                    </p>
                  )}
                  <div className="bg-background/60 border rounded-lg p-3 text-sm mb-4 max-w-sm mx-auto">
                    <div className="flex items-start gap-2 text-left">
                      <Mail className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <div className="text-muted-foreground">
                        {magicLinkSent ? (
                          <>We hebben een <span className="font-medium text-foreground">toegangslink</span> naar <span className="font-medium text-foreground">{user?.email}</span> gestuurd. Klik in de mail om direct in je dashboard te komen — geen wachtwoord nodig.</>
                        ) : (
                          <>We sturen je een toegangslink per e-mail zodat je later met één klik terug in je dashboard komt.</>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 max-w-xs mx-auto">
                    <Button asChild className="w-full">
                      <Link to="/owner">Naar mijn dashboard</Link>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => sendMagicLink(false)}
                      disabled={sendingMagicLink}
                    >
                      {sendingMagicLink ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />Versturen...</>
                      ) : (
                        <><Mail className="h-4 w-4 mr-2" />{magicLinkSent ? 'Link opnieuw sturen' : 'Stuur toegangslink'}</>
                      )}
                    </Button>
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/for-restaurants">Terug naar informatie</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
