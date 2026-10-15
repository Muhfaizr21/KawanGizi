import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const PWAContext = createContext({
  isInstalled: false,
  deferredPrompt: null,
  isMobile: false,
  isIOS: false,
  promptInstall: async () => null,
  clearDeferredPrompt: () => {},
})

export function PWAProvider({ children }) {
  const [isInstalled, setIsInstalled] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // 1. Detect Mobile / Tablet Environment
    const ua = navigator.userAgent || ''
    const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua)
    const touchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    const mobileOrTablet = mobileUA || (touchScreen && window.innerWidth <= 1024)
    setIsMobile(mobileOrTablet)

    // Detect iOS
    const iosDevice = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
    setIsIOS(iosDevice)

    // 2. Detect Standalone Mode (Installed PWA)
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches
      const isIOSStandalone = window.navigator.standalone === true
      const isTWA = document.referrer && document.referrer.startsWith('android-app://')
      const isFullscreenStandalone = window.matchMedia('(display-mode: fullscreen)').matches

      if (isStandaloneMedia || isIOSStandalone || isTWA || isFullscreenStandalone) {
        setIsInstalled(true)
        return true
      }
      return false
    }

    const alreadyInstalled = checkStandalone()

    // Listen for display-mode changes (e.g. launch or transition)
    const mediaQueryList = window.matchMedia('(display-mode: standalone)')
    const handleDisplayModeChange = (e) => {
      if (e.matches) {
        setIsInstalled(true)
        setDeferredPrompt(null)
      }
    }

    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handleDisplayModeChange)
    } else if (mediaQueryList.addListener) {
      mediaQueryList.addListener(handleDisplayModeChange)
    }

    // 3. Listen for 'beforeinstallprompt'
    const handleBeforeInstallPrompt = (e) => {
      // Prevent browser default mini-infobar
      e.preventDefault()
      // Store event for later activation
      setDeferredPrompt(e)
    }

    // 4. Listen for 'appinstalled'
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      console.log('[PWA] Aplikasi KawanGizi berhasil dipasang (appinstalled).')
    }

    if (!alreadyInstalled) {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', handleDisplayModeChange)
      } else if (mediaQueryList.removeListener) {
        mediaQueryList.removeListener(handleDisplayModeChange)
      }
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // Method to trigger the installation prompt
  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      return null
    }

    try {
      // Show the install prompt
      deferredPrompt.prompt()

      // Wait for user choice
      const choiceResult = await deferredPrompt.userChoice
      if (choiceResult && choiceResult.outcome === 'accepted') {
        setIsInstalled(true)
        setDeferredPrompt(null)
      }
      return choiceResult
    } catch (err) {
      console.error('[PWA] Gagal memicu install prompt:', err)
      return null
    }
  }, [deferredPrompt])

  const clearDeferredPrompt = useCallback(() => {
    setDeferredPrompt(null)
  }, [])

  const value = {
    isInstalled,
    deferredPrompt,
    isMobile,
    isIOS,
    promptInstall,
    clearDeferredPrompt,
  }

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>
}

export function usePWA() {
  const context = useContext(PWAContext)
  if (!context) {
    throw new Error('usePWA must be used within a PWAProvider')
  }
  return context
}

export { PWAContext }
