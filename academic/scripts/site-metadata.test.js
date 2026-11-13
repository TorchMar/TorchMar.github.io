import test from "node:test";
import assert from "node:assert/strict";
import { renderSiteMetadata } from "./site-metadata.js";
import { loadConfigs, validateConfigs } from "./config-validation.js";

test("site metadata is safely embedded in HTML", () => {
  const html = renderSiteMetadata('<html lang="%SITE_LANGUAGE%"><title>%SITE_TITLE%</title><meta content="%SITE_DESCRIPTION%">', {
    language: "en", title: "A & B <Research>", description: 'An "example" <script>',
  });
  assert.match(html, /A &amp; B &lt;Research&gt;/);
  assert.match(html, /An &quot;example&quot; &lt;script&gt;/);
  assert.doesNotMatch(html, /%SITE_/);
});

test("site settings reject missing fields and invalid language tags", () => {
  const configs = loadConfigs();
  delete configs["site.json"].title;
  configs["site.json"].language = 'en"';
  const errors = validateConfigs(configs).join("\n");
  assert.match(errors, /site.json.*title/);
  assert.match(errors, /site.json.*language/);
});
