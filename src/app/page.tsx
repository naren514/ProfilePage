import { Hero } from "@/components/sections/hero";
import { About } from "@/components/sections/about";
import { Skills } from "@/components/sections/skills";
import { ChatWidget } from "@/components/chat/chat-widget";
import {
  getSiteSettings,
  getHeroSettings,
  getAboutSettings,
  getSkillsSettings,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const settings = await getSiteSettings();

  const heroSettings = getHeroSettings(settings);
  const aboutSettings = getAboutSettings(settings);
  const skillsSettings = getSkillsSettings(settings);

  return (
    <>
      <Hero settings={heroSettings} />
      <About settings={aboutSettings} />
      <Skills settings={skillsSettings} />
      <ChatWidget />
    </>
  );
}
