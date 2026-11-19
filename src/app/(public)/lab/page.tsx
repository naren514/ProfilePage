import { Metadata } from "next";
import { getSiteSettings, getLabSettings } from "@/lib/settings";
import { ChatWidget } from "@/components/chat/chat-widget";
import { Container, EmptyState, PageHeader } from "@/components/site/ui";
import { LabCard } from "@/components/site/lab-card";

export const metadata: Metadata = {
  title: "Lab",
  description:
    "Open-source tools built for Oracle Transportation Management, EDI, parcel shipping, and supply chain operations.",
};

export const dynamic = "force-dynamic";

export default async function LabPage() {
  const settings = await getSiteSettings();
  const labList = [...getLabSettings(settings)].sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));

  return (
    <Container>
      <PageHeader
        eyebrow="Lab · Open source"
        title="Tools I built because I needed them"
        description="Open-source tools for Oracle OTM, EDI, parcel shipping and supply chain teams, built for the gaps commercial platforms leave."
      />
      {labList.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {labList.map((tool, i) => (
            <LabCard key={tool.githubUrl} tool={tool} index={i} />
          ))}
        </div>
      ) : (
        <EmptyState>No tools here yet.</EmptyState>
      )}
      <ChatWidget />
    </Container>
  );
}
