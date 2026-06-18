import { useState, useRef, useEffect } from "react";
import { setCurrentUnit } from "./utils/formatting.js";
import { GA_MEASUREMENT_ID } from "./utils/constants.js";
import "./moonshot.css";
import { NAV_GROUPS, navGroupForPage } from "./nav-config.js";
import NavBar from "./components/NavBar.jsx";
import MobileNav from "./components/MobileNav.jsx";
import Footer from "./components/Footer.jsx";

// ── Google Analytics (GA4) ──────────────────────────────────────────────────
if (typeof window !== "undefined" && typeof document !== "undefined" && GA_MEASUREMENT_ID) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };

  if (!document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"]`)) {
    const gaScript = document.createElement("script");
    gaScript.async = true;
    gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(gaScript);

    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID, {
      send_page_view: true,
      anonymize_ip: true,
    });
  }
}

// ── Browser chrome tint ───────────────────────────────────────────────────────
if (typeof document !== "undefined" && !document.querySelector('meta[name="theme-color"]')) {
  const tc = document.createElement("meta");
  tc.name = "theme-color";
  tc.content = "#1e1040";
  document.head.appendChild(tc);
}

// ── Google Fonts ──────────────────────────────────────────────────────────────
if (typeof document !== "undefined") {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=DM+Mono:wght@400;500&display=swap";
  document.head.appendChild(link);
}

// ── Page-reactive background patterns (stable module-level ref) ──

// Bag Structures — pale purple field with slightly darker purple 45° diagonal lines
const BAG_STRUCTURES_BG = {
  color: "#ede8f8",
  img: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40 L40 0 M-10 10 L10 -10 M30 50 L50 30' stroke='%235a2da0' stroke-width='0.8' fill='none' opacity='0.13'/%3E%3C/svg%3E")`,
};

const PAGE_PATTERNS = {
    // Bag Structures (all six pages share the same dark indigo field)
    "simple-bottom":      BAG_STRUCTURES_BG,
    "rectangular-panel":  BAG_STRUCTURES_BG,
    "curved-panel":       BAG_STRUCTURES_BG,
    "tapered-panel":      BAG_STRUCTURES_BG,
    "boxed-bottom":       BAG_STRUCTURES_BG,
    gussets:              BAG_STRUCTURES_BG,
    // Trim & Pockets
    piping: {
      color: "#f8eefb",
      img: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22'%3E%3Cline x1='11' y1='0' x2='11' y2='22' stroke='%238e1a9e' stroke-width='0.6' opacity='0.1'/%3E%3C/svg%3E")`,
    },
    accordion: {
      color: "#eaf2fc",
      img: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='20'%3E%3Cpolyline points='0%2C10%2010%2C0%2020%2C10%2030%2C0%2040%2C10' fill='none' stroke='%231a4a7a' stroke-width='0.7' opacity='0.1'/%3E%3C/svg%3E")`,
    },
    "zipper-pocket": {
      color: "#eaf6f7",
      img: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cline x1='12' y1='0' x2='12' y2='24' stroke='%23176b78' stroke-width='0.55' opacity='0.09'/%3E%3C/svg%3E")`,
    },
    "welt-pocket": {
      color: "#eef1f8",
      img: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='18'%3E%3Cline x1='0' y1='9' x2='36' y2='9' stroke='%233a5c99' stroke-width='0.65' opacity='0.09'/%3E%3C/svg%3E")`,
    },
};

export default function MoonshotBagCalc() {
  const [page, setPage] = useState("curved-panel");
  const [unitMode, setUnitMode] = useState("imperial");
  setCurrentUnit(unitMode);

  const scrollPositions = useRef({});
  const visitedTabs     = useRef(new Set(["curved-panel"]));
  const lastPageByGroup = useRef(Object.fromEntries(NAV_GROUPS.map(g => {
    const firstFunctional = g.pages.find(p => p.functional);
    return [g.id, firstFunctional ? firstFunctional.id : g.pages[0].id];
  })));

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);

  useEffect(() => {
    const p = PAGE_PATTERNS[page] || PAGE_PATTERNS["simple-bottom"];
    document.body.style.transition = "background-color 0.4s ease";
    document.body.style.backgroundColor = p.color;
    document.body.style.backgroundImage = p.img;
    document.body.style.backgroundRepeat = "repeat";
    return () => {
      document.body.style.backgroundColor = "";
      document.body.style.backgroundImage = "";
    };
  }, [page]);

  function handleTabClick(newPage) {
    if (newPage === page) return;
    scrollPositions.current[page] = window.scrollY;
    const destinationGroup = navGroupForPage(newPage);
    lastPageByGroup.current[destinationGroup.id] = newPage;
    setPage(newPage);
    requestAnimationFrame(() => {
      if (!visitedTabs.current.has(newPage)) {
        window.scrollTo({ top: 0, behavior: "instant" });
        visitedTabs.current.add(newPage);
      } else {
        window.scrollTo({ top: scrollPositions.current[newPage] || 0, behavior: "instant" });
      }
    });
  }

  function handleGroupClick(group) {
    const firstFunctional = group.pages.find(p => p.functional);
    const target = lastPageByGroup.current[group.id] || (firstFunctional ? firstFunctional.id : group.pages[0].id);
    handleTabClick(target);
  }

  const activeGroup = navGroupForPage(page);

  const navProps = {
    page,
    setPage: handleTabClick,
    activeGroup,
    onGroupClick: handleGroupClick,
  };

  return (
    <div className="ms-app">
      {isMobile
        ? <MobileNav {...navProps} />
        : <NavBar {...navProps} />
      }

      {/* Page card: wraps tab content only */}
      <div className="ms-page-card">
        {/* Tab content — always mounted, shown/hidden to preserve state */}
        {NAV_GROUPS.flatMap(group => group.pages).map(item => {
          const TabComponent = item.component;
          return (
            <div key={item.id} style={{ display: page === item.id ? "block" : "none" }}>
              <TabComponent {...(item.id === "curved-panel" ? { unitMode, setUnitMode } : {})} />
            </div>
          );
        })}
      </div>

      {/* Footer: full-width sibling of ms-page-card, not contained within it */}
      <Footer />
    </div>
  );
}
