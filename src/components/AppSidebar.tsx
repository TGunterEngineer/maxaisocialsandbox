import {
  Inbox,
  PenSquare,
  CalendarDays,
  Sparkles,
  Zap,
  Shield,
  LogOut,
  BarChart3,
  Users,
  Send,
  MessageSquareWarning,
  Lightbulb,
  MapPin,
  UserPlus,
  Palette,
  Webhook,
  CreditCard,
  ShieldCheck,
  Star,
  Lock,
  LifeBuoy,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { SubscriptionBadge } from "@/components/SubscriptionBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useUsage } from "@/hooks/useUsage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { planIncludes, minTierFor, type FeatureKey } from "@/lib/planFeatures";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  url: string;
  icon: typeof Inbox;
  feature: FeatureKey;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "AI Showcase",
    items: [
      { title: "AI Lab", url: "/ai-lab", icon: Sparkles, feature: "ai_insights" },
      { title: "About this Demo", url: "/about-this-demo", icon: LifeBuoy, feature: "ai_insights" },
    ],
  },
  {
    label: "Monitor",
    items: [
      { title: "Unified Inbox", url: "/dashboard", icon: Inbox, feature: "inbox" },
      { title: "Analytics", url: "/analytics", icon: BarChart3, feature: "analytics" },
      { title: "Review Sources", url: "/review-sources", icon: Star, feature: "review_sources" },
      { title: "AI Insights", url: "/insights", icon: Lightbulb, feature: "ai_insights" },
    ],
  },
  {
    label: "Engage",
    items: [
      { title: "Contacts", url: "/contacts", icon: Users, feature: "contacts" },
      { title: "Campaigns", url: "/campaigns", icon: Send, feature: "campaigns" },
      { title: "Feedback", url: "/feedback", icon: MessageSquareWarning, feature: "feedback" },
    ],
  },
  {
    label: "Grow",
    items: [
      { title: "Post Creator", url: "/posts", icon: PenSquare, feature: "post_creator" },
      { title: "Content Calendar", url: "/calendar", icon: CalendarDays, feature: "content_calendar" },
      { title: "Brand Voice", url: "/brand", icon: Sparkles, feature: "brand_voice" },
      { title: "Locations", url: "/locations", icon: MapPin, feature: "locations" },
    ],
  },
  {
    label: "Admin",
    items: [
      { title: "Team", url: "/team", icon: UserPlus, feature: "team" },
      { title: "Branding", url: "/branding", icon: Palette, feature: "branding" },
      { title: "Webhooks", url: "/webhooks", icon: Webhook, feature: "webhooks" },
      { title: "SMS Compliance", url: "/sms-compliance", icon: ShieldCheck, feature: "sms_compliance" },
      
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const { usage } = useUsage();
  const planTier = usage?.plan_tier ?? null;

  const { data: isAdmin } = useQuery({
    queryKey: ["is_admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" });
      return !!data;
    },
    enabled: !!user,
  });

  // Show all groups; mark items the tier doesn't unlock as locked.
  const visibleGroups = NAV_GROUPS;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="flex items-center gap-2.5 px-4 py-5">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
            <Zap className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold tracking-tight text-sidebar-foreground truncate">
                  Maximum Social
                </span>
                {user && <SubscriptionBadge />}
              </div>
              <span className="text-[10px] text-sidebar-foreground uppercase tracking-wider">
                Reputation Suite
              </span>
            </div>
          )}
          {collapsed && user && (
            <div className="absolute -right-0.5 -top-0.5">
              <SubscriptionBadge collapsed />
            </div>
          )}
        </div>

        {!collapsed && user && (
          <div className="px-3 pb-2">
            <OrgSwitcher />
          </div>
        )}

        {visibleGroups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-wider">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const unlocked = true; // Demo mode: all features unlocked
                  if (unlocked) {
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            end={item.url === "/dashboard"}
                            className="hover:bg-sidebar-accent"
                            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                          >
                            <item.icon className="mr-2 h-4 w-4" />
                            {!collapsed && <span>{item.title}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }
                  // Locked: show item, route click to /pricing with context
                  const tier = minTierFor(item.feature);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton asChild>
                            <Link
                              to="/pricing"
                              state={{ gatedFeature: item.feature, requiredTier: tier }}
                              className="hover:bg-sidebar-accent text-muted-foreground"
                            >
                              <item.icon className="mr-2 h-4 w-4 opacity-60" />
                              {!collapsed && (
                                <span className="flex items-center gap-1.5 flex-1">
                                  <span className="opacity-70">{item.title}</span>
                                  <Lock className="h-3 w-3 ml-auto opacity-60" />
                                </span>
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          Requires <span className="capitalize font-medium">{tier}</span> plan
                        </TooltipContent>
                      </Tooltip>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {isAdmin && (
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-wider">
                Internal
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/super-admin"
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Super Admin</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="gap-1">
        <div className={collapsed ? "flex justify-center pb-2" : "flex items-center justify-between px-2 pb-2"}>
          {!collapsed && (
            <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground">Theme</span>
          )}
          <ThemeToggle />
        </div>
        {user && (
          <>
            <NavLink
              to="/billing"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
              activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
            >
              <CreditCard className="h-4 w-4" />
              {!collapsed && <span>Billing</span>}
            </NavLink>
            <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-2">
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sign Out</span>}
            </Button>
            {!collapsed && (
              <div className="mt-2 px-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                <a href="mailto:support@maximumaiconsulting.com" className="hover:text-foreground flex items-center gap-1">
                  <LifeBuoy className="h-3 w-3" />
                  Support
                </a>
                <a href="/terms" target="_blank" rel="noreferrer" className="hover:text-foreground">Terms</a>
                <a href="/privacy" target="_blank" rel="noreferrer" className="hover:text-foreground">Privacy</a>
                <a href="/refunds" target="_blank" rel="noreferrer" className="hover:text-foreground">Refunds</a>
              </div>
            )}
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
