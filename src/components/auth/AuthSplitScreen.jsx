import { Outlet, useLocation } from 'react-router-dom'
import LoginBranding from './LoginBranding'

export default function AuthSplitScreen() {
  const isForgotPassword = useLocation().pathname === '/forgot-password'

  const heroPosition = isForgotPassword ? 'lg:translate-x-full' : 'lg:translate-x-0'
  const formPosition = isForgotPassword ? 'lg:translate-x-0' : 'lg:translate-x-full'

  return (
    <main className="auth-screen relative flex min-h-screen w-full flex-col overflow-x-hidden bg-[#F8FAFC] lg:block lg:h-screen lg:min-h-[560px] lg:overflow-hidden">
      <div
        className={`relative z-10 h-full min-h-screen w-full transition-transform duration-500 ease-in-out motion-reduce:transition-none lg:absolute lg:inset-y-0 lg:left-0 lg:min-h-0 lg:w-1/2 lg:will-change-transform ${heroPosition}`}
      >
        <LoginBranding mobileStack />
      </div>

      <section
        className={`auth-login-panel relative z-20 flex min-h-[100dvh] w-full items-center justify-center overflow-x-hidden bg-[#F8FAFC] px-5 py-8 transition-transform duration-500 ease-in-out motion-reduce:transition-none sm:px-8 lg:absolute lg:inset-y-0 lg:left-0 lg:min-h-0 lg:w-1/2 lg:overflow-y-auto lg:px-10 lg:py-5 lg:will-change-transform ${formPosition}`}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="absolute -right-24 -top-24 h-[min(38vw,420px)] w-[min(38vw,420px)] rounded-full bg-[#E0F7FA]/70" />
          <span className="absolute -bottom-32 -left-28 h-80 w-[min(34vw,380px)] rotate-[-18deg] rounded-[48%] bg-[#F0F9FF]" />
          <span className="absolute -bottom-32 -right-24 h-72 w-72 rounded-full bg-[#E0F7FA]/40" />
        </div>
        <div className="relative z-10 flex w-full justify-center">
          <Outlet />
        </div>
      </section>
    </main>
  )
}
