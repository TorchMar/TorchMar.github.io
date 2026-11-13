export function isDailyPapersVisible(config) {
  return config.enabled === true && config.daily?.enabled === true &&
    Array.isArray(config.daily.keywords) && config.daily.keywords.length > 0;
}
