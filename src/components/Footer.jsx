import { useState } from "react";

export default function Footer() {
  const [emailShown, setEmailShown] = useState(false);
  // assembled at runtime — never a plain string in source
  const parts = ["[your", " email", " here]"];
  const email = parts.join("");

  return (
    <footer className="ms-footer">
      <div className="ms-footer-inner">
        {/* Left column: brand + manifesto */}
        <div className="ms-footer-left">
          <div>
            <div className="ms-footer-wordmark">
              Moonshot<span> Bag Calculator</span>
            </div>
            <div className="ms-footer-tagline">Houston, we have the math.</div>
          </div>
          <p className="ms-footer-manifesto">
            This calculator is for drafting your own designs and tweaking your
            projects — it's a math tool, not a pattern. Pattern designers do far
            more than geometry: construction, fit, instructions, and style are the
            real craft. If you love a designer's work, buy their patterns. This
            exists to support that world, not shortcut it.
          </p>
        </div>

        {/* Right column: contact (bottom space reserved for mascot) */}
        <div className="ms-footer-right">
          <h2 className="ms-footer-right-heading">
            Got thoughts? I'm genuinely all ears.
          </h2>
          <p className="ms-footer-right-sub">
            Questions, feedback, spotted a bug — whatever's on your mind.
          </p>
          {!emailShown ? (
            <button className="ms-footer-email-btn" onClick={() => setEmailShown(true)}>
              Show contact email
            </button>
          ) : (
            <span className="ms-footer-email">{email}</span>
          )}
          {/* Space below intentionally empty — reserved for mascot SVG */}
        </div>
      </div>

      {/* Copyright strip */}
      <div className="ms-footer-strip">
        <span className="ms-footer-copy">
          © Moonshot · made with love for the bag-making community
        </span>
      </div>
    </footer>
  );
}
