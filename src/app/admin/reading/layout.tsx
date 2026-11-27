import { ReadingTabs } from "@/components/reading/workspace/reading-tabs";

export default function ReadingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <ReadingTabs />
      {children}
    </div>
  );
}
