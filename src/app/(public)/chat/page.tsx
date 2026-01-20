import { Metadata } from "next";
import { FullPageChat } from "@/components/chat/full-page-chat";

export const metadata: Metadata = {
  title: "Chat",
  description: "Ask questions about Portfolio Owner's experience, skills, and projects using AI-powered chat.",
};

export default function ChatPage() {
  return <FullPageChat />;
}
