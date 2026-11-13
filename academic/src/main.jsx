import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { applyTheme } from './siteConfig.js'

// Reload starts at the top; ordinary visits retain anchor navigation.
if (performance.getEntriesByType('navigation')[0]?.type === 'reload') {
  const restoration = history.scrollRestoration
  history.scrollRestoration = 'manual'
  const resetScroll = () => requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    history.scrollRestoration = restoration
  })
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  if (document.readyState === 'complete') resetScroll()
  else window.addEventListener('load', resetScroll, { once: true })
}

applyTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
