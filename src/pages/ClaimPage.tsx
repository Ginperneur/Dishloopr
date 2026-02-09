import { Layout } from '@/components/layout/Layout';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, TrendingUp, MessageSquare, BarChart3, Search, MapPin, Clock, Phone, Globe, Star, Loader2, Shield, AlertCircle, Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ClaimStatusBadge } from '@/components/claims/ClaimStatusBadge';
import { VerificationRequiredDialog } from '@/components/claims/VerificationRequiredDialog';
import { useRestaurantClaims } from '@/hooks/useRestaurantClaims';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

interface GooglePlaceResult {
  place_id: string;
  name: string;
  address: string;
  geo_lat: number | null;
  geo_lng: number | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  price_level: number;
  opening_hours: string[] | null;
  photo_references?: string[];
  // Local database fields
  is_local?: boolean;
  restaurant_id?: string;
  claim_status?: string;
}

export default function ClaimPage() {
  const { user } = useAuth();
  const { 
    userClaims, 
    canCreateClaim, 
    createClaim, 
    loading: claimsLoading,
    refetch: refetchClaims
  } = useRestaurantClaims();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [searchResults, setSearchResults] = useState<GooglePlaceResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<GooglePlaceResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Phone verification state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [currentClaimId, setCurrentClaimId] = useState<string | null>(null);
  
  // File upload state
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const benefits = [
    {
      icon: CheckCircle,
      title: 'Verificatiebadge',
      description: 'Laat gasten zien dat je profiel officieel is geverifieerd.'
    },
    {
      icon: TrendingUp,
      title: 'Meer zichtbaarheid',
      description: 'Word beter gevonden door potentiële gasten via onze zoekmachine.'
    },
    {
      icon: MessageSquare,
      title: 'Reageer op reviews',
      description: 'Bouw vertrouwen door professioneel te reageren op feedback.'
    },
    {
      icon: BarChart3,
      title: 'Inzichten & analytics',
      description: 'Bekijk hoeveel mensen je restaurant bekijken en hoe ze je vinden.'
    }
  ];

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Vul de naam van je restaurant in');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setSelectedPlace(null);

    try {
      const { data, error } = await supabase.functions.invoke('google-places-search', {
        body: { query: searchQuery, city: searchCity || undefined }
      });

      if (error) throw error;

      setSearchResults(data.results || []);
      
      if (data.results?.length === 0) {
        toast.info('Geen restaurants gevonden. Probeer een andere zoekopdracht.');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Er ging iets mis bij het zoeken. Probeer het opnieuw.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPlace = (place: GooglePlaceResult) => {
    setSelectedPlace(place);
    setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!selectedPlace) {
      toast.error('Selecteer eerst je restaurant uit de zoekresultaten');
      return;
    }

    if (!canCreateClaim) {
      toast.error('Je hebt het maximum aantal claims bereikt. Verifieer eerst een bestaande claim.');
      return;
    }

    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const role = formData.get('role') as string;
    const notes = formData.get('notes') as string;

    try {
      let restaurantId: string | undefined;

      // If this is a local restaurant from our database, use its ID directly
      if (selectedPlace.is_local && selectedPlace.restaurant_id) {
        console.log('Using local restaurant:', selectedPlace.restaurant_id);
        
        // Check if already verified
        const { data: existingRestaurant } = await supabase
          .from('restaurants')
          .select('id, claimed_by_owner_id, claim_status')
          .eq('id', selectedPlace.restaurant_id)
          .maybeSingle();

        if (existingRestaurant?.claim_status === 'verified_owner') {
          toast.error('Dit restaurant is al geclaimd en geverifieerd. Neem contact op als je denkt dat dit onjuist is.');
          setIsSubmitting(false);
          return;
        }

        restaurantId = existingRestaurant?.id;
      } else {
        // Google Places result - check if restaurant exists in our database by name
        const { data: existingRestaurant } = await supabase
          .from('restaurants')
          .select('id, claimed_by_owner_id, claim_status')
          .eq('name', selectedPlace.name)
          .maybeSingle();

        if (existingRestaurant?.claim_status === 'verified_owner') {
          toast.error('Dit restaurant is al geclaimd en geverifieerd. Neem contact op als je denkt dat dit onjuist is.');
          setIsSubmitting(false);
          return;
        }

        restaurantId = existingRestaurant?.id;
      }

      // If restaurant doesn't exist, create it
      if (!restaurantId) {
        const cityName = extractCityFromAddress(selectedPlace.address);
        let cityId: string;

        const { data: existingCity } = await supabase
          .from('cities')
          .select('id')
          .eq('name', cityName)
          .maybeSingle();

        if (existingCity) {
          cityId = existingCity.id;
        } else {
          const { data: newCity, error: cityError } = await supabase
            .from('cities')
            .insert({
              name: cityName,
              slug: cityName.toLowerCase().replace(/\s+/g, '-'),
              country_code: 'NL'
            })
            .select('id')
            .single();

          if (cityError) throw cityError;
          cityId = newCity.id;
        }

        const { data: newRestaurant, error: restaurantError } = await supabase
          .from('restaurants')
          .insert({
            name: selectedPlace.name,
            slug: generateSlug(selectedPlace.name),
            address: selectedPlace.address,
            city_id: cityId,
            geo_lat: selectedPlace.geo_lat,
            geo_lng: selectedPlace.geo_lng,
            phone: selectedPlace.phone,
            website_url: selectedPlace.website,
            rating: selectedPlace.rating || 0,
            review_count: selectedPlace.review_count || 0,
            price_level: selectedPlace.price_level || 2,
            opening_hours: selectedPlace.opening_hours ? { weekday_text: selectedPlace.opening_hours } : null,
            is_active: true,
            claim_status: 'claimed_unverified'
          })
          .select('id')
          .single();

        if (restaurantError) throw restaurantError;
        restaurantId = newRestaurant.id;

        // Fetch and store Google Places photos automatically
        if (selectedPlace.place_id && selectedPlace.photo_references?.length) {
          supabase.functions.invoke('fetch-google-photos', {
            body: { 
              place_id: selectedPlace.place_id,
              photo_references: selectedPlace.photo_references,
              restaurant_id: restaurantId,
              max_photos: 5
            }
          }).then(({ error }) => {
            if (error) {
              console.error('Failed to fetch Google photos:', error);
            } else {
              console.log('Google photos fetched successfully');
            }
          });
        }
      } else {
        // Update existing restaurant claim status
        await supabase
          .from('restaurants')
          .update({ claim_status: 'claimed_unverified' })
          .eq('id', restaurantId);
      }

      // Create claim using the new system
      const result = await createClaim(restaurantId, phoneNumber || undefined);
      
      if (result.success && result.claimId) {
        // Upload proof files if any
        if (proofFiles.length > 0) {
          setIsUploadingFiles(true);
          const uploadedUrls: string[] = [];
          
          for (const file of proofFiles) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${result.claimId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('menus') // Using menus bucket for claim documents
              .upload(`claim-documents/${fileName}`, file);
            
            if (uploadError) {
              console.error('Upload error:', uploadError);
            } else if (uploadData) {
              uploadedUrls.push(uploadData.path);
            }
          }
          
          // Update claim with proof documents
          if (uploadedUrls.length > 0) {
            await supabase
              .from('claim_requests')
              .update({ proof_documents: uploadedUrls })
              .eq('id', result.claimId);
          }
          
          setIsUploadingFiles(false);
        }
        
        setCurrentClaimId(result.claimId);
        setShowPhoneVerification(true);
        setProofFiles([]);
        toast.success('Claim aangemaakt! Verifieer nu je telefoonnummer.');
      } else if (result.error) {
        toast.error(result.error);
      }

    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Er ging iets mis. Probeer het opnieuw.');
    } finally {
      setIsSubmitting(false);
      setIsUploadingFiles(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    const validFiles: File[] = [];
    
    for (const file of Array.from(files)) {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name}: Alleen PDF, JPG, PNG of WEBP bestanden toegestaan`);
        continue;
      }
      if (file.size > maxSize) {
        toast.error(`${file.name}: Bestand is te groot (max 10MB)`);
        continue;
      }
      validFiles.push(file);
    }
    
    if (validFiles.length + proofFiles.length > 5) {
      toast.error('Je kunt maximaal 5 bestanden uploaden');
      return;
    }
    
    setProofFiles(prev => [...prev, ...validFiles]);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setProofFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendCode = async () => {
    if (!phoneNumber.trim() || !currentClaimId) {
      toast.error('Vul een geldig telefoonnummer in');
      return;
    }

    setSendingCode(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms-verification', {
        body: { 
          claimId: currentClaimId, 
          phoneNumber: phoneNumber.startsWith('+') ? phoneNumber : `+31${phoneNumber.replace(/^0/, '')}`,
          action: 'send'
        }
      });

      if (error) throw error;
      
      setCodeSent(true);
      toast.success('Verificatiecode verzonden naar je telefoon!');
    } catch (error: any) {
      console.error('Send code error:', error);
      toast.error(error.message || 'Kon code niet verzenden. Controleer het nummer.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6 || !currentClaimId) {
      toast.error('Voer de 6-cijferige code in');
      return;
    }

    setVerifyingCode(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms-verification', {
        body: { 
          claimId: currentClaimId, 
          phoneNumber,
          action: 'verify',
          code: verificationCode
        }
      });

      if (error) throw error;
      
      toast.success('Telefoon geverifieerd! Je claim is nu actief.');
      setShowPhoneVerification(false);
      setSelectedPlace(null);
      setSearchQuery('');
      setSearchCity('');
      setCodeSent(false);
      setVerificationCode('');
      setPhoneNumber('');
      refetchClaims();
    } catch (error: any) {
      console.error('Verify code error:', error);
      toast.error(error.message || 'Ongeldige code. Probeer opnieuw.');
    } finally {
      setVerifyingCode(false);
    }
  };

  const extractCityFromAddress = (address: string): string => {
    const parts = address.split(',').map(p => p.trim());
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (/^\d{4}\s?[A-Z]{2}/.test(part) || part === 'Nederland' || part === 'Netherlands') {
        continue;
      }
      return part.replace(/^\d{4}\s?[A-Z]{2}\s*/, '').trim() || 'Amsterdam';
    }
    return 'Amsterdam';
  };

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const priceLabels = ['€', '€€', '€€€', '€€€€'];

  return (
    <Layout>
      <div className="container py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Claim je restaurant
          </h1>
          <p className="text-xl text-muted-foreground">
            Neem de controle over je Dishloopr profiel en bereik meer gasten.
          </p>
        </motion.div>

        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="max-w-xl mx-auto mb-8"
        >
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Hoe werkt het?</p>
                  <p className="text-muted-foreground">
                    Claimen geeft je geen directe controle. Na telefoonverificatie krijg je beperkte toegang. 
                    Volledige controle (profiel bewerken, reviews beantwoorden, analytics) vereist extra verificatie.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-card border border-border rounded-xl p-6 text-center"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <benefit.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{benefit.title}</h3>
              <p className="text-sm text-muted-foreground">{benefit.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Existing Claims */}
        {userClaims.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-xl mx-auto mb-8"
          >
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Jouw claims</h3>
                <div className="space-y-3">
                  {userClaims.map((claim) => (
                    <div key={claim.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">Restaurant #{claim.restaurant_id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(claim.created_at).toLocaleDateString('nl-NL')}
                        </p>
                      </div>
                      <Badge variant={claim.status === 'verified' ? 'default' : 'secondary'}>
                        {claim.status === 'verified' ? 'Geverifieerd' : 
                         claim.status === 'phone_verified' ? 'Telefoon Geverifieerd' :
                         claim.status === 'email_verified' ? 'E-mail Geverifieerd' :
                         claim.status === 'pending' ? 'In Afwachting' : claim.status}
                      </Badge>
                    </div>
                  ))}
                </div>
                {!canCreateClaim && (
                  <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <div className="flex items-center gap-2 text-yellow-600 text-sm">
                      <AlertCircle className="h-4 w-4" />
                      <span>Je hebt het maximum aantal onverifieerde claims bereikt.</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="max-w-xl mx-auto"
        >
          {!user ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">Log eerst in</h2>
              <p className="text-muted-foreground mb-6">
                Je moet ingelogd zijn om je restaurant te claimen.
              </p>
              <Link to="/login">
                <Button size="lg">Inloggen of registreren</Button>
              </Link>
            </div>
          ) : showPhoneVerification ? (
            <div className="bg-card border border-border rounded-xl p-8 space-y-6">
              <div className="text-center">
                <Phone className="w-12 h-12 text-primary mx-auto mb-3" />
                <h2 className="text-2xl font-bold mb-2">Verifieer je telefoonnummer</h2>
                <p className="text-muted-foreground text-sm">
                  We sturen een SMS met een 6-cijferige code naar je telefoon.
                </p>
              </div>

              {!codeSent ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefoonnummer</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+31 6 12345678"
                    />
                    <p className="text-xs text-muted-foreground">
                      Voer je nummer in met landcode (+31) of zonder voorloop 0
                    </p>
                  </div>
                  <Button onClick={handleSendCode} className="w-full" disabled={sendingCode}>
                    {sendingCode ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verzenden...
                      </>
                    ) : (
                      'Stuur verificatiecode'
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Verificatiecode</Label>
                    <Input
                      id="code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="text-center text-2xl tracking-widest"
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Voer de 6-cijferige code in die je per SMS hebt ontvangen
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setCodeSent(false)} className="flex-1">
                      Opnieuw sturen
                    </Button>
                    <Button onClick={handleVerifyCode} className="flex-1" disabled={verifyingCode}>
                      {verifyingCode ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Verifiëren...
                        </>
                      ) : (
                        'Verifieer'
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <Button 
                variant="ghost" 
                className="w-full" 
                onClick={() => {
                  setShowPhoneVerification(false);
                  setCodeSent(false);
                }}
              >
                Annuleren
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Search Section */}
              <div className="bg-card border border-border rounded-xl p-8">
                <h2 className="text-2xl font-bold text-center mb-2">Zoek je restaurant</h2>
                <p className="text-muted-foreground text-center text-sm mb-6">
                  We gebruiken Google om je restaurant te vinden en de gegevens automatisch in te vullen.
                </p>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="searchQuery">Restaurantnaam</Label>
                    <Input
                      id="searchQuery"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Bijv. De Kas, Restaurant Blauw..."
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="searchCity">Stad (optioneel)</Label>
                    <Input
                      id="searchCity"
                      value={searchCity}
                      onChange={(e) => setSearchCity(e.target.value)}
                      placeholder="Amsterdam, Rotterdam, Utrecht..."
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                  </div>

                  <Button 
                    onClick={handleSearch} 
                    className="w-full" 
                    disabled={isSearching || !canCreateClaim}
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Zoeken...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        Zoek restaurant
                      </>
                    )}
                  </Button>
                </div>

                {/* Search Results */}
                <AnimatePresence>
                  {searchResults.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-6 space-y-3"
                    >
                      <p className="text-sm font-medium text-muted-foreground">
                        {searchResults.length} resultaten gevonden - selecteer je restaurant:
                      </p>
                      {searchResults.map((place) => (
                        <motion.button
                          key={place.place_id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          onClick={() => handleSelectPlace(place)}
                          className="w-full text-left p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold truncate">{place.name}</h4>
                                {place.is_local && (
                                  <Badge variant="secondary" className="text-xs">
                                    In database
                                  </Badge>
                                )}
                                {place.claim_status === 'claimed_unverified' && (
                                  <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
                                    Claim pending
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{place.address}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {place.rating && (
                                <span className="flex items-center gap-1 text-sm">
                                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                  {place.rating}
                                </span>
                              )}
                              <span className="text-sm text-muted-foreground">
                                {priceLabels[place.price_level - 1] || '€€'}
                              </span>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </motion.div>
                  )}

                  {hasSearched && searchResults.length === 0 && !isSearching && !selectedPlace && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-6 text-center text-muted-foreground"
                    >
                      Geen restaurants gevonden. Probeer een andere zoekopdracht.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Selected Place & Claim Form */}
              <AnimatePresence>
                {selectedPlace && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-8 space-y-6">
                      <div className="text-center">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                        <h2 className="text-2xl font-bold mb-1">Restaurant gevonden!</h2>
                        <p className="text-muted-foreground text-sm">
                          Controleer de gegevens en vul het formulier aan om te claimen.
                        </p>
                      </div>

                      {/* Restaurant Preview */}
                      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                        <h3 className="font-bold text-lg">{selectedPlace.name}</h3>
                        
                        <div className="grid gap-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-4 h-4 flex-shrink-0" />
                            <span>{selectedPlace.address}</span>
                          </div>
                          
                          {selectedPlace.phone && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="w-4 h-4 flex-shrink-0" />
                              <span>{selectedPlace.phone}</span>
                            </div>
                          )}
                          
                          {selectedPlace.website && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Globe className="w-4 h-4 flex-shrink-0" />
                              <a 
                                href={selectedPlace.website} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline truncate"
                              >
                                {selectedPlace.website}
                              </a>
                            </div>
                          )}
                          
                          {selectedPlace.opening_hours && selectedPlace.opening_hours.length > 0 && (
                            <div className="flex items-start gap-2 text-muted-foreground">
                              <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <div className="text-xs space-y-0.5">
                                {selectedPlace.opening_hours.slice(0, 3).map((hours, i) => (
                                  <div key={i}>{hours}</div>
                                ))}
                                {selectedPlace.opening_hours.length > 3 && (
                                  <div className="text-muted-foreground/60">...</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-4 pt-2 border-t border-border">
                          {selectedPlace.rating && (
                            <span className="flex items-center gap-1 text-sm">
                              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                              {selectedPlace.rating} ({selectedPlace.review_count} reviews)
                            </span>
                          )}
                          <span className="text-sm">
                            {priceLabels[selectedPlace.price_level - 1] || '€€'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="role">Jouw rol *</Label>
                        <Input 
                          id="role" 
                          name="role" 
                          required 
                          placeholder="Bijv. Eigenaar, Manager, Marketing" 
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="notes">Extra informatie (optioneel)</Label>
                        <Textarea 
                          id="notes" 
                          name="notes" 
                          placeholder="Vertel ons hoe we kunnen verifiëren dat je bij dit restaurant hoort..."
                          rows={3}
                        />
                      </div>

                      {/* Proof Documents Upload */}
                      <div className="space-y-3">
                        <Label>Bewijsdocumenten (optioneel)</Label>
                        <p className="text-sm text-muted-foreground">
                          Upload documenten om te bewijzen dat je bij dit restaurant hoort. Bijvoorbeeld: KVK-uittreksel, 
                          huurcontract, visitekaartje of andere officiële documenten.
                        </p>
                        
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          multiple
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full border-dashed"
                          disabled={proofFiles.length >= 5}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {proofFiles.length >= 5 ? 'Maximum bereikt (5 bestanden)' : 'Upload KVK of ander bewijs'}
                        </Button>
                        
                        {proofFiles.length > 0 && (
                          <div className="space-y-2">
                            {proofFiles.map((file, index) => (
                              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                  <span className="text-sm truncate">{file.name}</span>
                                  <span className="text-xs text-muted-foreground flex-shrink-0">
                                    ({(file.size / 1024 / 1024).toFixed(1)} MB)
                                  </span>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFile(index)}
                                  className="h-8 w-8 p-0 flex-shrink-0"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <p className="text-xs text-muted-foreground">
                          Toegestaan: PDF, JPG, PNG, WEBP • Max 10MB per bestand • Max 5 bestanden
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => {
                            setSelectedPlace(null);
                            setSearchResults([]);
                          }}
                        >
                          Andere zoeken
                        </Button>
                        <Button type="submit" className="flex-1" disabled={isSubmitting || isUploadingFiles}>
                          {isSubmitting || isUploadingFiles ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {isUploadingFiles ? 'Bestanden uploaden...' : 'Verzenden...'}
                            </>
                          ) : (
                            'Claim aanvragen'
                          )}
                        </Button>
                      </div>

                      <p className="text-xs text-muted-foreground text-center">
                        Door te claimen ga je akkoord met onze{' '}
                        <Link to="/terms" className="text-primary hover:underline">voorwaarden</Link>.
                        <br />
                        <span className="text-primary/80">Claimen geeft geen directe controle tot verificatie.</span>
                      </p>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
