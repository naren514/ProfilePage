import { LabEntry } from "@/lib/settings";
import { Container, SectionHeader } from "@/components/site/ui";
import { LabCard } from "@/components/site/lab-card";

interface LabPreviewProps {
  tools: LabEntry[];
}

const PREVIEW_COUNT = 3;

export function LabPreview({ tools }: LabPreviewProps) {
  if (tools.length === 0) return null;

  const preview = [...tools].sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99)).slice(0, PREVIEW_COUNT);
  const viewAllLabel = tools.length > PREVIEW_COUNT ? `All ${tools.length} tools` : "Visit the Lab";

  return (
    <section className="py-12 sm:py-16">
      <Container>
        <SectionHeader
          title="From the Lab"
          description="Open-source tools for Oracle OTM, EDI, parcel and supply chain teams, built for the gaps commercial platforms leave."
          href="/lab"
          linkLabel={viewAllLabel}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {preview.map((tool, i) => (
            <LabCard key={tool.githubUrl} tool={tool} index={i} />
          ))}
        </div>
      </Container>
    </section>
  );
}
