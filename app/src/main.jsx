import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

console.log('[DIAG] main.jsx - createRoot started, t=', performance.now().toFixed(2))
try {
  const root = createRoot(document.getElementById('root'))
  console.log('[DIAG] main.jsx - createRoot succeeded, t=', performance.now().toFixed(2))
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  console.log('[DIAG] main.jsx - render() called, t=', performance.now().toFixed(2))
} catch(e) {
  console.error('[DIAG] main.jsx - EXCEPTION:', e)
}
