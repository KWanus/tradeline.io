import Link from "next/link";
import { Fragment } from "react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

/**
 * Compact mono-uppercase breadcrumb for detail pages. The last item is the
 * current page (no href). Separator is a dim slash.
 *
 *   <Breadcrumb items={[
 *     { label: "Banks", href: "/app/banks" },
 *     { label: "FRBK" },
 *   ]} />
 */
export function Breadcrumb({
  items,
  className = "",
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] ${className}`}
    >
      {items.map((item, idx) => (
        <Fragment key={`${item.label}-${idx}`}>
          {idx > 0 && (
            <span aria-hidden className="opacity-50">
              /
            </span>
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-[color:var(--color-fg)] transition"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-[color:var(--color-fg)]" aria-current="page">
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
