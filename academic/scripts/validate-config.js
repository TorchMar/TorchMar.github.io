import { loadConfigs, validateConfigs } from "./config-validation.js";

try {
  const errors = validateConfigs(loadConfigs());
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("Configuration valid: schema, publication IDs, preview data, and assets checked.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
