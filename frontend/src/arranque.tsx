import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AccessibilityProvider } from './context/AccessibilityContext'
import App from './App.tsx'
import DialogoGlobal from './components/common/DialogoGlobal'

// Monta la aplicación React. Lo invoca main.tsx, a veces tras el primer pintado.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AccessibilityProvider>
          <App />
          <DialogoGlobal />
        </AccessibilityProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
