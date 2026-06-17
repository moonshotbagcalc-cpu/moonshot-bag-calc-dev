import { useState, useEffect, useCallback } from "react";
import { NAV_GROUPS } from "../nav-config.js";
import AboutModal from "./AboutModal.jsx";

function ChevronRight() {
  return (
    <svg className="ms-accordion-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg className="ms-accordion-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Only groups with at least one functional tab appear in the mobile drawer
const visibleGroups = NAV_GROUPS.filter(g => g.pages.some(p => p.functional));

export default function MobileNav({ page, setPage, activeGroup }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState(activeGroup.id);
  const [scrolled, setScrolled] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleGroupToggle = useCallback((groupId) => {
    setExpandedGroup(prev => prev === groupId ? null : groupId);
  }, []);

  const handlePageClick = useCallback((pageId) => {
    setPage(pageId);
    setDrawerOpen(false);
  }, [setPage]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <>
      {/* 44px mobile header */}
      <div className="ms-site-header">
        <div className="ms-header-inner">
          <div className="ms-header-left">
            <div className="ms-wordmark">
              Moonshot<span> Bag Calculator</span>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button
              className="ms-info-btn"
              onClick={() => setShowAbout(true)}
              aria-label="About this calculator"
              title="About this calculator"
            >
              i
            </button>
            <button
              className="ms-burger-btn"
              onClick={() => setDrawerOpen(v => !v)}
              aria-expanded={drawerOpen}
              aria-label={drawerOpen ? "Close navigation" : "Open navigation"}
            >
              {drawerOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* 3px color stripe below header */}
        <div className="ms-mobile-stripe" data-group={activeGroup.id} aria-hidden="true" />

        {/* Accordion drawer — only groups with functional tabs */}
        <div className={`ms-mobile-nav-drawer${drawerOpen ? " open" : ""}`} aria-hidden={!drawerOpen}>
          {visibleGroups.map((group) => {
            const isExpanded = expandedGroup === group.id;
            const functionalPages = group.pages.filter(p => p.functional);
            return (
              <div key={group.id} className="ms-accordion-group">
                <button
                  className={`ms-accordion-trigger${isExpanded ? " expanded" : ""}`}
                  data-group={group.id}
                  onClick={() => handleGroupToggle(group.id)}
                  aria-expanded={isExpanded}
                >
                  {group.label}
                  {isExpanded ? <ChevronDown /> : <ChevronRight />}
                </button>
                <div
                  className={`ms-accordion-panel${isExpanded ? " open" : ""}`}
                  data-group={group.id}
                >
                  {functionalPages.map(item => (
                    <button
                      key={item.id}
                      className={`ms-accordion-item${page === item.id ? " active" : ""}`}
                      data-group={group.id}
                      onClick={() => handlePageClick(item.id)}
                      aria-current={page === item.id ? "page" : undefined}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fixed bottom utility bar */}
      <div className="ms-mobile-bottom-bar">
        <button
          className="ms-tng-btn"
          onClick={() => window.open(
            "https://moonshotbagcalc-cpu.github.io/moonshot-bag-calc/thread-needle.html",
            "moonshot-thread-guide"
          )}
        >
          Thread &amp; Needle Guide
        </button>
      </div>

      {/* Back-to-top */}
      <button
        className={`ms-top-btn${scrolled ? " visible" : ""}`}
        onClick={scrollToTop}
        aria-label="Back to top"
      >
        <svg width="13" height="9" viewBox="0 0 13 9" fill="none" aria-hidden="true">
          <path d="M1 8L6.5 1.5L12 8" stroke="#5a2da0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        TOP
      </button>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </>
  );
}
