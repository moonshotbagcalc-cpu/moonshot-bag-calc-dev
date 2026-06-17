import { useEffect } from "react";

export default function AboutModal({ onClose }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="ms-about-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="About Moonshot">
      <div className="ms-about-modal" onClick={e => e.stopPropagation()}>
        <button className="ms-about-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="ms-about-title">About Moonshot</div>
        <div className="ms-about-body">
          <div className="ms-about-hi">Hi, I&apos;m Abby 👋</div>
          <p>
            I&apos;m a bag maker and designer obsessed with getting the math right.
            I built this calculator for myself and figured other makers could use it too.
            It&apos;s free, it&apos;s a work in progress, and I hope it saves you some seam-ripping.
          </p>
        </div>
      </div>
    </div>
  );
}
