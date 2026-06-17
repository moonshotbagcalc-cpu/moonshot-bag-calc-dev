import { useState, useEffect, useCallback } from "react";
import { NAV_GROUPS } from "../nav-config.js";
import AboutModal from "./AboutModal.jsx";

// Only groups with at least one functional tab appear in primary nav
const visibleGroups = NAV_GROUPS.filter(g => g.pages.some(p => p.functional));

export default function NavBar({ page, setPage, activeGroup, onGroupClick }) {
  const [scrolled, setScrolled] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Only show functional sub-tabs
  const subPages = activeGroup.pages.filter(item => item.functional);

  return (
    <>
      <div className={`ms-site-header${scrolled ? " scrolled" : ""}`}>
        <div className="ms-header-inner">
          {/* Left: wordmark + tagline */}
          <div className="ms-header-left">
            <div className="ms-wordmark">
              Moonshot<span> Bag Calculator</span>
            </div>
            <div className="ms-tagline">Houston, we have the math.</div>
          </div>

          {/* Right: tools + primary nav */}
          <div className="ms-header-right">
            {/* Tools row */}
            <div className="ms-header-tools">
              <button
                className="ms-tng-btn"
                onClick={() => window.open(
                  "https://moonshotbagcalc-cpu.github.io/moonshot-bag-calc/thread-needle.html",
                  "moonshot-thread-guide"
                )}
              >
                Thread &amp; Needle Guide
              </button>
              <button
                className="ms-info-btn"
                onClick={() => setShowAbout(true)}
                aria-label="About this calculator"
                title="About this calculator"
              >
                i
              </button>
            </div>

            {/* Primary group nav — only groups with functional tabs */}
            <nav className="ms-primary-nav" aria-label="Calculator categories">
              {visibleGroups.map(group => (
                <button
                  key={group.id}
                  className={`ms-primary-tab${activeGroup.id === group.id ? " active" : ""}`}
                  data-group={group.id}
                  onClick={() => onGroupClick(group)}
                  aria-pressed={activeGroup.id === group.id}
                >
                  {group.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Sub-nav: color bar + sub-tabs as siblings inside wrapper */}
        <div className={`ms-subnav-wrapper${scrolled ? " scrolled" : ""}`}>
          <div className="ms-subnav-bar" data-group={activeGroup.id} aria-hidden="true" />
          <div className="ms-subnav-tabs" role="tablist" aria-label={`${activeGroup.label} calculators`}>
            {subPages.map(item => (
              <button
                key={item.id}
                role="tab"
                className={`ms-sub-tab${page === item.id ? " active" : ""}`}
                data-group={activeGroup.id}
                aria-selected={page === item.id}
                onClick={() => setPage(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Back-to-top button */}
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
