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
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Dashboard</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {sections.map((section) => {
                const isActive = activeTab === section.id;
                const locked = section.requiresVerified && !isVerified;
                return (
                  <SidebarMenuItem key={section.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={collapsed ? section.label : undefined}
                    >
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => !locked && onChange(section.id)}
                        className={cn(
                          'flex items-center gap-2 w-full text-left',
                          locked && 'opacity-50 cursor-not-allowed',
                        )}
                        aria-label={section.label}
                      >
                        <section.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate">{section.label}</span>
                            {locked && <Lock className="h-3 w-3 opacity-60" />}
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