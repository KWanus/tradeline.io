import Link from "next/link";

export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative z-10 border-t border-[color:var(--color-line)] mt-16">
      <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono text-[11px] tracking-[0.05em] text-[color:var(--color-fg-faint)]">
        <div>
          &copy; {year} TRADELINE &middot; Public-source data only &middot; Zero
          consumer information
        </div>
        <nav className="flex flex-wrap gap-4">
          <Link
            href="/report"
            className="hover:text-[color:var(--color-accent)] transition"
          >
            Report
          </Link>
          <Link
            href="/about"
            className="hover:text-[color:var(--color-accent)] transition"
          >
            About
          </Link>
          <Link
            href="/coverage"
            className="hover:text-[color:var(--color-accent)] transition"
          >
            Coverage
          </Link>
          <Link
            href="/changelog"
            className="hover:text-[color:var(--color-accent)] transition"
          >
            Changelog
          </Link>
          <Link
            href="/status"
            className="hover:text-[color:var(--color-accent)] transition"
          >
            Status
          </Link>
          <Link
            href="/kit"
            className="hover:text-[color:var(--color-accent)] transition"
          >
            Kit
          </Link>
          <Link
            href="/app/learn"
            className="hover:text-[color:var(--color-accent)] transition"
          >
            How this works
          </Link>
          <Link
            href="/app/today"
            className="hover:text-[color:var(--color-accent)] transition"
          >
            Workbase
          </Link>
          <Link
            href="/privacy"
            className="hover:text-[color:var(--color-accent)] transition"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="hover:text-[color:var(--color-accent)] transition"
          >
            Terms
          </Link>
          <a
            href="https://github.com/KWanus/tradeline.io"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[color:var(--color-accent)] transition"
          >
            GitHub &nearr;
          </a>
        </nav>
      </div>
    </footer>
  );
}
