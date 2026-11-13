import React, { lazy, Suspense, useState } from "react";
import "../css/Hero.css";
import { FaGithub, FaLinkedin } from "react-icons/fa";
import { FaGoogleScholar } from "react-icons/fa6";
import { MdEmail } from "react-icons/md";
import { RiInstagramFill } from "react-icons/ri";
import { TbBrandOpenai } from "react-icons/tb";
import { Camera, Sparkles } from "lucide-react";
import { hero } from "../siteConfig";
const loadResumePreview = () => import("./ResumePreview");
const ResumePreview = lazy(loadResumePreview);

const descriptionIcons = {
  openai: TbBrandOpenai,
  sparkles: Sparkles,
  camera: Camera,
};

const socialIcons = {
  email: MdEmail,
  github: FaGithub,
  scholar: FaGoogleScholar,
  linkedin: FaLinkedin,
  instagram: RiInstagramFill,
};

export default function Hero() {
  const [preview, setPreview] = useState(null);
  return (
    <div className="hero-grid"><div className="hero-left">
      <img src={hero.profileImage} alt={hero.name} className="profile-pic" draggable={false} fetchPriority="high" />
      <div className="hero-meta">
        <div className="meta-name">{hero.name}</div><div>{hero.title}</div>
        <div className="meta-description">
          {hero.descriptions.map((item) => {
            const Icon = descriptionIcons[item.icon];
            return <div className="meta-description-row" key={item.text}>{Icon && <Icon aria-hidden="true" />}<span>{item.text}</span></div>;
          })}
        </div>
        <div className="meta-link">
          {hero.primaryLinks.map((link) => link.url ? (
            <a className="meta-linkitem" href={link.url} target="_blank" rel="noreferrer" key={link.label}
              aria-haspopup={link.preview === "pdf" ? "dialog" : undefined}
              onPointerEnter={() => { if (link.preview === "pdf") void loadResumePreview(); }}
              onFocus={() => { if (link.preview === "pdf") void loadResumePreview(); }}
              onClick={event => { if (link.preview === "pdf" && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); setPreview(link); } }}>{link.label}</a>
          ) : (
            <span className="meta-linkitem" aria-disabled="true" key={link.label}>{link.label} · Unavailable</span>
          ))}
        </div>
        <div className="contact-small">{hero.socialLinks.map((item) => {
          const Icon = socialIcons[item.icon];
          if (!item.url) {
            const label = `${item.label} · Unavailable`;
            return <span key={item.label} role="img" aria-label={label} title={label} aria-disabled="true" className="icon-link">{Icon && <Icon aria-hidden="true" />}</span>;
          }
          return <a key={item.label} aria-label={item.label} title={item.label} href={item.url} target="_blank" rel="noreferrer" className="icon-link">{Icon && <Icon aria-hidden="true" />}</a>;
        })}</div>
        <div className="small-text">Last updated: {import.meta.env.VITE_BUILD_DATE}</div>
      </div>
    </div>{preview && <Suspense fallback={null}><ResumePreview url={preview.url} name={hero.name} onClose={() => setPreview(null)} /></Suspense>}</div>
  );
}
