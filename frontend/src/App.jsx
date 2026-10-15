import { useState, useEffect } from 'react'
import { SiteHeader } from './components/layout/SiteHeader'
import { SiteFooter } from './components/layout/SiteFooter'
import { HomePage } from './pages/HomePage'
import { FiturPage } from './pages/FiturPage'
import { TentangKamiPage } from './pages/TentangKamiPage'
import { ScanPage } from './pages/ScanPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ErrorPage } from './components/ErrorPage'
import { AdminPage } from './pages/admin/AdminPage'
import { ValidatorsPage } from './pages/admin/ValidatorsPage'
import { SppgPage } from './pages/admin/SppgPage'
import { DeliveriesPage } from './pages/admin/DeliveriesPage'
import { AttendancePage } from './pages/admin/AttendancePage'
import { SchoolsPage } from './pages/admin/SchoolsPage'
import { SchedulePage } from './pages/admin/SchedulePage'
import { NoticesPage } from './pages/admin/NoticesPage'
import { CalendarPage } from './pages/admin/CalendarPage'
import { ReportsPage } from './pages/admin/ReportsPage'
import { FeedbackPage } from './pages/admin/FeedbackPage'
import { SppgDashboardPage } from './pages/sppg/SppgDashboardPage'
import { SppgRecipesPage } from './pages/sppg/SppgRecipesPage'
import { SppgBatchesPage } from './pages/sppg/SppgBatchesPage'
import { SppgQualityPage } from './pages/sppg/SppgQualityPage'
import { SppgLogisticsPage } from './pages/sppg/SppgLogisticsPage'
import { SppgSchoolsPage } from './pages/sppg/SppgSchoolsPage'
import { SppgHandoverPage } from './pages/sppg/SppgHandoverPage'
import { SppgIncidentsPage } from './pages/sppg/SppgIncidentsPage'
import { SppgCompliancePage } from './pages/sppg/SppgCompliancePage'
import { ValidatorDashboardPage } from './pages/validator/ValidatorDashboardPage'
import { ValidatorHandoverPage } from './pages/validator/ValidatorHandoverPage'
import { ValidatorIncidentsPage } from './pages/validator/ValidatorIncidentsPage'
import { ValidatorHistoryPage } from './pages/validator/ValidatorHistoryPage'
import { ValidatorFoodScanPage } from './pages/validator/ValidatorFoodScanPage'
import { ValidatorSettingsPage } from './pages/validator/ValidatorSettingsPage'
import { KomunitasPage } from './pages/validator/KomunitasPage'
import { KomunitasDetailPage } from './pages/validator/KomunitasDetailPage'
import { RequireRole } from './components/RequireRole'
import { RedirectIfAuthed } from './components/RedirectIfAuthed'
import { useAuth } from './context/AuthContext'
import { homeForRole } from './lib/api'

function DashboardGuard() {
  const { user } = useAuth()
  useEffect(() => {
    if (user?.role) {
      navigate(homeForRole(user.role))
    }
  }, [user])
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <p className="font-mono text-[11px] uppercase tracking-widest text-slate-400">
        Mengalihkan ke dasbor…
      </p>
    </div>
  )
}

