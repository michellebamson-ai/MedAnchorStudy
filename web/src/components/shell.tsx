"use client";

import { useState } from "react";
import Link from "next/link";
import { Brand, SIDEBAR_NAV } from "@/components/nav";
import { BrandMark } from "@/components/brand-mark";
import { ThemeSwitch } from "@/components/theme-switch";
import { GlobalSearch } from "@/components/global-search";

/**
 * App shell (ONBOARDING_SPEC.md): dark-teal left sidebar with the seven main
 * tabs, user card at the bottom; top bar with centred search, notification
 * bell and bookmark. Mobile gets a bottom bar plus a drawer for the full list.
 */
export function Shell({
  section,
  children,
  name = "Student",
  role = "Medical student",
  topics = [],
  searchPlaceholder = "Search topics, questions, or ask MedAnchor…",
}: {
  section: string;
  children: React.ReactNode;
  name?: string;
  role?: string;
  topics?: { slug: string; title: string }[];
  searchPlaceholder?: string;
}) {
  const [drawer, setDrawer] = useState(false);
  const initial = (name.trim().slice(0, 1) || "S").toUpperCase();
  const current = `/${section}`;

  const links = (
    <>
      {SIDEBAR_NAV.map((item) => {
        const active = current === item.href || current.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="side-link"
            aria-current={active ? "page" : undefined}
            title={item.role}
            onClick={() => setDrawer(false)}
          >
            <span className="side-icon" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="app">
      {/* ---------------- Sidebar ---------------- */}
      <aside className="sidebar" aria-label="Main navigation">
        <div className="side-brand">
          <BrandMark size={40} label="MedAnchor Study logo" />
          <div>
            <span className="side-brand-name">MedAnchor</span>
            <span className="side-brand-sub">Study</span>
          </div>
        </div>
        <nav className="side-nav" aria-label="Primary">
          {links}
        </nav>
        <div className="side-user">
          <span className="side-avatar" aria-hidden="true">
            {initial}
          </span>
          <span className="side-user-text">
            <span className="side-user-name">{name}</span>
            <span className="side-user-role">{role}</span>
          </span>
        </div>
      </aside>

      {/* ---------------- Mobile drawer ---------------- */}
      {drawer ? (
        <div
          className="palette-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawer(false);
          }}
        >
          <div className="drawer" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="side-brand" style={{ marginBottom: "var(--sp-4)" }}>
              <BrandMark size={36} label="MedAnchor Study logo" />
              <div>
                <span className="side-brand-name">MedAnchor</span>
                <span className="side-brand-sub">Study</span>
              </div>
            </div>
            <nav className="side-nav" aria-label="Primary">
              {links}
            </nav>
            <button className="btn btn-ghost btn-sm" onClick={() => setDrawer(false)} type="button">
              Close
            </button>
          </div>
        </div>
      ) : null}

      {/* ---------------- Main column ---------------- */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-inner topbar-app">
            <button
              className="menu-btn icon-btn"
              type="button"
              aria-label="Open navigation"
              onClick={() => setDrawer(true)}
            >
              <span aria-hidden="true">☰</span>
            </button>
            <Brand />
            <GlobalSearch topics={topics} placeholder={searchPlaceholder} />
            <div className="topbar-right">
              <ThemeSwitch />
              <button className="icon-btn" type="button" aria-label="Notifications">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
              </button>
              <button className="icon-btn" type="button" aria-label="Bookmarks">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              </button>
              <span className="avatar" aria-label="Student profile">
                {initial}
              </span>
            </div>
          </div>
        </header>
        <main className="content content-wide">{children}</main>

        {/* ---------------- Mobile bottom bar ---------------- */}
        <nav className="bottombar" aria-label="Primary">
          {SIDEBAR_NAV.slice(0, 4).map((item) => {
            const active = current === item.href || current.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="bottombar-link"
                aria-current={active ? "page" : undefined}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            className="bottombar-link"
            type="button"
            aria-label="More navigation"
            onClick={() => setDrawer(true)}
          >
            <span aria-hidden="true">⋯</span>
            <span>More</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
