import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { parseConfig } from "../src/utils/parseConfig.js";
import { getPublicationTemplate, publicationTemplates } from "../src/utils/publicationTemplates.js";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const configTypes = {
  "site.json": "site",
  "hero.json": "hero", "about.json": "about", "news.json": "news",
  "publications.json": "publications", "experience.json": "experience",
  "projects.json": "projects", "education.json": "education", "awards.json": "awards",
  "publication-previews.json": "previews", "theme.jsonc": "theme",
  "paper-recommendations.json": "recommendations",
};
const schema = JSON.parse(fs.readFileSync(path.join(root, "config/schemas/site.schema.json"), "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema(schema, "site");

export function loadConfigs() {
  return Object.fromEntries(Object.keys(configTypes).map(filename => [filename,
    parseConfig(fs.readFileSync(path.join(root, "config", filename), "utf8"), `config/${filename}`, filename.endsWith(".jsonc")),
  ]));
}

export function validateConfigs(configs, assetExists = file => fs.existsSync(path.join(root, "src", file))) {
  const errors = [];
  for (const [filename, type] of Object.entries(configTypes)) {
    const validate = ajv.getSchema(`site#/$defs/${type}`);
    if (!validate(configs[filename])) {
      errors.push(...validate.errors.map(error => `config/${filename}${error.instancePath || "/"}: ${error.message} ${JSON.stringify(error.params)}`));
    }
  }
  // Do not traverse malformed data: schema diagnostics above are more useful.
  if (errors.length) return errors;

  function checkAssets(value, location) {
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      const at = `${location}/${key}`;
      if (["asset", "image", "video", "logo", "profileImage", "brandLogo", "figure"].includes(key) && typeof item === "string") {
        if (item.split("/").includes("..") || !assetExists(item)) errors.push(`${at}: asset not found: ${item}`);
      } else checkAssets(item, at);
    }
  }
  for (const [filename, config] of Object.entries(configs)) checkAssets(config, `config/${filename}`);
  const ids = new Set();
  for (const [index, paper] of configs["publications.json"].entries()) {
    if (ids.has(paper.id)) errors.push(`config/publications.json/${index}/id: duplicate ID "${paper.id}"`);
    ids.add(paper.id);
  }
  for (const [id, story] of Object.entries(configs["publication-previews.json"])) {
    const at = `config/publication-previews.json/${id}`;
    if (!ids.has(id)) errors.push(`${at}: no publication has this ID`);
    const template = getPublicationTemplate(story);
    if (story.template && story.layout && story.template !== story.layout) errors.push(`${at}: template and legacy layout must agree`);
    for (const key of publicationTemplates[template].required) {
      if (story[key] === undefined) errors.push(`${at}/${key}: required for ${template} template`);
    }
    for (const [index, row] of (story.rows || []).entries()) {
      const required = template === "comparison" ? ["reference", "referenceLabel"] : template === "budget" ? ["secondary"] : template === "challenge" ? ["rank"] : [];
      for (const key of required) if (row[key] === undefined) errors.push(`${at}/rows/${index}/${key}: required for ${template} template`);
      if (template === "budget" && !/^\d+(\.\d+)?%$/.test(row.label)) errors.push(`${at}/rows/${index}/label: expected a percentage, e.g. 10%`);
    }
    for (const collection of ["rows", "ablationRows"]) {
      for (const [index, row] of (story[collection] || []).entries()) {
        for (const key of ["value", "secondary", "reference"]) {
          if (row[key] === undefined) continue;
          const percent = template === "challenge" && key === "value";
          const number = Number.parseFloat(row[key]);
          if (number < 0 || number > (percent ? 100 : 1) || (percent !== row[key].endsWith("%"))) {
            errors.push(`${at}/${collection}/${index}/${key}: expected ${percent ? "0%–100%" : "a value from 0 to 1"}`);
          }
        }
      }
    }
  }
  return errors;
}
