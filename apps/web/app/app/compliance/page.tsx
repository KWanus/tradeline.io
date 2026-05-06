import { ComplianceBoard } from "./_compliance-board";

export const dynamic = "force-dynamic";

export default function CompliancePage() {
  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight">
          Compliance
        </h1>
        <p className="mt-3 text-[color:var(--color-fg-dim)] text-lg max-w-2xl leading-relaxed">
          State licenses, bonds, renewal alerts, and the SOL reference chart — in
          one place. Most buyers spend $5–25k/year on outside compliance counsel
          for things software handles better; this is the "things software handles
          better" half.
        </p>
      </header>

      <ComplianceBoard />
    </main>
  );
}
