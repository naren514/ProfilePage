import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader } from "@/components/site/ui";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

// Opening the link never unsubscribes by itself (mail scanners open links);
// the reader confirms with one press.
export default async function UnsubscribePage(props: { searchParams: Promise<{ token?: string; done?: string }> }) {
  const { token, done } = await props.searchParams;
  return (
    <Container size="narrow">
      {done === "1" ? (
        <PageHeader title="You're unsubscribed" description="You won't get the weekly reading list by email any more. The lists stay on the site whenever you want them." />
      ) : done ? (
        <PageHeader title="That link didn't work" description="It may be old. If you still get the emails, use the link in the latest one." />
      ) : (
        <>
          <PageHeader title="Stop the weekly email?" description="You'll stop getting the reading list by email. You can sign up again any time." />
          <form method="post" action="/api/subscribe/unsubscribe" className="pb-16">
            <input type="hidden" name="token" value={token ?? ""} />
            <button type="submit" className="h-11 rounded-full bg-foreground px-5 text-sm font-medium text-background">
              Unsubscribe
            </button>
          </form>
        </>
      )}
      <p className="pb-16 text-sm text-muted-foreground">
        <Link href="/reading/weekly" className="underline underline-offset-4">
          The weekly lists
        </Link>
      </p>
    </Container>
  );
}
