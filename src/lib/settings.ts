import { db } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";

export interface HeroSettings {
  name: string;
  title: string;
  location: string;
  subtitle: string;
  stats: Array<{ label: string; value: string }>;
}

export interface AboutSettings {
  headline: string;
  description: string;
  features: Array<{ name: string; description: string }>;
}

export interface SkillCategory {
  name: string;
  skills: string[];
}

export interface ContactSettings {
  email: string;
  linkedin: string;
  phone: string;
}

export interface CertificationEntry {
  name: string;
  issuer: string;
  year: string;
}

export interface EducationEntry {
  degree: string;
  institution: string;
  year: string;
}

export interface SiteSettings {
  hero: HeroSettings | null;
  about: AboutSettings | null;
  skills: SkillCategory[] | null;
  contact: ContactSettings | null;
  certifications: CertificationEntry[] | null;
  education: EducationEntry[] | null;
}

// Default placeholder values shown when settings are not configured
export const placeholders = {
  hero: {
    name: "[Your Name]",
    title: "[Your Title]",
    location: "[Your Location]",
    subtitle: "[Configure your professional summary in Admin > Settings]",
    stats: [
      { label: "[Stat 1]", value: "[--]" },
      { label: "[Stat 2]", value: "[--]" },
      { label: "[Stat 3]", value: "[--]" },
      { label: "[Stat 4]", value: "[--]" },
    ],
  },
  about: {
    headline: "[Configure in Admin > Settings]",
    description: "[Add your professional description in the admin settings panel]",
    features: [
      { name: "[Feature 1]", description: "[Configure features in admin settings]" },
      { name: "[Feature 2]", description: "[Configure features in admin settings]" },
      { name: "[Feature 3]", description: "[Configure features in admin settings]" },
      { name: "[Feature 4]", description: "[Configure features in admin settings]" },
    ],
  },
  skills: [
    { name: "[Category 1]", skills: ["[Skill 1]", "[Skill 2]", "[Skill 3]"] },
    { name: "[Category 2]", skills: ["[Skill 1]", "[Skill 2]", "[Skill 3]"] },
    { name: "[Category 3]", skills: ["[Skill 1]", "[Skill 2]", "[Skill 3]"] },
  ],
  contact: {
    email: "[email@example.com]",
    linkedin: "[linkedin.com/in/yourprofile]",
    phone: "",
  },
};

const SETTINGS_QUERY_TIMEOUT_MS = Number(process.env.SETTINGS_QUERY_TIMEOUT_MS ?? 4000);

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const settings = await withTimeout(
      db.select().from(siteSettings),
      SETTINGS_QUERY_TIMEOUT_MS,
      "site settings query"
    );

    // Convert to key-value object
    const settingsMap: Record<string, unknown> = {};
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value;
    }

    return {
      hero: (settingsMap.hero as HeroSettings) || null,
      about: (settingsMap.about as AboutSettings) || null,
      skills: (settingsMap.skills as SkillCategory[]) || null,
      contact: (settingsMap.contact as ContactSettings) || null,
      certifications: (settingsMap.certifications as CertificationEntry[]) || null,
      education: (settingsMap.education as EducationEntry[]) || null,
    };
  } catch (error) {
    console.error("Error fetching site settings:", error);
    return {
      hero: null,
      about: null,
      skills: null,
      contact: null,
      certifications: null,
      education: null,
    };
  }
}

// Helper to get a setting with fallback to placeholder
export function getHeroSettings(settings: SiteSettings): HeroSettings {
  return settings.hero || placeholders.hero;
}

export function getAboutSettings(settings: SiteSettings): AboutSettings {
  return settings.about || placeholders.about;
}

export function getSkillsSettings(settings: SiteSettings): SkillCategory[] {
  return settings.skills || placeholders.skills;
}

export function getContactSettings(settings: SiteSettings): ContactSettings {
  return settings.contact || placeholders.contact;
}

export function getCertificationsSettings(settings: SiteSettings): CertificationEntry[] {
  return settings.certifications || [];
}

export function getEducationSettings(settings: SiteSettings): EducationEntry[] {
  return settings.education || [];
}
