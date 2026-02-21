import { Hero } from "@/components/sections/hero";
import { Skills } from "@/components/sections/skills";
import { ChatWidget } from "@/components/chat/chat-widget";
import {
  getSiteSettings,
  getHeroSettings,
  getSkillsSettings,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const settings = await getSiteSettings();

  const heroSettings = getHeroSettings(settings);
  const skillsSettings = getSkillsSettings(settings);

  return (
    <>
      <Hero settings={heroSettings} />
      <Skills settings={skillsSettings} />
      <ChatWidget />
    </>
  );
}
