import React, { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import "../css/Footer.css";
import { site } from "../siteConfig";

export default function Footer() {
  const year = new Date().getFullYear();
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const updateBackToTopVisibility = () => setShowBackToTop(window.scrollY > 200);

    updateBackToTopVisibility();
    window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });

    return () => window.removeEventListener("scroll", updateBackToTopVisibility);
  }, []);

  return (
    <footer className="site-footer">
      <div className="site-footer-content">
        <p>© {year} {site.copyrightName}.</p>
        <button
          className={`back-to-top${showBackToTop ? " is-visible" : ""}`}
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          aria-hidden={!showBackToTop}
          tabIndex={showBackToTop ? 0 : -1}
          title="Back to top"
        >
          <ArrowUp size={19} aria-hidden="true" />
        </button>
      </div>
    </footer>
  );
}
