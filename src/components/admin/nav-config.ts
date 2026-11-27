import {
  BarChart3,
  FileText,
  HandHeart,
  Import,
  Briefcase,
  Building2,
  Camera,
  Feather,
  Home,
  Sparkles,
  BookOpen,
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
  /** Places inside the page the command menu can jump to (tabs, settings). */
  within?: Array<{ label: string; href: string; keywords?: string[] }>;
  match: (path: string) => boolean;
}

export interface NavGroup {
  label: string | null;
  /** Folded away in the sidebar until opened (or until one of its pages is open). */
  collapsible?: boolean;
  items: NavItem[];
}

const UUID = /^\/admin\/stories\/[0-9a-f-]{36}/;

export const NAV: NavGroup[] = [
  {
    label: null,
    items: [{ label: "Home", href: "/admin", icon: Home, keywords: ["today", "dashboard"], match: (p) => p === "/admin" }],
  },
  {
    label: "Studio",
    items: [
      { label: "Thoughts", href: "/admin/stories", icon: Feather, keywords: ["posts", "drafts", "ideas", "write", "board"], match: (p) => p === "/admin/stories" || UUID.test(p) || p.startsWith("/admin/stories/classic") },
      {
        label: "Reading",
        href: "/admin/reading",
        icon: BookOpen,
        keywords: ["feed", "discover", "articles", "links"],
        match: (p) => p.startsWith("/admin/reading"),
        within: [
          { label: "Discover", href: "/admin/reading", keywords: ["feed", "new articles", "recommended"] },
          { label: "Reading inbox", href: "/admin/reading/inbox", keywords: ["saved", "read later", "links"] },
          { label: "This week", href: "/admin/reading/week", keywords: ["shortlist", "weekly list", "approve", "worth your time"] },
          { label: "Published reading", href: "/admin/reading/published", keywords: ["public", "archive", "weekly lists"] },
          { label: "Reading settings", href: "/admin/reading/settings", keywords: ["sources", "topics", "schedule", "ways to save", "bookmarklet", "phone"] },
        ],
      },
      {
        label: "AI",
        href: "/admin/ai",
        icon: Sparkles,
        keywords: ["assistant", "agents"],
        match: (p) => p.startsWith("/admin/ai") || p.startsWith("/admin/stories/runs"),
        within: [
          { label: "Your voice", href: "/admin/ai", keywords: ["styles", "writing styles", "tone"] },
          { label: "What it learned", href: "/admin/ai/memory", keywords: ["memory", "samples", "feedback", "learn"] },
          { label: "Deep research", href: "/admin/ai/research", keywords: ["research", "report", "investigate", "sources", "citations"] },
          { label: "Helpers", href: "/admin/ai/helpers", keywords: ["automations", "schedule", "triggers", "cron", "nightly"] },
          { label: "History", href: "/admin/ai/history", keywords: ["activity", "runs", "log"] },
          { label: "AI settings & cost", href: "/admin/ai/settings", keywords: ["models", "budget", "usage", "spend", "pause"] },
        ],
      },
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
    label: "More",
    collapsible: true,
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
