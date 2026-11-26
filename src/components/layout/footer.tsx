"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Github, Linkedin, Mail } from "lucide-react";
import { profileUrl } from "@/lib/utils";

interface ContactSettings {
  email?: string;
  linkedin?: string;
  github?: string;
}

interface FooterProps {
  siteName: string;
  contact: ContactSettings | null;
}

const links = [
  { name: "Work", href: "/projects" },
  { name: "Experience", href: "/experience" },
  { name: "Lab", href: "/lab" },
  { name: "Thoughts", href: "/thoughts" },
  { name: "Reading", href: "/certifications" },
  { name: "Topics", href: "/topics" },
  { name: "For recruiters", href: "/for-recruiters" },
];

export function Footer({ siteName, contact: contactSettings }: FooterProps) {
  const pathname = usePathname();
  const contact = contactSettings ?? {};

  // Don't show footer on admin pages
  if (pathname.startsWith("/admin") || pathname === "/login" || pathname === "/reading-save" || pathname.startsWith("/save")) {
    return null;
  }

  const socialLinks = [
    contact.github && { name: "GitHub", href: profileUrl(contact.github, "https://github.com/"), icon: Github },
    contact.linkedin && { name: "LinkedIn", href: profileUrl(contact.linkedin, "https://linkedin.com/in/"), icon: Linkedin },
    contact.email && { name: "Email", href: `mailto:${contact.email}`, icon: Mail },
  ].filter(Boolean) as Array<{ name: string; href: string; icon: typeof Github }>;

  return (
    <footer className="mt-24 border-t">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="font-serif text-2xl">{siteName}</p>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} · Built with ProfilePage
            </p>
          </div>

          <nav aria-label="Footer">
            <ul className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm sm:grid-cols-3">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted-foreground transition-colors hover:text-foreground">
                    {l.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {socialLinks.length > 0 && (
            <ul className="flex gap-2">
              {socialLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <span className="sr-only">{link.name}</span>
                    <link.icon className="h-4 w-4" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </footer>
  );
}
