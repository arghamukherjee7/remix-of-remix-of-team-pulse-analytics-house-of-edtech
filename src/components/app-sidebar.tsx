import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, CalendarCheck, UserPlus, DollarSign, Layers,
  Target, PhoneCall, TrendingUp, CalendarRange, FileBarChart, Users, Settings,
  LogOut,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const sections = [
  {
    label: "Analytics",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Team Performance", url: "/team-performance", icon: TrendingUp },
      { title: "Batch Analytics", url: "/batches", icon: Layers },
      { title: "Reports", url: "/reports", icon: FileBarChart },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Attendance", url: "/attendance", icon: CalendarCheck },
      { title: "Lead Assignment", url: "/leads", icon: UserPlus },
      { title: "Revenue", url: "/revenue", icon: DollarSign },
      { title: "KPI Monitoring", url: "/kpi", icon: PhoneCall },
      { title: "Weekly Targets", url: "/targets", icon: Target },
      { title: "Monthly Targets", url: "/monthly-targets", icon: Target },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Billing Cycles", url: "/billing-cycles", icon: CalendarRange },
      { title: "Team Members", url: "/team-members", icon: Users },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { user, roles, signOut } = useAuth();
  const isActive = (url: string) => path === url || path.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground font-bold">
            T
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">TeamPulse</span>
              <span className="text-[11px] text-sidebar-foreground/60">Analytics Suite</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            {!collapsed && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && user && (
          <div className="mb-2 px-2">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{user.email}</p>
            <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
              {roles.join(" · ") || "team member"}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sign out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
