import { Hero } from "@/components/sections/hero";
import { FeaturedProjects, getProjectCompanies } from "@/components/sections/featured-projects";
import { LabPreview } from "@/components/sections/lab-preview";
import { Skills } from "@/components/sections/skills";
import { Contact } from "@/components/sections/contact";
import {
  getSiteSettings,
  getHeroSettings,
  getLabSettings,
  getSkillsSettings,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [settings, companies] = await Promise.all([getSiteSettings(), getProjectCompanies()]);

  const heroSettings = getHeroSettings(settings);
  const skillsSettings = getSkillsSettings(settings);

  return (
    <div className="bg-muted/40">
      <Hero settings={heroSettings} companies={companies} />
      <FeaturedProjects />
      <LabPreview tools={getLabSettings(settings)} />
      <Skills settings={skillsSettings} />
      <Contact settings={settings.contact} />
    </div>
  );
}
