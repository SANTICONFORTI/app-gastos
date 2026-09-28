import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import App from './App'
import { AuthProvider, useAuth } from './store/AuthProvider'
import { PersonalStoreProvider } from './store/PersonalStore'
import AuthScreen from './screens/AuthScreen'
import WelcomeScreen from './screens/WelcomeScreen'
import NewPasswordScreen from './screens/NewPasswordScreen'
import StatusScreen from './screens/StatusScreen'
import './styles/global.css'
import './styles/components.css'

/** Decides what to show depending on the session. */
function Gate() {
  const { status, user, profile, profileError, reloadProfile, signOut } = useAuth()

  if (status === 'loading') return <StatusScreen loading />
  if (status === 'recovery') return <NewPasswordScreen />
  if (status === 'signed-out') return <AuthScreen />
  if (profileError && !profile) {
    return (
      <StatusScreen
        title="No pudimos cargar tu perfil"
        text="Revisá tu conexión a internet."
        action={{ label: 'Reintentar', onClick: reloadProfile }}
        secondary={{ label: 'Cerrar sesión', onClick: signOut }}
      />
    )
  }
  if (!profile?.username) return <WelcomeScreen />

  return (
    <PersonalStoreProvider key={user.id}>
      <App />
    </PersonalStoreProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </MotionConfig>
  </StrictMode>,
)