// Helper for programmatic navigation
export function navigate(to) {
  if (!to) return
  if (to.startsWith('http://') || to.startsWith('https://')) {
    window.location.href = to
    return
  }
  const clean = to.replace(/^#\/?/, '/').replace(/^\/#/, '') || '/'
  const target = clean.startsWith('/') ? clean : '/' + clean
  window.history.pushState(null, '', target)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function getCleanPath() {
  // If user visits with legacy hash (e.g. /#/login or #/login), convert immediately to /login
  if (window.location.hash && window.location.hash.startsWith('#/')) {
    const fromHash = window.location.hash.replace(/^#/, '')
    window.history.replaceState(null, '', fromHash)
    return fromHash.split('?')[0].split('#')[0] || '/'
  }
  let path = window.location.pathname.split('?')[0].split('#')[0] || '/'
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1)
  }
  return path
}

function getErrorCode(path) {
  const prefixed = path.match(/^\/error\/(\d{3})$/)
  if (prefixed) return Number(prefixed[1])
  const bare = path.match(/^\/(400|401|403|404|500|503)$/)
  if (bare) return Number(bare[1])
  if (path === '/error') return 500
  return null
}

function usePath() {
  const [path, setPath] = useState(getCleanPath)

  useEffect(() => {
    const handlePop = () => setPath(getCleanPath())
    window.addEventListener('popstate', handlePop)

    // Handle seamless SPA anchor clicks for clean URLs
    const handleClick = (e) => {
      const anchor = e.target.closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      // If anchor has hash only on same page like href="#kontak", let native scroll handle it
      if (href && href.startsWith('#') && !href.startsWith('#/')) return

      if (
        anchor.href &&
        anchor.origin === window.location.origin &&
        !anchor.hasAttribute('download') &&
        anchor.target !== '_blank' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey &&
        !e.defaultPrevented
      ) {
        e.preventDefault()
        const url = new URL(anchor.href)
        navigate(url.pathname + url.search + url.hash)
      }
    }

    document.addEventListener('click', handleClick)
    return () => {
      window.removeEventListener('popstate', handlePop)
      document.removeEventListener('click', handleClick)
    }
  }, [])

  return path
}

function PublicPage({ path }) {
  if (path === '/' || path === '/home') return <HomePage />
  if (path === '/fitur') return <FiturPage />
  if (path === '/tentang-kami' || path === '/tentang' || path === '/mulai') return <TentangKamiPage />
  if (path === '/scan')
    return (
      <RequireRole roles={['validator']}>
        <ScanPage />
      </RequireRole>
    )

  return <NotFoundPage path={path} />
}

export default function App() {
  const path = usePath()

  const errorCode = getErrorCode(path)
  if (errorCode) {
    return <ErrorPage code={errorCode} path={path} />
  }

  // Full-screen isolated admin dashboard (no public header/footer)
  // Superadmin portal.
  if (path.startsWith('/admin')) {
    return (
      <RequireRole roles={['superadmin']}>
        {path === '/admin' ? (
          <AdminPage route={path} />
        ) : path === '/admin/validators' ? (
          <ValidatorsPage />
        ) : path === '/admin/sppg' ? (
          <SppgPage />
        ) : path === '/admin/deliveries' ? (
          <DeliveriesPage />
        ) : path === '/admin/attendance' ? (
          <AttendancePage />
        ) : path === '/admin/schools' ? (
          <SchoolsPage />
        ) : path === '/admin/schedule' ? (
          <SchedulePage />
        ) : path === '/admin/notices' ? (
          <NoticesPage />
        ) : path === '/admin/calendar' ? (
          <CalendarPage />
        ) : path === '/admin/reports' ? (
          <ReportsPage />
        ) : path === '/admin/feedback' ? (
          <FeedbackPage />
        ) : (
          <AdminPage route={path} />
        )}
      </RequireRole>
    )
  }

  // Full-screen isolated SPPG kitchen cockpit (no public header/footer, completely decoupled from /admin/*)
  // SPPG portal — hanya role sppg.
  if (path.startsWith('/sppg')) {
    return (
      <RequireRole roles={['sppg']}>
        {path === '/sppg/recipes' ? (
          <SppgRecipesPage />
        ) : path === '/sppg/batches' ? (
          <SppgBatchesPage />
        ) : path === '/sppg/quality' ? (
          <SppgQualityPage />
        ) : path === '/sppg/logistics' ? (
          <SppgLogisticsPage />
        ) : path === '/sppg/schools' ? (
          <SppgSchoolsPage />
        ) : path === '/sppg/handover' ? (
          <SppgHandoverPage />
        ) : path === '/sppg/incidents' ? (
          <SppgIncidentsPage />
        ) : path === '/sppg/compliance' ? (
          <SppgCompliancePage />
        ) : (
          <SppgDashboardPage />
        )}
      </RequireRole>
    )
  }

  // Full-screen isolated validator portal (guru & staf sekolah — validator lapangan)
  // Hanya role validator; role lain dialihkan ke dasbor miliknya.
  if (path === '/validator' || path.startsWith('/validator/')) {
    const validatorDetailMatch = path.match(/^\/validator\/(?:komunitas|community)\/([^/]+)$/)
    if (validatorDetailMatch) {
      return (
        <RequireRole roles={['validator']}>
          <KomunitasDetailPage postId={validatorDetailMatch[1]} />
        </RequireRole>
      )
    }

    return (
      <RequireRole roles={['validator', 'superadmin', 'sppg']}>
        {path === '/validator/scan' || path === '/validator/foodscan' ? (
          <ValidatorFoodScanPage />
        ) : path === '/validator/handover' ? (
          <ValidatorHandoverPage />
        ) : path === '/validator/komunitas' || path === '/validator/community' ? (
          <KomunitasPage />
        ) : path === '/validator/incidents' ? (
          <ValidatorIncidentsPage />
        ) : path === '/validator/history' ? (
          <ValidatorHistoryPage />
        ) : path === '/validator/settings' || path === '/validator/profile' || path === '/validator/pengaturan' ? (
          <ValidatorSettingsPage />
        ) : (
          <ValidatorDashboardPage />
        )}
      </RequireRole>
    )
  }

  // Full-screen protected /dashboard route (guards and redirects to role home or /login)
  if (path === '/dashboard') {
    return (
      <RequireRole roles={['superadmin', 'sppg', 'validator']}>
        <DashboardGuard />
      </RequireRole>
    )
  }

  // Mobile / PWA dashboard sub-routes (Beranda, Skrining, Riwayat, Komunitas, Pengaturan)
  if (path.startsWith('/dashboard/')) {
    const detailMatch = path.match(/^\/dashboard\/(?:komunitas|community)\/([^/]+)$/)
    if (detailMatch) {
      return (
        <RequireRole roles={['validator', 'superadmin', 'sppg']}>
          <KomunitasDetailPage postId={detailMatch[1]} />
        </RequireRole>
      )
    }

    return (
      <RequireRole roles={['validator', 'superadmin', 'sppg']}>
        {path === '/dashboard/skrining' || path === '/dashboard/scan' ? (
          <ValidatorFoodScanPage />
        ) : path === '/dashboard/riwayat' || path === '/dashboard/history' ? (
          <ValidatorHistoryPage />
        ) : path === '/dashboard/komunitas' || path === '/dashboard/community' ? (
          <KomunitasPage />
        ) : path === '/dashboard/incidents' ? (
          <ValidatorIncidentsPage />
        ) : path === '/dashboard/handover' ? (
          <ValidatorHandoverPage />
        ) : path === '/dashboard/pengaturan' || path === '/dashboard/profil' || path === '/dashboard/settings' ? (
          <ValidatorSettingsPage />
        ) : (
          <ValidatorDashboardPage />
        )}
      </RequireRole>
    )
  }

  // Full-screen isolated auth pages
  if (path === '/login' || path === '/signin' || path === '/auth/signin') {
    return (
      <RedirectIfAuthed>
        <LoginPage />
      </RedirectIfAuthed>
    )
  }
  if (
    path === '/register' ||
    path === '/signup' ||
    path === '/auth/signup' ||
    path === '/auth/register'
  ) {
    return (
      <RedirectIfAuthed>
        <RegisterPage />
      </RedirectIfAuthed>
    )
  }

  // Full-screen 404 page (no header/footer) if route is invalid/unknown
  const isKnownRoute =
    path === '/' ||
    path === '/home' ||
    path === '/fitur' ||
    path === '/tentang-kami' ||
    path === '/tentang' ||
    path === '/mulai' ||
    path === '/scan' ||
    path === '/dashboard'

  if (!isKnownRoute) {
    return <NotFoundPage path={path} />
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col justify-between selection:bg-gray-900 selection:text-white">
      <SiteHeader path={path} />
      <main className="flex-1">
        <PublicPage path={path} />
      </main>
      <SiteFooter />
    </div>
  )
}
