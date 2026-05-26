import { DEFAULT_STATE, readState as readAutopilotState } from "@/lib/autopilot/state";
import { readSnapshot } from "@/lib/snapshot";
import { CommandPalette } from "./_components/command-palette";
import { FloatingAi } from "./_components/floating-ai";
import { KeyboardShortcuts } from "./_components/keyboard-shortcuts";
import { LivingSurface } from "./_components/living-surface";
import { ProgressStrip } from "./_components/progress-strip";
import { MobileTabs, Sidebar } from "./_components/sidebar";
import { ThemeProvider } from "./_components/theme-provider";
import { TopBar } from "./_components/top-bar";
import { UrgentNotificationPing } from "./_components/urgent-notification-ping";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [snapRes, autopilotRes] = await Promise.allSettled([
    readSnapshot(),
    readAutopilotState(),
  ]);
  const generatedAt =
    snapRes.status === "fulfilled" ? snapRes.value.generated_at : "";
  const autopilot =
    autopilotRes.status === "fulfilled" ? autopilotRes.value : DEFAULT_STATE;

  return (
    <ThemeProvider>
    <div className="relative flex min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-fg)]">
      <LivingSurface />
      <Sidebar generatedAt={generatedAt} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          userEmail={process.env.NEXT_PUBLIC_USER_EMAIL}
          autopilot={{
            enabled: autopilot.enabled,
            dryRun: autopilot.dryRun,
            pausedReason: autopilot.pausedReason,
            dailyCap: autopilot.dailyCap,
          }}
        />
        <ProgressStrip />
        <MobileTabs />
        <div className="flex-1">{children}</div>
      </div>
      <CommandPalette />
      <KeyboardShortcuts />
      <FloatingAi />
      <UrgentNotificationPing />
    </div>
    </ThemeProvider>
  );
}
