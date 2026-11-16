import { ShieldCheck, Clock3, Leaf } from 'lucide-react'
import FreshSpinLogo, { FreshSpinWordmark } from './FreshSpinLogo'

const BENEFITS = [
  { icon: ShieldCheck, title: 'Safe & Clean', text: 'Laundry Service' },
  { icon: Clock3, title: 'Fast & On Time', text: 'Service' },
  { icon: Leaf, title: 'Fresh Scent', text: 'Every Time' },
]

/** FreshSpin's full-height laundry hero shared by the login and recovery screens. */
export default function LoginBranding() {
  return (
    <aside className="relative hidden min-h-0 overflow-hidden md:flex md:flex-col">
      <img
        src="/images/freshspin-login-bg.jpg"
        alt="Fresh, neatly folded white laundry towels"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-white/75 via-brand-tint/45 to-navy/15" />

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="auth-bubble animate-float-slow left-[12%] top-[24%] h-9 w-9" />
        <span className="auth-bubble animate-float-slow left-[78%] top-[16%] h-6 w-6" style={{ animationDelay: '700ms' }} />
        <span className="auth-bubble animate-float-slow left-[88%] top-[54%] h-12 w-12" style={{ animationDelay: '300ms' }} />
        <span className="auth-bubble animate-float-slow left-[7%] top-[69%] h-14 w-14" style={{ animationDelay: '700ms' }} />
        <span className="auth-bubble animate-float-slow left-[58%] top-[78%] h-7 w-7" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-between p-7 lg:p-12 xl:p-16">
        <div className="flex items-center gap-3">
          <FreshSpinLogo size={52} />
          <FreshSpinWordmark />
        </div>

        <div className="my-8 max-w-2xl lg:my-0">
          <h1 className="text-[clamp(34px,4.2vw,58px)] font-extrabold leading-[1.03] tracking-tight text-navy">
            <span className="block">Clean Clothes,</span>
            <span className="block text-brand-light">Happier Days</span>
          </h1>
          <p className="mt-5 max-w-md text-sm font-medium leading-7 text-navy/90 sm:text-base">
            We take care of your laundry,
            <br className="hidden xl:block" /> so you can focus on what matters most.
          </p>

            <div className="mt-7 grid grid-cols-1 gap-3 lg:mt-8 lg:grid-cols-3 lg:gap-0">
            {BENEFITS.map(({ icon: Icon, title, text }, index) => (
              <div key={title} className="flex items-center gap-3 xl:pr-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/80 bg-white/90 shadow-card backdrop-blur-sm">
                  <Icon className="h-5 w-5 text-[#087BA8]" strokeWidth={2.1} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold text-navy">{title}</span>
                  <span className="block text-xs font-medium text-navy/75">{text}</span>
                </span>
                {index < BENEFITS.length - 1 && (
                  <span aria-hidden="true" className="ml-auto hidden h-10 w-px bg-navy/20 lg:block lg:mr-3 xl:mr-4" />
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-20 text-[11px] font-medium tracking-wide text-navy/75">
          © 2026 FreshSpin Laundry Service. All rights reserved.
        </p>
      </div>

      <svg
        aria-hidden="true"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="pointer-events-none absolute bottom-0 left-0 z-10 h-14 w-full lg:h-20"
      >
        <path d="M0,76 C240,34 480,106 720,72 C960,40 1200,100 1440,66 L1440,120 L0,120 Z" fill="var(--blue)" opacity="0.24" />
        <path d="M0,96 C260,62 520,120 780,96 C1040,72 1240,116 1440,92 L1440,120 L0,120 Z" fill="var(--blue-soft)" opacity="0.72" />
      </svg>
    </aside>
  )
}
