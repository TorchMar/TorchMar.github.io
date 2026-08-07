const STORAGE_KEY = 'torchmar-academic-language'
const supportedLanguages = new Set(['en', 'zh'])
const selector = document.querySelector('#language-select')

function getStoredLanguage() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return supportedLanguages.has(stored) ? stored : 'en'
  }
  catch {
    return 'en'
  }
}

function setLanguage(language, persist = true) {
  const nextLanguage = supportedLanguages.has(language) ? language : 'en'
  document.documentElement.dataset.language = nextLanguage
  document.documentElement.lang = nextLanguage === 'zh' ? 'zh-CN' : 'en'

  document.querySelectorAll('[data-alt-en]').forEach((image) => {
    image.alt = nextLanguage === 'zh'
      ? image.dataset.altZh || image.dataset.altEn
      : image.dataset.altEn
  })

  if (selector)
    selector.value = nextLanguage

  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, nextLanguage)
    }
    catch {
      // The selected language still applies for this page view.
    }
  }
}

selector?.addEventListener('change', event => setLanguage(event.target.value))
setLanguage(getStoredLanguage(), false)
