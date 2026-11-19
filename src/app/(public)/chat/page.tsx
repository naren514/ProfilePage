import { Container, PageHeader } from "@/components/site/ui";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat Unavailable",
  description: "Chat is disabled for this portfolio deployment.",
};

export default function ChatPage() {
  return (
    <Container size="narrow">
      <PageHeader eyebrow="Chat" title="Chat is turned off" description="This portfolio is running without the chat assistant." />
    </Container>
  );
}
