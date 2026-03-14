import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import type { RoleKey } from "@wms/shared";

import { PwaBootstrap } from "../components/pwa-bootstrap";
import { PrimaryNav } from "../components/primary-nav";
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
  { href: "/counts", label: "Counts", roles: routeAccessByPath["/counts"] },
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
              <div className="brand-stack">
                <strong className="brand-mark">Fulfillment Control Room</strong>
                <p className="brand-copy">
                  Barcode-first receiving, counts, inventory, and outbound work for one warehouse team.
                </p>
              </div>
            </div>

            <PrimaryNav
              items={visibleNavItems.map((item) => ({
                href: item.href,
                label: item.label
              }))}
              signedIn={Boolean(session)}
            />

            <div className="site-utility">
              {session ? (
                <>
                  <div className="session-meta">
                    <div className="session-topline">
                      <strong>{session.displayName}</strong>
                      <span className="status-chip status-chip--accent">{session.role}</span>
                    </div>
                    <p>{session.email}</p>
                  </div>
                  <form action="/auth/sign-out" method="post">
                    <input name="redirectTo" type="hidden" value="/sign-in" />
                    <button className="session-button" type="submit">
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <p className="session-empty">Choose a session to open the warehouse workflows.</p>
              )}
            </div>
          </header>

          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
