import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import '@/i18n';
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ErrorBoundary } from "@/components/errors/ErrorBoundary";
import Index from "./pages/Index";
import SearchPage from "./pages/SearchPage";
import RestaurantPage from "./pages/RestaurantPage";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import EmailConfirmPage from "./pages/EmailConfirmPage";
import OwnerDashboard from "./pages/OwnerDashboard";
import AdminPanel from "./pages/AdminPanel";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import ClaimPage from "./pages/ClaimPage";
import FavoritesPage from "./pages/FavoritesPage";
import ProfilePage from "./pages/ProfilePage";
import AccountPage from "./pages/AccountPage";
import InsightsPage from "./pages/InsightsPage";
import CollectionsPage from "./pages/CollectionsPage";
import CollectionPage from "./pages/CollectionPage";
import DishCityPage from "./pages/DishCityPage";
import DishCityIndexPage from "./pages/DishCityIndexPage";
import NotFound from "./pages/NotFound";
import ForRestaurantsPage from "./pages/ForRestaurantsPage";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <ThemeProvider defaultTheme="system" storageKey="dishloopr-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
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
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/claim" element={<ClaimPage />} />
                <Route path="/for-restaurants" element={<ForRestaurantsPage />} />
                <Route path="/favorites" element={<FavoritesPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/insights" element={<InsightsPage />} />
                <Route path="/collections" element={<CollectionsPage />} />
                <Route path="/collection/:slug" element={<CollectionPage />} />
                <Route path="/eten" element={<DishCityIndexPage />} />
                <Route path="/eten/:slug" element={<DishCityPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
