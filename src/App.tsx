import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import '@/i18n';
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ErrorBoundary } from "@/components/errors/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingDialog } from "@/components/onboarding/OnboardingDialog";

// Eagerly load critical routes
import Index from "./pages/Index";
import SearchPage from "./pages/SearchPage";

// Lazy load all other routes
const RestaurantPage = lazy(() => import("./pages/RestaurantPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const EmailConfirmPage = lazy(() => import("./pages/EmailConfirmPage"));
const OwnerDashboard = lazy(() => import("./pages/OwnerDashboard"));
const FoodieDashboard = lazy(() => import("./pages/FoodieDashboard"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const ClaimPage = lazy(() => import("./pages/ClaimPage"));
const FavoritesPage = lazy(() => import("./pages/FavoritesPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const InsightsPage = lazy(() => import("./pages/InsightsPage"));
const CollectionsPage = lazy(() => import("./pages/CollectionsPage"));
const CollectionPage = lazy(() => import("./pages/CollectionPage"));
const DishCityPage = lazy(() => import("./pages/DishCityPage"));
const DishCityIndexPage = lazy(() => import("./pages/DishCityIndexPage"));
const DishPillarPage = lazy(() => import("./pages/DishPillarPage"));
const CityIndexPage = lazy(() => import("./pages/CityIndexPage"));
const CityDetailPage = lazy(() => import("./pages/CityDetailPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ForRestaurantsPage = lazy(() => import("./pages/ForRestaurantsPage"));
const AddRestaurantPage = lazy(() => import("./pages/AddRestaurantPage"));
const EventsPage = lazy(() => import("./pages/EventsPage"));

// Page loading fallback
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="space-y-4 w-full max-w-md px-4">
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-4 w-64 mx-auto" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <ThemeProvider defaultTheme="system" storageKey="dishloopr-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <OnboardingDialog />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/restaurant/:slug" element={<RestaurantPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/email-confirm" element={<EmailConfirmPage />} />
                  <Route path="/owner" element={<OwnerDashboard />} />
                  <Route path="/dashboard" element={<OwnerDashboard />} />
                  <Route path="/owner-dashboard" element={<OwnerDashboard />} />
                  <Route path="/my-dashboard" element={<FoodieDashboard />} />
                  <Route path="/admin" element={<AdminPanel />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/claim" element={<ClaimPage />} />
                  <Route path="/for-restaurants" element={<ForRestaurantsPage />} />
                  <Route path="/add-restaurant" element={<AddRestaurantPage />} />
                  <Route path="/favorites" element={<FavoritesPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/account" element={<AccountPage />} />
                  <Route path="/insights" element={<InsightsPage />} />
                  <Route path="/collections" element={<CollectionsPage />} />
                  <Route path="/collection/:slug" element={<CollectionPage />} />
                  <Route path="/eten" element={<DishCityIndexPage />} />
                  <Route path="/eten/gerecht/:dishSlug" element={<DishPillarPage />} />
                  <Route path="/eten/:slug" element={<DishCityPage />} />
                  <Route path="/steden" element={<CityIndexPage />} />
                  <Route path="/steden/:citySlug" element={<CityDetailPage />} />
                  <Route path="/events" element={<EventsPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
