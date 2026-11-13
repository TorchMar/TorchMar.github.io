const STORAGE_KEY = 'torchmar-academic-language'
const supportedLanguages = new Set(['en', 'zh'])
const selector = document.querySelector('#language-select')
const navigation = document.querySelector('#site-nav')
const menu = document.querySelector('.nav-toggle')

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
  selector?.setAttribute('aria-label', nextLanguage === 'zh' ? '语言' : 'Language')
  navigation?.setAttribute('aria-label', nextLanguage === 'zh' ? '主导航' : 'Primary navigation')

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

if (menu && navigation) {
  menu.addEventListener('click', () => {
    menu.setAttribute('aria-expanded', String(menu.getAttribute('aria-expanded') === 'false'))
  })
  navigation.addEventListener('click', (event) => {
    if (event.target.closest('a'))
      menu.setAttribute('aria-expanded', 'false')
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true' && menu.offsetWidth) {
      menu.setAttribute('aria-expanded', 'false')
      menu.focus()
    }
  })
  document.body.dataset.enhanced = ''
}

const backToTop = document.querySelector('.back-to-top')
if (backToTop) {
  const updateBackToTop = () => {
    backToTop.hidden = window.scrollY < 240 && document.activeElement !== backToTop
  }
  window.addEventListener('scroll', updateBackToTop, { passive: true })
  backToTop.addEventListener('blur', updateBackToTop)
  updateBackToTop()
}
