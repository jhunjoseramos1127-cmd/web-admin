import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LoginBranding from './auth/LoginBranding'
import LoginForm from './auth/LoginForm'

/**
 * GET /login — split-screen admin login.
 * Left: branding panel (desktop only). Right: white login card.
 * Auth logic lives in LoginForm + AuthContext; route + guards unchanged.
 */
export default function LoginPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-tint">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-navy" />
      </div>
    )
  }

  // If already authenticated, go straight to dashboard
  if (user) return <Navigate to="/" replace />

  return (
    <main className="auth-screen grid min-h-[100dvh] w-full grid-cols-1 bg-white md:h-[100dvh] md:grid-cols-[42fr_58fr] lg:grid-cols-[58fr_42fr]">
      <LoginBranding />

      <section className="auth-login-panel relative flex min-h-[100dvh] items-center justify-center overflow-x-hidden px-4 py-6 sm:px-8 md:min-h-0 md:overflow-y-auto lg:px-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="absolute -right-24 -top-24 h-[min(38vw,420px)] w-[min(38vw,420px)] rounded-full bg-brand-soft/60" />
          <span className="absolute -bottom-32 -left-28 h-80 w-[min(34vw,380px)] rotate-[-18deg] rounded-[48%] bg-brand-tint" />
          <span className="absolute -bottom-32 -right-24 h-72 w-72 rounded-full bg-brand-soft/40" />
          <span className="absolute right-[18%] top-[52%] h-4 w-4 rounded-full bg-brand-light/30 blur-[1px]" />
        </div>
        <div className="relative z-10 flex w-full justify-center">
          <LoginForm />
        </div>
      </section>
    </main>
  )
}
