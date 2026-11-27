import { AiTabs } from "@/components/writing/ai-tabs";

export default function AiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <AiTabs />
      {children}
    </div>
  );
}
