import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";

type DashboardShellProps = {
  pageTitle: string;
  email?: string;
  statusText?: string;
  actions?: ReactNode;
  children: ReactNode;
};

const navItems = [
  { href: "/chat", label: "Chat" },
  { href: "/uploads", label: "Uploads" },
];

export default function DashboardShell({ pageTitle, email, statusText, actions, children }: DashboardShellProps) {
  const router = useRouter();
  const avatarLabel = email?.trim()?.charAt(0)?.toUpperCase() || "S";

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">SiteMind</div>
        <nav className="app-nav">
          {navItems.map((item) => {
            const active = router.pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`app-nav-item ${active ? "app-nav-item-active" : ""}`.trim()}
              >
                {item.label}
              </Link>
            );
          })}
          <button type="button" className="app-nav-item app-nav-item-disabled" disabled>
            Projects
            <span>Coming soon</span>
          </button>
          <button type="button" className="app-nav-item app-nav-item-disabled" disabled>
            Settings
            <span>Coming soon</span>
          </button>
        </nav>
      </aside>

      <section className="app-main">
        <header className="app-topbar">
          <div>
            <h1 className="app-title">{pageTitle}</h1>
            {statusText ? <p className="app-status">{statusText}</p> : null}
          </div>
          <div className="app-topbar-right">
            {actions}
            <div className="app-user-pill">
              <span className="app-avatar">{avatarLabel}</span>
              <span className="app-user-email">{email || "Not signed in"}</span>
            </div>
          </div>
        </header>
        <div className="app-content">{children}</div>
      </section>
    </main>
  );
}
