import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {Provider, defaultTheme} from '@adobe/react-spectrum'
import {registerSW} from 'virtual:pwa-register'
import './index.css'
import App from './app/App'

void registerSW({immediate: true})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider theme={defaultTheme} colorScheme="light">
      <App />
    </Provider>
  </StrictMode>,
)
