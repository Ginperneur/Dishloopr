import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Megaphone,
  TrendingUp,
  Receipt,
  Lock,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';

export interface OwnerSidebarProps {
  activeTab: string;
  onChange: (tab: string) => void;
  isVerified: boolean;
}

const sections = [
  { id: 'overview', label: 'Overzicht', icon: LayoutDashboard, requiresVerified: false },
  { id: 'content', label: 'Content', icon: FileText, requiresVerified: false },
  { id: 'insights', label: 'Inzichten', icon: BarChart3, requiresVerified: true },
  { id: 'marketing', label: 'Marketing', icon: Megaphone, requiresVerified: false },
  { id: 'market', label: 'Markt', icon: TrendingUp, requiresVerified: true },
  { id: 'invoices', label: 'Facturen', icon: Receipt, requiresVerified: false },
];

export function OwnerSidebar({ activeTab, onChange, isVerified }: OwnerSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar
      collapsible="icon"
      className="border-r !top-14 md:!top-16 !h-[calc(100svh-3.5rem)] md:!h-[calc(100svh-4rem)]"
    >
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Dashboard</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {sections.map((section) => {
                const isActive = activeTab === section.id;
                // Visual hint only — the destination page itself shows the
                // appropriate gate (verification flow or Pro paywall) so the
                // owner can always click through and learn what's behind it.
                const showLockHint = section.requiresVerified && !isVerified;
                return (
                  <SidebarMenuItem key={section.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={collapsed ? section.label : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => onChange(section.id)}
                        className={cn(
                          'flex items-center gap-2 w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-md',
                        )}
                        aria-label={section.label}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <section.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate">{section.label}</span>
                            {showLockHint && <Lock className="h-3 w-3 opacity-60" />}
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
    </Sidebar>
  );
}