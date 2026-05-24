import { PageHeader } from "../_components/page-header";
import { BrokerWorkbench } from "./_workbench";

export const dynamic = "force-dynamic";

export default function BrokerPage() {
  return (
    <main className="relative px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <PageHeader
        icon={<span aria-hidden>⇄</span>}
        title="Broker"
        badge={{ label: "Match", tone: "primary" }}
        tagline="Log inbound portfolios. Build your buyer book. Tradeline matches and one-tap-intros — that's the day."
      />
      <BrokerWorkbench />
    </main>
  );
}
