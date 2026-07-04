import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {registerSW} from 'virtual:pwa-register'
import '@react-spectrum/s2/page.css'
import './index.css'
import App from './app/App'
import {AppThemeProvider} from './app/theme'

void registerSW({immediate: true})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppThemeProvider>
      <App />
    </AppThemeProvider>
  </StrictMode>,
)
