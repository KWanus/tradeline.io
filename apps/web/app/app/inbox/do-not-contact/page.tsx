import { readDncList } from "@/lib/dnc-server";
import { PageHeader } from "../../_components/page-header";
import { DncDesk } from "./_dnc-desk";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DoNotContactPage() {
  let entries: Awaited<ReturnType<typeof readDncList>> = [];
  try {
    entries = await readDncList();
  } catch {}

  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-3xl">
      <PageHeader
        icon={<span aria-hidden>⊘</span>}
        title="Do not contact"
        badge={{ label: "Suppression", tone: "warn" }}
        tagline="Addresses here are blocked from every send — manual, autopilot, growth, and replies — as a hard pre-send guard. Add anyone who opts out; remove if added by mistake."
      />
      <DncDesk initialEntries={entries} />
    </main>
  );
}
