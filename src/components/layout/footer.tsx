"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Github, Linkedin, Mail } from "lucide-react";
import { useState, useEffect } from "react";

interface ContactSettings {
  email?: string;
  linkedin?: string;
  github?: string;
}

interface HeroSettings {
  name?: string;
}

export function Footer() {
  const pathname = usePathname();
  const [contact, setContact] = useState<ContactSettings>({});
  const [siteName, setSiteName] = useState("Portfolio");

  // Fetch contact settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/admin/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.contact) {
            setContact(data.contact);
          }
          if (data.hero?.name) {
            setSiteName(data.hero.name);
          }
        }
      } catch {
        // Use defaults on error
      }
    }
    fetchSettings();
  }, []);

  // Don't show footer on admin pages
  if (pathname.startsWith("/admin") || pathname === "/login") {
    return null;
  }

  const socialLinks = [
    contact.github && {
      name: "GitHub",
      href: contact.github.startsWith("http") ? contact.github : `https://github.com/${contact.github}`,
      icon: Github,
    },
    contact.linkedin && {
      name: "LinkedIn",
      href: contact.linkedin.startsWith("http") ? contact.linkedin : `https://linkedin.com/in/${contact.linkedin}`,
      icon: Linkedin,
    },
    contact.email && {
      name: "Email",
      href: `mailto:${contact.email}`,
      icon: Mail,
    },
  ].filter(Boolean) as Array<{ name: string; href: string; icon: typeof Github }>;

  return (
    <footer className="border-t border-border/40">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex flex-col items-center gap-2 md:items-start">
            <span className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} {siteName}. All rights reserved.
            </span>
            <span className="text-xs text-muted-foreground/60">
              Built with <span className="font-medium">ProfilePage</span>
            </span>
          </div>

          {socialLinks.length > 0 && (
            <div className="flex gap-6">
              {socialLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="sr-only">{link.name}</span>
                  <link.icon className="h-5 w-5" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
