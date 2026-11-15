import {
  LayoutDashboard,
  Store,
  UtensilsCrossed,
  MessageSquare,
  CalendarCheck,
  BarChart3,
  Rocket,
  Settings,
  Lock,
  LifeBuoy,
  type LucideIcon,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { OWNER_TABS, type OwnerTab } from '@/lib/ownerTabs';

export interface OwnerSidebarProps {
  activeTab: string;
  onChange: (tab: OwnerTab) => void;
  isVerified: boolean;
  unansweredReviews?: number;
  onOpenHelp: () => void;
}

const ICONS: Record<OwnerTab, LucideIcon> = {
  overview: LayoutDashboard,
  profile: Store,
  menu: UtensilsCrossed,
  reviews: MessageSquare,
  reservations: CalendarCheck,
  insights: BarChart3,
  promotions: Rocket,
  settings: Settings,
};

export function OwnerSidebar({ activeTab, onChange, isVerified, unansweredReviews = 0, onOpenHelp }: OwnerSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar
      collapsible="icon"
      className="border-r !top-14 md:!top-16 !h-[calc(100svh-3.5rem)] md:!h-[calc(100svh-4rem)]"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {OWNER_TABS.map((section) => {
                const Icon = ICONS[section.id];
                const isActive = activeTab === section.id;
                // Visual hint only: the section itself shows the verification step or Pro paywall.
                const showLockHint = section.requiresVerified && !isVerified;
                const badge = section.id === 'reviews' && unansweredReviews > 0 ? unansweredReviews : 0;
                return (
                  <SidebarMenuItem key={section.id}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={collapsed ? section.label : undefined}>
                      <button
                        type="button"
                        onClick={() => onChange(section.id)}
                        className="flex w-full items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate">{section.label}</span>
                            {badge > 0 && (
                              <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground" aria-label={`${badge} onbeantwoord`}>
                                {badge}
                              </span>
                            )}
                            {showLockHint && <Lock className="h-3 w-3 opacity-60" aria-label="Na verificatie" />}
                          </>
                        )}
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {collapsed ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Hulp en contact" onClick={onOpenHelp}>
                <LifeBuoy className="h-4 w-4" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <div className="rounded-lg border bg-card p-3 space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold"><LifeBuoy className="h-4 w-4 text-primary" />Hulp nodig?</p>
            <p className="text-xs text-muted-foreground">Vraag, fout melden of klacht. We reageren meestal binnen 1 werkdag.</p>
            <Button variant="outline" size="sm" className="w-full min-h-10" onClick={onOpenHelp}>Neem contact op</Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
