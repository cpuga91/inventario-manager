"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ArrowRightLeft,
  Tag,
  Brain,
  Settings,
  DollarSign,
  ChevronLeft,
  LogOut,
  Bell,
  Search,
  Menu,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface AuthUser {
  name?: string | null;
  email: string;
  role: string;
}

interface AuthTenant {
  name: string;
  wizardComplete?: boolean;
}

interface AppShellContext {
  user: AuthUser;
  tenant: AuthTenant;
}

const AppContext = createContext<AppShellContext | null>(null);

export function useAppShell() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppShell must be used within AppShell");
  return ctx;
}

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/transfers", label: "Transfers", icon: ArrowRightLeft },
  { href: "/discounts", label: "Discounts", icon: Tag },
  { href: "/cogs", label: "COGS", icon: DollarSign },
  { href: "/ai-insights", label: "AI Insights", icon: Brain },
  { href: "/settings", label: "Settings", icon: Settings },
];

function SidebarContent({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b">
        <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-bold text-sm shrink-0">
            A
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm truncate">
              Adagio
            </span>
          )}
        </Link>
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-7 w-7"
            onClick={onToggle}
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Nav Items */}
      <ScrollArea className="flex-1 px-2 py-2">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div className="px-2 py-2 border-t">
          <Button
            variant="ghost"
            size="icon"
            className="w-full h-8"
            onClick={onToggle}
            aria-label="Expand sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function TopBar({ user, tenant }: { user: AuthUser; tenant: AuthTenant }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const currentPage = navItems.find((i) => i.href === pathname);

  return (
    <header className="sticky top-0 z-30 flex items-center h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {currentPage && (
            <h1 className="text-lg font-semibold truncate">
              {currentPage.label}
            </h1>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 h-9 px-3">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                {(user.name || user.email).charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline text-sm font-medium truncate max-w-[120px]">
                {user.name || user.email}
              </span>
              <Badge variant="secondary" className="text-[10px] h-5">
                {user.role}
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user.name || user.email}</p>
              <p className="text-xs text-muted-foreground">{tenant.name}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export function AppShellSkeleton() {
  return (
    <div className="flex h-screen">
      <div className="hidden lg:flex w-[240px] border-r flex-col">
        <div className="h-14 border-b px-4 flex items-center gap-2">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="w-20 h-4" />
        </div>
        <div className="p-2 space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-md" />
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <div className="h-14 border-b px-4 flex items-center">
          <Skeleton className="w-32 h-5" />
        </div>
        <div className="flex-1 p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<AuthTenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          router.push("/login");
          return;
        }
        setUser(data.user);
        setTenant(data.tenant);
        if (!data.tenant.wizardComplete) {
          router.push("/wizard");
        }
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (loading || !user || !tenant) {
    return <AppShellSkeleton />;
  }

  return (
    <AppContext.Provider value={{ user, tenant }}>
      <div className="flex h-screen overflow-hidden">
        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar - Mobile */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-[240px] bg-background border-r transform transition-transform lg:hidden",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <SidebarContent collapsed={false} onToggle={() => setMobileOpen(false)} />
        </aside>

        {/* Sidebar - Desktop */}
        <aside
          className={cn(
            "hidden lg:flex flex-col border-r bg-background transition-all duration-200 shrink-0",
            collapsed ? "w-16" : "w-60"
          )}
        >
          <SidebarContent collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="lg:hidden flex items-center h-14 border-b px-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              className="mr-2"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="font-semibold text-sm">Adagio</span>
          </div>
          <TopBar user={user} tenant={tenant} />
          <main className="flex-1 overflow-auto">
            <div className="container max-w-7xl mx-auto p-4 lg:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AppContext.Provider>
  );
}
