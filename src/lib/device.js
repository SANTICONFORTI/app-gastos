// Install (PWA) and system notifications. No servers: notifications are shown by the app
// itself while it's open or minimized (push with the app fully closed would need a server).

const NOTIF_KEY = 'puly:notificaciones'
let installPrompt = null

/** Call at startup: Android/desktop Chrome fires this when the app can be installed. */
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installPrompt = e
  })
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
export const canPromptInstall = () => Boolean(installPrompt)

/** Shows the browser's install dialog. Returns 'accepted' | 'dismissed' | 'unavailable'. */
export async function promptInstall() {
  if (!installPrompt) return 'unavailable'
  installPrompt.prompt()
  const { outcome } = await installPrompt.userChoice
  installPrompt = null
  return outcome
}

export const notificationsSupported = () => 'Notification' in window

export function notificationsEnabled() {
  try {
    return notificationsSupported() && Notification.permission === 'granted' && localStorage.getItem(NOTIF_KEY) === 'on'
  } catch {
    return false
  }
}

/** Asks for permission and turns them on. Returns true if enabled. */
export async function enableNotifications() {
  if (!notificationsSupported()) return false
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false
  localStorage.setItem(NOTIF_KEY, 'on')
  return true
}

export function disableNotifications() {
  localStorage.setItem(NOTIF_KEY, 'off')
}

/** Shows a system notification if enabled and the app isn't in front. */
export async function notify(title, body) {
  if (!notificationsEnabled() || document.visibilityState === 'visible') return
  const options = { body, icon: '/icon-192.png', badge: '/icon-192.png', lang: 'es-AR' }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, options)
    else new Notification(title, options)
  } catch {
    // Some browsers only allow notifications from a service worker; ignore quietly.
  }
}
