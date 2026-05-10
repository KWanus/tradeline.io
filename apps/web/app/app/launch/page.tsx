import { LaunchBoard } from "./_board";

export const dynamic = "force-dynamic";

export default function LaunchPage() {
  return (
    <main className="relative px-6 md:px-10 lg:px-14 py-10 max-w-5xl">
      <div className="absolute inset-x-0 top-0 h-96 bg-aurora pointer-events-none" />
      <div className="relative">
        <LaunchBoard />
      </div>
    </main>
  );
}
