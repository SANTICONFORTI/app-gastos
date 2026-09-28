import { motion } from 'framer-motion'
import ProfileForm from '../components/ProfileForm'
import { useAuth } from '../store/AuthProvider'
import { listContainer, listItem } from '../lib/motion'

/** First screen after creating an account: name, @username and photo. */
export default function WelcomeScreen() {
  const { user, profile, reloadProfile, signOut } = useAuth()

  return (
    <motion.main className="auth" variants={listContainer} initial="hidden" animate="show">
      <motion.div variants={listItem} className="auth-brand">
        <h1 className="auth-title">¡Bienvenido!</h1>
        <p className="auth-tagline">Armá tu perfil. Así te van a encontrar tus amigos para compartir gastos.</p>
      </motion.div>
      <motion.div variants={listItem} className="auth-card glass">
        <ProfileForm user={user} profile={profile} submitLabel="Empezar" onSaved={reloadProfile} />
      </motion.div>
      <motion.button variants={listItem} type="button" className="link-btn" onClick={signOut}>
        Salir y entrar con otra cuenta
      </motion.button>
    </motion.main>
  )
}
