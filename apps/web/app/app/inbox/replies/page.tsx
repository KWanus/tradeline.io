import { readInbox } from "@/lib/replies";
import { PageHeader } from "../../_components/page-header";
import { RepliesDesk } from "./_replies-desk";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RepliesInboxPage() {
  let replies: Awaited<ReturnType<typeof readInbox>> = [];
  try {
    replies = await readInbox();
  } catch {}

  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-3xl">
      <PageHeader
        icon={<span aria-hidden>↩</span>}
        title="Replies"
        badge={{ label: "Inbox", tone: "primary" }}
        tagline="Brokers' replies, classified and pre-drafted. Read, tweak, and send the response — or mark handled. Each send routes through the same compliance + DNC guard as outreach."
      />
      <RepliesDesk initialReplies={replies} />
    </main>
  );
}
