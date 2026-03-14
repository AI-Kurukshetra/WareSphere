import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import type { RoleKey } from "@wms/shared";

import { PwaBootstrap } from "../components/pwa-bootstrap";
import { getSession, routeAccessByPath } from "../lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIMaha Kruksetra WMS",
  description: "Omnichannel warehouse management system foundation"
};

export const viewport: Viewport = {
  themeColor: "#f15a24"
};

const navItems = [
  { href: "/", label: "Overview", roles: routeAccessByPath["/"] },
  { href: "/receiving", label: "Receiving", roles: routeAccessByPath["/receiving"] },
  { href: "/inventory", label: "Inventory", roles: routeAccessByPath["/inventory"] },
  { href: "/orders", label: "Orders", roles: routeAccessByPath["/orders"] },
  { href: "/returns", label: "Returns", roles: routeAccessByPath["/returns"] }
];

export default async function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await getSession();
  const visibleNavItems = session
    ? navItems.filter((item) => (item.roles as readonly RoleKey[]).includes(session.role))
    : [];

  return (
    <html lang="en">
      <body>
        <PwaBootstrap />
        <div className="page-shell">
          <header className="site-header">
            <div className="site-brand">
              <p className="eyebrow">AIMaha Kruksetra</p>
              <strong className="brand-mark">Fulfillment Control Room</strong>
            </div>

            <nav className="site-nav" aria-label="Primary">
              {visibleNavItems.map((item) => (
                <Link href={item.href} key={item.href}>
                  {item.label}
                </Link>
              ))}

              {!session ? <Link href="/sign-in">Sign in</Link> : null}
            </nav>

            <div className="site-utility">
              {session ? (
                <>
                  <div className="session-meta">
                    <strong>{session.displayName}</strong>
                    <p>
                      {session.email} • {session.role}
                    </p>
                  </div>
                  <form action="/auth/sign-out" method="post">
                    <input name="redirectTo" type="hidden" value="/sign-in" />
                    <button className="session-button" type="submit">
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <p className="session-empty">Choose a session to access protected workflows.</p>
              )}
            </div>
          </header>

          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
