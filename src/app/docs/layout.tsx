"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Book, Search, Menu, X, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import MiniSearch from "minisearch";

interface NavItem {
  slug: string;
  title: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface SearchResult {
  slug: string;
  title: string;
  section: string;
  description: string;
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sections, setSections] = useState<NavSection[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchEngine, setSearchEngine] = useState<MiniSearch | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    fetch("/api/docs/nav")
      .then((r) => r.json())
      .then(setSections)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/docs/search")
      .then((r) => r.json())
      .then((docs: Array<{ slug: string; title: string; description: string; content: string; section: string }>) => {
        const ms = new MiniSearch({
          fields: ["title", "description", "content"],
          storeFields: ["slug", "title", "section", "description"],
          searchOptions: { prefix: true, fuzzy: 0.2, boost: { title: 3, description: 2 } },
        });
        ms.addAll(docs.map((d, i) => ({ id: i, ...d })));
        setSearchEngine(ms);
      })
      .catch(() => {});
  }, []);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (!searchEngine || query.length < 2) {
        setSearchResults([]);
        return;
      }
      const results = searchEngine.search(query).slice(0, 8) as unknown as SearchResult[];
      setSearchResults(results);
    },
    [searchEngine]
  );

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setSearchQuery("");
  }, [pathname]);

  const currentSlug = pathname.replace("/docs/", "").replace("/docs", "");

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center h-14 px-4 border-b shrink-0">
        <Link href="/docs" className="flex items-center gap-2 font-semibold text-sm">
          <Book className="h-5 w-5 text-primary" />
          <span>Documentación</span>
        </Link>
      </div>
      <div className="p-3 border-b shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        {searchOpen && searchResults.length > 0 && (
          <div className="mt-1 bg-background border rounded-md shadow-md max-h-64 overflow-auto">
            {searchResults.map((r) => (
              <Link
                key={r.slug}
                href={`/docs/${r.slug}`}
                className="block px-3 py-2 text-sm hover:bg-accent border-b last:border-0"
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery("");
                }}
              >
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-muted-foreground">{r.section}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <ScrollArea className="flex-1">
        <nav className="p-3 space-y-4">
          {sections.map((section) => (
            <div key={section.title}>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
                {section.title}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = currentSlug === item.slug;
                  return (
                    <Link
                      key={item.slug}
                      href={`/docs/${item.slug}`}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <ChevronRight className={cn("h-3 w-3 shrink-0", isActive ? "opacity-100" : "opacity-0")} />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>
      <div className="p-3 border-t text-xs text-muted-foreground shrink-0">
        <Link href="/dashboard" className="hover:text-primary transition-colors">
          ← Volver a la app
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-background border-r transform transition-transform lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-72 border-r bg-background shrink-0">
        <Sidebar />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center h-14 border-b px-4 lg:px-6 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden mr-2"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              Ir a la App
            </Button>
          </Link>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto px-4 lg:px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
