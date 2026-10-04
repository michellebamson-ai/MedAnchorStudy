"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ALL_DESTINATIONS } from "@/components/nav";

type Topic = { slug: string; title: string };

/**
 * Global search (design spec §3: centrally available in the header; find
 * courses, topics, materials, sessions and features). ⌘K / Ctrl+K to open.
 */
export function GlobalSearch({
  topics = [],
  placeholder = "Search topics, materials, features",
}: {
  topics?: Topic[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      // Focus after paint so the dialog is mounted.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return { topics: topics.slice(0, 4), destinations: ALL_DESTINATIONS.slice(0, 6) };
    return {
      topics: topics
        .filter((t) => t.title.toLowerCase().includes(term) || t.slug.includes(term))
        .slice(0, 5),
      destinations: ALL_DESTINATIONS.filter(
        (d) =>
          d.label.toLowerCase().includes(term) ||
          (d.role ?? "").toLowerCase().includes(term) ||
          (d.blurb ?? "").toLowerCase().includes(term)
      ).slice(0, 6),
    };
  }, [q, topics]);

  const flat = useMemo(
    () => [
      ...results.topics.map((t) => ({ href: `/teach/${t.slug}`, label: t.title, meta: "Topic" })),
      ...results.destinations.map((d) => ({
        href: d.href,
        label: d.label,
        meta: d.role ?? "Feature",
      })),
    ],
    [results]
  );

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && flat[active]) {
      e.preventDefault();
      go(flat[active].href);
    }
  }

  let index = -1;

  return (
    <>
      <button className="search-trigger" onClick={() => setOpen(true)} type="button">
        <span aria-hidden="true">⌕</span>
        <span className="search-trigger-label">{placeholder}</span>
        <span className="kbd">Ctrl K</span>
      </button>

      {open ? (
        <div
          className="palette-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="palette" role="dialog" aria-modal="true" aria-label="Search">
            <input
              ref={inputRef}
              className="palette-input"
              placeholder="Search MedAnchor…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              aria-label="Search query"
            />
            <div className="palette-list">
              {flat.length === 0 ? (
                <div className="palette-item" style={{ color: "var(--text-3)" }}>
                  Nothing matched “{q}”
                </div>
              ) : null}

              {results.topics.length > 0 ? (
                <>
                  <div className="palette-group">Topics</div>
                  {results.topics.map((t) => {
                    index += 1;
                    const i = index;
                    return (
                      <button
                        key={`t-${t.slug}`}
                        className="palette-item"
                        data-active={active === i}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(`/teach/${t.slug}`)}
                        type="button"
                      >
                        <span aria-hidden="true">◆</span>
                        <span>{t.title}</span>
                        <span className="pi-meta">{t.slug}</span>
                      </button>
                    );
                  })}
                </>
              ) : null}

              {results.destinations.length > 0 ? (
                <>
                  <div className="palette-group">Features</div>
                  {results.destinations.map((d) => {
                    index += 1;
                    const i = index;
                    return (
                      <button
                        key={`d-${d.href}`}
                        className="palette-item"
                        data-active={active === i}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(d.href)}
                        type="button"
                      >
                        <span aria-hidden="true">❑</span>
                        <span>{d.label}</span>
                        <span className="pi-meta">{d.role ?? ""}</span>
                      </button>
                    );
                  })}
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
