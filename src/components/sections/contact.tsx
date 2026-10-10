import { Linkedin, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactSettings } from "@/lib/settings";
import { profileUrl } from "@/lib/utils";

interface ContactProps {
  settings: ContactSettings | null;
}

export function Contact({ settings }: ContactProps) {
  const email = settings?.email?.trim();
  const linkedin = settings?.linkedin?.trim();

  if (!email && !linkedin) return null;

  return (
    <section className="pb-10 md:pb-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative isolate flex flex-col gap-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a1a2e] to-[#16213e] px-6 py-8 text-white sm:px-10 md:flex-row md:items-center md:justify-between lg:px-14">
          <div className="absolute -right-10 -top-24 -z-10 h-64 w-64 rounded-full bg-[#7c3aed]/30 blur-3xl" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Let&apos;s talk
            </h2>
            <p className="mt-2 text-base text-white/65">
              The quickest way to reach me is email or LinkedIn.
            </p>
          </div>
          <div className="flex gap-3">
            {email && (
              <Button
                asChild
                size="lg"
                className="flex-1 bg-white text-[#1a1a2e] hover:bg-white/90 md:flex-none"
              >
                <a href={`mailto:${email}`}>
                  <Mail className="mr-2 h-4 w-4" />
                  Email
                </a>
              </Button>
            )}
            {linkedin && (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="flex-1 border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white md:flex-none"
              >
                <a
                  href={profileUrl(linkedin, "https://linkedin.com/in/")}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Linkedin className="mr-2 h-4 w-4" />
                  LinkedIn
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
