import { Layout } from '@/components/layout/Layout';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, TrendingUp, MessageSquare, BarChart3, Search, MapPin, Phone, Globe, Loader2, Shield, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ClaimStatusBadge } from '@/components/claims/ClaimStatusBadge';
import { VerificationRequiredDialog } from '@/components/claims/VerificationRequiredDialog';
import { useRestaurantClaims } from '@/hooks/useRestaurantClaims';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { SEOHead } from '@/components/seo/SEOHead';

// Search results come from our own database only (google-places-search with includeGoogle: false).
interface GooglePlaceResult {
  place_id: string;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  price_level: number;
  // Local database fields
  is_local?: boolean;
  restaurant_id?: string;
  claim_status?: string;
}

export default function ClaimPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  
  // Resolve claim-limit boolean (canCreateClaim from the hook is an async function).
  const [canClaim, setCanClaim] = useState(true);
  useEffect(() => {
    let active = true;
    if (!user) {
      setCanClaim(true);
      return;
    }
    canCreateClaim().then((allowed) => {
      if (active) setCanClaim(allowed);
    }).catch(() => {
      if (active) setCanClaim(true);
    });
    return () => { active = false; };
  }, [user, userClaims, canCreateClaim]);

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
        body: { query: searchQuery, city: searchCity || undefined, includeGoogle: false }
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

    if (!canClaim) {
      toast.error('Je hebt het maximum aantal claims bereikt. Verifieer eerst een bestaande claim.');
      return;
    }

    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const role = formData.get('role') as string;
    const notes = formData.get('notes') as string;

    try {
      // Claims only attach to restaurants already on Dishloopr. New restaurants go through
      // /add-restaurant, where the owner enters the details themselves: Google Places content
      // may not be copied into our database (docs/google-places-compliance.md).
      if (!selectedPlace.is_local || !selectedPlace.restaurant_id) {
        toast.info('Dit restaurant staat nog niet op Dishloopr. Voeg het toe als nieuw restaurant.');
        setIsSubmitting(false);
        navigate('/add-restaurant');
        return;
      }

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

      const restaurantId = existingRestaurant?.id;
      if (!restaurantId) {
        toast.error('Restaurant niet gevonden. Probeer opnieuw te zoeken.');
        setIsSubmitting(false);
        return;
      }

      await supabase
        .from('restaurants')
        .update({ claim_status: 'claimed_unverified' })
        .eq('id', restaurantId);

      // Continue in the two-route verification flow (business e-mail or manual proof)
      const { data: target } = await supabase
        .from('restaurants')
        .select('slug')
        .eq('id', restaurantId)
        .maybeSingle();
      if (target?.slug) {
        navigate(`/claim/${target.slug}`);
      } else {
        toast.error('Restaurant niet gevonden.');
      }

    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Er ging iets mis. Probeer het opnieuw.');
    } finally {
      setIsSubmitting(false);
    }
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

  const priceLabels = ['€', '€€', '€€€', '€€€€'];

  return (
    <Layout>
      <SEOHead
        title="Claim je restaurant | Dishloopr"
        description="Neem de controle over je Dishloopr-profiel: claim je restaurant, beheer info en foto's en bereik meer gasten."
        noindex
      />
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
                    Zoek je restaurant en kies daarna een van twee routes. <strong>Direct:</strong> we sturen een code naar je zakelijke e-mailadres op het domein van je website. <strong>Handmatig:</strong> upload een KvK-uittreksel of een foto van een factuur of menukaart; wij controleren binnen 2 werkdagen.
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
                {!canClaim && (
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
                    disabled={isSearching || !canClaim}
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
                      Geen restaurants gevonden. Staat je restaurant nog niet op Dishloopr?{' '}
                      <Link to="/add-restaurant" className="text-primary hover:underline">Voeg het toe</Link>.
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
                          
                        </div>

                        <div className="flex items-center gap-4 pt-2 border-t border-border">
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

                      <p className="text-sm text-muted-foreground text-center">
                        Op de volgende pagina kies je hoe je wilt verifiëren — direct via je zakelijke
                        e-mailadres, of handmatig met een bewijsdocument (KvK-uittreksel, factuur of menukaart).
                      </p>

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
                        <Button type="submit" className="flex-1" disabled={isSubmitting}>
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Verzenden...
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
