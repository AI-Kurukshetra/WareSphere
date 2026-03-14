"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
};

type PrimaryNavProps = {
  items: NavItem[];
  signedIn: boolean;
};

export function PrimaryNav({ items, signedIn }: PrimaryNavProps) {
  const pathname = usePathname();

  return (
    <nav className="site-nav" aria-label="Primary">
      {items.map((item) => {
        const isActive =
          item.href === "/" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            className={`site-nav-link${isActive ? " site-nav-link--active" : ""}`}
            href={item.href}
            key={item.href}
            prefetch={false}
          >
            {item.label}
          </Link>
        );
      })}

      {!signedIn ? (
        <Link className="site-nav-link" href="/sign-in" prefetch={false}>
          Sign in
        </Link>
      ) : null}
    </nav>
  );
}
