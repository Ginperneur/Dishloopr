import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Eye, 
  MousePointer, 
  Phone, 
  Globe, 
  Calendar,
  Star,
  MessageSquare,
  TrendingUp,
  Store,
  ExternalLink
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useOwnerDashboard } from '@/hooks/useOwnerDashboard';
import { toast } from 'sonner';

function StatCard({ title, value, icon: Icon, trend }: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType;
  trend?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {trend && (
              <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3" />
                {trend}
              </p>
            )}
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewCard({ review, onRespond }: { 
  review: any; 
  onRespond: (reviewId: string, response: string) => Promise<boolean>;
}) {
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [response, setResponse] = useState(review.owner_response || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    const success = await onRespond(review.id, response);
    if (success) {
      toast.success('Reactie geplaatst');
      setShowResponseForm(false);
    } else {
      toast.error('Kon reactie niet plaatsen');
    }
    setSubmitting(false);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-semibold">{review.profile?.name || 'Anoniem'}</p>
            <p className="text-sm text-muted-foreground">
              {new Date(review.created_at).toLocaleDateString('nl-NL')}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${
                  i < review.rating ? 'fill-rating text-rating' : 'text-muted-foreground'
                }`}
              />
            ))}
          </div>
        </div>

        {review.title && <h4 className="font-medium mb-1">{review.title}</h4>}
        {review.body && <p className="text-muted-foreground mb-3">{review.body}</p>}

        <Badge variant={review.status === 'published' ? 'default' : 'secondary'}>
          {review.status === 'published' ? 'Gepubliceerd' : review.status === 'pending' ? 'In afwachting' : 'Gemarkeerd'}
        </Badge>

        {review.owner_response ? (
          <div className="mt-4 p-3 rounded-lg bg-muted border-l-2 border-primary">
            <p className="text-sm font-medium mb-1">Jouw reactie</p>
            <p className="text-sm text-muted-foreground">{review.owner_response}</p>
          </div>
        ) : (
          <div className="mt-4">
            {showResponseForm ? (
              <div className="space-y-3">
                <Textarea
                  placeholder="Schrijf een reactie op deze review..."
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button onClick={handleSubmit} disabled={submitting || !response.trim()}>
                    {submitting ? 'Plaatsen...' : 'Reactie plaatsen'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowResponseForm(false)}>
                    Annuleren
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowResponseForm(true)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Reageren
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OwnerDashboard() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const {
    restaurants,
    selectedRestaurant,
    setSelectedRestaurant,
    reviews,
    analytics,
    loading,
    respondToReview
  } = useOwnerDashboard();

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-muted rounded" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (restaurants.length === 0) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Store className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Geen restaurants gevonden</h1>
          <p className="text-muted-foreground mb-6">
            Je hebt nog geen restaurants geclaimd. Claim je restaurant om toegang te krijgen tot het dashboard.
          </p>
          <Button asChild>
            <Link to="/search">Zoek je restaurant</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-1">Owner Dashboard</h1>
              <p className="text-muted-foreground">Beheer je restaurant en bekijk statistieken</p>
            </div>

            {restaurants.length > 1 && (
              <Select
                value={selectedRestaurant?.id}
                onValueChange={(id) => {
                  const restaurant = restaurants.find(r => r.id === id);
                  if (restaurant) setSelectedRestaurant(restaurant);
                }}
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Selecteer restaurant" />
                </SelectTrigger>
                <SelectContent>
                  {restaurants.map(restaurant => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedRestaurant && (
            <div className="mt-4 flex items-center gap-4">
              <Badge variant="outline" className="text-sm">
                {selectedRestaurant.name}
              </Badge>
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/restaurant/${selectedRestaurant.slug}`}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Bekijk pagina
                </Link>
              </Button>
            </div>
          )}
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          <StatCard
            title="Profielweergaven"
            value={analytics?.totalViews || 0}
            icon={Eye}
            trend="Laatste 30 dagen"
          />
          <StatCard
            title="Totale clicks"
            value={analytics?.totalClicks || 0}
            icon={MousePointer}
          />
          <StatCard
            title="Website clicks"
            value={analytics?.websiteClicks || 0}
            icon={Globe}
          />
          <StatCard
            title="Telefoon clicks"
            value={analytics?.phoneClicks || 0}
            icon={Phone}
          />
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="reviews" className="space-y-6">
          <TabsList>
            <TabsTrigger value="reviews">
              Reviews ({reviews.length})
            </TabsTrigger>
            <TabsTrigger value="analytics">
              Analytics
            </TabsTrigger>
            <TabsTrigger value="settings">
              Instellingen
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reviews" className="space-y-4">
            {reviews.length > 0 ? (
              reviews.map(review => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onRespond={respondToReview}
                />
              ))
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nog geen reviews ontvangen</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Weergaven per dag (laatste 30 dagen)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics?.viewsByDay && analytics.viewsByDay.length > 0 ? (
                  <div className="h-64 flex items-end gap-1">
                    {analytics.viewsByDay.map((day, i) => {
                      const maxCount = Math.max(...analytics.viewsByDay.map(d => d.count));
                      const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                      return (
                        <div
                          key={day.date}
                          className="flex-1 bg-primary/80 hover:bg-primary transition-colors rounded-t"
                          style={{ height: `${Math.max(height, 5)}%` }}
                          title={`${day.date}: ${day.count} weergaven`}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-12">
                    Nog geen analytics data beschikbaar
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">CTA Conversies</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reserveringen</span>
                    <span className="font-semibold">{analytics?.reservationClicks || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Website bezoeken</span>
                    <span className="font-semibold">{analytics?.websiteClicks || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Telefoongesprekken</span>
                    <span className="font-semibold">{analytics?.phoneClicks || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Review Statistieken</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Totaal reviews</span>
                    <span className="font-semibold">{selectedRestaurant?.review_count || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gemiddelde rating</span>
                    <span className="font-semibold flex items-center gap-1">
                      <Star className="h-4 w-4 fill-rating text-rating" />
                      {Number(selectedRestaurant?.rating || 0).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Beantwoord</span>
                    <span className="font-semibold">
                      {reviews.filter(r => r.owner_response).length} / {reviews.length}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Restaurant Instellingen</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Neem contact op met ons team om je restaurantgegevens bij te werken.
                </p>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted">
                    <h4 className="font-semibold mb-2">Featured Listing</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Verhoog je zichtbaarheid met een featured listing.
                    </p>
                    <Badge variant={selectedRestaurant?.is_featured ? 'default' : 'secondary'}>
                      {selectedRestaurant?.is_featured ? 'Actief' : 'Niet actief'}
                    </Badge>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <h4 className="font-semibold mb-2">Top Listing</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Verschijn bovenaan in zoekresultaten.
                    </p>
                    <Badge variant={selectedRestaurant?.is_top_listing ? 'default' : 'secondary'}>
                      {selectedRestaurant?.is_top_listing ? 'Actief' : 'Niet actief'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
