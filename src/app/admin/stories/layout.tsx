import { StudioNav } from "@/components/writing/studio-nav";

// The serif reading face (--font-serif) is loaded once in the root layout.
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <StudioNav />
      {children}
    </div>
  );
}
