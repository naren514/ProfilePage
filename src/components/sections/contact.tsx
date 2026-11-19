import { Linkedin, Mail } from "lucide-react";
import { ContactSettings } from "@/lib/settings";
import { profileUrl } from "@/lib/utils";
import { Container } from "@/components/site/ui";

interface ContactProps {
  settings: ContactSettings | null;
}

export function Contact({ settings }: ContactProps) {
  const email = settings?.email?.trim();
  const linkedin = settings?.linkedin?.trim();

  if (!email && !linkedin) return null;

  return (
    <section className="pt-12 sm:pt-16">
      <Container>
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-foreground px-7 py-14 text-background sm:px-14 sm:py-20">
          <div
            aria-hidden
            className="absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,hsl(var(--brand)/0.55),transparent)] blur-2xl"
          />
          <h2 className="max-w-2xl text-balance font-serif text-5xl font-normal leading-[1.02] tracking-[-0.02em] sm:text-6xl">
            Let&apos;s talk.
          </h2>
          <p className="mt-5 max-w-xl text-background/60">The quickest way to reach me is email or LinkedIn.</p>
          <div className="mt-10 flex flex-wrap gap-3">
            {email && (
              <a
                href={`mailto:${email}`}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-background px-6 text-sm font-medium text-foreground transition-colors hover:bg-background/90"
              >
                <Mail className="h-4 w-4" aria-hidden />
                Email me
              </a>
            )}
            {linkedin && (
              <a
                href={profileUrl(linkedin, "https://linkedin.com/in/")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-background/25 px-6 text-sm font-medium transition-colors hover:bg-background/10"
              >
                <Linkedin className="h-4 w-4" aria-hidden />
                LinkedIn
              </a>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
