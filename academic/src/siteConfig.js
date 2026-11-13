import newsItems from "../config/news.json";
import siteData from "../config/site.json";
import publicationItems from "../config/publications.json";
import experienceItems from "../config/experience.json";
import projectItems from "../config/projects.json";
import heroData from "../config/hero.json";
import aboutData from "../config/about.json";
import educationData from "../config/education.json";
import awardsData from "../config/awards.json";
import themeSource from "../config/theme.jsonc?raw";
import previewItems from "../config/publication-previews.json";
import { parseConfig } from "./utils/parseConfig";

const theme = parseConfig(themeSource, "config/theme.jsonc", true);

const assets = import.meta.glob("./assets/**/*", {
  eager: true,
  query: "?url",
  import: "default",
});

function resolveAsset(path) {
  if (!path) return path;
  const key = path.startsWith("assets/") ? `./${path}` : path;
  const asset = assets[key];
  if (!asset) throw new Error(`Config references an unknown asset: ${path}`);
  return asset;
}

export { newsItems };
export const site = siteData;

export const scholarProfileUrl = heroData.socialLinks.find(link => link.icon === "scholar")?.url;
export const publicationPreviews = Object.fromEntries(
  Object.entries(previewItems).map(([id, preview]) => [id, {
    ...preview,
    figure: resolveAsset(preview.figure),
  }]),
);

export const hero = {
  ...heroData,
  profileImage: resolveAsset(heroData.profileImage),
  brandLogo: resolveAsset(heroData.brandLogo),
  primaryLinks: heroData.primaryLinks.map((link) => ({
    ...link,
    url: link.asset ? resolveAsset(link.asset) : link.url,
  })),
};

export const about = aboutData;

export const education = educationData;
export const awards = awardsData;
export function isSectionVisible(section) {
  return section.enabled === true && Array.isArray(section.items) && section.items.length > 0;
}

export const publications = publicationItems.map((publication) => ({
  ...publication,
  image: resolveAsset(publication.image),
}));

export const experiences = experienceItems.map((experience) => ({
  ...experience,
  logo: resolveAsset(experience.logo),
}));

export const projects = projectItems.map((project) => ({
  ...project,
  image: resolveAsset(project.image),
  video: resolveAsset(project.video),
}));

export function applyTheme() {
  Object.entries(theme).forEach(([name, value]) => {
    if (value) document.documentElement.style.setProperty(name, value);
  });
}
