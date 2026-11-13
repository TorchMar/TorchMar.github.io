import React, { useEffect, useState } from "react";
import { Award, GraduationCap, BookOpen, BriefcaseBusiness, FolderKanban, Newspaper, UserRound } from "lucide-react";
import "../css/Header.css";
import { hero, education, awards, isSectionVisible } from "../siteConfig";
import recommendations from "../../config/paper-recommendations.json";
import { isDailyPapersVisible } from "../utils/sectionVisibility";

function DailyPaperIcon(props) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3H5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M7 11h5M7 15h8M7 18h6" />
    <path d="m18 2 1.3 3.7L23 7l-3.7 1.3L18 12l-1.3-3.7L13 7l3.7-1.3Z" />
  </svg>;
}

const NAV = [
  { id: "about", label: "About", icon: UserRound },
  { id: "news", label: "News", icon: Newspaper },
  { id: "publications", label: "Publications", icon: BookOpen },
  { id: "experience", label: "Experience", icon: BriefcaseBusiness },
  ...(isSectionVisible(education) ? [{ id: "education", label: "Education", icon: GraduationCap }] : []),
  ...(isSectionVisible(awards) ? [{ id: "awards", label: "Awards", icon: Award }] : []),
  { id: "projects", label: "Projects", icon: FolderKanban },
  ...(isDailyPapersVisible(recommendations) ? [{ id: "daily-papers", label: "Trends", icon: DailyPaperIcon }] : []),
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY >= 20);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);
  const handleClick = (id) => {
    const target = id === "about" ? document.querySelector("#about .intro-text") : document.getElementById(id);
    if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 70, behavior: "smooth" });
    setMenuOpen(false);
  };
  return (
    <header style={{ "--nav-count": NAV.length }} className={`header-wrapper ${scrolled ? "is-scrolled" : ""} ${menuOpen ? "menu-open" : ""}`}><div className="header-container">
      <button className="header-name brand-button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
        <img className="brand-logo" src={hero.brandLogo} alt={`${hero.name} logo`} />
      </button>
      <button className={`hamburger ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}><span className="bar bar1" /><span className="bar bar2" /><span className="bar bar3" /></button>
      <nav className={`header-nav ${menuOpen ? "show" : ""}`}>{NAV.map((item) => {
        const Icon = item.icon;
        return <button key={item.id} className="nav-item" onClick={() => handleClick(item.id)}><span className="nav-item-content"><Icon aria-hidden="true" />{item.label}</span></button>;
      })}</nav>
    </div></header>
  );
}
