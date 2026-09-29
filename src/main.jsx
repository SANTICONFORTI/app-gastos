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
import ErrorBoundary from './components/ErrorBoundary'
import PublicEventPage from './screens/PublicEventPage'
import { EventsStoreProvider } from './store/EventsStore'
import { ExtrasStoreProvider } from './store/ExtrasStore'
import { capturePendingInviteCode } from './lib/inviteLink'
import './styles/global.css'
import './styles/components.css'

capturePendingInviteCode()

// Public event link: /?evento=TOKEN works without logging in.
const publicEventToken = new URLSearchParams(window.location.search).get('evento')

/** Decides what to show depending on the session. */
function Gate() {
  const { status, user, profile, profileError, reloadProfile, signOut } = useAuth()

  if (publicEventToken) return <PublicEventPage token={publicEventToken} />
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
      <EventsStoreProvider>
        <ExtrasStoreProvider>
          <App />
        </ExtrasStoreProvider>
      </EventsStoreProvider>
    </PersonalStoreProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </ErrorBoundary>
    </MotionConfig>
  </StrictMode>,
)
