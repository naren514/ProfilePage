import type { Metadata } from "next";
import { FeedPage } from "@/components/writing/agent/feed";

export const metadata: Metadata = { title: "Feed | Admin" };

export default function Page() {
  return <FeedPage />;
}
