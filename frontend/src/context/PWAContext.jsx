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
  const [deferredPrompt, setDeferredPrompt] = useState(() => (typeof window !== 'undefined' ? window.__deferredInstallPrompt : null))
  const [isMobile, setIsMobile] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Check if prompt was captured early by inline script
    if (typeof window !== 'undefined' && window.__deferredInstallPrompt) {
      console.log('beforeinstallprompt fired! (early capture in window.__deferredInstallPrompt)')
      setDeferredPrompt(window.__deferredInstallPrompt)
    }

    const handleEarlyPrompt = () => {
      console.log('beforeinstallprompt fired! (via pwa:promptready event)')
      if (typeof window !== 'undefined' && window.__deferredInstallPrompt) {
        setDeferredPrompt(window.__deferredInstallPrompt)
      }
    }
    window.addEventListener('pwa:promptready', handleEarlyPrompt)

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
      console.log('beforeinstallprompt fired!', e)
      // Prevent browser default mini-infobar
      e.preventDefault()
      // Store event for later activation
      setDeferredPrompt(e)
      if (typeof window !== 'undefined') {
        window.__deferredInstallPrompt = e
      }
    }

    // 4. Listen for 'appinstalled'
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      if (typeof window !== 'undefined') {
        window.__deferredInstallPrompt = null
      }
      console.log('[PWA] Aplikasi KawanGizi berhasil dipasang (appinstalled).')
    }

    if (!alreadyInstalled) {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('pwa:promptready', handleEarlyPrompt)
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
    const promptEvent = deferredPrompt || (typeof window !== 'undefined' ? window.__deferredInstallPrompt : null)
    if (!promptEvent) {
      return null
    }

    try {
      // Show the install prompt
      await promptEvent.prompt()

      // Wait for user choice
      const choiceResult = await promptEvent.userChoice
      if (choiceResult && choiceResult.outcome === 'accepted') {
        setIsInstalled(true)
      }
      return choiceResult
    } catch (err) {
      console.error('[PWA] Gagal memicu install prompt:', err)
      return null
    } finally {
      // Clear deferredPrompt regardless of whether accepted or dismissed
      setDeferredPrompt(null)
      if (typeof window !== 'undefined') {
        window.__deferredInstallPrompt = null
      }
    }
  }, [deferredPrompt])

  const clearDeferredPrompt = useCallback(() => {
    setDeferredPrompt(null)
    if (typeof window !== 'undefined') {
      window.__deferredInstallPrompt = null
    }
  }, [])

  const value = {
    isInstalled,
    deferredPrompt,
    setDeferredPrompt,
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
