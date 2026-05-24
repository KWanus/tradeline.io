import { readSnapshot } from "@/lib/snapshot";
import { CommandPalette } from "./_components/command-palette";
import { FloatingAi } from "./_components/floating-ai";
import { ProgressStrip } from "./_components/progress-strip";
import { MobileTabs, Sidebar } from "./_components/sidebar";
import { TopBar } from "./_components/top-bar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let generatedAt = "";
  try {
    const snap = await readSnapshot();
    generatedAt = snap.generated_at;
  } catch {}
  return (
    <div className="flex min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)]">
      <Sidebar generatedAt={generatedAt} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar userEmail={process.env.NEXT_PUBLIC_USER_EMAIL} />
        <ProgressStrip />
        <MobileTabs />
        <div className="flex-1">{children}</div>
      </div>
      <CommandPalette />
      <FloatingAi />
    </div>
  );
}
