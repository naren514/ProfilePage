import {
  Activity,
  BarChart3,
  Bot,
  FileText,
  HandHeart,
  Import,
  BookMarked,
  Briefcase,
  Building2,
  Camera,
  Feather,
  Home,
  Inbox,
  ListChecks,
  Rss,
  Palette,
  UserRound,
  type LucideIcon,
} from "lucide-react";

// The admin's information architecture: grouped by job, not by table.
// One place lists every page so the sidebar, the phone menu and the
// command menu always agree.

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Other words the command menu matches. */
  keywords?: string[];
  match: (path: string) => boolean;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

const UUID = /^\/admin\/stories\/[0-9a-f-]{36}/;

export const NAV: NavGroup[] = [
  {
    label: null,
    items: [{ label: "Home", href: "/admin", icon: Home, keywords: ["today", "dashboard"], match: (p) => p === "/admin" }],
  },
  {
    label: "Write",
    items: [
      { label: "Thoughts", href: "/admin/stories", icon: Feather, keywords: ["posts", "drafts", "ideas", "studio"], match: (p) => p === "/admin/stories" || UUID.test(p) || p.startsWith("/admin/stories/classic") },
      { label: "Styles & AI", href: "/admin/stories/styles", icon: Palette, keywords: ["voice", "models", "budget"], match: (p) => p.startsWith("/admin/stories/styles") },
      { label: "Memory", href: "/admin/stories/memory", icon: BookMarked, keywords: ["samples", "feedback"], match: (p) => p.startsWith("/admin/stories/memory") },
    ],
  },
  {
    label: "Read",
    items: [
      { label: "Feed", href: "/admin/feed", icon: Rss, keywords: ["new articles", "sources", "discover", "recommended"], match: (p) => p.startsWith("/admin/feed") },
      { label: "Reading inbox", href: "/admin/reading", icon: Inbox, keywords: ["articles", "links", "saved"], match: (p) => p.startsWith("/admin/reading") },
      { label: "Weekly list", href: "/admin/stories/weekly", icon: ListChecks, keywords: ["topics", "shortlist", "worth your time"], match: (p) => p.startsWith("/admin/stories/weekly") },
    ],
  },
  {
    label: "Site",
    items: [
      { label: "Profile", href: "/admin/settings", icon: UserRound, keywords: ["settings", "hero", "about", "skills", "contact"], match: (p) => p.startsWith("/admin/settings") },
      { label: "Work", href: "/admin/projects", icon: Briefcase, keywords: ["projects", "case studies"], match: (p) => p.startsWith("/admin/projects") },
      { label: "Experience", href: "/admin/experience", icon: Building2, keywords: ["career", "jobs"], match: (p) => p.startsWith("/admin/experience") },
      { label: "Photos", href: "/admin/photos", icon: Camera, keywords: ["gallery"], match: (p) => p.startsWith("/admin/photos") },
    ],
  },
  {
    label: "Agents",
    items: [
      { label: "Automations", href: "/admin/stories/automations", icon: Bot, keywords: ["schedule", "triggers", "cron"], match: (p) => p.startsWith("/admin/stories/automations") },
      { label: "Activity", href: "/admin/stories/activity", icon: Activity, keywords: ["runs", "log", "usage"], match: (p) => p.startsWith("/admin/stories/activity") || p.startsWith("/admin/stories/runs") },
    ],
  },
  {
    label: "More",
    items: [
      { label: "Volunteering", href: "/admin/volunteer", icon: HandHeart, keywords: ["volunteer"], match: (p) => p.startsWith("/admin/volunteer") },
      { label: "Documents", href: "/admin/documents", icon: FileText, keywords: ["rag", "chat", "files"], match: (p) => p.startsWith("/admin/documents") },
      { label: "Profile import", href: "/admin/profile-import", icon: Import, keywords: ["linkedin", "github"], match: (p) => p.startsWith("/admin/profile-import") },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3, keywords: ["visitors", "tokens"], match: (p) => p.startsWith("/admin/analytics") },
    ],
  },
];

export const ALL_ITEMS = NAV.flatMap((g) => g.items);

/** Full-screen writing surfaces: the navigation steps back. */
export function isImmersive(path: string) {
  return /^\/admin\/stories\/[0-9a-f-]{36}(\/preview)?$/.test(path);
}
