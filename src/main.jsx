import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { PersonalStoreProvider } from './store/PersonalStore'
import './styles/global.css'
import './styles/components.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PersonalStoreProvider>
      <App />
    </PersonalStoreProvider>
  </StrictMode>,
)
