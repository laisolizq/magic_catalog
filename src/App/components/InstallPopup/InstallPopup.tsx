import { useEffect, useState } from 'react'

import './InstallPopup.css'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function InstallPopup() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  // Start as installed if already running in standalone mode
  const [isInstalled, setIsInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches
  )

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const showIosHint = isiOS && !isStandalone

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const onAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  return (
    <section className="install-popup" aria-label="Install">
      {deferredPrompt && !isInstalled && (
        <button type="button" className="install-cta" onClick={handleInstall}>
          Install app
        </button>
      )}
      {showIosHint && !isInstalled && !deferredPrompt && (
        <p className="ios-hint">
          On iPhone/iPad, open Safari Share and choose Add to Home Screen.
        </p>
      )}
    </section>
  )
}
