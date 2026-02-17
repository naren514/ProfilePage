import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat Unavailable",
  description: "Chat is disabled for this portfolio deployment.",
};

export default function ChatPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 pt-32 pb-20 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Chat is disabled</h1>
      <p className="mt-4 text-muted-foreground">
        This portfolio is running in no-chat mode.
      </p>
    </main>
  );
}
