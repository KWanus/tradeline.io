import { readSnapshot } from "@/lib/snapshot";
import { CommandPalette } from "./_components/command-palette";
import { MobileTabs, Sidebar } from "./_components/sidebar";

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
        <MobileTabs />
        <div className="flex-1">{children}</div>
      </div>
      <CommandPalette />
    </div>
  );
}
