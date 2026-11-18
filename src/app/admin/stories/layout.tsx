import { Newsreader } from "next/font/google";
import { StudioNav } from "@/components/writing/studio-nav";

// The Writing Studio's reading face. UI chrome stays in the site's sans.
const serif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={serif.variable}>
      <StudioNav />
      {children}
    </div>
  );
}
