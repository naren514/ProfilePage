"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";

const baseNavigation = [
  { name: "Work", href: "/projects" },
  { name: "Experience", href: "/experience" },
  { name: "Lab", href: "/lab" },
  { name: "Thoughts", href: "/thoughts" },
  { name: "Reading", href: "/certifications" },
];

interface HeaderProps {
  siteName: string;
  showPhotos?: boolean;
}

export function Header({ siteName, showPhotos = false }: HeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // The photo journal only gets a menu entry once it has something in it
  const navigation = showPhotos ? [...baseNavigation, { name: "Photos", href: "/photos" }] : baseNavigation;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMobileMenuOpen(false), [pathname]);

  // Don't show header on admin pages
  if (pathname.startsWith("/admin") || pathname === "/login") {
    return null;
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header
      className={cn(
        "site-motion sticky top-0 z-50 transition-[background-color,border-color] duration-200",
        scrolled || mobileMenuOpen ? "border-b bg-background/80 backdrop-blur-xl backdrop-saturate-150" : "border-b border-transparent bg-background"
      )}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8" aria-label="Main">
        <Link href="/" className="flex items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo size="sm" />
          <span className="font-serif text-xl tracking-tight">{siteName}</span>
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {navigation.map((item) => (
            <li key={item.name}>
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm transition-colors",
                  isActive(item.href) ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.name}
              </Link>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted md:hidden"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMobileMenuOpen((o) => !o)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {mobileMenuOpen && (
        <div id="mobile-nav" className="border-t md:hidden">
          <ul className="mx-auto max-w-6xl px-5 py-3">
            {[{ name: "Home", href: "/" }, ...navigation].map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href || (item.href !== "/" && isActive(item.href)) ? "page" : undefined}
                  className={cn(
                    "block py-3 font-serif text-2xl",
                    pathname === item.href || (item.href !== "/" && isActive(item.href)) ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
