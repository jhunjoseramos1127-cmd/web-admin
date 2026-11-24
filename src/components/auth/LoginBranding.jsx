import { Clock3, Leaf, ShieldCheck } from 'lucide-react'
import FreshSpinLogo, { FreshSpinWordmark } from './FreshSpinLogo'

const BENEFITS = [
  { icon: ShieldCheck, title: 'Safe & Clean Laundry Service' },
  { icon: Clock3, title: 'Fast & On Time Service' },
  { icon: Leaf, title: 'Fresh Scent Every Time' },
]

export default function LoginBranding({ mobileStack = false }) {
  const layoutClass = mobileStack
    ? 'flex h-full min-h-screen w-full md:flex-col'
    : 'hidden h-full min-h-0 w-full md:flex md:flex-col'

  return (
    <aside className={`relative ${layoutClass} overflow-hidden`}>
      <img
        src="/images/freshspin-login-bg.jpg"
        alt="Fresh, neatly folded white laundry towels"
        className="absolute inset-0 block h-full w-full object-cover object-center"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-[#0A4D68]/90 via-[#0A4D68]/80 to-[#088395]/85"
      />

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="auth-bubble animate-float-slow left-[12%] top-[24%] h-9 w-9" />
        <span className="auth-bubble animate-float-slow left-[78%] top-[16%] h-6 w-6" style={{ animationDelay: '700ms' }} />
        <span className="auth-bubble animate-float-slow left-[88%] top-[54%] h-12 w-12" style={{ animationDelay: '300ms' }} />
        <span className="auth-bubble animate-float-slow left-[7%] top-[69%] h-14 w-14" style={{ animationDelay: '700ms' }} />
        <span className="auth-bubble animate-float-slow left-[58%] top-[78%] h-7 w-7" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-between p-6 sm:p-8 md:p-7 lg:p-12 xl:p-16">
        <div className="flex items-center gap-3">
          <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-white p-1 shadow-[0_8px_24px_rgba(8,131,149,0.28)]">
            <FreshSpinLogo size={52} />
          </span>
          <FreshSpinWordmark tone="light" />
        </div>

        <div className="my-8 max-w-2xl lg:my-0">
          <h1 className="text-[clamp(34px,4.2vw,58px)] font-extrabold leading-[1.03] tracking-tight text-white">
            <span className="block">Clean Clothes,</span>
            <span className="block text-[#B7F1F2]">Happier Days</span>
          </h1>
          <p className="mt-5 max-w-md text-sm font-medium leading-7 text-white/90 sm:text-base">
            We take care of your laundry,
            <br className="hidden xl:block" /> so you can focus on what matters most.
          </p>

          <div className="mt-7 grid grid-cols-1 gap-3 lg:mt-8 lg:grid-cols-3 lg:gap-4">
            {BENEFITS.map(({ icon: Icon, title }) => (
              <div key={title} className="flex items-center gap-3 lg:items-start">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/95 shadow-[0_6px_18px_rgba(10,77,104,0.18)]">
                  <Icon className="h-5 w-5 text-[#0A4D68]" strokeWidth={2.1} />
                </span>
                <span className="max-w-[180px] text-[13px] font-semibold leading-5 text-white">
                  {title}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-20 mt-8 text-[11px] font-medium tracking-wide text-white/75">
          &copy; 2026 FreshSpin Laundry Service. All rights reserved.
        </p>
      </div>

    </aside>
  )
}
