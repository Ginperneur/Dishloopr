import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { ADMIN_GROUPS, groupBadgeTotal, type AdminBadges } from './adminNav';

interface AdminSidebarProps {
  activeGroup: string;
  onGroupChange: (groupId: string) => void;
  badges: AdminBadges;
}

export function AdminSidebar({ activeGroup, onGroupChange, badges }: AdminSidebarProps) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === 'collapsed' && !isMobile;

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarContent className="py-2">
        {!collapsed && (
          <div className="px-4 py-3 mb-1 flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">Dishloopr</h2>
              <p className="text-[11px] text-muted-foreground">Admin</p>
            </div>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {ADMIN_GROUPS.map((group) => {
                const isActive = activeGroup === group.id;
                const count = groupBadgeTotal(group, badges);
                const Icon = group.icon;
                return (
                  <SidebarMenuItem key={group.id}>
                    <SidebarMenuButton
                      onClick={() => { onGroupChange(group.id); if (isMobile) setOpenMobile(false); }}
                      isActive={isActive}
                      tooltip={collapsed ? `${group.label}${count ? ` (${count})` : ''}` : undefined}
                      className={`relative h-10 transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="text-sm truncate">{group.label}</span>}
                      {count > 0 && !collapsed && (
                        <Badge variant="destructive" className="ml-auto h-5 min-w-[22px] px-1.5 text-[11px] font-bold">
                          {count}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Link
          to="/"
          className="flex items-center gap-2 rounded-md px-2 py-2 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Terug naar de site</span>}
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}
