import { useLocation } from 'react-router-dom';
import {
  TrendingUp, Crown, Users, Search, MapPin, AlertCircle, Shield,
  Store, UtensilsCrossed, Check, Sparkles,
  MessageSquare, FileText,
  Bell, Star,
  ShieldAlert, Image, Eye, Upload, Globe, Download, Zap, Clock, Settings, Inbox, Calendar
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  pendingReviews?: number;
  pendingClaims?: number;
}

const navGroups = [
  {
    label: 'Vandaag',
    items: [
      { id: 'today', label: 'Vandaag', icon: Inbox },
    ],
  },
  {
    label: 'Dashboard',
    items: [
      { id: 'kpi', label: "KPI's", icon: TrendingUp },
      { id: 'revenue', label: 'Omzet', icon: Crown },
      { id: 'user-insights', label: 'Gebruikersinzicht', icon: Users },
      { id: 'search-analytics', label: 'Zoek Analytics', icon: Search },
      { id: 'geographic', label: 'Dekking', icon: MapPin },
      { id: 'churn', label: 'Verlooprisico', icon: AlertCircle },
      { id: 'claim-analytics', label: 'Claim Analyse', icon: Shield },
    ],
  },
  {
    label: 'Content',
    items: [
      { id: 'restaurants', label: 'Restaurants', icon: Store },
      { id: 'dishes', label: 'Gerechten', icon: UtensilsCrossed },
      { id: 'dish-approval', label: 'Goedkeuring', icon: Check },
      { id: 'restaurant-dishes', label: 'Bekend Om', icon: UtensilsCrossed },
      { id: 'cities', label: 'Steden', icon: MapPin },
      { id: 'collections', label: 'Collecties', icon: Sparkles },
      { id: 'chains', label: 'Ketens', icon: Store },
    ],
  },
  {
    label: 'Gebruikers & Claims',
    items: [
      { id: 'reviews', label: 'Reviews', icon: MessageSquare, badgeKey: 'pendingReviews' as const },
      { id: 'users', label: 'Gebruikers', icon: Users },
      { id: 'roles', label: 'Rollen', icon: Crown },
      { id: 'claims', label: 'Claims', icon: FileText, badgeKey: 'pendingClaims' as const },
      { id: 'suggestions', label: 'Suggesties', icon: Inbox },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { id: 'sponsored', label: 'Sponsored', icon: Sparkles },
      { id: 'featured-slots', label: 'Featured', icon: Crown },
      { id: 'newsletter', label: 'Nieuwsbrief', icon: FileText },
      { id: 'restaurant-mail', label: 'Mail Restaurants', icon: FileText },
      { id: 'upgrade-reviews', label: 'Review-verzoeken', icon: MessageSquare },
      { id: 'seo', label: 'SEO Pages', icon: TrendingUp },
      { id: 'notifications', label: 'Notificaties', icon: Bell },
    ],
  },
  {
    label: 'Tools & Systeem',
    items: [
      { id: 'audit', label: 'Audit', icon: ShieldAlert },
      { id: 'ai-classify', label: 'AI Classificatie', icon: Sparkles },
      { id: 'broken-images', label: 'Kapotte afbeeldingen', icon: Image },
      { id: 'duplicates', label: 'Duplicaten', icon: AlertCircle },
      { id: 'completeness', label: 'Volledigheid', icon: Eye },
      { id: 'bulk-import', label: 'Import', icon: Upload },
      { id: 'menu-scraper', label: 'Menu Scraper', icon: Globe },
      { id: 'manual-menu', label: 'Handmatig Menu', icon: Upload },
      { id: 'empty-dishes', label: '0 Gerechten', icon: AlertCircle },
      { id: 'discovery', label: 'Discovery', icon: Search },
      { id: 'geocode', label: 'Geocode', icon: MapPin },
      { id: 'google-enrich', label: 'Google Verrijking', icon: Star },
      { id: 'reservation-detect', label: 'Reserveringslinks', icon: Calendar },
      { id: 'photos', label: "Foto's", icon: Image },
      { id: 'data-export', label: 'Export', icon: Download },
      { id: 'seo-health', label: 'SEO Health', icon: Globe },
      { id: 'bulk-actions', label: 'Bulk Acties', icon: Zap },
      { id: 'audit-trail', label: 'Audit Trail', icon: Clock },
      { id: 'error-logs', label: 'Error Logs', icon: AlertCircle },
      { id: 'activity', label: 'Activiteit', icon: Settings },
      { id: 'rate-limits', label: 'API Bescherming', icon: ShieldAlert },
      { id: 'settings', label: 'Instellingen', icon: Settings },
    ],
  },
];

export function AdminSidebar({ activeSection, onSectionChange, pendingReviews = 0, pendingClaims = 0 }: AdminSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const badges: Record<string, number> = {
    pendingReviews,
    pendingClaims,
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarContent className="py-2">
        {/* Logo area */}
        {!collapsed && (
          <div className="px-4 py-3 mb-2">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <div>
                <h2 className="text-sm font-bold tracking-tight">Admin Panel</h2>
                <p className="text-[10px] text-muted-foreground">Dishloopr Platform</p>
              </div>
            </div>
          </div>
        )}

        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = activeSection === item.id;
                  const badgeCount = (item as any).badgeKey ? badges[(item as any).badgeKey] : 0;

                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => onSectionChange(item.id)}
                        className={`relative transition-colors ${
                          isActive
                            ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary'
                            : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                        }`}
                        tooltip={collapsed ? item.label : undefined}
                      >
                        <item.icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : ''}`} />
                        {!collapsed && (
                          <span className="text-xs truncate">{item.label}</span>
                        )}
                        {badgeCount > 0 && (
                          <Badge
                            variant="destructive"
                            className="ml-auto h-5 min-w-[20px] px-1 text-[10px] font-bold"
                          >
                            {badgeCount}
                          </Badge>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
